/**
 * PM2 process file for Hostinger VPS (or any Linux server).
 *
 * Usage (from repo root, after build + backend deps):
 *   npm ci --prefix backend --omit=dev
 *   npm run build --prefix frontend
 *   pm2 start ecosystem.config.cjs --env production
 *   pm2 save && pm2 startup
 *
 * Copy backend/.env from .env.example and set secrets; production: FRONTEND_URL=https://zippyyy.com
 */
const path = require("path");

const root = __dirname;
const backendDir = path.join(root, "backend");
const buildDir = path.join(root, "frontend", "build");

module.exports = {
  apps: [
    {
      name: "zippyyy-grocera",
      cwd: backendDir,
      script: "app.js",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "800M",
      env_production: {
        NODE_ENV: "production",
        PORT: 5000,
        FRONTEND_BUILD_PATH: buildDir,
      },
    },
  ],
};
