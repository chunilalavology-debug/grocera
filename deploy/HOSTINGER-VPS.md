# Deploy Grocera (Zippyyy) on Hostinger VPS

This stack is **Node 20** + **Express** (API + optional production SPA) + **MongoDB** (Atlas or self‑hosted) + **React** (static `frontend/build`). On a VPS you typically add **nginx** (TLS + reverse proxy) and **PM2** (keep Node running).

## 1. Server prerequisites

- Ubuntu 22.04/24.04 (or Debian) on the VPS  
- Node.js **20.x** — [NodeSource](https://github.com/nodesource/distributions) or `nvm install 20`  
- `build-essential` — recommended for native modules (`bcrypt`, `sharp`):  
  `sudo apt update && sudo apt install -y build-essential`  
- **Redis** — the app uses Redis for product-list cache and rate limits. Install on the same VPS (default: listens on `127.0.0.1:6379`):

```bash
sudo apt update && sudo apt install -y redis-server
sudo systemctl enable --now redis-server
redis-cli ping   # must print PONG
```

In `backend/.env` set **`REDIS_URL=redis://127.0.0.1:6379`** (recommended) and do **not** set `REDIS_DISABLED`. Do **not** also set `REDIS_HOST` / `REDIS_PORT` when using `REDIS_URL` — pick one connection style. The Node app and Redis must run on the same machine (or point `REDIS_URL` at your managed Redis host).

## 2. Clone and build

```bash
git clone https://github.com/YOUR_ORG/grocera.git
cd grocera
chmod +x deploy/vps-setup.sh
./deploy/vps-setup.sh
```

The script installs backend deps, builds the frontend with `REACT_APP_SAME_ORIGIN_API=1` so the browser calls **`https://zippyyy.com/api`** (same origin as the shop).

## 3. Backend environment

```bash
cp backend/.env.example backend/.env
nano backend/.env
```

Set at least:

| Variable | Notes |
|----------|--------|
| `NODE_ENV` | `production` |
| `PORT` | `5000` (or any free port; match nginx `proxy_pass`) |
| `MONGO_URI` or `DB_STRING` | Mongo connection string |
| `JWT_SECRET_KEY` | Strong secret; required in production |
| `FRONTEND_URL` | `https://zippyyy.com` (no trailing slash). If you use **www**, add `https://www.zippyyy.com` via `FRONTEND_URLS` (comma-separated) |
| `API_PUBLIC_URL` | `https://zippyyy.com` — used for invoice/email asset URLs behind nginx |
| `REDIS_URL` | `redis://127.0.0.1:6379` when Redis runs on this VPS (after `redis-server` install). Omit `REDIS_DISABLED` |
| Stripe, SMTP, Cloudinary | As in `.env.example` |

**Single Node process (API + React build):**

- `FRONTEND_BUILD_PATH` is set automatically by `ecosystem.config.cjs` to the absolute path of `frontend/build`.

**If you serve only API from Node and static files from nginx:** unset `FRONTEND_BUILD_PATH` in PM2/env and point nginx `root` at `frontend/build` with a `location /api/` proxy (advanced; the bundled SPA mode is simpler).

**Behind nginx (recommended):** in `backend/.env` set:

```env
LISTEN_HOST=127.0.0.1
```

So Node only accepts local connections; the public internet hits nginx.

**Direct port exposure (no nginx on the same box):** omit `LISTEN_HOST` so Node listens on all interfaces, open the firewall for `PORT`, and still set `FRONTEND_URL` to the URL users use in the browser.

## 4. PM2

```bash
sudo npm install -g pm2
cd /path/to/grocera
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup
# Run the command PM2 prints so the app restarts after reboot
```

Logs: `pm2 logs zippyyy-grocera`

## 5. nginx + HTTPS

1. `sudo apt install -y nginx certbot python3-certbot-nginx`  
2. Copy `deploy/nginx-grocera.conf` to `/etc/nginx/sites-available/grocera`, enable the site, test, reload.  
3. `sudo certbot --nginx -d zippyyy.com -d www.zippyyy.com`

Stripe webhooks must use your public **HTTPS** URL: `https://zippyyy.com/api/orders/webhook`.

## 6. Smoke checks

```bash
curl -sS https://zippyyy.com/api/health
curl -sS -o /dev/null -w "%{http_code}" https://zippyyy.com/
```

You should see JSON from `/api/health` and `200` for `/` (HTML).

## 7. Updates after `git pull`

```bash
cd /path/to/grocera
git pull
npm ci --prefix backend --omit=dev
# If you see MODULE_NOT_FOUND (e.g. xlsx), dependencies are incomplete — run: npm install --prefix backend
REACT_APP_SAME_ORIGIN_API=1 npm run build --prefix frontend
pm2 reload ecosystem.config.cjs --env production
```

## 8. Fix `ECONNREFUSED 127.0.0.1:6379` (Redis)

The app expects **Redis on the same VPS** when `REDIS_URL=redis://127.0.0.1:6379` is set. This error means **nothing is listening on port 6379** (Redis not installed, stopped, or bound only to a socket).

**One-shot install (as root):**

```bash
cd /var/www/grocera
chmod +x deploy/ensure-redis.sh
sudo ./deploy/ensure-redis.sh
```

**Or manually:**

```bash
sudo apt update && sudo apt install -y redis-server
sudo systemctl enable --now redis-server
redis-cli ping    # PONG
ss -tlnp | grep 6379
```

Then: `pm2 restart zippyyy-api --update-env`

**Redis runs but Node still logs `ECONNREFUSED`:** the app loads `backend/.env` from the **`app.js` folder** (not from PM2’s current working directory). Ensure **`/var/www/grocera/backend/.env`** exists and contains `REDIS_URL=redis://127.0.0.1:6379`. After updating the repo, restart: `pm2 restart zippyyy-api --update-env`. If it persists, start PM2 with **`cwd` set to `backend`** (see `ecosystem.config.cjs`) or run: `cd /var/www/grocera/backend && pm2 start app.js --name zippyyy-api`.

If `redis-cli ping` still fails, check `sudo systemctl status redis-server` and that `/etc/redis/redis.conf` has `bind 127.0.0.1` (or `0.0.0.0`) and `port 6379`.

**Temporary workaround without Redis:** in `backend/.env` set `REDIS_DISABLED=1` and remove or comment `REDIS_URL` (weaker rate limits, no Redis catalog cache).

## 9. Optional: Zippyyy Ships API

If you use the separate ships server under `backend/zippyyy-ships-server`, run it as a second PM2 app or document your own port; the main grocery app can work without it if shipping falls back in your configuration.
