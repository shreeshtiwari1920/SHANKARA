const express = require("express");
const store = require("../store");
const { channelStatusForDrone } = require("../channels");

const router = express.Router();

router.get("/drones", (req, res) => {
  const drones = store.getAllDrones().map((d) => ({
    ...d,
    status: channelStatusForDrone(d),
  }));
  res.json(drones);
});

router.get("/drones/:id/telemetry", (req, res) => {
  const limit = Number(req.query.limit) || 200;
  res.json(store.getTelemetry(req.params.id, limit));
});

router.get("/detections", (req, res) => {
  res.json(store.getDetections(200));
});

router.get("/images", (req, res) => {
  const { droneId, kind } = req.query;
  res.json(store.getImages({ droneId, kind }, 200));
});

router.get("/lora", (req, res) => {
  res.json(store.getLora(300));
});

module.exports = router;
