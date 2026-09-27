const { WebSocketServer } = require("ws");
const { verifyToken } = require("./auth");
const url = require("url");

let wss = null;

function initWebSocket(server) {
  wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const { pathname, query } = url.parse(req.url, true);
    if (pathname !== "/ws") {
      socket.destroy();
      return;
    }
    const token = query.token;
    const payload = token && verifyToken(token);
    if (!payload) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (ws) => {
    ws.isAlive = true;
    ws.on("pong", () => (ws.isAlive = true));
    ws.send(JSON.stringify({ type: "hello", ts: Date.now() }));
  });

  // Drop dead connections (e.g. laptop lid closed mid-mission).
  setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  return wss;
}

// Push an event to every connected dashboard client.
function broadcast(type, data) {
  if (!wss) return;
  const msg = JSON.stringify({ type, data, ts: Date.now() });
  wss.clients.forEach((ws) => {
    if (ws.readyState === 1) ws.send(msg);
  });
}

module.exports = { initWebSocket, broadcast };
