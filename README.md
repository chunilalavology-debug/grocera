# Grocera (Frontend + Backend) Monorepo

This repository contains:

- `frontend/` - React web application (admin + storefront)
- `backend/` - Node.js/Express API (auth, products, orders, shipping label, emails)

---

## Quick Start (Local Development)

### 1) Backend
1. Go to `backend/`
2. Install dependencies:
   - `npm install`
3. Create env file:
   - Copy `backend/.env.production.example` to `backend/.env`
   - Update required values (MongoDB, Stripe, email, Cloudinary, Easyship).
4. Start the API:
   - `npm start`

Backend runs on `PORT` (default `5000`).

### 2) Frontend
1. Go to `frontend/`
2. Install dependencies:
   - `npm install`
3. Create env file:
   - Create `frontend/.env.production` (or `.env.local` depending on your local setup)
   - Set:
     - `REACT_APP_API_URL=http://localhost:5000/api`
4. Start:
   - `npm start`

Frontend runs on `http://localhost:3000` (default CRA).

---

## Vercel Deployment (Recommended)

Deploy **two Vercel projects** from this repo:

### A) Backend (Server)
- Project root: `backend/`
- Use Node runtime (Node 18+)
- Deploy settings:
  - Framework: “Other” / “Node.js”
  - Build command: (empty)
  - Install command: `npm install`
  - Start command: `npm start`
- Environment variables:
  - Add all values required by `backend/.env.production.example` in Vercel project settings.

**Stripe webhook endpoint**
- The backend webhook route is:
  - `POST {BACKEND_URL}/api/orders/webhook`
- Configure Stripe webhook in Stripe Dashboard using:
  - `STRIPE_WEBHOOK_SECRET`

### B) Frontend (Web)
- **Critical — Root Directory:** In the Vercel project, open **Settings → General → Root Directory** and set it to **`frontend`**. If this is empty or `.`, Vercel builds the repo root (where there is no CRA `package.json`), so builds fail or deployments look “stuck” on an old version.
- Framework: Create React App (or “Other” with build output `build`).
- **Build command:** `npm run build` (uses `cross-env CI=false` so ESLint warnings do not fail the build on Vercel).
- **Output directory:** `build`.
- **Node.js:** `package.json` has `"engines": { "node": "24.x" }` — matches Vercel’s current default.
- Do **not** commit `frontend/build/`; it is gitignored. Vercel always builds from source on deploy.
- Environment variables:
  - Set `REACT_APP_API_URL` to:
    - `https://{BACKEND_VERCEL_DOMAIN}/api`

### Vercel troubleshooting (changes on GitHub but site not updating)

1. **Wrong root directory** — Most common. Frontend project must use Root Directory = `frontend`. Backend project must use `backend`. Redeploy after saving.
2. **Wrong Git repo or branch** — **Settings → Git** → confirm the connected repository is `chunilalavology-debug/grocera` (or your fork) and **Production Branch** is `main` (if you deploy from `main`).
3. **Failed deployment** — **Deployments** tab → open the latest deploy → read **Build Logs**. Fix any red errors (missing env, install failure, etc.).
4. **PR / preview deploys** — Pushing a **branch** or opening a **PR** creates a **Preview** URL, not production. Check the preview link on the deployment, or merge to `main` to update production.
5. **Ignored Build Step** — **Settings → Git → Ignored Build Step**. If a custom script always skips the build, new commits will not deploy. Disable or fix the script.
6. **Browser cache** — Hard refresh (Ctrl+Shift+R) or try an incognito window after a successful deploy.

---

## Easyship Shipping
- If you want real Easyship rate quotes and/or label tracking, set:
  - `backend/EASYSHIP_API_KEY`
- If Easyship is not configured or fails, the app falls back to the internal quote calculation.

---

## Security Notes
- Do **not** commit secrets to GitHub:
  - `.env`, Stripe secrets, SMTP passwords, Easyship tokens, `serviceAccount.json`, etc.
- Use Vercel Environment Variables for production.


