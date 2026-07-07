"""
WakaWaka Backend - Payments + Platform Fee + Live Location tests
Covers new features:
- Delivery paymentMethod=CASH: immediately PENDING + PAID_ON_DELIVERY
- Delivery paymentMethod=CARD/WALLET: AWAITING_PAYMENT + PENDING_PAYMENT
  and hidden from /api/riders/incoming until paid
- POST /api/payments/init (mock mode)
- 403 on non-owner init
- alreadyPaid short-circuit
- GET /api/payments/mock-checkout HTML with amount
- POST /api/payments/mock-approve: flips to PAID + delivery PENDING
- POST /api/payments/verify idempotent + mock flow
- POST /api/payments/verify 403 for non-owner
- Delivery pricing: 15% platformFee, 85% riderEarning in response
- PATCH DELIVERED: rider.earnings increments by riderEarning (85%)
- GET /api/riders/earnings: price=riderEarning, includes grossPrice+platformFee
- POST /api/riders/location as RIDER + reflection in /api/riders/nearby
- POST /api/riders/location as CLIENT -> 403
- GET /api/deliveries/{id} shows live rider.currentLat/Lng
- POST /api/paystack/webhook doesn't crash in mock mode
"""
import os
import re
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().strip('"')
                break
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL missing"
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"

DEMO_CUSTOMER = {"phone": "+2348099999999", "password": "password123"}
DEMO_RIDER = {"phone": "+2348011111111", "password": "password123"}
DEMO_RIDER2 = {"phone": "+2348022222222", "password": "password123"}

PICKUP = {"lat": 6.4281, "lng": 3.4219, "addr": "Victoria Island"}
DROPOFF = {"lat": 6.4550, "lng": 3.4500, "addr": "Ikoyi"}


# ---------- helpers ----------
def _h(t):
    return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}


def _login(s, creds):
    r = s.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


