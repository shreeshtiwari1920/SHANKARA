# Deployment

Two setups, matching what you said you need: **local** (runs at the command
post, works with zero internet) and **cloud** (reachable anytime, for demos
and as a backup). They're independent — each keeps its own `data/sar.db`
file; nothing syncs between them automatically (see "Keeping them in sync"
at the bottom if you want that later).

---

## 1. Local — command post laptop

This is the one that matters most for real operations: no internet
dependency, and the rescue team's phones/tablets can reach it over local
WiFi/hotspot even with zero outside connectivity.

```bash
cd sar-dashboard
npm install
cp .env.example .env      # set SAR_USERNAME / SAR_PASSWORD / JWT_SECRET
npm start
```

By default this only listens on the laptop. To let other devices on the same
WiFi/hotspot reach it:

1. Find the laptop's local IP: `ip addr` (Linux) / `ipconfig` (Windows) /
   `ifconfig` (Mac) — look for something like `192.168.1.42`.
2. On phones/tablets on the same network, open `http://192.168.1.42:4000`.
3. If nothing loads, your OS firewall is probably blocking incoming
   connections on port 4000 — allow it (e.g. `sudo ufw allow 4000` on
   Ubuntu).

**Keeping it running unattended** — if the laptop reboots or the terminal
closes, plain `npm start` dies with it. For a real deployment, run it under
a process manager so it restarts automatically:

```bash
npm install -g pm2
pm2 start src/index.js --name sar-dashboard
pm2 save
pm2 startup   # follow the printed instructions to survive reboots
```

**Backing up the mission data**: it's all in one file, `data/sar.db`. Copy
that file (plus `.env`, since it holds your credentials) to a USB drive or
another machine periodically — that's your entire backup.

---

## 2. Cloud — always-reachable demo/backup

Recommended: **Fly.io** — free/cheap tier, supports WebSockets out of the
box, and gives you a real persistent volume (important: without one, the
SQLite file gets wiped every time the app restarts or redeploys). Railway
works almost identically if you'd rather use that instead.

### Fly.io

```bash
# one-time setup
curl -L https://fly.io/install.sh | sh
fly auth login

cd sar-dashboard
fly launch --no-deploy        # detects the Dockerfile, asks app name/region
```

Create a persistent volume for the database (1GB is overkill for this but
it's the smallest size Fly offers):

```bash
fly volumes create sar_data --size 1 --region <same region fly launch picked>
```

Edit the `fly.toml` that `fly launch` generated, adding:

```toml
[mounts]
  source = "sar_data"
  destination = "/data"

[env]
  SQLITE_PATH = "/data/sar.db"
```

Set your real secrets (never commit these):

```bash
fly secrets set SAR_USERNAME=rescueteam SAR_PASSWORD=<a-real-password> JWT_SECRET=<a-long-random-string>
```

Deploy:

```bash
fly deploy
```

Your dashboard is now live at `https://<app-name>.fly.dev`. Re-running
`fly deploy` after code changes will **not** lose data — that only lives on
the mounted volume, not in the container image.

### Railway (alternative)

1. `railway init` in the project folder, connect it to this repo.
2. Railway auto-detects the Dockerfile.
3. In the project's Volumes tab, attach a volume mounted at `/data`.
4. In Variables, set `SAR_USERNAME`, `SAR_PASSWORD`, `JWT_SECRET`,
   `SQLITE_PATH=/data/sar.db`.
5. Deploy from the dashboard or `railway up`.

### Testing the Docker build locally first (recommended before either)

```bash
docker build -t sar-dashboard .
docker run -p 4000:4000 --env-file .env sar-dashboard
```

If that boots and you can log in at `http://localhost:4000`, the cloud build
will too.

---

## Keeping local and cloud in sync (optional, not set up here)

Right now local and cloud are two separate databases — real mission data
during an actual operation should be treated as living on the **local**
instance (it's the one that can't lose connectivity mid-mission). The cloud
one is for demos/access when you're not physically at the command post.

If you later want the cloud copy to mirror real mission data:
- Simplest: after a mission, `scp`/upload `data/sar.db` from the laptop up
  to the cloud volume.
- More real-time: swap the SQLite store for a shared hosted Postgres
  (Supabase/Neon both have free tiers) that both the laptop and the cloud
  instance point at — this needs internet from the laptop, though, which
  defeats the "works offline" property, so only worth it if the command
  post reliably has a connection.
