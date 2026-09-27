API.requireLogin();
renderShell("/index.html");

let selectedDrone = localStorage.getItem("sar_selected_drone") || null;
let allDrones = [];
let latestImages = {}; // droneId -> { color: url, thermal: url }
let map, marker, trackLine;

function initMap() {
  map = L.map("route-map", { zoomControl: false, attributionControl: false }).setView([20, 0], 2);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
  marker = L.circleMarker([0, 0], { radius: 6, color: "#4edea3", fillColor: "#4edea3", fillOpacity: 1 });
  trackLine = L.polyline([], { color: "#14b8a6", weight: 2, dashArray: "4,4" });
}

function selectDrone(id) {
  selectedDrone = id;
  localStorage.setItem("sar_selected_drone", id);
  document.getElementById("feed-title").textContent = `Live Feed — ${id.toUpperCase()}`;
  loadSelectedDroneData();
  renderThumbnails();
}

async function loadSelectedDroneData() {
  if (!selectedDrone) return;
  try {
    const tel = await API.get(`/api/drones/${selectedDrone}/telemetry?limit=100`);
    if (tel.length) applyTelemetryToUI(tel[tel.length - 1]);
    if (tel.length && map) {
      trackLine.setLatLngs(tel.filter(p => p.lat && p.lon).map((p) => [p.lat, p.lon])).addTo(map);
      const last = tel[tel.length - 1];
      if (last.lat && last.lon) {
        marker.setLatLng([last.lat, last.lon]).addTo(map);
        map.setView([last.lat, last.lon], 15);
      }
    }
  } catch (e) {}

  try {
    const imgs = await API.get(`/api/images?droneId=${selectedDrone}`);
    const color = imgs.find((i) => i.kind === "color");
    const thermal = imgs.find((i) => i.kind === "thermal");
    if (color) setFeed(color.url, "color-box", "feed-box");
    if (thermal) setFeed(thermal.url, "thermal-box");
  } catch (e) {}
}

function setFeed(url, ...boxIds) {
  for (const id of boxIds) {
    const box = document.getElementById(id);
    if (box) box.innerHTML = `<img src="${url}" alt="frame"/>`;
  }
}

function applyTelemetryToUI(point) {
  document.getElementById("tel-alt").textContent = point.alt != null ? `${point.alt.toFixed(0)} m` : "—";
  document.getElementById("tel-heading").textContent = point.heading != null ? `${point.heading.toFixed(0)}°` : "—";
  document.getElementById("tel-speed").textContent = point.speed != null ? `${point.speed.toFixed(1)} m/s` : "—";
  document.getElementById("tel-battery").textContent = point.battery != null ? `${point.battery.toFixed(0)}%` : "—";
}

function renderThumbnails() {
  const others = allDrones.filter((d) => d.id !== selectedDrone);
  const row = document.getElementById("thumb-row");
  row.innerHTML = others
    .map((d) => {
      const img = (latestImages[d.id] || {}).color;
      const status = d.status || {};
      const ch = status.activeChannel;
      const color = ch ? `var(--ch-${ch})` : "var(--red)";
      return `<div class="thumb" data-drone="${d.id}">
        ${img ? `<img src="${img}"/>` : `<div style="height:96px;background:#000;display:flex;align-items:center;justify-content:center;" class="label">no frame yet</div>`}
        <div class="meta"><span>${d.id.toUpperCase()}</span><span class="mono" style="color:${color}">${ch ? ch.toUpperCase() : "OFFLINE"}</span></div>
      </div>`;
    })
    .join("");
  row.querySelectorAll(".thumb").forEach((el) => {
    el.onclick = () => selectDrone(el.dataset.drone);
  });
}

function updateLoraTicker(msg) {
  const el = document.getElementById("lora-ticker");
  const span = el.querySelector("span:last-child");
  span.textContent = `${msg.droneId.toUpperCase()} · ${msg.kind} · ${msg.text} (${new Date(msg.ts).toLocaleTimeString()})`;
}

async function init() {
  initMap();
  try {
    allDrones = await API.get("/api/drones");
  } catch (e) {
    allDrones = [];
  }
  for (const d of allDrones) {
    try {
      const imgs = await API.get(`/api/images?droneId=${d.id}`);
      latestImages[d.id] = {
        color: (imgs.find((i) => i.kind === "color") || {}).url,
        thermal: (imgs.find((i) => i.kind === "thermal") || {}).url,
      };
    } catch (e) {}
  }

  if (!selectedDrone || !allDrones.find((d) => d.id === selectedDrone)) {
    selectedDrone = allDrones[0] ? allDrones[0].id : null;
  }
  if (selectedDrone) selectDrone(selectedDrone);
  else renderThumbnails();

  try {
    const lora = await API.get("/api/lora");
    if (lora.length) updateLoraTicker(lora[0]);
  } catch (e) {}

  API.connectWS({
    telemetry_update: ({ droneId, point }) => {
      if (droneId === selectedDrone) {
        applyTelemetryToUI(point);
        if (point.lat && point.lon && map) {
          marker.setLatLng([point.lat, point.lon]);
          const latlngs = trackLine.getLatLngs();
          latlngs.push([point.lat, point.lon]);
          trackLine.setLatLngs(latlngs);
        }
      }
    },
    image_new: (img) => {
      if (!latestImages[img.droneId]) latestImages[img.droneId] = {};
      latestImages[img.droneId][img.kind] = img.url;
      if (img.droneId === selectedDrone) {
        if (img.kind === "color") setFeed(img.url, "color-box", "feed-box");
        if (img.kind === "thermal") setFeed(img.url, "thermal-box");
      } else {
        renderThumbnails();
      }
    },
    lora_new: (msg) => updateLoraTicker(msg),
    drone_status: (status) => {
      const d = allDrones.find((x) => x.id === status.droneId);
      if (d) d.status = status;
      renderThumbnails();
    },
    detection_new: (det) => {
      // Surface a quick visual nudge; full list lives on the LoRa/Images pages.
      const badge = document.getElementById("route-badge");
      badge.textContent = `Detection: ${det.kind}`;
      badge.className = "badge badge-red";
    },
  });
}

init();
