const NAV_ITEMS = [
  { path: "/index.html", icon: "grid_view", label: "Home" },
  { path: "/mark-area.html", icon: "polyline", label: "Mark Search Area" },
  { path: "/live-feed.html", icon: "videocam", label: "Live Feed" },
  { path: "/images.html", icon: "photo_library", label: "Images" },
  { path: "/lora.html", icon: "cell_tower", label: "LoRa Text" },
];

const CHANNEL_LABEL = { cellular: "5G/4G", wifi: "WiFi", radio: "Radio", lora: "LoRa" };

function renderShell(activePath) {
  const nav = NAV_ITEMS.map(
    (item) => `
    <a class="nav-item ${item.path === activePath ? "active" : ""}" href="${item.path}">
      <span class="nav-icon material-symbols-outlined">${item.icon}</span>
      <span>${item.label}</span>
    </a>`
  ).join("");

  document.getElementById("app-shell").innerHTML = `
    <header class="topbar">
      <div class="topbar-left">
        <div class="brand">🛰 SAR Mission Control</div>
        <div class="mission-pill"><span class="dot pulse"></span><span id="mission-name">No active mission</span></div>
      </div>
      <div class="link-badges" id="drone-badges"></div>
      <div style="display:flex;align-items:center;gap:10px;">
        <span class="label" id="clock"></span>
        <button class="btn" id="logout-btn">Logout</button>
      </div>
    </header>
    <aside class="sidebar">
      <nav>${nav}</nav>
      <div style="padding:12px;border-top:1px solid var(--border-dim);">
        <div class="label">Rescue Team (shared login)</div>
      </div>
    </aside>
  `;

  document.getElementById("logout-btn").onclick = () => {
    API.clearToken();
    window.location.href = "/login.html";
  };

  setInterval(() => {
    document.getElementById("clock").textContent = new Date().toLocaleTimeString();
  }, 1000);

  refreshMissionAndDrones();
  setInterval(refreshMissionAndDrones, 10000);
}

async function refreshMissionAndDrones() {
  try {
    const mission = await API.get("/api/mission/current");
    document.getElementById("mission-name").textContent = mission
      ? `${mission.name} — ${mission.status.toUpperCase()}`
      : "No active mission";
  } catch (e) { /* not fatal */ }

  try {
    const drones = await API.get("/api/drones");
    renderDroneBadges(drones);
  } catch (e) { /* not fatal */ }
}

function renderDroneBadges(drones) {
  const el = document.getElementById("drone-badges");
  if (!el) return;
  el.innerHTML = drones
    .map((d) => {
      const s = d.status || {};
      const ch = s.activeChannel;
      const color = ch ? `var(--ch-${ch})` : "var(--red)";
      const label = ch ? CHANNEL_LABEL[ch] : "OFFLINE";
      return `<div class="link-badge" style="border-color:${color}">
        <span class="dot" style="background:${color}"></span>
        <span>${d.id}</span>
        <span class="mono" style="color:${color}">${label}</span>
      </div>`;
    })
    .join("");
}
