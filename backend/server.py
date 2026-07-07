"""
WakaWaka Bike Delivery Backend
FastAPI + MongoDB (Motor) + JWT auth
Roles: CLIENT (customer) and RIDER
"""
import os
import math
import uuid
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Optional, Literal

import bcrypt
import httpx
import jwt
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request, status, Query
from fastapi.responses import HTMLResponse
from fastapi.security import OAuth2PasswordBearer
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ---------- Config ----------
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))

BASE_PRICE_NGN = 500  # ₦500 base fare
PRICE_PER_KM_NGN = 200  # ₦200/km
NEARBY_RADIUS_KM = 10
INCOMING_REQUEST_TIMEOUT_SEC = 60

PAYSTACK_SECRET_KEY = os.environ.get("PAYSTACK_SECRET_KEY", "")
PAYSTACK_BASE_URL = "https://api.paystack.co"
PLATFORM_FEE_PERCENT = float(os.environ.get("PLATFORM_FEE_PERCENT", "15"))
IS_PAYSTACK_MOCK = (not PAYSTACK_SECRET_KEY) or PAYSTACK_SECRET_KEY.startswith("sk_test_placeholder")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("wakawaka")

app = FastAPI(title="WakaWaka API")
api = APIRouter(prefix="/api")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


# ---------- Utils ----------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False


def create_access_token(payload: dict) -> str:
    to_encode = payload.copy()
    to_encode["exp"] = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2)
    return 2 * R * math.asin(math.sqrt(a))


def calc_price(distance_km: float) -> float:
    return round(BASE_PRICE_NGN + PRICE_PER_KM_NGN * distance_km, 2)


def clean(doc: dict) -> dict:
    if not doc:
        return doc
    doc.pop("_id", None)
    doc.pop("password", None)
    return doc


async def get_current_user(token: Optional[str] = Depends(oauth2_scheme)) -> dict:
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ---------- Models ----------
class RegisterRequest(BaseModel):
    phone: str
    password: str
    name: str
    role: Literal["CLIENT", "RIDER"]
    vehicleType: Optional[str] = None
    licensePlate: Optional[str] = None


class LoginRequest(BaseModel):
    phone: str
    password: str


class TokenResponse(BaseModel):
    user: dict
    token: str


class DeliveryRequestBody(BaseModel):
    pickupAddress: str
    pickupLat: float
    pickupLng: float
    dropoffAddress: str
    dropoffLat: float
    dropoffLng: float
    price: float
    paymentMethod: Literal["CASH", "CARD", "WALLET"] = "CASH"


class StatusUpdateBody(BaseModel):
    status: Literal["PICKED_UP", "DELIVERED"]


class RateBody(BaseModel):
    rating: float = Field(ge=1, le=5)


class LocationUpdateBody(BaseModel):
    lat: float
    lng: float


class OnlineBody(BaseModel):
    lat: float
    lng: float


class AcceptBody(BaseModel):
    deliveryId: str


# ---------- Auth Routes ----------
@api.post("/auth/register", response_model=TokenResponse)
async def register(body: RegisterRequest):
    existing = await db.users.find_one({"phone": body.phone})
    if existing:
        raise HTTPException(status_code=400, detail="Phone already registered")

    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    user_doc = {
        "id": user_id,
        "phone": body.phone,
        "name": body.name,
        "password": hash_password(body.password),
        "role": body.role,
        "createdAt": now,
        "updatedAt": now,
    }
    if body.role == "RIDER":
        user_doc["rider"] = {
            "vehicleType": body.vehicleType or "Motorcycle",
            "licensePlate": body.licensePlate or "",
            "isOnline": False,
            "currentLat": None,
            "currentLng": None,
            "rating": 5.0,
            "totalDeliveries": 0,
            "earnings": 0.0,
            "lastLocationUpdate": now,
        }
    await db.users.insert_one(user_doc)
    token = create_access_token({"sub": user_id, "role": body.role})
    return {"user": clean(user_doc.copy()), "token": token}


