// Stand-in for the real drones' companion computers, until those are wired
// up for real. Run this alongside the server and the dashboard:
//
//   node src/index.js          (terminal 1)
//   node scripts/simulate_drones.js   (terminal 2)
//
// It logs in with the shared credential, then plays back
// data/sample_dataset.json in time order, POSTing each event to whichever
// channel the dataset says it arrived on (/api/ingest/cellular|wifi|radio|lora).
// This is real HTTP traffic hitting the real endpoints - the dashboard has no
// idea it isn't talking to actual drones. A 6x speed-up keeps a demo watchable.
require("dotenv").config();
const fs = require("fs");
const path = require("path");

const BASE_URL = process.env.SIM_BASE_URL || `http://localhost:${process.env.PORT || 4000}`;
const USERNAME = process.env.SAR_USERNAME || "rescueteam";
const PASSWORD = process.env.SAR_PASSWORD || "changeme123";
const SPEEDUP = Number(process.env.SIM_SPEEDUP || 6);

async function login() {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`login failed: ${res.status} ${await res.text()}`);
  const { token } = await res.json();
  return token;
}

async function ingest(token, channel, payload) {
  const res = await fetch(`${BASE_URL}/api/ingest/${channel}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    console.error(`  [!] ${channel} ingest failed (${res.status}):`, await res.text());
  }
}

async function main() {
  const datasetPath = path.join(__dirname, "..", "data", "sample_dataset.json");
  const dataset = JSON.parse(fs.readFileSync(datasetPath, "utf8"));

  console.log(`Logging in to ${BASE_URL} as ${USERNAME}...`);
  const token = await login();
  console.log("Logged in. Starting playback at", SPEEDUP + "x speed.\n");

  // Merge every drone's events into one global timeline, sorted by time.
  const timeline = [];
  for (const d of dataset.drones) {
    for (const e of d.events) timeline.push(e);
  }
  timeline.sort((a, b) => a.atMs - b.atMs);

  const t0 = Date.now();
  for (const evt of timeline) {
    const targetElapsed = evt.atMs / SPEEDUP;
    const wait = t0 + targetElapsed - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));

    const payload = { ...evt.payload, ts: Date.now() };
    await ingest(token, evt.channel, payload);
    console.log(
      `[${new Date().toLocaleTimeString()}] ${payload.droneId} -> ${evt.channel.toUpperCase().padEnd(8)} ${evt.kind}` +
        (evt.kind === "detection" ? `  ⚠ ${payload.detectionKind}` : "") +
        (evt.kind === "lora" && payload.textKind !== "status" ? `  ⚠ ${payload.textKind}: ${payload.text}` : "")
    );
  }

  console.log("\nPlayback complete. Re-run this script to loop the mission again.");
}

main().catch((e) => {
  console.error("Simulator error:", e.message);
  process.exit(1);
});
