API.requireLogin();
renderShell("/mark-area.html");

const DRONE_COLORS = ["#4edea3", "#a78bfa", "#38bdf8", "#fb923c", "#fb7185", "#facc15", "#34d399", "#f472b6"];

const map = L.map("map").setView([34.0522, -118.2437], 13);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

const drawControl = new L.Control.Draw({
  edit: { featureGroup: drawnItems, remove: false },
  draw: {
    polygon: { allowIntersection: false, shapeOptions: { color: "#14b8a6" } },
    rectangle: { shapeOptions: { color: "#14b8a6" } },
    polyline: false, circle: false, circlemarker: false, marker: false,
  },
});
map.addControl(drawControl);

let currentPolygonLayer = null;
let routeLayers = [];
let currentMission = null;

map.on(L.Draw.Event.CREATED, (e) => {
  drawnItems.clearLayers();
  routeLayers.forEach((l) => map.removeLayer(l));
  routeLayers = [];
  currentMission = null;
  document.getElementById("deploy-btn").disabled = true;

  currentPolygonLayer = e.layer;
  drawnItems.addLayer(currentPolygonLayer);
  document.getElementById("generate-btn").disabled = false;
  setStatus("Polygon marked. Set parameters and generate a route.");
});

document.getElementById("clear-btn").onclick = () => {
  drawnItems.clearLayers();
  routeLayers.forEach((l) => map.removeLayer(l));
  routeLayers = [];
  currentPolygonLayer = null;
  currentMission = null;
  document.getElementById("generate-btn").disabled = true;
  document.getElementById("deploy-btn").disabled = true;
  setStatus("");
};

function setStatus(text) {
  document.getElementById("status-text").textContent = text;
}

function polygonToLatLon(layer) {
  const latlngs = layer.getLatLngs()[0];
  return latlngs.map((p) => ({ lat: p.lat, lon: p.lng }));
}

document.getElementById("generate-btn").onclick = async () => {
  if (!currentPolygonLayer) return;
  setStatus("Computing coverage paths…");
  const polygon = polygonToLatLon(currentPolygonLayer);
  const payload = {
    name: document.getElementById("mission-name-input").value || undefined,
    polygon,
    numDrones: Number(document.getElementById("num-drones").value),
    altitude: Number(document.getElementById("altitude").value),
    overlapPct: Number(document.getElementById("overlap").value),
    terrain: document.getElementById("terrain").value,
  };
  try {
    const mission = await API.post("/api/mission/plan", payload);
    currentMission = mission;
    routeLayers.forEach((l) => map.removeLayer(l));
    routeLayers = mission.drones.map((d, i) => {
      const line = L.polyline(
        d.waypoints.map((w) => [w.lat, w.lon]),
        { color: DRONE_COLORS[i % DRONE_COLORS.length], weight: 3 }
      ).addTo(map);
      return line;
    });
    document.getElementById("deploy-btn").disabled = false;
    setStatus(`Route generated: ${mission.drones.length} drone path(s), ${mission.drones.reduce((s,d)=>s+d.waypoints.length,0)} total waypoints.`);
  } catch (e) {
    setStatus("Error: " + e.message);
  }
};

document.getElementById("deploy-btn").onclick = async () => {
  if (!currentMission) return;
  try {
    await API.post(`/api/mission/${currentMission.id}/deploy`, {});
    setStatus(`Deployed — mission "${currentMission.name}" is now active. See Home for live data.`);
    document.getElementById("deploy-btn").disabled = true;
  } catch (e) {
    setStatus("Error: " + e.message);
  }
};
