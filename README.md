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
- Project root: `frontend/`
- Environment variables:
  - Set `REACT_APP_API_URL` to:
    - `https://{BACKEND_VERCEL_DOMAIN}/api`

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


