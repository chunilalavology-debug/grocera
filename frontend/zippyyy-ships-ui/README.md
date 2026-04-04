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
