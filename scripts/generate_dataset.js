// Builds data/sample_dataset.json: a realistic multi-drone mission the
// simulator plays back against the live ingest endpoints. Re-run with
// `npm run gen-dataset` any time you want a fresh dataset (e.g. more drones,
// a different polygon).
const fs = require("fs");
const path = require("path");
const { generateCoveragePaths } = require("../src/routeplanner");

const POLYGON = [
  { lat: 34.055, lon: -118.252 },
  { lat: 34.055, lon: -118.238 },
  { lat: 34.065, lon: -118.238 },
  { lat: 34.065, lon: -118.252 },
];

const NUM_DRONES = 3;
const mission = generateCoveragePaths(POLYGON, NUM_DRONES, 60, 25);

const CHANNEL_CYCLE = ["cellular", "cellular", "wifi", "cellular", "radio", "cellular"]; // mostly-cellular w/ occasional failover
const DETECTION_KINDS = ["human", "hazard-fire", "structural-collapse"];
const LORA_KINDS = ["status", "human-presence", "hazard"];

function pick(arr, i) {
  return arr[i % arr.length];
}

const dataset = { generatedAt: Date.now(), polygon: POLYGON, drones: [] };

mission.forEach((droneMission, dIdx) => {
  const droneId = droneMission.droneId;
  const waypoints = droneMission.waypoints;
  const events = [];
  let battery = 96;

  waypoints.forEach((wp, i) => {
    const t = i * 4000; // 4s between waypoints
    const channel = pick(CHANNEL_CYCLE, i + dIdx * 2);
    battery = Math.max(18, battery - 0.6);

    events.push({
      atMs: t,
      channel,
      kind: "telemetry",
      payload: {
        droneId, kind: "telemetry",
        lat: wp.lat, lon: wp.lon, alt: wp.alt,
        heading: Math.round((i * 47) % 360),
        speed: +(10 + Math.sin(i / 3) * 3).toFixed(1),
        battery: Math.round(battery),
      },
    });

    // A color still every other waypoint, thermal every third.
    if (i % 2 === 0) {
      events.push({
        atMs: t + 500,
        channel,
        kind: "image",
        payload: {
          droneId, kind: "image", imageKind: "color",
          lat: wp.lat, lon: wp.lon,
          url: `https://picsum.photos/seed/${droneId}-color-${i}/640/480`,
        },
      });
    }
    if (i % 3 === 0) {
      events.push({
        atMs: t + 800,
        channel,
        kind: "image",
        payload: {
          droneId, kind: "image", imageKind: "thermal",
          lat: wp.lat, lon: wp.lon,
          url: `https://picsum.photos/seed/${droneId}-thermal-${i}/640/480?grayscale`,
        },
      });
    }

    // LoRa status heartbeat every waypoint (always-on channel).
    events.push({
      atMs: t + 200,
      channel: "lora",
      kind: "lora",
      payload: {
        droneId, kind: "lora", textKind: "status",
        lat: wp.lat, lon: wp.lon,
        text: `OK batt=${Math.round(battery)}% alt=${wp.alt}m`,
      },
    });

    // Sprinkle a couple of detections + urgent LoRa alerts per drone.
    if (i === Math.floor(waypoints.length / 3)) {
      events.push({
        atMs: t + 300,
        channel,
        kind: "detection",
        payload: {
          droneId, kind: "detection", detectionKind: pick(DETECTION_KINDS, dIdx),
          lat: wp.lat, lon: wp.lon, confidence: 0.87,
          note: "Auto-flagged by onboard detection model",
        },
      });
      events.push({
        atMs: t + 350,
        channel: "lora",
        kind: "lora",
        payload: {
          droneId, kind: "lora", textKind: "human-presence",
          lat: wp.lat, lon: wp.lon,
          text: "Possible survivor detected near ingress point",
        },
      });
    }
  });

  dataset.drones.push({ droneId, events });
});

const outPath = path.join(__dirname, "..", "data", "sample_dataset.json");
fs.writeFileSync(outPath, JSON.stringify(dataset, null, 2));
console.log(`Wrote ${outPath} — ${dataset.drones.map((d) => `${d.droneId}:${d.events.length} events`).join(", ")}`);
