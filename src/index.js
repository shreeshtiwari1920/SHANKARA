require("dotenv").config();
const express = require("express");
const http = require("http");
const path = require("path");
const cors = require("cors");

const { requireAuth } = require("./auth");
const { initWebSocket } = require("./ws");

const authRoutes = require("./routes/auth");
const missionRoutes = require("./routes/mission");
const ingestRoutes = require("./routes/ingest");
const dataRoutes = require("./routes/data");

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" })); // images may come through as data URIs

// Public
app.use("/api/auth", authRoutes);

// Ingest is protected with the SAME shared token for simplicity in this repo.
// In the field you'd likely give the drones/gateway their own long-lived
// token or pre-shared key instead of the team's login token - see README.
app.use("/api/ingest", requireAuth, ingestRoutes);

// Dashboard-facing, requires login
app.use("/api/mission", requireAuth, missionRoutes);
app.use("/api", requireAuth, dataRoutes);

app.get("/api/health", (req, res) => res.json({ ok: true, ts: Date.now() }));

// Static frontend
app.use(express.static(path.join(__dirname, "..", "public")));

const server = http.createServer(app);
initWebSocket(server);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`SAR dashboard backend listening on http://localhost:${PORT}`);
  console.log(`Login: ${process.env.SAR_USERNAME || "rescueteam"} / ${process.env.SAR_PASSWORD ? "(from .env)" : "changeme123"}`);
});
