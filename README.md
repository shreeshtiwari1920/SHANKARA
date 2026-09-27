# SAR Drone Mission Control — Dashboard

This is the dashboard part of the disaster-response autonomous-drone project
(area marking → route generation → live multi-drone monitoring). It's a real
Node/Express + WebSocket backend with a browser frontend — not a mockup. It
receives data over the same 4 channels the drones use, resolves which link is
currently active per drone, and pushes live updates to every connected
dashboard.

## What's in here

```
sar-dashboard/
├── src/                  # backend
│   ├── index.js          # server entry point
│   ├── auth.js           # shared rescue-team login (one username/password)
│   ├── store.js          # SQLite datastore (drones, telemetry, detections, images, lora, missions)
│   ├── channels.js        # 5G/4G > WiFi > Radio priority + LoRa fallback resolution
│   ├── routeplanner.js    # coverage-path (lawnmower) generator for "Mark Search Area"
│   ├── ws.js              # WebSocket hub (auth + broadcast)
│   └── routes/            # auth / mission / ingest / data endpoints
├── public/                # frontend (login, Home, Mark Search Area, Live Feed, Images, LoRa Text)
├── data/
│   ├── sar.db             # SQLite database (created on first run, gitignored)
│   └── sample_dataset.json   # generated test dataset (3 drones, full mission)
├── scripts/
│   ├── generate_dataset.js   # (re)generates the sample dataset
│   └── simulate_drones.js    # plays the dataset into the real ingest endpoints
├── Dockerfile              # for cloud deployment
├── DEPLOYMENT.md           # local (command post) + cloud deploy steps
├── .env.example
└── package.json
```

## Running it

```bash
cd sar-dashboard
npm install
cp .env.example .env      # edit SAR_USERNAME / SAR_PASSWORD / JWT_SECRET if you want
npm start                 # starts the server on http://localhost:4000
```

Open `http://localhost:4000` and log in with the shared credential from
`.env` (default: `rescueteam` / `changeme123`).

### Checking it's actually working (no real drones needed yet)

In a second terminal, with the server still running:

```bash
node scripts/simulate_drones.js
```

This logs in with the same shared credential and POSTs a realistic 3-drone
mission (telemetry, color/thermal stills, detections, LoRa messages) into the
**real** ingest endpoints, switching between cellular/WiFi/radio/LoRa exactly
like a real companion computer would. Watch the dashboard update live — drone
badges change channel/color, the map track grows, images swap in, LoRa
messages scroll. Re-run it any time to loop the mission again, or run
`node scripts/generate_dataset.js` first to regenerate the dataset (e.g. for
more drones or a different search polygon).

Set `SIM_SPEEDUP=1` for real-time playback (default is 6x so a demo doesn't
take forever).

## What's real vs. what's a placeholder

- **Real**: auth, ingest endpoints, channel priority/failover resolution,
  persistence, WebSocket push, the coverage-path generator, mission
  plan/deploy, all five dashboard pages reading live data.
- **Placeholder, by design**: the "Live Feed" panel shows the latest color
  still image, refreshed as new frames arrive — it is **not** a continuous
  video stream. True continuous video needs a separate video pipeline
  (RTSP/WebRTC) over the dedicated radio link discussed earlier, which is
  outside this dashboard's scope. The "Manual Override" button in Live Feed
  is a UI stub — it needs to be wired to whatever command channel the
  companion computer exposes for taking RC control.
- **Map tiles**: OpenStreetMap (no API key needed) instead of Google Maps, so
  this runs out of the box. Swapping in the Google Maps JS API is a
  frontend-only change (`public/mark-area.html` / `public/js/mark-area.js`
  and `public/index.html` / `public/js/home.js`, wherever Leaflet is used).

## Deployment

See `DEPLOYMENT.md` for running this locally at a command post (works
offline) and deploying it to the cloud (Fly.io/Railway) with a persistent
volume so mission data survives restarts. Both can run at once, independently.

## Database

Persistence is SQLite (`better-sqlite3`), one file at `data/sar.db` — no
separate database server to install or run. Capped row limits per table keep
it from growing unbounded during a long mission (see `src/store.js` for the
exact caps). If this ever needs to become Postgres/PostGIS for a
multi-instance cloud setup, only `src/store.js` needs to change — every
other file talks to it through the same exported functions.

## Database

Persistence is SQLite (`better-sqlite3`), one file at `data/sar.db` — no
separate database server to install or run. Capped row limits per table keep
it from growing unbounded during a long mission (see `src/store.js` for the
exact caps). If this ever needs to become Postgres/PostGIS for a
multi-instance cloud setup, only `src/store.js` needs to change — every
other file talks to it through the same exported functions.

`better-sqlite3` ships prebuilt binaries for common platforms, so
`npm install` normally needs no compiler. If `npm install` ever fails with a
`node-gyp` / compile error, delete `package-lock.json` and `node_modules`
and run `npm install` again — a stale lockfile can make npm try to rebuild
the native module from source instead of using the prebuilt one. If it
*does* need to compile from source (an unusual platform), you'll need
Python 3 and a C++ toolchain installed (`build-essential` on Ubuntu).

## Auth model

One shared username/password for the whole rescue team, as specified — no
per-user accounts. Login issues a JWT (12h expiry) that's required on every
API call and on the WebSocket connection. The same token is reused to protect
the `/api/ingest/*` endpoints for simplicity; see `interfaces.md` for a note
on giving drones their own credential instead, once that's worth doing.

## See also

`interfaces.md` — the exact request/response schema for everything this
dashboard sends and receives, for whoever is wiring up the companion computer
and the route-planning/detection models on the other side.
