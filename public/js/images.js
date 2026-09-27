API.requireLogin();
renderShell("/images.html");

async function load() {
  const droneId = document.getElementById("drone-filter").value;
  const kind = document.getElementById("kind-filter").value;
  const qs = new URLSearchParams();
  if (droneId) qs.set("droneId", droneId);
  if (kind) qs.set("kind", kind);
  const imgs = await API.get(`/api/images?${qs}`);
  renderGallery(imgs);
}

function renderGallery(imgs) {
  document.getElementById("gallery").innerHTML = imgs
    .map(
      (i) => `<div>
        <img src="${i.url}" title="${i.droneId} · ${i.kind} · ${new Date(i.ts).toLocaleString()}"/>
        <div class="label" style="margin-top:4px;">${i.droneId.toUpperCase()} · ${i.kind} · ${i.lat ? i.lat.toFixed(4) : "—"},${i.lon ? i.lon.toFixed(4) : "—"}</div>
        <div class="label" style="color:var(--text-dim)">${new Date(i.ts).toLocaleTimeString()}</div>
      </div>`
    )
    .join("");
}

(async function init() {
  const drones = await API.get("/api/drones").catch(() => []);
  document.getElementById("drone-filter").innerHTML +=
    drones.map((d) => `<option value="${d.id}">${d.id.toUpperCase()}</option>`).join("");
  document.getElementById("drone-filter").onchange = load;
  document.getElementById("kind-filter").onchange = load;
  await load();
  API.connectWS({ image_new: () => load() });
})();
