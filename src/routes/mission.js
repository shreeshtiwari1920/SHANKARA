const express = require("express");
const { v4: uuid } = require("uuid");
const store = require("../store");
const { generateCoveragePaths } = require("../routeplanner");
const { broadcast } = require("../ws");

const router = express.Router();

// POST /api/mission/plan
// { polygon: [{lat,lon}, ...], numDrones, altitude, overlapPct, terrain }
// -> { missionId, drones: [{droneId, waypoints}] }
router.post("/plan", (req, res) => {
  const { polygon, numDrones, altitude, overlapPct, terrain, name } = req.body || {};
  if (!Array.isArray(polygon) || polygon.length < 3) {
    return res.status(400).json({ error: "polygon (>=3 points) is required" });
  }
  try {
    const drones = generateCoveragePaths(polygon, numDrones, altitude, overlapPct);
    const mission = {
      id: uuid(),
      name: name || `Mission ${new Date().toISOString()}`,
      createdAt: Date.now(),
      polygon,
      params: { numDrones, altitude, overlapPct, terrain },
      drones,
      status: "planned",
    };
    // Not persisted as "current" until /deploy is called, but we keep it so
    // the frontend can re-fetch it (e.g. after a refresh) before deploying.
    store.createMission(mission);
    res.json(mission);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// POST /api/mission/:id/deploy - marks the mission active and broadcasts it
router.post("/:id/deploy", (req, res) => {
  const mission = store.getCurrentMission();
  if (!mission || mission.id !== req.params.id) {
    return res.status(404).json({ error: "mission not found" });
  }
  const updated = store.updateMissionStatus(mission.id, { status: "active", deployedAt: Date.now() });
  for (const d of mission.drones) {
    store.upsertDrone(d.droneId, { name: d.droneId, waypoints: d.waypoints });
  }
  broadcast("mission_deployed", updated);
  res.json(updated);
});

router.get("/current", (req, res) => {
  res.json(store.getCurrentMission());
});

module.exports = router;