def _register(s, role="CLIENT"):
    phone = f"+23480{uuid.uuid4().int % 10**8:08d}"
    payload = {"phone": phone, "password": "password123",
               "name": f"TEST_{role}", "role": role}
    if role == "RIDER":
        payload.update({"vehicleType": "Bajaj", "licensePlate": "LAG-TST-XX"})
    r = s.post(f"{API}/auth/register", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"], r.json()["user"], phone


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def seeded(s):
    r = s.post(f"{API}/seed", timeout=30)
    assert r.status_code == 200
    return r.json()


@pytest.fixture(scope="module")
def ctok(s, seeded):
    return _login(s, DEMO_CUSTOMER)


@pytest.fixture(scope="module")
def rtok(s, seeded):
    # ensure rider is online near pickup so candidate selection includes them
    tok = _login(s, DEMO_RIDER)
    r = s.post(f"{API}/riders/online",
               json={"lat": PICKUP["lat"], "lng": PICKUP["lng"]},
               headers=_h(tok))
    assert r.status_code == 200
    return tok


@pytest.fixture(scope="module")
def rtok2(s, seeded):
    tok = _login(s, DEMO_RIDER2)
    r = s.post(f"{API}/riders/online",
               json={"lat": PICKUP["lat"], "lng": PICKUP["lng"]},
               headers=_h(tok))
    assert r.status_code == 200
    return tok


def _request_delivery(s, ctok, payment_method="CASH", price=1500):
    body = {
        "pickupAddress": PICKUP["addr"], "pickupLat": PICKUP["lat"], "pickupLng": PICKUP["lng"],
        "dropoffAddress": DROPOFF["addr"], "dropoffLat": DROPOFF["lat"], "dropoffLng": DROPOFF["lng"],
        "price": price, "paymentMethod": payment_method,
    }
    r = s.post(f"{API}/deliveries/request", json=body, headers=_h(ctok))
    assert r.status_code == 200, r.text
    return r.json()["delivery"]


# ---------- Delivery pricing + payment gating ----------
def test_cash_delivery_is_pending_and_paid_on_delivery(s, ctok, rtok):
    d = _request_delivery(s, ctok, "CASH", price=1500)
    assert d["status"] == "PENDING"
    assert d["paymentStatus"] == "PAID_ON_DELIVERY"
    assert d["paymentMethod"] == "CASH"
    # Platform fee & rider earning are computed
    assert d["platformFee"] == pytest.approx(1500 * 0.15, rel=1e-3)
    assert d["riderEarning"] == pytest.approx(1500 * 0.85, rel=1e-3)


def test_card_delivery_awaits_payment_and_hidden_from_riders(s, ctok, rtok):
    d = _request_delivery(s, ctok, "CARD", price=2000)
    assert d["status"] == "AWAITING_PAYMENT"
    assert d["paymentStatus"] == "PENDING_PAYMENT"

    # Rider incoming MUST NOT show unpaid delivery
    r = s.get(f"{API}/riders/incoming", headers=_h(rtok))
    assert r.status_code == 200
    ids = [x["id"] for x in r.json()["requests"]]
    assert d["id"] not in ids, "Unpaid CARD delivery should not be visible to riders"


def test_wallet_delivery_awaits_payment(s, ctok):
    d = _request_delivery(s, ctok, "WALLET", price=1000)
    assert d["status"] == "AWAITING_PAYMENT"
    assert d["paymentStatus"] == "PENDING_PAYMENT"


# ---------- Payment init ----------
def test_payment_init_mock_mode(s, ctok):
    d = _request_delivery(s, ctok, "CARD", price=3000)
    r = s.post(f"{API}/payments/init",
               json={"deliveryId": d["id"], "email": "test@wakawaka.demo"},
               headers=_h(ctok))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["isMock"] is True
    assert body["reference"].startswith("WW-")
    assert "mock-checkout" in body["authorizationUrl"]
    assert body["accessCode"]

    # delivery paymentStatus flips to INITIALIZED
    r2 = s.get(f"{API}/deliveries/{d['id']}", headers=_h(ctok))
    assert r2.status_code == 200
    assert r2.json()["delivery"]["paymentStatus"] == "INITIALIZED"


def test_payment_init_forbidden_for_non_owner(s, ctok):
    d = _request_delivery(s, ctok, "CARD", price=2500)
    # register a different client
    other_tok, _, _ = _register(s, "CLIENT")
    r = s.post(f"{API}/payments/init",
               json={"deliveryId": d["id"]},
               headers=_h(other_tok))
    assert r.status_code == 403


def test_payment_init_already_paid_shortcircuit(s, ctok):
    d = _request_delivery(s, ctok, "CARD", price=1200)
    init = s.post(f"{API}/payments/init",
                  json={"deliveryId": d["id"]},
                  headers=_h(ctok)).json()
    ref = init["reference"]
    # Approve via mock
    ar = s.post(f"{API}/payments/mock-approve", params={"reference": ref})
    assert ar.status_code == 200

    # Second init should short-circuit
    r = s.post(f"{API}/payments/init",
               json={"deliveryId": d["id"]},
               headers=_h(ctok))
    assert r.status_code == 200
    body = r.json()
    assert body.get("alreadyPaid") is True
    assert body.get("reference") == ref


# ---------- Mock checkout page ----------
def test_mock_checkout_page_shows_amount(s, ctok):
    d = _request_delivery(s, ctok, "CARD", price=1750)
    init = s.post(f"{API}/payments/init",
                  json={"deliveryId": d["id"]},
                  headers=_h(ctok)).json()
    ref = init["reference"]
    r = s.get(f"{API}/payments/mock-checkout", params={"reference": ref})
    assert r.status_code == 200
    html = r.text
    assert "text/html" in r.headers.get("content-type", "").lower()
    # Amount appears as ₦1,750.00
    assert "1,750" in html or "1750" in html
    assert "DEMO MODE" in html


# ---------- Mock approve + rider visibility ----------
def test_mock_approve_flips_to_paid_and_visible_to_riders(s, ctok, rtok):
    d = _request_delivery(s, ctok, "CARD", price=1400)
    init = s.post(f"{API}/payments/init",
                  json={"deliveryId": d["id"]},
                  headers=_h(ctok)).json()
    ref = init["reference"]

    # Before approval — delivery hidden
    incoming = s.get(f"{API}/riders/incoming", headers=_h(rtok)).json()["requests"]
    assert d["id"] not in [x["id"] for x in incoming]

    # Approve
    ar = s.post(f"{API}/payments/mock-approve", params={"reference": ref})
    assert ar.status_code == 200

    # Delivery is now PAID + PENDING
    d2 = s.get(f"{API}/deliveries/{d['id']}", headers=_h(ctok)).json()["delivery"]
    assert d2["paymentStatus"] == "PAID"
    assert d2["status"] == "PENDING"

    # And visible to riders in candidateRiders
    incoming = s.get(f"{API}/riders/incoming", headers=_h(rtok)).json()["requests"]
    assert d["id"] in [x["id"] for x in incoming]


# ---------- Payment verify ----------
def test_payment_verify_pending_then_paid_mock(s, ctok):
    d = _request_delivery(s, ctok, "CARD", price=900)
    init = s.post(f"{API}/payments/init",
                  json={"deliveryId": d["id"]},
                  headers=_h(ctok)).json()
    ref = init["reference"]

    # Before approve -> PENDING
    v = s.post(f"{API}/payments/verify", json={"reference": ref}, headers=_h(ctok))
    assert v.status_code == 200
    assert v.json()["paymentStatus"] == "PENDING"

    # Approve then verify -> PAID (idempotent)
    s.post(f"{API}/payments/mock-approve", params={"reference": ref})
    v2 = s.post(f"{API}/payments/verify", json={"reference": ref}, headers=_h(ctok))
    assert v2.status_code == 200
    assert v2.json()["paymentStatus"] == "PAID"

    # Second verify still PAID (idempotent short-circuit)
    v3 = s.post(f"{API}/payments/verify", json={"reference": ref}, headers=_h(ctok))
    assert v3.status_code == 200
    assert v3.json()["paymentStatus"] == "PAID"


def test_payment_verify_forbidden_for_non_owner(s, ctok):
    d = _request_delivery(s, ctok, "CARD", price=700)
    init = s.post(f"{API}/payments/init",
                  json={"deliveryId": d["id"]},
                  headers=_h(ctok)).json()
    ref = init["reference"]
    other_tok, _, _ = _register(s, "CLIENT")
    r = s.post(f"{API}/payments/verify",
               json={"reference": ref},
               headers=_h(other_tok))
    assert r.status_code == 403


# ---------- Platform fee flow on DELIVERED ----------
def test_delivered_increments_rider_earnings_by_85_percent(s, ctok):
    """Rider earnings should increment by riderEarning (85%), not gross price."""
    # Use a fresh rider to avoid pollution from other tests
    r_tok, r_user, _ = _register(s, "RIDER")
    # Put rider online near pickup
    s.post(f"{API}/riders/online",
           json={"lat": PICKUP["lat"], "lng": PICKUP["lng"]},
           headers=_h(r_tok))

    price = 2000
    expected_earning = round(price * 0.85, 2)

    # Get baseline earnings
    stats_before = s.get(f"{API}/riders/stats", headers=_h(r_tok)).json()
    base_earnings = stats_before["stats"]["totalEarnings"]
    base_count = stats_before["stats"]["totalDeliveries"]

    # Client requests CASH delivery (no payment step)
    d = _request_delivery(s, ctok, "CASH", price=price)

    # Rider accepts
    ar = s.post(f"{API}/riders/accept",
                json={"deliveryId": d["id"]},
                headers=_h(r_tok))
    if ar.status_code == 409:
        pytest.skip("Delivery taken by another rider — race with prior fixtures")
    assert ar.status_code == 200, ar.text

    # PICKED_UP -> DELIVERED
    s.patch(f"{API}/deliveries/{d['id']}/status",
            json={"status": "PICKED_UP"},
            headers=_h(r_tok))
    dr = s.patch(f"{API}/deliveries/{d['id']}/status",
                 json={"status": "DELIVERED"},
                 headers=_h(r_tok))
    assert dr.status_code == 200

    # Verify earnings incremented by exactly 85%
    stats_after = s.get(f"{API}/riders/stats", headers=_h(r_tok)).json()
    delta_earn = stats_after["stats"]["totalEarnings"] - base_earnings
    delta_count = stats_after["stats"]["totalDeliveries"] - base_count
    assert delta_count == 1
    assert delta_earn == pytest.approx(expected_earning, rel=1e-3), \
        f"expected +{expected_earning}, got +{delta_earn} (gross={price})"

    # /riders/earnings returns price=riderEarning + grossPrice + platformFee
    er = s.get(f"{API}/riders/earnings", params={"period": "day"}, headers=_h(r_tok))
    assert er.status_code == 200
    ebody = er.json()
    match = next((x for x in ebody["deliveries"] if x["id"] == d["id"]), None)
    assert match is not None
    assert match["price"] == pytest.approx(expected_earning, rel=1e-3)
    assert match["grossPrice"] == pytest.approx(price, rel=1e-3)
    assert match["platformFee"] == pytest.approx(price * 0.15, rel=1e-3)


# ---------- Rider location endpoint ----------
def test_rider_location_updates_and_reflects_in_nearby(s):
    # Fresh rider to have a controlled position
    r_tok, r_user, _ = _register(s, "RIDER")
    # Go online at initial pos
    s.post(f"{API}/riders/online",
           json={"lat": 6.4000, "lng": 3.4000},
           headers=_h(r_tok))
    # Update to new pos
    new_lat, new_lng = 6.4285, 3.4225
    r = s.post(f"{API}/riders/location",
               json={"lat": new_lat, "lng": new_lng},
               headers=_h(r_tok))
    assert r.status_code == 200
    assert r.json()["success"] is True

    # Reflected in /riders/nearby
    nb = s.get(f"{API}/riders/nearby",
               params={"lat": new_lat, "lng": new_lng, "radius": 1}).json()["riders"]
    match = next((x for x in nb if x["id"] == r_user["id"]), None)
    assert match is not None
    assert match["currentLat"] == pytest.approx(new_lat, abs=1e-6)
    assert match["currentLng"] == pytest.approx(new_lng, abs=1e-6)


def test_client_cannot_update_location(s, ctok):
    r = s.post(f"{API}/riders/location",
               json={"lat": 6.42, "lng": 3.42},
               headers=_h(ctok))
    assert r.status_code == 403


def test_get_delivery_shows_live_rider_location(s, ctok):
    """After rider updates location, GET /api/deliveries/{id} should include rider.currentLat/Lng."""
    r_tok, r_user, _ = _register(s, "RIDER")
    # Online near pickup
    s.post(f"{API}/riders/online",
           json={"lat": PICKUP["lat"], "lng": PICKUP["lng"]},
           headers=_h(r_tok))
    d = _request_delivery(s, ctok, "CASH", price=1000)
    ar = s.post(f"{API}/riders/accept",
                json={"deliveryId": d["id"]},
                headers=_h(r_tok))
    if ar.status_code == 409:
        pytest.skip("Race with concurrent rider")
    assert ar.status_code == 200

    # Rider moves
    new_lat, new_lng = 6.4400, 3.4300
    s.post(f"{API}/riders/location",
           json={"lat": new_lat, "lng": new_lng},
           headers=_h(r_tok))

    # Client fetches delivery
    dv = s.get(f"{API}/deliveries/{d['id']}", headers=_h(ctok)).json()["delivery"]
    assert "rider" in dv
    assert dv["rider"]["currentLat"] == pytest.approx(new_lat, abs=1e-6)
    assert dv["rider"]["currentLng"] == pytest.approx(new_lng, abs=1e-6)


# ---------- Paystack webhook (mock mode) ----------
def test_paystack_webhook_mock_mode_does_not_crash(s):
    # In mock mode, signature check is skipped
    r = s.post(f"{API}/paystack/webhook",
               json={"event": "charge.success",
                     "data": {"reference": "WW-NOPE"}},
               headers={"Content-Type": "application/json"})
    assert r.status_code == 200
    assert r.json().get("received") is True


def test_paystack_webhook_marks_paid_in_mock(s, ctok):
    d = _request_delivery(s, ctok, "CARD", price=1100)
    init = s.post(f"{API}/payments/init",
                  json={"deliveryId": d["id"]},
                  headers=_h(ctok)).json()
    ref = init["reference"]
    r = s.post(f"{API}/paystack/webhook",
               json={"event": "charge.success", "data": {"reference": ref}})
    assert r.status_code == 200
    # Delivery should now be PAID
    dv = s.get(f"{API}/deliveries/{d['id']}", headers=_h(ctok)).json()["delivery"]
    assert dv["paymentStatus"] == "PAID"
    assert dv["status"] == "PENDING"
