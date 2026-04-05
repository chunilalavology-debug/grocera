# Zippyyy Ships UI (Vite + React)

Source for the flow embedded at **`/zippyyy-ships`** on the main site. The built files are served from **`frontend/public/zippyyy-ships-app/`** (iframe in `src/pages/ZippyyyShips.js`).

## Build and refresh the embed

From `grocera/frontend/zippyyy-ships-ui`:

```bash
npm install
npm run build
```

Copy the contents of the generated **`dist/`** folder into **`../public/zippyyy-ships-app/`** (replace old `index.html` and `assets/`), then commit. `vite.config.ts` uses `base: "/zippyyy-ships-app/"` so paths match production.

## API URL in dev

The UI calls same-origin **`/api/...`**; locally the CRA dev server / Vercel proxies to **`SHIPS_API_BASE`**. The ships **server** code lives in **`backend/zippyyy-ships-server`**.

## Embedded flow on Vercel (split frontend + grocery API)

Production `.env.production` sets **`VITE_GROCERA_API_BASE=/api`** so quotes/checkout call **`/api/user/shipping/quote`** and **`/api/user/shipping/checkout`** on the **same host as the storefront**. Those routes are implemented as Vercel serverless proxies in **`frontend/api/user/shipping/`**, which forward to the real grocery API.

On the **storefront** Vercel project, set **`REACT_APP_API_URL`** to your grocery API base including **`/api`** (e.g. `https://grocera-k45u.vercel.app/api`). Optional override: **`GROCERY_API_BASE`**. Without this, embedded Ships returns **405** on the quote step because POST hits the SPA fallback instead of the API.

For full Easyship rates (multi-carrier) instead of the grocery quote fallback, set **`SHIPS_API_BASE`** on the storefront to your **`zippyyy-ships-server`** URL and rebuild the ships UI with **`VITE_SHIPS_API_BASE`** pointing there (see `frontend/api/lib/forwardToShips.js`).
