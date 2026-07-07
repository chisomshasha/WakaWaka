"""
WakaWaka Backend Test Suite
Covers: seed, auth, riders (online/offline/location/nearby/stats/earnings),
deliveries (price-estimate/request/incoming/accept/decline/status/history/get/cancel/rate),
role authorization, JWT errors, MongoDB _id/password leakage.
"""
import os
import time
import uuid
import threading
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/") if os.environ.get("EXPO_PUBLIC_BACKEND_URL") else None
# Fallback: read from frontend/.env
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
                break

assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL not configured"
API = f"{BASE_URL}/api"

DEMO_CUSTOMER = {"phone": "+2348099999999", "password": "password123"}
DEMO_RIDER = {"phone": "+2348011111111", "password": "password123"}
DEMO_RIDER2 = {"phone": "+2348022222222", "password": "password123"}

# Lagos VI pickup / dropoff
PICKUP = {"lat": 6.4281, "lng": 3.4219, "addr": "Victoria Island"}
DROPOFF = {"lat": 6.4550, "lng": 3.4500, "addr": "Ikoyi"}


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def s():
    ses = requests.Session()
    ses.headers.update({"Content-Type": "application/json"})
    return ses


def _auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def seed(s):
    r = s.post(f"{API}/seed", timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="session")
