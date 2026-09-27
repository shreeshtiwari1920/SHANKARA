// =============================================================================
// This is where data actually enters the system from the drones.
//
// Each drone's companion computer picks ONE of these endpoints depending on
// which link is currently up (see channels.js for the priority logic that the
// DASHBOARD uses to interpret what it's hearing - the drone side decides which
// link to transmit on; the endpoint below just records which channel a given
// message arrived over).
//
//   POST /api/ingest/cellular   (5G/4G - 1st priority, full bandwidth)
//   POST /api/ingest/wifi       (2nd priority)
//   POST /api/ingest/radio      (COFDM/RF - 3rd priority)
//   POST /api/ingest/lora       (always-on, text-only fallback)
//
// Body (same shape on every channel - "kind" says what's inside):
//   {
//     "droneId": "drone-1",
//     "ts": 1735300000000,               // unix ms, set by the companion computer
//     "kind": "telemetry" | "detection" | "image" | "lora",
//     "lat": 34.0522, "lon": -118.2437,   // most kinds carry a position
//     ... kind-specific fields, see interfaces.md ...
//   }
//
// No API key needed beyond the shared bearer token below - real deployments
// should put a per-drone pre-shared key on this endpoint instead/in addition.
// =============================================================================

const express = require("express");
const { v4: uuid } = require("uuid");
const store = require("../store");
const { broadcast } = require("../ws");
const { channelStatusForDrone } = require("../channels");

const router = express.Router();
const VALID_CHANNELS = ["cellular", "wifi", "radio", "lora"];

router.post("/:channel", (req, res) => {
  const { channel } = req.params;
  if (!VALID_CHANNELS.includes(channel)) {
    return res.status(400).json({ error: `unknown channel '${channel}'`, valid: VALID_CHANNELS });
  }

  const body = req.body || {};
  const { droneId, kind } = body;
  const ts = Number(body.ts) || Date.now();

  if (!droneId || !kind) {
    return res.status(400).json({ error: "droneId and kind are required" });
  }

  store.markChannelSeen(droneId, channel, ts);

  switch (kind) {
    case "telemetry": {
      const point = {
        ts,
        lat: body.lat,
        lon: body.lon,
        alt: body.alt,
        heading: body.heading,
        speed: body.speed,
        battery: body.battery,
        channel,
      };
      store.addTelemetry(droneId, point);
      broadcast("telemetry_update", { droneId, point });
      break;
    }
    case "detection": {
      const det = {
        id: body.id || uuid(),
        droneId,
        ts,
        lat: body.lat,
        lon: body.lon,
        kind: body.detectionKind || "unknown", // e.g. "human", "hazard-fire", "structural-collapse"
        confidence: body.confidence,
        note: body.note || "",
        channel,
      };
      store.addDetection(det);
      broadcast("detection_new", det);
      break;
    }
    case "image": {
      const img = {
        id: body.id || uuid(),
        droneId,
        ts,
        lat: body.lat,
        lon: body.lon,
        kind: body.imageKind === "thermal" ? "thermal" : "color",
        url: body.url, // data URI or a URL the companion computer/uplink exposes
        channel,
      };
      store.addImage(img);
      broadcast("image_new", img);
      break;
    }
    case "lora": {
      const msg = {
        id: body.id || uuid(),
        droneId,
        ts,
        lat: body.lat,
        lon: body.lon,
        kind: body.textKind || "status", // "human-presence" | "hazard" | "status"
        text: body.text || "",
        channel: "lora",
      };
      store.addLora(msg);
      broadcast("lora_new", msg);
      break;
    }
    default:
      return res.status(400).json({ error: `unknown kind '${kind}'` });
  }

  const drone = store.getDrone(droneId);
  broadcast("drone_status", channelStatusForDrone(drone));

  res.json({ ok: true });
});

module.exports = router;
