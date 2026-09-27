# Interfaces — Dashboard Side

This document only covers the dashboard's side of every boundary: what it
exposes, what it expects to receive, and what it sends out. Whatever happens
inside the drone/companion computer to produce these payloads is outside this
file.

All authenticated requests need `Authorization: Bearer <token>` (see Auth).

---

## 1. Auth

`POST /api/auth/login`

Request:
```json
{ "username": "rescueteam", "password": "changeme123" }
```
Response:
```json
{ "token": "<jwt, valid 12h>" }
```
Use this token as a Bearer token on every other call below, and pass it as
`?token=<jwt>` on the WebSocket URL (`ws(s)://<host>/ws?token=...`).

---

## 2. Data in — the 4 channels

`POST /api/ingest/cellular`
`POST /api/ingest/wifi`
`POST /api/ingest/radio`
`POST /api/ingest/lora`

Same body shape on all four; the URL segment is only used to record *which
link the message arrived over* (this is what channel-priority/failover
resolution is based on — see README). Whatever is producing these calls picks
the URL according to which physical link is currently up.

Common fields on every request:
| field     | type   | required | notes |
|-----------|--------|----------|-------|
| `droneId` | string | yes      | stable id, e.g. `"drone-1"` |
| `kind`    | string | yes      | `"telemetry"` \| `"detection"` \| `"image"` \| `"lora"` |
| `ts`      | number | no       | unix ms; server stamps current time if omitted |
| `lat`,`lon` | number | usually | most kinds carry a position |

### `kind: "telemetry"`
```json
{
  "droneId": "drone-1", "kind": "telemetry", "ts": 1735300000000,
  "lat": 34.0522, "lon": -118.2437, "alt": 58,
  "heading": 42, "speed": 12.4, "battery": 81
}
```

### `kind: "detection"`
```json
{
  "droneId": "drone-1", "kind": "detection", "ts": 1735300000000,
  "lat": 34.0522, "lon": -118.2437,
  "detectionKind": "human",
  "confidence": 0.87,
  "note": "optional free text"
}
```
`detectionKind` is a free-form string on the dashboard side (rendered as-is);
suggested values so far: `"human"`, `"hazard-fire"`, `"structural-collapse"`.

### `kind: "image"`
```json
{
  "droneId": "drone-1", "kind": "image", "ts": 1735300000000,
  "lat": 34.0522, "lon": -118.2437,
  "imageKind": "color",
  "url": "data:image/jpeg;base64,..."   // or any URL the dashboard's browser can load
}
```
`imageKind` is `"color"` or `"thermal"`. `url` can be a data URI (simplest —
no separate file hosting needed) or a normal URL if there's an image server
in between. There is no separate video/streaming endpoint — "Live Feed" on
the dashboard is just the latest `color` image, refreshed as new ones arrive.

### `kind: "lora"`
```json
{
  "droneId": "drone-1", "kind": "lora", "ts": 1735300000000,
  "lat": 34.0522, "lon": -118.2437,
  "textKind": "human-presence",
  "text": "Possible survivor detected near ingress point"
}
```
`textKind`: `"status"` (routine heartbeat) | `"human-presence"` | `"hazard"`.
The dashboard visually flags `human-presence` and `hazard` as critical.

Response on success (all 4 channels): `{ "ok": true }`, HTTP 200.

---

## 3. Mission planning ("Mark Search Area")

`POST /api/mission/plan`
```json
{
  "name": "Sector 4 Search",
  "polygon": [{ "lat": 34.05, "lon": -118.25 }, ...],
  "numDrones": 3,
  "altitude": 60,
  "overlapPct": 20,
  "terrain": "urban"
}
```
Returns:
```json
{
  "id": "uuid",
  "name": "Sector 4 Search",
  "polygon": [...],
  "params": { "numDrones": 3, "altitude": 60, "overlapPct": 20, "terrain": "urban" },
  "drones": [
    { "droneId": "drone-1", "waypoints": [{ "lat": 34.05, "lon": -118.249, "alt": 60 }, ...] }
  ],
  "status": "planned"
}
```
This is currently produced by a real lawnmower-coverage algorithm
(`src/routeplanner.js`), **not a stub** — it returns real waypoints today.
It's also the single integration point for a smarter route-planning model
later: swap the inside of `generateCoveragePaths()` for a call to that model,
keep the same `{droneId, waypoints:[{lat,lon,alt}]}` return shape, and nothing
else in the dashboard needs to change.

`POST /api/mission/:id/deploy` → marks the mission active, broadcasts
`mission_deployed` over WebSocket, returns the mission object. This is the
point at which, on the real system, the generated waypoints need to actually
reach each drone — that hand-off (protocol, transport) is on the drone side,
not covered here.

`GET /api/mission/current` → the current mission object, or `null`.

---

## 4. Data out — what the dashboard reads

- `GET /api/drones` → array of `{ id, name, lastSeen, lastKnown, status }`,
  where `status` is the resolved `{ activeChannel, loraOnly, offline, links }`
  from the channel-priority logic.
- `GET /api/drones/:id/telemetry?limit=200` → recent telemetry points.
- `GET /api/detections` → most recent 200, newest first.
- `GET /api/images?droneId=&kind=` → most recent 200, newest first, both
  filters optional.
- `GET /api/lora` → most recent 300, newest first.

## 5. Live push — WebSocket

Connect to `ws(s)://<host>/ws?token=<jwt>`. Server pushes JSON messages
`{ type, data, ts }` any time new data lands via ingest:

| `type`             | `data`                                   |
|--------------------|-------------------------------------------|
| `telemetry_update` | `{ droneId, point }`                      |
| `detection_new`     | the detection object                      |
| `image_new`         | the image object                          |
| `lora_new`          | the lora message object                   |
| `drone_status`      | `{ droneId, activeChannel, loraOnly, offline, links }` |
| `mission_deployed`  | the full mission object                   |

No action needed to subscribe — every authenticated connection receives every
event; there's no per-drone subscription filtering (fine at 3-4 drones; would
need topics if this ever supports much larger swarms).

---

## 6. Auth note for real drone links

Right now `/api/ingest/*` is protected with the same shared team-login token
used by the dashboard, for simplicity. Before this goes anywhere beyond a
demo, give the drone/gateway side its own long-lived credential (a separate
pre-shared token or API key per drone) instead of reusing the team's login —
that way rotating the team password doesn't also take down data ingestion,
and a compromised drone credential doesn't grant dashboard login access.
