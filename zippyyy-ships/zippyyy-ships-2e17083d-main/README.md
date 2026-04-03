# Zippyyy Ships – local development

### 1) Frontend (Vite)

```bash
npm install
npm run dev
```

The site runs on `http://localhost:8080` and proxies `/api/*` to the backend.

### 2) Backend (Express)

Create `server/.env` from `server/.env.example`, then:

```bash
cd server
npm install
npm run dev
```

Backend runs on `http://localhost:3001`.

### 3) Stripe webhook (local)

Use Stripe CLI to forward webhooks to your backend:

```bash
stripe listen --forward-to http://localhost:3001/api/stripe/webhook
```

Copy the `whsec_...` into `server/.env` as `STRIPE_WEBHOOK_SECRET`.

## Environment variables

- **Client**: set `VITE_GOOGLE_MAPS_API_KEY` in a root `.env` (optional but recommended for address autocomplete + map tag).
- **Server**: set `EASYSHIP_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` in `server/.env`.

