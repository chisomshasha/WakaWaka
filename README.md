# WakaWaka

A two-sided okada (motorcycle) delivery marketplace for Lagos, Nigeria —
customers request package deliveries, riders accept and complete them.
Built with Expo Router (React Native) and FastAPI + MongoDB.

See `docs/PRD.md` for the full product spec and `docs/design_guidelines.json`
for the design system tokens.

## Stack

- **Frontend:** Expo Router 6 (React Native 0.81), TypeScript, MapLibre (free,
  no API key, no billing account) with OpenFreeMap vector tiles for maps —
  supports two-finger rotation and deep zoom (~z20, sub-5m resolution).
- **Backend:** FastAPI + Motor (MongoDB async driver), JWT auth.
- **Payments:** Paystack (falls back to a mock checkout flow if no key is set).
- **Address entry:** search-to-map (OpenStreetMap Nominatim, proxied through
  the backend, free/no key) with a "Find Myself on Map" GPS option — see
  `app/(customer)/location-picker.tsx` and the `/geocode/*` backend routes.

## Repo layout

```
backend/    FastAPI app (server.py), deploys to Railway
frontend/   Expo Router app
docs/       Product spec + design tokens
```

## Running locally

### Backend

```
cd backend
cp .env.example .env   # fill in MONGO_URL, DB_NAME, JWT_SECRET
pip install -r requirements.txt --break-system-packages
uvicorn server:app --reload
```

### Frontend

```
cd frontend
cp .env.example .env   # fill in EXPO_PUBLIC_BACKEND_URL
npm install
npm start
```

## Deploying

- **Backend → Railway:** create a service rooted at `/backend`, add a MongoDB
  plugin, and set the env vars from `backend/.env.example` (`MONGO_URL` comes
  from the Mongo plugin). Railway picks up `backend/Procfile` /
  `backend/railway.json` automatically.
- **Frontend:** set `EXPO_PUBLIC_BACKEND_URL` to your Railway backend URL and
  build with `eas build`, or run `expo start --web` for a web preview.

## Demo data

`POST /api/seed` creates 5 online demo riders around Victoria Island, Lagos,
plus a demo customer (`+2348099999999` / `password123`). Idempotent — safe to
call more than once.