@api.post("/auth/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    user = await db.users.find_one({"phone": body.phone})
    if not user or not verify_password(body.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid phone or password")
    token = create_access_token({"sub": user["id"], "role": user["role"]})
    return {"user": clean(user), "token": token}


@api.get("/auth/me")
async def me(current=Depends(get_current_user)):
    return {"user": current}


# ---------- Rider Routes ----------
@api.post("/riders/online")
async def go_online(body: OnlineBody, current=Depends(get_current_user)):
    if current["role"] != "RIDER":
        raise HTTPException(status_code=403, detail="Only riders can go online")
    now = datetime.now(timezone.utc).isoformat()
    await db.users.update_one(
        {"id": current["id"]},
        {"$set": {
            "rider.isOnline": True,
            "rider.currentLat": body.lat,
            "rider.currentLng": body.lng,
            "rider.lastLocationUpdate": now,
        }},
    )
    return {"success": True, "isOnline": True}


@api.post("/riders/offline")
async def go_offline(current=Depends(get_current_user)):
    if current["role"] != "RIDER":
        raise HTTPException(status_code=403, detail="Only riders")
    await db.users.update_one({"id": current["id"]}, {"$set": {"rider.isOnline": False}})
    return {"success": True, "isOnline": False}


@api.post("/riders/location")
async def update_location(body: LocationUpdateBody, current=Depends(get_current_user)):
    if current["role"] != "RIDER":
        raise HTTPException(status_code=403, detail="Only riders")
    now = datetime.now(timezone.utc).isoformat()
    await db.users.update_one(
        {"id": current["id"]},
        {"$set": {
            "rider.currentLat": body.lat,
            "rider.currentLng": body.lng,
            "rider.lastLocationUpdate": now,
        }},
    )
    return {"success": True}


@api.get("/riders/nearby")
async def nearby_riders(
    lat: float = Query(...),
    lng: float = Query(...),
    radius: float = Query(NEARBY_RADIUS_KM),
):
    """Return online riders within radius (km), sorted by distance."""
    cursor = db.users.find(
        {"role": "RIDER", "rider.isOnline": True, "rider.currentLat": {"$ne": None}},
        {"_id": 0, "password": 0},
    )
    results = []
    async for r in cursor:
        rd = r.get("rider") or {}
        rlat, rlng = rd.get("currentLat"), rd.get("currentLng")
        if rlat is None or rlng is None:
            continue
        dist = haversine_km(lat, lng, rlat, rlng)
        if dist <= radius:
            results.append({
                "id": r["id"],
                "userId": r["id"],
                "name": r["name"],
                "phone": r["phone"],
                "vehicleType": rd.get("vehicleType", "Motorcycle"),
                "licensePlate": rd.get("licensePlate", ""),
                "rating": rd.get("rating", 5.0),
                "distance": round(dist, 2),
                "isOnline": True,
                "currentLat": rlat,
                "currentLng": rlng,
            })
    results.sort(key=lambda x: x["distance"])
    return {"riders": results[:20]}


@api.get("/riders/stats")
async def rider_stats(current=Depends(get_current_user)):
    if current["role"] != "RIDER":
        raise HTTPException(status_code=403, detail="Only riders")
    rider = current.get("rider", {})
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    today_cursor = db.deliveries.find({
        "riderId": current["id"],
        "status": "DELIVERED",
        "deliveredAt": {"$gte": today_start},
    }, {"_id": 0})
    today_deliveries = 0
    today_earnings = 0.0
    async for d in today_cursor:
        today_deliveries += 1
        today_earnings += d.get("riderEarning", d.get("price", 0))

    active = await db.deliveries.find_one(
        {"riderId": current["id"], "status": {"$in": ["ACCEPTED", "PICKED_UP"]}},
        {"_id": 0},
    )
    return {
        "rider": rider,
        "stats": {
            "totalDeliveries": rider.get("totalDeliveries", 0),
            "totalEarnings": rider.get("earnings", 0),
            "rating": rider.get("rating", 5.0),
            "todayDeliveries": today_deliveries,
            "todayEarnings": round(today_earnings, 2),
            "isOnline": rider.get("isOnline", False),
            "currentDelivery": active,
        },
    }


@api.get("/riders/earnings")
async def rider_earnings(period: Literal["day", "week", "month"] = "week",
                        current=Depends(get_current_user)):
    if current["role"] != "RIDER":
        raise HTTPException(status_code=403, detail="Only riders")
    now = datetime.now(timezone.utc)
    if period == "day":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "week":
        start = now - timedelta(days=7)
    else:
        start = now - timedelta(days=30)

    cursor = db.deliveries.find({
        "riderId": current["id"],
        "status": "DELIVERED",
        "deliveredAt": {"$gte": start.isoformat()},
    }, {"_id": 0}).sort("deliveredAt", -1)

    deliveries = []
    total = 0.0
    async for d in cursor:
        earning = d.get("riderEarning", d.get("price", 0))
        total += earning
        deliveries.append({
            "id": d["id"],
            "price": earning,
            "grossPrice": d.get("price"),
            "platformFee": d.get("platformFee", 0),
            "deliveredAt": d.get("deliveredAt"),
            "pickupAddress": d["pickupAddress"],
            "dropoffAddress": d["dropoffAddress"],
            "distance": d.get("distance"),
        })
    count = len(deliveries)
    avg = round(total / count, 2) if count else 0
    return {
        "period": period,
        "totalEarnings": round(total, 2),
        "averageEarnings": avg,
        "count": count,
        "deliveries": deliveries,
    }


@api.get("/riders/incoming")
async def get_incoming_requests(current=Depends(get_current_user)):
    """Poll for pending deliveries where this rider is in candidateRiders and delivery is still PENDING."""
    if current["role"] != "RIDER":
        raise HTTPException(status_code=403, detail="Only riders")
    now = datetime.now(timezone.utc)
    cutoff = (now - timedelta(seconds=INCOMING_REQUEST_TIMEOUT_SEC)).isoformat()
    cursor = db.deliveries.find({
        "status": "PENDING",
        "paymentStatus": {"$in": ["PAID", "PAID_ON_DELIVERY"]},
        "candidateRiders": current["id"],
        "createdAt": {"$gte": cutoff},
        "declinedBy": {"$ne": current["id"]},
    }, {"_id": 0}).sort("createdAt", -1)
    requests = []
    async for d in cursor:
        # Compute distance from rider to pickup
        rider = current.get("rider", {})
        rlat, rlng = rider.get("currentLat"), rider.get("currentLng")
        dist_to_pickup = (
            haversine_km(rlat, rlng, d["pickupLat"], d["pickupLng"])
            if rlat is not None and rlng is not None else None
        )
        # Compute seconds remaining
        created_at = datetime.fromisoformat(d["createdAt"])
        elapsed = (now - created_at).total_seconds()
        remaining = max(0, INCOMING_REQUEST_TIMEOUT_SEC - int(elapsed))
        requests.append({**d, "distanceToPickup": dist_to_pickup, "secondsRemaining": remaining})
    return {"requests": requests}


@api.post("/riders/accept")
async def accept_delivery(body: AcceptBody, current=Depends(get_current_user)):
    """Atomic accept: only first rider wins."""
    if current["role"] != "RIDER":
        raise HTTPException(status_code=403, detail="Only riders")
    now = datetime.now(timezone.utc).isoformat()
    result = await db.deliveries.find_one_and_update(
        {
            "id": body.deliveryId,
            "status": "PENDING",
            "candidateRiders": current["id"],  # must be one of the matched riders
        },
        {"$set": {
            "riderId": current["id"],
            "status": "ACCEPTED",
            "acceptedAt": now,
            "updatedAt": now,
        }},
        return_document=True,
        projection={"_id": 0},
    )
    if not result:
        raise HTTPException(status_code=409, detail="Delivery already taken, expired, or not offered to you")
    # Attach rider info for client
    return {"delivery": result}


@api.post("/riders/decline")
async def decline_delivery(body: AcceptBody, current=Depends(get_current_user)):
    if current["role"] != "RIDER":
        raise HTTPException(status_code=403, detail="Only riders")
    await db.deliveries.update_one(
        {"id": body.deliveryId, "status": "PENDING"},
        {"$addToSet": {"declinedBy": current["id"]}},
    )
    return {"success": True}


# ---------- Delivery Routes ----------
@api.post("/deliveries/price-estimate")
async def price_estimate(body: DeliveryRequestBody):
    dist = haversine_km(body.pickupLat, body.pickupLng, body.dropoffLat, body.dropoffLng)
    price = calc_price(dist)
    return {
        "distance": round(dist, 2),
        "estimatedPrice": price,
        "minPrice": price,
        "maxPrice": round(price * 1.5, 2),
        "eta": max(5, int(dist * 3)),  # ~3 min per km
    }


@api.post("/deliveries/request")
async def request_delivery(body: DeliveryRequestBody, current=Depends(get_current_user)):
    if current["role"] != "CLIENT":
        raise HTTPException(status_code=403, detail="Only clients can request deliveries")

    # Find nearest 3 online riders within radius
    all_riders_cursor = db.users.find(
        {"role": "RIDER", "rider.isOnline": True, "rider.currentLat": {"$ne": None}},
        {"_id": 0, "id": 1, "rider.currentLat": 1, "rider.currentLng": 1},
    )
    candidates = []
    async for r in all_riders_cursor:
        rd = r.get("rider", {})
        d = haversine_km(body.pickupLat, body.pickupLng, rd["currentLat"], rd["currentLng"])
        if d <= NEARBY_RADIUS_KM:
            candidates.append((r["id"], d))
    candidates.sort(key=lambda x: x[1])
    candidate_ids = [c[0] for c in candidates[:3]]

    if not candidate_ids:
        raise HTTPException(status_code=404, detail="No riders available nearby")

    dist = haversine_km(body.pickupLat, body.pickupLng, body.dropoffLat, body.dropoffLng)
    now = datetime.now(timezone.utc).isoformat()
    delivery_id = str(uuid.uuid4())

    price = calc_price(dist)

    payment_status = "PAID_ON_DELIVERY" if body.paymentMethod == "CASH" else "PENDING_PAYMENT"
    platform_fee = round(price * (PLATFORM_FEE_PERCENT / 100.0), 2)
    rider_earning = round(price - platform_fee, 2)

    delivery = {
        "id": delivery_id,
        "clientId": current["id"],
        "clientName": current["name"],
        "clientPhone": current["phone"],
        "riderId": None,
        "pickupAddress": body.pickupAddress,
        "pickupLat": body.pickupLat,
        "pickupLng": body.pickupLng,
        "dropoffAddress": body.dropoffAddress,
        "dropoffLat": body.dropoffLat,
        "dropoffLng": body.dropoffLng,
        "status": "PENDING" if payment_status != "PENDING_PAYMENT" else "AWAITING_PAYMENT",
        "price": price,
        "platformFee": platform_fee,
        "riderEarning": rider_earning,
        "distance": round(dist, 2),
        "duration": max(5, int(dist * 3)),
        "paymentMethod": body.paymentMethod,
        "paymentStatus": payment_status,
        "paymentReference": None,
        "candidateRiders": candidate_ids,
        "declinedBy": [],
        "createdAt": now,
        "updatedAt": now,
        "acceptedAt": None,
        "pickedUpAt": None,
        "deliveredAt": None,
    }
    await db.deliveries.insert_one(delivery)
    delivery.pop("_id", None)
    return {"deliveryId": delivery_id, "delivery": delivery}


async def _attach_rider(delivery: dict) -> dict:
    if delivery and delivery.get("riderId"):
        rider_user = await db.users.find_one({"id": delivery["riderId"]}, {"_id": 0, "password": 0})
        if rider_user:
            delivery["rider"] = {
                "id": rider_user["id"],
                "name": rider_user["name"],
                "phone": rider_user["phone"],
                "vehicleType": rider_user.get("rider", {}).get("vehicleType"),
                "licensePlate": rider_user.get("rider", {}).get("licensePlate"),
                "rating": rider_user.get("rider", {}).get("rating", 5.0),
                "currentLat": rider_user.get("rider", {}).get("currentLat"),
                "currentLng": rider_user.get("rider", {}).get("currentLng"),
            }
    return delivery


async def _maybe_expire(d: dict) -> dict:
    if d and d.get("status") == "PENDING":
        try:
            created_at = datetime.fromisoformat(d["createdAt"])
        except (ValueError, KeyError):
            return d
        elapsed = (datetime.now(timezone.utc) - created_at).total_seconds()
        if elapsed > INCOMING_REQUEST_TIMEOUT_SEC:
            now = datetime.now(timezone.utc).isoformat()
            result = await db.deliveries.find_one_and_update(
                {"id": d["id"], "status": "PENDING"},
                {"$set": {"status": "NO_RIDERS_AVAILABLE", "updatedAt": now}},
                return_document=True,
                projection={"_id": 0},
            )
            if result:
                d = result
    return d


@api.get("/deliveries/history")
async def delivery_history(current=Depends(get_current_user)):
    query = {"clientId": current["id"]} if current["role"] == "CLIENT" else {"riderId": current["id"]}
    cursor = db.deliveries.find(query, {"_id": 0}).sort("createdAt", -1).limit(50)
    deliveries = []
    async for d in cursor:
        d = await _maybe_expire(d)
        deliveries.append(await _attach_rider(d))
    return {"deliveries": deliveries}


@api.get("/deliveries/{delivery_id}")
async def get_delivery(delivery_id: str, current=Depends(get_current_user)):
    d = await db.deliveries.find_one({"id": delivery_id}, {"_id": 0})
    if not d:
        raise HTTPException(status_code=404, detail="Delivery not found")
    if d["clientId"] != current["id"] and d.get("riderId") != current["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    d = await _maybe_expire(d)
    d = await _attach_rider(d)
    return {"delivery": d}


@api.patch("/deliveries/{delivery_id}/status")
async def update_delivery_status(delivery_id: str, body: StatusUpdateBody,
                                current=Depends(get_current_user)):
    d = await db.deliveries.find_one({"id": delivery_id}, {"_id": 0})
    if not d:
        raise HTTPException(status_code=404, detail="Delivery not found")
    if d.get("riderId") != current["id"]:
        raise HTTPException(status_code=403, detail="Only the assigned rider can update")

    now = datetime.now(timezone.utc).isoformat()
    update = {"status": body.status, "updatedAt": now}
    if body.status == "PICKED_UP":
        update["pickedUpAt"] = now
    elif body.status == "DELIVERED":
        update["deliveredAt"] = now
        earning = d.get("riderEarning", d.get("price", 0))
        await db.users.update_one(
            {"id": current["id"]},
            {"$inc": {"rider.totalDeliveries": 1, "rider.earnings": earning}},
        )

    await db.deliveries.update_one({"id": delivery_id}, {"$set": update})
    updated = await db.deliveries.find_one({"id": delivery_id}, {"_id": 0})
    updated = await _attach_rider(updated)
    return {"delivery": updated}


@api.post("/deliveries/{delivery_id}/cancel")
async def cancel_delivery(delivery_id: str, current=Depends(get_current_user)):
    d = await db.deliveries.find_one({"id": delivery_id}, {"_id": 0})
    if not d:
        raise HTTPException(status_code=404, detail="Delivery not found")
    if d["clientId"] != current["id"]:
        raise HTTPException(status_code=403, detail="Only client can cancel")
    if d["status"] in ("DELIVERED", "CANCELLED"):
        raise HTTPException(status_code=400, detail=f"Cannot cancel {d['status']} delivery")
    now = datetime.now(timezone.utc).isoformat()
    await db.deliveries.update_one({"id": delivery_id},
                                   {"$set": {"status": "CANCELLED", "updatedAt": now}})
    return {"success": True}


@api.post("/deliveries/{delivery_id}/rate")
async def rate_delivery(delivery_id: str, body: RateBody, current=Depends(get_current_user)):
    d = await db.deliveries.find_one({"id": delivery_id}, {"_id": 0})
    if not d:
        raise HTTPException(status_code=404, detail="Delivery not found")
    if d["clientId"] != current["id"]:
        raise HTTPException(status_code=403, detail="Only client can rate")
    if d["status"] != "DELIVERED":
        raise HTTPException(status_code=400, detail="Can only rate completed deliveries")
    if d.get("rating"):
        raise HTTPException(status_code=400, detail="Already rated")

    await db.deliveries.update_one({"id": delivery_id}, {"$set": {"rating": body.rating}})
    if d.get("riderId"):
        rider_user = await db.users.find_one({"id": d["riderId"]}, {"_id": 0})
        if rider_user:
            rd = rider_user.get("rider", {})
            total = rd.get("totalDeliveries", 1) or 1
            current_rating = rd.get("rating", 5.0)
            new_rating = round((current_rating * (total - 1) + body.rating) / total, 2)
            await db.users.update_one({"id": d["riderId"]},
                                    {"$set": {"rider.rating": new_rating}})
    return {"success": True}


# ---------- Paystack Payment Routes ----------
class PaymentInitBody(BaseModel):
    deliveryId: str
    email: Optional[str] = None


async def _paystack_call(method: str, path: str, json_body: Optional[dict] = None):
    if IS_PAYSTACK_MOCK:
        return None
    headers = {
        "Authorization": f"Bearer {PAYSTACK_SECRET_KEY}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=30.0) as client_http:
        if method == "POST":
            res = await client_http.post(f"{PAYSTACK_BASE_URL}{path}", json=json_body, headers=headers)
        else:
            res = await client_http.get(f"{PAYSTACK_BASE_URL}{path}", headers=headers)
        res.raise_for_status()
        return res.json()


@api.post("/payments/init")
async def init_payment(body: PaymentInitBody, request: Request, current=Depends(get_current_user)):
    delivery = await db.deliveries.find_one({"id": body.deliveryId}, {"_id": 0})
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")
    if delivery["clientId"] != current["id"]:
        raise HTTPException(status_code=403, detail="Not your delivery")
    if delivery.get("paymentStatus") == "PAID":
        return {"alreadyPaid": True, "reference": delivery.get("paymentReference")}

    reference = f"WW-{uuid.uuid4().hex[:16].upper()}"
    amount_kobo = int(round(delivery["price"] * 100))
    email = body.email or f"{current['phone'].replace('+','')}@wakawaka.demo"

    base_url = str(request.base_url).rstrip("/")
    callback_url = f"{base_url}/api/payments/callback"

    paystack_res = await _paystack_call(
        "POST",
        "/transaction/initialize",
        {
            "email": email,
            "amount": amount_kobo,
            "reference": reference,
            "callback_url": callback_url,
            "metadata": {"deliveryId": body.deliveryId, "clientId": current["id"]},
        },
    )

    if paystack_res is None:
        authorization_url = f"{base_url}/api/payments/mock-checkout?reference={reference}"
        access_code = "mock_access_code"
    else:
        data = paystack_res.get("data") or {}
        authorization_url = data.get("authorization_url")
        access_code = data.get("access_code")
        if not authorization_url:
            raise HTTPException(status_code=502, detail="Paystack init failed")

    now = datetime.now(timezone.utc).isoformat()
    await db.deliveries.update_one(
        {"id": body.deliveryId},
        {"$set": {"paymentReference": reference, "paymentStatus": "INITIALIZED", "updatedAt": now}},
    )
    await db.payments.insert_one({
        "reference": reference,
        "deliveryId": body.deliveryId,
        "clientId": current["id"],
        "amount": delivery["price"],
        "amountKobo": amount_kobo,
        "status": "INITIALIZED",
        "provider": "mock" if IS_PAYSTACK_MOCK else "paystack",
        "createdAt": now,
    })
    return {
        "authorizationUrl": authorization_url,
        "reference": reference,
        "accessCode": access_code,
        "isMock": IS_PAYSTACK_MOCK,
    }


class PaymentVerifyBody(BaseModel):
    reference: str


async def _mark_paid(reference: str, provider_status: str, provider_data: dict) -> Optional[dict]:
    payment = await db.payments.find_one({"reference": reference}, {"_id": 0})
    if not payment:
        return None
    delivery = await db.deliveries.find_one({"id": payment["deliveryId"]}, {"_id": 0})
    if not delivery:
        return None
    now = datetime.now(timezone.utc).isoformat()
    if delivery.get("paymentStatus") == "PAID":
        return delivery
    await db.payments.update_one(
        {"reference": reference},
        {"$set": {"status": "PAID", "providerStatus": provider_status,
                 "providerData": provider_data, "paidAt": now}},
    )

    all_riders_cursor = db.users.find(
        {"role": "RIDER", "rider.isOnline": True, "rider.currentLat": {"$ne": None}},
        {"_id": 0, "id": 1, "rider.currentLat": 1, "rider.currentLng": 1},
    )
    fresh_candidates: list[tuple[str, float]] = []
    async for r in all_riders_cursor:
        rd = r.get("rider", {})
        d = haversine_km(delivery["pickupLat"], delivery["pickupLng"], rd["currentLat"], rd["currentLng"])
        if d <= NEARBY_RADIUS_KM:
            fresh_candidates.append((r["id"], d))
    fresh_candidates.sort(key=lambda x: x[1])
    candidate_ids = [c[0] for c in fresh_candidates[:3]] or delivery.get("candidateRiders", [])

    await db.deliveries.update_one(
        {"id": payment["deliveryId"]},
        {"$set": {
            "paymentStatus": "PAID",
            "status": "PENDING",
            "candidateRiders": candidate_ids,
            "createdAt": now,
            "updatedAt": now,
            "paidAt": now,
        }},
    )
    return await db.deliveries.find_one({"id": payment["deliveryId"]}, {"_id": 0})


@api.post("/payments/verify")
async def verify_payment(body: PaymentVerifyBody, current=Depends(get_current_user)):
    payment = await db.payments.find_one({"reference": body.reference}, {"_id": 0})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    delivery = await db.deliveries.find_one({"id": payment["deliveryId"]}, {"_id": 0})
    if not delivery or delivery["clientId"] != current["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    if delivery.get("paymentStatus") == "PAID":
        return {"paymentStatus": "PAID", "delivery": delivery}

    provider_res = await _paystack_call("GET", f"/transaction/verify/{body.reference}")

    if provider_res is None:
        if payment.get("status") == "MOCK_APPROVED":
            updated = await _mark_paid(body.reference, "success", {"mock": True})
            return {"paymentStatus": "PAID", "delivery": updated}
        return {"paymentStatus": "PENDING", "delivery": delivery}

    data = provider_res.get("data") or {}
    prov_status = data.get("status")
    if prov_status == "success" and data.get("amount") == payment["amountKobo"]:
        updated = await _mark_paid(body.reference, prov_status, data)
        return {"paymentStatus": "PAID", "delivery": updated}

    now = datetime.now(timezone.utc).isoformat()
    await db.payments.update_one(
        {"reference": body.reference},
        {"$set": {"status": "FAILED", "providerStatus": prov_status, "providerData": data,
                 "updatedAt": now}},
    )
    return {"paymentStatus": "FAILED", "delivery": delivery}


# --- Mock checkout pages (for placeholder key testing) ---
@api.get("/payments/mock-checkout", response_class=HTMLResponse)
async def mock_checkout(reference: str):
    payment = await db.payments.find_one({"reference": reference}, {"_id": 0})
    if not payment:
        return HTMLResponse("<h1>Payment not found</h1>", status_code=404)
    delivery = await db.deliveries.find_one({"id": payment["deliveryId"]}, {"_id": 0})
    amount_naira = payment["amount"]
    html = f"""
    <!DOCTYPE html><html><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>WakaWaka Payment (Demo)</title>
    <style>
      body {{ font-family: -apple-system, sans-serif; background:#0A0A0A; color:#fff;
             margin:0; padding:24px; min-height:100vh; box-sizing:border-box; }}
      .card {{ background:#1a1a1a; border-radius:20px; padding:24px; margin-top:40px;
              border:1px solid #333; }}
      .brand {{ color:#FF4F00; font-size:14px; font-weight:800; letter-spacing:2px; }}
      h1 {{ font-size:32px; margin:8px 0; letter-spacing:-1px; }}
      .amount {{ font-size:48px; font-weight:800; color:#FF4F00; margin:20px 0; }}
      .route {{ background:#111; border-radius:12px; padding:16px; margin:16px 0; font-size:14px; }}
      .btn {{ display:block; width:100%; height:56px; background:#FF4F00; color:#fff;
              border:none; border-radius:16px; font-size:18px; font-weight:800;
              margin-top:12px; cursor:pointer; letter-spacing:0.5px; }}
      .btn-cancel {{ background:transparent; border:2px solid #444; color:#fff; }}
      .warn {{ background:#3b2c1a; border-left:4px solid #F59E0B; padding:12px;
               border-radius:8px; font-size:12px; margin:16px 0; color:#F5D69B; }}
    </style></head><body>
    <div class="card">
      <div class="brand">WAKAWAKA PAYMENT · DEMO MODE</div>
      <h1>Confirm payment</h1>
      <div class="amount">₦{amount_naira:,.2f}</div>
      <div class="route">
        <div style="opacity:0.6;font-size:11px;letter-spacing:1px;">FROM</div>
        <div>{(delivery or {}).get('pickupAddress','—')}</div>
        <div style="opacity:0.6;font-size:11px;letter-spacing:1px;margin-top:8px;">TO</div>
        <div>{(delivery or {}).get('dropoffAddress','—')}</div>
      </div>
      <div class="warn">
        Running in <b>DEMO MODE</b> (no Paystack key configured). Add your
        <code>PAYSTACK_SECRET_KEY</code> to <code>/app/backend/.env</code> for real charges.
      </div>
      <form method="POST" action="/api/payments/mock-approve?reference={reference}">
        <button class="btn" type="submit">Pay ₦{amount_naira:,.0f}</button>
      </form>
      <form method="POST" action="/api/payments/mock-cancel?reference={reference}">
        <button class="btn btn-cancel" type="submit">Cancel</button>
      </form>
    </div></body></html>
    """
    return HTMLResponse(html)


@api.post("/payments/mock-approve", response_class=HTMLResponse)
async def mock_approve(reference: str):
    now = datetime.now(timezone.utc).isoformat()
    await db.payments.update_one(
        {"reference": reference},
        {"$set": {"status": "MOCK_APPROVED", "updatedAt": now}},
    )
    await _mark_paid(reference, "success", {"mock": True})
    return HTMLResponse(_callback_html(reference, "success"))


@api.post("/payments/mock-cancel", response_class=HTMLResponse)
async def mock_cancel(reference: str):
    now = datetime.now(timezone.utc).isoformat()
    await db.payments.update_one(
        {"reference": reference},
        {"$set": {"status": "CANCELLED", "updatedAt": now}},
    )
    return HTMLResponse(_callback_html(reference, "cancelled"))


@api.get("/payments/callback", response_class=HTMLResponse)
async def payments_callback(reference: str = ""):
    return HTMLResponse(_callback_html(reference, "success"))


def _callback_html(reference: str, outcome: str) -> str:
    color = "#10B981" if outcome == "success" else "#EF4444"
    icon = "✓" if outcome == "success" else "×"
    msg = "Payment complete" if outcome == "success" else "Payment cancelled"
    return f"""
    <!DOCTYPE html><html><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>WakaWaka</title>
    <style>
      body {{ font-family:-apple-system, sans-serif; background:#0A0A0A; color:#fff;
             display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; }}
      .box {{ text-align:center; padding:24px; }}
      .dot {{ width:96px; height:96px; border-radius:48px; background:{color};
             display:inline-flex; align-items:center; justify-content:center;
             font-size:56px; color:#fff; margin-bottom:16px; }}
    </style></head>
    <body data-ww-payment-callback="1" data-ww-reference="{reference}" data-ww-outcome="{outcome}">
      <div class="box">
        <div class="dot">{icon}</div>
        <h1>{msg}</h1>
        <p style="opacity:0.7;">You can close this window.</p>
      </div>
    </body></html>
    """


@api.post("/paystack/webhook")
async def paystack_webhook(request: Request):
    body_bytes = await request.body()
    signature = request.headers.get("x-paystack-signature", "")
    if not IS_PAYSTACK_MOCK:
        import hmac as _hmac
        import hashlib as _hashlib
        computed = _hmac.new(PAYSTACK_SECRET_KEY.encode(), body_bytes, _hashlib.sha512).hexdigest()
        if not _hmac.compare_digest(computed, signature):
            raise HTTPException(status_code=400, detail="Invalid signature")
    event = await request.json()
    if event.get("event") == "charge.success":
        data = event.get("data") or {}
        reference = data.get("reference")
        if reference:
            await _mark_paid(reference, "success", data)
    return {"received": True}


# ---------- Geocoding ----------
GEOCODE_USER_AGENT = "WakaWaka-Delivery-App/1.0 (+https://github.com/exit-media/wakawaka)"


@api.get("/geocode/search")
async def geocode_search(q: str = Query(..., min_length=3), current=Depends(get_current_user)):
    try:
        async with httpx.AsyncClient(timeout=8.0) as client_http:
            resp = await client_http.get(
                "https://nominatim.openstreetmap.org/search",
                params={"q": q, "format": "jsonv2", "limit": 6, "countrycodes": "ng"},
                headers={"User-Agent": GEOCODE_USER_AGENT},
            )
            resp.raise_for_status()
            data = resp.json()
    except Exception:
        logger.exception("geocode_search failed")
        return {"results": []}
    results = [
        {"label": item.get("display_name", q), "lat": float(item["lat"]), "lng": float(item["lon"])}
        for item in data
        if "lat" in item and "lon" in item
    ]
    return {"results": results}


@api.get("/geocode/reverse")
async def geocode_reverse(lat: float, lng: float, current=Depends(get_current_user)):
    try:
        async with httpx.AsyncClient(timeout=8.0) as client_http:
            resp = await client_http.get(
                "https://nominatim.openstreetmap.org/reverse",
                params={"lat": lat, "lon": lng, "format": "jsonv2"},
                headers={"User-Agent": GEOCODE_USER_AGENT},
            )
            resp.raise_for_status()
            data = resp.json()
            label = data.get("display_name") or f"{lat:.5f}, {lng:.5f}"
    except Exception:
        logger.exception("geocode_reverse failed")
        label = f"{lat:.5f}, {lng:.5f}"
    return {"label": label}


# ---------- Seed Data ----------
@api.post("/seed")
async def seed_data():
    seed_riders = [
        {"name": "Chuka Okafor", "phone": "+2348011111111", "lat": 6.4281, "lng": 3.4219, "plate": "LAG-234-AB", "vehicle": "Bajaj Boxer"},
        {"name": "Femi Adeyemi", "phone": "+2348022222222", "lat": 6.4350, "lng": 3.4280, "plate": "LAG-892-XY", "vehicle": "Suzuki 150"},
        {"name": "Musa Ibrahim", "phone": "+2348033333333", "lat": 6.4180, "lng": 3.4150, "plate": "LAG-501-CD", "vehicle": "TVS Star"},
        {"name": "Emeka Nwosu", "phone": "+2348044444444", "lat": 6.4400, "lng": 3.4350, "plate": "LAG-663-EF", "vehicle": "Bajaj Pulsar"},
        {"name": "Tunde Balogun", "phone": "+2348055555555", "lat": 6.4230, "lng": 3.4100, "plate": "LAG-777-GH", "vehicle": "Honda CG125"},
    ]

    created = 0
    for r in seed_riders:
        exists = await db.users.find_one({"phone": r["phone"]})
        if exists:
            continue
        uid = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        await db.users.insert_one({
            "id": uid,
            "phone": r["phone"],
            "name": r["name"],
            "password": hash_password("password123"),
            "role": "RIDER",
            "createdAt": now,
            "updatedAt": now,
            "rider": {
                "vehicleType": r["vehicle"],
                "licensePlate": r["plate"],
                "isOnline": True,
                "currentLat": r["lat"],
                "currentLng": r["lng"],
                "rating": round(4.5 + (created % 3) * 0.15, 2),
                "totalDeliveries": 50 + created * 12,
                "earnings": (50 + created * 12) * 800,
                "lastLocationUpdate": now,
            },
        })
        created += 1

    demo_phone = "+2348099999999"
    if not await db.users.find_one({"phone": demo_phone}):
        uid = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        await db.users.insert_one({
            "id": uid,
            "phone": demo_phone,
            "name": "Ada Demo",
            "password": hash_password("password123"),
            "role": "CLIENT",
            "createdAt": now,
            "updatedAt": now,
        })

    return {"success": True, "ridersSeeded": created, "message": "Seed complete"}


@api.get("/")
async def root():
    return {"message": "WakaWaka API", "version": "1.0"}


app.include_router(api)


# --- Root-level health endpoint exposed explicitly at /health ---
@app.get("/health")
async def health_check():
    return {"status": "healthy", "mode": f"Paystack mock mode: {IS_PAYSTACK_MOCK}"}


@app.on_event("startup")
async def startup():
    await db.users.create_index("phone", unique=True)
    await db.users.create_index("id", unique=True)
    await db.deliveries.create_index("id", unique=True)
    await db.deliveries.create_index("clientId")
    await db.deliveries.create_index("riderId")
    await db.deliveries.create_index("status")
    await db.payments.create_index("reference", unique=True)
    await db.payments.create_index("deliveryId")
    logger.info(f"WakaWaka API started (Paystack mock mode: {IS_PAYSTACK_MOCK})")


@app.on_event("shutdown")
async def shutdown():
    client.close()
