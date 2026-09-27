// Shared across every page. Handles the login token and talks to the backend.
const API = (() => {
  const TOKEN_KEY = "sar_token";

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }
  function setToken(t) {
    localStorage.setItem(TOKEN_KEY, t);
  }
  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  }

  function requireLogin() {
    if (!getToken()) window.location.href = "/login.html";
  }

  async function request(path, opts = {}) {
    const headers = Object.assign(
      { "Content-Type": "application/json" },
      opts.headers || {},
      getToken() ? { Authorization: `Bearer ${getToken()}` } : {}
    );
    const res = await fetch(path, { ...opts, headers });
    if (res.status === 401) {
      clearToken();
      window.location.href = "/login.html";
      throw new Error("unauthorized");
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `request failed: ${res.status}`);
    }
    return res.json();
  }

  async function login(username, password) {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) throw new Error("Invalid credentials");
    const { token } = await res.json();
    setToken(token);
    return token;
  }

  function connectWS(handlers) {
    const token = getToken();
    if (!token) return null;
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${window.location.host}/ws?token=${encodeURIComponent(token)}`);
    ws.addEventListener("message", (evt) => {
      let msg;
      try {
        msg = JSON.parse(evt.data);
      } catch {
        return;
      }
      const handler = handlers[msg.type];
      if (handler) handler(msg.data, msg.ts);
    });
    ws.addEventListener("close", () => {
      // Reconnect after a moment - the dashboard should never just go silent.
      setTimeout(() => connectWS(handlers), 3000);
    });
    return ws;
  }

  return { getToken, setToken, clearToken, requireLogin, get: (p) => request(p), post: (p, b) => request(p, { method: "POST", body: JSON.stringify(b) }), login, connectWS };
})();
