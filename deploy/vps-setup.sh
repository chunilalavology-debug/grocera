#!/usr/bin/env bash
# First-time setup on Ubuntu/Debian VPS (Hostinger or similar).
# Run as a sudo-capable user from the grocera repo root after git clone.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Node version (use 20.x per package.json engines)"
node -v

echo "==> Install backend production dependencies"
npm ci --prefix backend --omit=dev

echo "==> Install frontend deps and production build"
npm ci --prefix frontend
# Same-origin API: nginx proxies everything to Node; browser uses /api on your domain.
export REACT_APP_SAME_ORIGIN_API=1
npm run build --prefix frontend

echo "==> Done. Next steps:"
echo "    1. cp backend/.env.example backend/.env  # then edit: MONGO_URI, JWT_SECRET_KEY, FRONTEND_URL=https://zippyyy.com, STRIPE_*, EMAIL_*, etc."
echo "    2. For nginx + PM2: set LISTEN_HOST=127.0.0.1 in backend/.env"
echo "    3. pm2 start ecosystem.config.cjs --env production && pm2 save"
echo "    4. Configure SSL (certbot) using deploy/nginx-grocera.conf as a template"
