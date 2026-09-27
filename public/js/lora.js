API.requireLogin();
renderShell("/lora.html");

function rowHtml(m) {
  const critical = m.kind === "human-presence" || m.kind === "hazard";
  return `<tr class="${critical ? "critical" : ""}">
    <td class="mono">${new Date(m.ts).toLocaleTimeString()}</td>
    <td>${m.droneId.toUpperCase()}</td>
    <td>${m.kind}</td>
    <td class="mono">${m.lat ? m.lat.toFixed(4) : "—"}, ${m.lon ? m.lon.toFixed(4) : "—"}</td>
    <td>${m.text}</td>
  </tr>`;
}

async function load() {
  const msgs = await API.get("/api/lora");
  document.getElementById("lora-body").innerHTML = msgs.map(rowHtml).join("");
}

function prepend(m) {
  document.getElementById("lora-body").insertAdjacentHTML("afterbegin", rowHtml(m));
}

(async function init() {
  await load();
  API.connectWS({ lora_new: prepend });
})();
