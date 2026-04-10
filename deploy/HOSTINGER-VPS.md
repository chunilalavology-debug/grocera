# Deploy Grocera (Zippyyy) on Hostinger VPS

This stack is **Node 20** + **Express** (API + optional production SPA) + **MongoDB** (Atlas or self‑hosted) + **React** (static `frontend/build`). On a VPS you typically add **nginx** (TLS + reverse proxy) and **PM2** (keep Node running).

## 1. Server prerequisites

- Ubuntu 22.04/24.04 (or Debian) on the VPS  
- Node.js **20.x** — [NodeSource](https://github.com/nodesource/distributions) or `nvm install 20`  
- `build-essential` — recommended for native modules (`bcrypt`, `sharp`):  
  `sudo apt update && sudo apt install -y build-essential`

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
REACT_APP_SAME_ORIGIN_API=1 npm run build --prefix frontend
pm2 reload ecosystem.config.cjs --env production
```

## 8. Optional: Zippyyy Ships API

If you use the separate ships server under `backend/zippyyy-ships-server`, run it as a second PM2 app or document your own port; the main grocery app can work without it if shipping falls back in your configuration.
