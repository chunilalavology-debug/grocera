#!/usr/bin/env bash
# Run on the VPS as root when you see: connect ECONNREFUSED 127.0.0.1:6379
set -euo pipefail

echo "==> Installing Redis (Ubuntu/Debian)"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y redis-server

echo "==> Enabling and starting service"
systemctl enable redis-server
systemctl start redis-server
systemctl --no-pager status redis-server || true

echo "==> Listen check (expect 127.0.0.1:6379 or 0.0.0.0:6379)"
ss -tlnp | grep 6379 || (echo "No listener on 6379 — check /etc/redis/redis.conf (bind, port)" && exit 1)

echo "==> Ping"
redis-cli ping

echo "OK — restart Node: pm2 restart zippyyy-api --update-env"
