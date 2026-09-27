// Persistent store, backed by SQLite (via better-sqlite3 - no external DB
// server to run, just one file: data/sar.db). Every other file in this repo
// only calls the functions exported below, so if this ever needs to become
// Postgres/PostGIS (e.g. for a multi-instance cloud deployment), only this
// file changes.
//
// Rows are capped per collection (see MAX_* below) so the file can't grow
// without bound during a long mission - old rows are pruned automatically.

const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const DATA_DIR = path.join(__dirname, "..", "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_FILE = process.env.SQLITE_PATH || path.join(DATA_DIR, "sar.db");

const db = new Database(DB_FILE);
db.pragma("journal_mode = WAL"); // safe for one writer + concurrent readers, survives crashes

db.exec(`
  CREATE TABLE IF NOT EXISTS drones (
    id TEXT PRIMARY KEY,
    name TEXT,
    last_seen_cellular INTEGER,
    last_seen_wifi INTEGER,
    last_seen_radio INTEGER,
    last_seen_lora INTEGER,
    last_known TEXT,
    waypoints TEXT
  );
  CREATE TABLE IF NOT EXISTS telemetry (
    rowid INTEGER PRIMARY KEY AUTOINCREMENT,
    drone_id TEXT NOT NULL,
    ts INTEGER, lat REAL, lon REAL, alt REAL, heading REAL, speed REAL, battery REAL, channel TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_telemetry_drone ON telemetry(drone_id, rowid);

  CREATE TABLE IF NOT EXISTS detections (
    rowid INTEGER PRIMARY KEY AUTOINCREMENT,
    id TEXT, drone_id TEXT NOT NULL, ts INTEGER, lat REAL, lon REAL,
    kind TEXT, confidence REAL, note TEXT, channel TEXT
  );
  CREATE TABLE IF NOT EXISTS images (
    rowid INTEGER PRIMARY KEY AUTOINCREMENT,
    id TEXT, drone_id TEXT NOT NULL, ts INTEGER, lat REAL, lon REAL,
    kind TEXT, url TEXT, channel TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_images_drone ON images(drone_id, kind, rowid);

  CREATE TABLE IF NOT EXISTS lora (
    rowid INTEGER PRIMARY KEY AUTOINCREMENT,
    id TEXT, drone_id TEXT NOT NULL, ts INTEGER, lat REAL, lon REAL,
    kind TEXT, text TEXT, channel TEXT
  );
  CREATE TABLE IF NOT EXISTS missions (
    id TEXT PRIMARY KEY, name TEXT, created_at INTEGER, deployed_at INTEGER,
    polygon TEXT, params TEXT, drones TEXT, status TEXT
  );
  CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
`);

const MAX_TELEMETRY_PER_DRONE = 500;
const MAX_DETECTIONS = 500;
const MAX_IMAGES = 300;
const MAX_LORA = 500;

function rowToDrone(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    lastSeen: {
      cellular: row.last_seen_cellular || undefined,
      wifi: row.last_seen_wifi || undefined,
      radio: row.last_seen_radio || undefined,
      lora: row.last_seen_lora || undefined,
    },
    lastKnown: row.last_known ? JSON.parse(row.last_known) : {},
    waypoints: row.waypoints ? JSON.parse(row.waypoints) : undefined,
  };
}

function ensureDroneRow(droneId) {
  db.prepare(`INSERT OR IGNORE INTO drones (id, name) VALUES (?, ?)`).run(droneId, droneId);
}

function upsertDrone(droneId, patch = {}) {
  ensureDroneRow(droneId);
  const sets = [];
  const args = [];
  if (patch.name !== undefined) { sets.push("name = ?"); args.push(patch.name); }
  if (patch.lastKnown !== undefined) { sets.push("last_known = ?"); args.push(JSON.stringify(patch.lastKnown)); }
  if (patch.waypoints !== undefined) { sets.push("waypoints = ?"); args.push(JSON.stringify(patch.waypoints)); }
  if (sets.length) {
    args.push(droneId);
    db.prepare(`UPDATE drones SET ${sets.join(", ")} WHERE id = ?`).run(...args);
  }
  return rowToDrone(db.prepare(`SELECT * FROM drones WHERE id = ?`).get(droneId));
}

const CHANNEL_COLUMN = {
  cellular: "last_seen_cellular",
  wifi: "last_seen_wifi",
  radio: "last_seen_radio",
  lora: "last_seen_lora",
};

function markChannelSeen(droneId, channel, ts) {
  ensureDroneRow(droneId);
  const col = CHANNEL_COLUMN[channel];
  if (col) db.prepare(`UPDATE drones SET ${col} = ? WHERE id = ?`).run(ts, droneId);
  return rowToDrone(db.prepare(`SELECT * FROM drones WHERE id = ?`).get(droneId));
}

const insertTelemetry = db.prepare(`
  INSERT INTO telemetry (drone_id, ts, lat, lon, alt, heading, speed, battery, channel)
  VALUES (@droneId, @ts, @lat, @lon, @alt, @heading, @speed, @battery, @channel)
`);
const trimTelemetry = db.prepare(`
  DELETE FROM telemetry WHERE drone_id = ? AND rowid NOT IN (
    SELECT rowid FROM telemetry WHERE drone_id = ? ORDER BY rowid DESC LIMIT ?
  )
`);