def client_token(s, seed):
    r = s.post(f"{API}/auth/login", json=DEMO_CUSTOMER, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def rider_token(s, seed):
    r = s.post(f"{API}/auth/login", json=DEMO_RIDER, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def rider2_token(s, seed):
    r = s.post(f"{API}/auth/login", json=DEMO_RIDER2, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


# ---------- Seed ----------
def test_seed_idempotent(s, seed):
    # Call twice — second should not fail
    r = s.post(f"{API}/seed", timeout=30)
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True


# ---------- Auth ----------
def test_register_client(s):
    phone = f"+23480{uuid.uuid4().int % 10**8:08d}"
    r = s.post(f"{API}/auth/register", json={
        "phone": phone, "password": "password123", "name": "TEST_Client", "role": "CLIENT",
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert "token" in body
    assert body["user"]["role"] == "CLIENT"
    assert "password" not in body["user"]
    assert "_id" not in body["user"]


def test_register_rider(s):
    phone = f"+23480{uuid.uuid4().int % 10**8:08d}"
    r = s.post(f"{API}/auth/register", json={
        "phone": phone, "password": "password123", "name": "TEST_Rider",
        "role": "RIDER", "vehicleType": "Bajaj", "licensePlate": "LAG-TST-01",
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["user"]["role"] == "RIDER"
    assert body["user"]["rider"]["vehicleType"] == "Bajaj"
    assert body["user"]["rider"]["licensePlate"] == "LAG-TST-01"
    assert "password" not in body["user"]


def test_register_duplicate_phone(s):
    r = s.post(f"{API}/auth/register", json={
        "phone": DEMO_CUSTOMER["phone"], "password": "x", "name": "dup", "role": "CLIENT",
    })
    assert r.status_code == 400


def test_login_success_customer(s, client_token):
    assert client_token


def test_login_wrong_password(s):
    r = s.post(f"{API}/auth/login", json={"phone": DEMO_CUSTOMER["phone"], "password": "wrong"})
    assert r.status_code == 401


def test_auth_me(s, client_token):
    r = s.get(f"{API}/auth/me", headers=_auth_headers(client_token))
    assert r.status_code == 200
    user = r.json()["user"]
    assert user["phone"] == DEMO_CUSTOMER["phone"]
    assert "password" not in user
    assert "_id" not in user


def test_auth_me_invalid_token(s):
    r = s.get(f"{API}/auth/me", headers={"Authorization": "Bearer invalid.token.here"})
    assert r.status_code == 401


def test_auth_me_no_token(s):
    r = s.get(f"{API}/auth/me")
    assert r.status_code == 401


# ---------- Rider ops ----------
def test_riders_nearby(s, seed):
    r = s.get(f"{API}/riders/nearby", params={"lat": PICKUP["lat"], "lng": PICKUP["lng"], "radius": 10})
    assert r.status_code == 200
    riders = r.json()["riders"]
    assert len(riders) >= 5
    # Sorted asc by distance
    distances = [x["distance"] for x in riders]
    assert distances == sorted(distances)
    # No leaks
    for x in riders:
        assert "password" not in x
        assert "_id" not in x


def test_client_cannot_go_online(s, client_token):
    r = s.post(f"{API}/riders/online",
               json={"lat": PICKUP["lat"], "lng": PICKUP["lng"]},
               headers=_auth_headers(client_token))
    assert r.status_code == 403


def test_rider_online_offline_location(s, rider_token):
    # Online
    r = s.post(f"{API}/riders/online",
               json={"lat": PICKUP["lat"], "lng": PICKUP["lng"]},
               headers=_auth_headers(rider_token))
    assert r.status_code == 200 and r.json()["isOnline"] is True
    # Update location
    r = s.post(f"{API}/riders/location",
               json={"lat": PICKUP["lat"] + 0.001, "lng": PICKUP["lng"] + 0.001},
               headers=_auth_headers(rider_token))
    assert r.status_code == 200
    # Verify via /auth/me
    me = s.get(f"{API}/auth/me", headers=_auth_headers(rider_token)).json()["user"]
    assert me["rider"]["isOnline"] is True
    assert abs(me["rider"]["currentLat"] - (PICKUP["lat"] + 0.001)) < 1e-6
    # Offline
    r = s.post(f"{API}/riders/offline", headers=_auth_headers(rider_token))
    assert r.status_code == 200 and r.json()["isOnline"] is False
    # Restore online for later tests
    r = s.post(f"{API}/riders/online",
               json={"lat": PICKUP["lat"], "lng": PICKUP["lng"]},
               headers=_auth_headers(rider_token))
    assert r.status_code == 200


def test_rider_stats(s, rider_token):
    r = s.get(f"{API}/riders/stats", headers=_auth_headers(rider_token))
    assert r.status_code == 200
    body = r.json()
    assert "stats" in body and "rider" in body
    assert "totalDeliveries" in body["stats"]


def test_rider_earnings_week(s, rider_token):
    r = s.get(f"{API}/riders/earnings", params={"period": "week"},
              headers=_auth_headers(rider_token))
    assert r.status_code == 200
    body = r.json()
    assert body["period"] == "week"
    assert "totalEarnings" in body
    assert "deliveries" in body


def test_client_cannot_get_rider_stats(s, client_token):
    r = s.get(f"{API}/riders/stats", headers=_auth_headers(client_token))
    assert r.status_code == 403


# ---------- Delivery flow ----------
def test_price_estimate(s):
    r = s.post(f"{API}/deliveries/price-estimate", json={
        "pickupAddress": PICKUP["addr"], "pickupLat": PICKUP["lat"], "pickupLng": PICKUP["lng"],
        "dropoffAddress": DROPOFF["addr"], "dropoffLat": DROPOFF["lat"], "dropoffLng": DROPOFF["lng"],
        "price": 0,
    })
    assert r.status_code == 200
    body = r.json()
    assert body["distance"] > 0
    assert body["estimatedPrice"] >= 500  # base fare
    assert body["eta"] >= 5


def test_rider_cannot_request_delivery(s, rider_token):
    r = s.post(f"{API}/deliveries/request", json={
        "pickupAddress": PICKUP["addr"], "pickupLat": PICKUP["lat"], "pickupLng": PICKUP["lng"],
        "dropoffAddress": DROPOFF["addr"], "dropoffLat": DROPOFF["lat"], "dropoffLng": DROPOFF["lng"],
        "price": 1000, "paymentMethod": "CASH",
    }, headers=_auth_headers(rider_token))
    assert r.status_code == 403


def _make_delivery(s, client_token, price=1000):
    r = s.post(f"{API}/deliveries/request", json={
        "pickupAddress": PICKUP["addr"], "pickupLat": PICKUP["lat"], "pickupLng": PICKUP["lng"],
        "dropoffAddress": DROPOFF["addr"], "dropoffLat": DROPOFF["lat"], "dropoffLng": DROPOFF["lng"],
        "price": price, "paymentMethod": "CASH",
    }, headers=_auth_headers(client_token))
    assert r.status_code == 200, r.text
    body = r.json()
    return body["deliveryId"], body["delivery"]


def test_request_delivery_creates_candidates(s, client_token, rider_token):
    # Ensure rider is online at pickup
    s.post(f"{API}/riders/online", json={"lat": PICKUP["lat"], "lng": PICKUP["lng"]},
           headers=_auth_headers(rider_token))
    did, delivery = _make_delivery(s, client_token)
    assert delivery["status"] == "PENDING"
    assert len(delivery["candidateRiders"]) >= 1
    assert len(delivery["candidateRiders"]) <= 3
    assert "_id" not in delivery


def test_incoming_and_accept_and_status_flow(s, client_token, rider_token):
    # Rider online
    s.post(f"{API}/riders/online", json={"lat": PICKUP["lat"], "lng": PICKUP["lng"]},
           headers=_auth_headers(rider_token))
    did, _ = _make_delivery(s, client_token)

    # Incoming should include this delivery
    r = s.get(f"{API}/riders/incoming", headers=_auth_headers(rider_token))
    assert r.status_code == 200
    inc_ids = [x["id"] for x in r.json()["requests"]]
    assert did in inc_ids

    # Accept
    r = s.post(f"{API}/riders/accept", json={"deliveryId": did},
               headers=_auth_headers(rider_token))
    assert r.status_code == 200
    assert r.json()["delivery"]["status"] == "ACCEPTED"

    # Get stats before delivered — capture earnings
    stats_before = s.get(f"{API}/riders/stats", headers=_auth_headers(rider_token)).json()["stats"]

    # PICKED_UP
    r = s.patch(f"{API}/deliveries/{did}/status", json={"status": "PICKED_UP"},
                headers=_auth_headers(rider_token))
    assert r.status_code == 200
    assert r.json()["delivery"]["status"] == "PICKED_UP"

    # DELIVERED
    r = s.patch(f"{API}/deliveries/{did}/status", json={"status": "DELIVERED"},
                headers=_auth_headers(rider_token))
    assert r.status_code == 200
    delivered = r.json()["delivery"]
    assert delivered["status"] == "DELIVERED"

    # Rider totalDeliveries and earnings incremented
    stats_after = s.get(f"{API}/riders/stats", headers=_auth_headers(rider_token)).json()["stats"]
    assert stats_after["totalDeliveries"] == stats_before["totalDeliveries"] + 1
    # Earnings should increment by riderEarning (85%), not gross price
    expected_earning = delivered.get("riderEarning", delivered["price"])
    assert stats_after["totalEarnings"] >= stats_before["totalEarnings"] + expected_earning - 0.01

    # Rate
    r = s.post(f"{API}/deliveries/{did}/rate", json={"rating": 5},
               headers=_auth_headers(client_token))
    assert r.status_code == 200

    # Cannot rate twice
    r = s.post(f"{API}/deliveries/{did}/rate", json={"rating": 4},
               headers=_auth_headers(client_token))
    assert r.status_code == 400


def test_concurrent_accept_returns_409(s, client_token, rider_token, rider2_token):
    # Both riders online near pickup
    s.post(f"{API}/riders/online", json={"lat": PICKUP["lat"], "lng": PICKUP["lng"]},
           headers=_auth_headers(rider_token))
    s.post(f"{API}/riders/online", json={"lat": PICKUP["lat"] + 0.0005, "lng": PICKUP["lng"]},
           headers=_auth_headers(rider2_token))

    did, delivery = _make_delivery(s, client_token)
    cands = set(delivery["candidateRiders"])

    # Determine which rider tokens are candidates via /auth/me
    me1 = s.get(f"{API}/auth/me", headers=_auth_headers(rider_token)).json()["user"]["id"]
    me2 = s.get(f"{API}/auth/me", headers=_auth_headers(rider2_token)).json()["user"]["id"]
    # Both should be candidates typically; if not, skip
    if me1 not in cands or me2 not in cands:
        pytest.skip(f"Both riders not candidates: {cands}")

    results = {}

    def do_accept(name, tok):
        try:
            resp = requests.post(f"{API}/riders/accept", json={"deliveryId": did},
                                 headers=_auth_headers(tok), timeout=15)
            results[name] = resp.status_code
        except Exception as e:
            results[name] = str(e)

    t1 = threading.Thread(target=do_accept, args=("r1", rider_token))
    t2 = threading.Thread(target=do_accept, args=("r2", rider2_token))
    t1.start(); t2.start(); t1.join(); t2.join()
    codes = sorted(results.values())
    assert codes == [200, 409], f"Expected [200,409], got {codes} ({results})"


def test_decline_delivery(s, client_token, rider_token, rider2_token):
    s.post(f"{API}/riders/online", json={"lat": PICKUP["lat"], "lng": PICKUP["lng"]},
           headers=_auth_headers(rider_token))
    s.post(f"{API}/riders/online", json={"lat": PICKUP["lat"] + 0.0005, "lng": PICKUP["lng"]},
           headers=_auth_headers(rider2_token))
    did, _ = _make_delivery(s, client_token)
    r = s.post(f"{API}/riders/decline", json={"deliveryId": did},
               headers=_auth_headers(rider_token))
    assert r.status_code == 200
    # Rider1's incoming should not include it now
    inc = s.get(f"{API}/riders/incoming", headers=_auth_headers(rider_token)).json()["requests"]
    assert did not in [x["id"] for x in inc]


def test_get_delivery_authorization(s, client_token, rider_token, rider2_token):
    s.post(f"{API}/riders/online", json={"lat": PICKUP["lat"], "lng": PICKUP["lng"]},
           headers=_auth_headers(rider_token))
    did, _ = _make_delivery(s, client_token)
    # Client can view
    r = s.get(f"{API}/deliveries/{did}", headers=_auth_headers(client_token))
    assert r.status_code == 200
    # Unassigned rider (rider2) not authorized (still PENDING, no rider assigned)
    r = s.get(f"{API}/deliveries/{did}", headers=_auth_headers(rider2_token))
    assert r.status_code == 403


def test_delivery_history_filters(s, client_token, rider_token):
    r = s.get(f"{API}/deliveries/history", headers=_auth_headers(client_token))
    assert r.status_code == 200
    for d in r.json()["deliveries"]:
        assert d["clientId"]  # client's deliveries

    r = s.get(f"{API}/deliveries/history", headers=_auth_headers(rider_token))
    assert r.status_code == 200


def test_cancel_before_pickup(s, client_token, rider_token):
    s.post(f"{API}/riders/online", json={"lat": PICKUP["lat"], "lng": PICKUP["lng"]},
           headers=_auth_headers(rider_token))
    did, _ = _make_delivery(s, client_token)
    r = s.post(f"{API}/deliveries/{did}/cancel", headers=_auth_headers(client_token))
    assert r.status_code == 200
    # Cannot cancel a delivered one — create+deliver+cancel
    did2, _ = _make_delivery(s, client_token)
    s.post(f"{API}/riders/accept", json={"deliveryId": did2}, headers=_auth_headers(rider_token))
    s.patch(f"{API}/deliveries/{did2}/status", json={"status": "PICKED_UP"},
            headers=_auth_headers(rider_token))
    s.patch(f"{API}/deliveries/{did2}/status", json={"status": "DELIVERED"},
            headers=_auth_headers(rider_token))
    r = s.post(f"{API}/deliveries/{did2}/cancel", headers=_auth_headers(client_token))
    assert r.status_code == 400


def test_no_riders_available(s, client_token):
    # Use a pickup very far from any online rider (Abuja) so radius yields 0 candidates.
    # This avoids test pollution from ephemeral riders registered by other tests.
    r = s.post(f"{API}/deliveries/request", json={
        "pickupAddress": "Abuja", "pickupLat": 9.0765, "pickupLng": 7.3986,
        "dropoffAddress": "Abuja Downtown", "dropoffLat": 9.0800, "dropoffLng": 7.4000,
        "price": 1000, "paymentMethod": "CASH",
    }, headers=_auth_headers(client_token))
    assert r.status_code == 404
