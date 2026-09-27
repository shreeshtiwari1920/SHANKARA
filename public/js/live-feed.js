API.requireLogin();
renderShell("/live-feed.html");

let selected = null;
let drones = [];

function renderTabs() {
  document.getElementById("drone-tabs").innerHTML = drones
    .map((d) => `<button class="btn ${d.id === selected ? "primary" : ""}" data-id="${d.id}">${d.id.toUpperCase()}</button>`)
    .join("");
  document.querySelectorAll("#drone-tabs button").forEach((b) => {
    b.onclick = () => selectDrone(b.dataset.id);
  });
}

async function selectDrone(id) {
  selected = id;
  document.getElementById("feed-title").textContent = `Live Feed — ${id.toUpperCase()}`;
  renderTabs();
  try {
    const imgs = await API.get(`/api/images?droneId=${id}&kind=color`);
    if (imgs[0]) setFeed(imgs[0].url);
    else document.getElementById("feed-box").innerHTML = `<div class="label">No frames yet for ${id}</div>`;
  } catch (e) {}
}

function setFeed(url) {
  document.getElementById("feed-box").innerHTML = `<img src="${url}"/>`;
}

document.getElementById("override-btn").onclick = () => {
  alert(
    "This is a UI placeholder. Wire it to a POST to your companion computer's override endpoint (e.g. /api/ingest control-channel or a direct MAVLink command) once that interface is finalized with the drone team."
  );
};

(async function init() {
  drones = await API.get("/api/drones").catch(() => []);
  if (drones.length) selectDrone(drones[0].id);
  API.connectWS({
    image_new: (img) => {
      if (img.droneId === selected && img.kind === "color") setFeed(img.url);
    },
  });
})();