function addTelemetry(droneId, point) {
  insertTelemetry.run({ droneId, ...point });
  trimTelemetry.run(droneId, droneId, MAX_TELEMETRY_PER_DRONE);
  upsertDrone(droneId, { lastKnown: point });
}

function getTelemetry(droneId, limit = 200) {
  const rows = db
    .prepare(`SELECT ts, lat, lon, alt, heading, speed, battery, channel FROM telemetry WHERE drone_id = ? ORDER BY rowid DESC LIMIT ?`)
    .all(droneId, limit);
  return rows.reverse(); // chronological order, like the old in-memory array
}

const insertDetection = db.prepare(`
  INSERT INTO detections (id, drone_id, ts, lat, lon, kind, confidence, note, channel)
  VALUES (@id, @droneId, @ts, @lat, @lon, @kind, @confidence, @note, @channel)
`);
function addDetection(det) {
  insertDetection.run(det);
  db.prepare(`DELETE FROM detections WHERE rowid NOT IN (SELECT rowid FROM detections ORDER BY rowid DESC LIMIT ?)`).run(MAX_DETECTIONS);
}
function getDetections(limit = 200) {
  return db.prepare(`SELECT id, drone_id as droneId, ts, lat, lon, kind, confidence, note, channel FROM detections ORDER BY rowid DESC LIMIT ?`).all(limit);
}

const insertImage = db.prepare(`
  INSERT INTO images (id, drone_id, ts, lat, lon, kind, url, channel)
  VALUES (@id, @droneId, @ts, @lat, @lon, @kind, @url, @channel)
`);
function addImage(img) {
  insertImage.run(img);
  db.prepare(`DELETE FROM images WHERE rowid NOT IN (SELECT rowid FROM images ORDER BY rowid DESC LIMIT ?)`).run(MAX_IMAGES);
}
function getImages({ droneId, kind } = {}, limit = 200) {
  const clauses = [];
  const args = [];
  if (droneId) { clauses.push("drone_id = ?"); args.push(droneId); }
  if (kind) { clauses.push("kind = ?"); args.push(kind); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  args.push(limit);
  return db.prepare(`SELECT id, drone_id as droneId, ts, lat, lon, kind, url, channel FROM images ${where} ORDER BY rowid DESC LIMIT ?`).all(...args);
}

const insertLora = db.prepare(`
  INSERT INTO lora (id, drone_id, ts, lat, lon, kind, text, channel)
  VALUES (@id, @droneId, @ts, @lat, @lon, @kind, @text, @channel)
`);
function addLora(msg) {
  insertLora.run(msg);
  db.prepare(`DELETE FROM lora WHERE rowid NOT IN (SELECT rowid FROM lora ORDER BY rowid DESC LIMIT ?)`).run(MAX_LORA);
}
function getLora(limit = 300) {
  return db.prepare(`SELECT id, drone_id as droneId, ts, lat, lon, kind, text, channel FROM lora ORDER BY rowid DESC LIMIT ?`).all(limit);
}

function createMission(mission) {
  db.prepare(`
    INSERT INTO missions (id, name, created_at, deployed_at, polygon, params, drones, status)
    VALUES (@id, @name, @createdAt, @deployedAt, @polygon, @params, @drones, @status)
  `).run({
    id: mission.id,
    name: mission.name,
    createdAt: mission.createdAt,
    deployedAt: mission.deployedAt || null,
    polygon: JSON.stringify(mission.polygon),
    params: JSON.stringify(mission.params),
    drones: JSON.stringify(mission.drones),
    status: mission.status,
  });
  db.prepare(`INSERT INTO meta (key, value) VALUES ('currentMissionId', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(mission.id);
  return mission;
}

function rowToMission(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    deployedAt: row.deployed_at || undefined,
    polygon: JSON.parse(row.polygon),
    params: JSON.parse(row.params),
    drones: JSON.parse(row.drones),
    status: row.status,
  };
}

function getCurrentMission() {
  const metaRow = db.prepare(`SELECT value FROM meta WHERE key = 'currentMissionId'`).get();
  if (!metaRow) return null;
  return rowToMission(db.prepare(`SELECT * FROM missions WHERE id = ?`).get(metaRow.value));
}

// Used by mission.js's /deploy route to update status/deployedAt in place.
function updateMissionStatus(missionId, patch) {
  const sets = [];
  const args = [];
  if (patch.status !== undefined) { sets.push("status = ?"); args.push(patch.status); }
  if (patch.deployedAt !== undefined) { sets.push("deployed_at = ?"); args.push(patch.deployedAt); }
  if (!sets.length) return getCurrentMission();
  args.push(missionId);
  db.prepare(`UPDATE missions SET ${sets.join(", ")} WHERE id = ?`).run(...args);
  return rowToMission(db.prepare(`SELECT * FROM missions WHERE id = ?`).get(missionId));
}

function getAllDrones() {
  return db.prepare(`SELECT * FROM drones`).all().map(rowToDrone);
}

function getDrone(droneId) {
  return rowToDrone(db.prepare(`SELECT * FROM drones WHERE id = ?`).get(droneId));
}

module.exports = {
  upsertDrone,
  markChannelSeen,
  addTelemetry,
  getTelemetry,
  addDetection,
  getDetections,
  addImage,
  getImages,
  addLora,
  getLora,
  createMission,
  updateMissionStatus,
  getCurrentMission,
  getAllDrones,
  getDrone,
};
