# WakaWaka — Bike Delivery App PRD

## Summary
A two-sided bike delivery marketplace for Lagos, Nigeria (super-app style like Grab/Gojek). Customers request package delivery, and okada (motorcycle) riders accept and complete deliveries. Single Expo app switches UI based on user role.

## Stack
- **Frontend:** Expo Router 6 (React Native 0.81), TypeScript, react-native-maps (native only, web fallback), @gorhom/bottom-sheet.
- **Backend:** FastAPI + Motor (MongoDB async).
- **Auth:** JWT with bcrypt password hashing, stored in Expo SecureStore.
- **Realtime:** HTTP polling every 3–5s (nearby riders, incoming requests, delivery status).

## User Roles
- **CLIENT (Customer):** requests deliveries, tracks riders, rates completed trips.
- **RIDER:** toggles online status, accepts/declines requests, updates status, views earnings.

## Backend Endpoints (all prefixed `/api`)
### Auth
- `POST /auth/register` — register with role (`CLIENT` / `RIDER`); returns JWT + user.
- `POST /auth/login` — login by phone + password.
- `GET /auth/me` — current user.

### Riders
- `POST /riders/online` — go online (needs lat/lng).
- `POST /riders/offline`
- `POST /riders/location` — update GPS.
- `GET /riders/nearby?lat&lng&radius` — public, list online riders within radius (km).
- `GET /riders/stats` — today's trips, earnings, active delivery.
- `GET /riders/earnings?period=day|week|month`
- `GET /riders/incoming` — poll for pending requests matched to this rider.
- `POST /riders/accept` — atomic accept (first rider wins).
- `POST /riders/decline`

### Deliveries
- `POST /deliveries/price-estimate` — distance + fare estimate.
- `POST /deliveries/request` — customer creates delivery, picks nearest 3 riders as candidates.
- `GET /deliveries/history` — history for current user (client OR rider).
- `GET /deliveries/{id}` — details w/ attached rider info.
- `PATCH /deliveries/{id}/status` — rider updates to `PICKED_UP` / `DELIVERED`.
- `POST /deliveries/{id}/cancel` — customer cancels.
- `POST /deliveries/{id}/rate` — customer rates 1-5.

### Seed
- `POST /api/seed` — creates demo customer + 5 online riders in Lagos VI area.

## Frontend Screens
- `/` — auth-based redirect
- `/role-selection` — Customer vs Rider (Pexels imagery, bold cards)
- `/(auth)/login` and `/(auth)/register` — brand-styled JWT auth
- **Customer tabs:** Deliver (map + request), History, Profile
  - `/(customer)/request` — pickup/dropoff picker + price estimate + payment method
  - `/(customer)/tracking/[id]` — live status + rider card + rating modal
- **Rider tabs:** Ride (online toggle + incoming modal), Earnings, History, Profile
  - `/(rider)/active/[id]` — pickup → dropoff progression, slide to complete

## Design System
- **Colors:** Okada Orange `#FF4F00`, Asphalt Black `#0A0A0A`, Off-White `#FAFAFA`
- **Fonts:** Outfit (heading), Manrope (body) — via system fallbacks
- **Language accent:** Nigerian pidgin ("no wahala", "How you dey use")

## Payment
Currently mocked. Payment methods (Cash / Card / Wallet) selectable in request flow. Card/Wallet show a "demo mode" notice. Ready to integrate Paystack or Flutterwave when keys are provided.

## Known Limitations
- `react-native-maps` renders only on native builds; web preview shows a stylized fallback panel with markers list.
- Realtime is polling-based (3s intervals). Can be upgraded to WebSockets/Socket.IO later.
- Payment is mocked (no real charges). Add Paystack/Flutterwave secrets to enable.

## Business Enhancement (Next Actions)
1. **Real payment integration** — Paystack test keys → live charges → 5-10% platform commission.
2. **Rider onboarding & KYC** — document verification for trust.
3. **Referral & promo codes** — one-time discount for first delivery, referral bonus for riders.
4. **Scheduled deliveries** — book a rider for later (recurring corporate accounts).
