from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import random
import smtplib
from email.mime.text import MIMEText
from datetime import datetime, timedelta, timezone
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from jose import jwt, JWTError
from passlib.context import CryptContext
import requests
import base64

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Config
mongo_url = os.environ['MONGO_URL']
db_name = os.environ.get('DB_NAME', 'bushbeing_db')
JWT_SECRET = os.environ['JWT_SECRET']
PLANTNET_API_KEY = os.environ['PLANTNET_API_KEY']
SMTP_EMAIL = os.environ.get('SMTP_EMAIL', '')
SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD', '')

JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 24
OTP_EXPIRE_MINUTES = 5
OTP_RESEND_SECONDS = 120

# MongoDB
client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Auth
security = HTTPBearer()

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- Helpers ---

def create_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

def generate_otp() -> str:
    return str(random.randint(1000, 9999))

def send_otp_email(to_email: str, otp: str):
    try:
        msg = MIMEText(f"Your bushbeing verification code is: {otp}\n\nThis code expires in 5 minutes.")
        msg["Subject"] = f"bushbeing Verification Code: {otp}"
        msg["From"] = SMTP_EMAIL
        msg["To"] = to_email
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.sendmail(SMTP_EMAIL, to_email, msg.as_string())
        logger.info(f"OTP sent to {to_email}")
    except Exception as e:
        logger.error(f"Failed to send OTP email: {e}")

def send_reset_email(to_email: str, token: str):
    try:
        reset_link = f"https://bushbeing.app/reset-password?token={token}"
        msg = MIMEText(f"Click the link to reset your password:\n\n{reset_link}\n\nThis link expires in 15 minutes.")
        msg["Subject"] = "bushbeing Password Reset"
        msg["From"] = SMTP_EMAIL
        msg["To"] = to_email
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.sendmail(SMTP_EMAIL, to_email, msg.as_string())
        logger.info(f"Reset email sent to {to_email}")
    except Exception as e:
        logger.error(f"Failed to send reset email: {e}")

def validate_password(password: str) -> bool:
    if len(password) < 8:
        return False
    import re
    if not re.search(r'[A-Z]', password):
        return False
    if not re.search(r'[a-z]', password):
        return False
    if not re.search(r'[0-9]', password):
        return False
    if not re.search(r'[^A-Za-z0-9]', password):
        return False
    return True

# --- Models ---

class RequestOTPBody(BaseModel):
    email: str
    name: str
    password: str

class ResendOTPBody(BaseModel):
    email: str

class VerifyOTPBody(BaseModel):
    email: str
    otp: str
    name: str
    password: str

class LoginBody(BaseModel):
    email: str
    password: str

class ForgotPasswordBody(BaseModel):
    email: str

class ResetPasswordBody(BaseModel):
    token: str
    new_password: str

class ChangePasswordBody(BaseModel):
    old_password: str
    new_password: str

class PlantCreate(BaseModel):
    nickname: str
    location: Optional[str] = None
    scientific_name: Optional[str] = None
    common_name: Optional[str] = None
    family: Optional[str] = None
    confidence: Optional[float] = None
    images: Optional[List[str]] = None
    care_info: Optional[dict] = None

class PlantUpdate(BaseModel):
    nickname: Optional[str] = None
    location: Optional[str] = None
    watering_frequency_days: Optional[int] = None

class RoomCreate(BaseModel):
    name: str

class RoomRename(BaseModel):
    name: str

class WaterHistoryBody(BaseModel):
    watered_at: str

class HealthLogCreate(BaseModel):
    plant_id: str
    notes: str
    photo: Optional[str] = None

# --- Auth Endpoints ---

@api_router.post("/auth/request-otp")
async def request_otp(body: RequestOTPBody):
    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    if not validate_password(body.password):
        raise HTTPException(status_code=400, detail="Password must be 8+ chars with uppercase, lowercase, number, and special character")

    otp = generate_otp()
    await db.otps.delete_many({"email": body.email.lower()})
    await db.otps.insert_one({
        "email": body.email.lower(),
        "otp": otp,
        "name": body.name,
        "password": pwd_context.hash(body.password),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRE_MINUTES)).isoformat(),
    })
    send_otp_email(body.email, otp)
    return {"message": "OTP sent to your email"}

@api_router.post("/auth/resend-otp")
async def resend_otp(body: ResendOTPBody):
    existing = await db.otps.find_one({"email": body.email.lower()})
    if not existing:
        raise HTTPException(status_code=400, detail="No pending OTP for this email")

    otp = generate_otp()
    await db.otps.update_one(
        {"email": body.email.lower()},
        {"$set": {"otp": otp, "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRE_MINUTES)).isoformat()}}
    )
    send_otp_email(body.email, otp)
    return {"message": "OTP resent to your email"}

@api_router.post("/auth/verify-otp")
async def verify_otp(body: VerifyOTPBody):
    record = await db.otps.find_one({"email": body.email.lower()})
    if not record:
        raise HTTPException(status_code=400, detail="No OTP found. Please request again.")
    if record["otp"] != body.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    if datetime.fromisoformat(record["expires_at"]) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="OTP expired")

    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "email": body.email.lower(),
        "name": body.name,
        "password_hash": record["password"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user)
    await db.otps.delete_many({"email": body.email.lower()})
    await db.rooms.insert_one({"user_id": user_id, "rooms": []})

    token = create_token(user_id, body.email.lower())
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user_id, "email": body.email.lower(), "name": body.name, "created_at": user["created_at"]},
    }

@api_router.post("/auth/login")
async def login(body: LoginBody):
    user = await db.users.find_one({"email": body.email.lower()}, {"_id": 0})
    if not user or not pwd_context.verify(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(user["id"], user["email"])
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user["id"], "email": user["email"], "name": user["name"], "created_at": user["created_at"]},
    }

@api_router.post("/auth/forgot-password")
async def forgot_password(body: ForgotPasswordBody):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user:
        return {"message": "If an account exists, a reset link has been sent"}
    token = str(uuid.uuid4())
    await db.reset_tokens.insert_one({
        "email": body.email.lower(),
        "token": token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat(),
    })
    send_reset_email(body.email, token)
    return {"message": "If an account exists, a reset link has been sent"}

@api_router.post("/auth/reset-password")
async def reset_password(body: ResetPasswordBody):
    record = await db.reset_tokens.find_one({"token": body.token})
    if not record:
        raise HTTPException(status_code=400, detail="Invalid reset token")
    if datetime.fromisoformat(record["expires_at"]) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Reset token expired")
    if not validate_password(body.new_password):
        raise HTTPException(status_code=400, detail="Password does not meet requirements")
    await db.users.update_one({"email": record["email"]}, {"$set": {"password_hash": pwd_context.hash(body.new_password)}})
    await db.reset_tokens.delete_many({"email": record["email"]})
    return {"message": "Password reset successfully"}

@api_router.post("/auth/change-password")
async def change_password(body: ChangePasswordBody, user=Depends(get_current_user)):
    full_user = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    if not pwd_context.verify(body.old_password, full_user["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if not validate_password(body.new_password):
        raise HTTPException(status_code=400, detail="New password does not meet requirements")
    await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": pwd_context.hash(body.new_password)}})
    return {"message": "Password changed successfully"}

@api_router.get("/auth/me")
async def get_me(user=Depends(get_current_user)):
    return {"id": user["id"], "email": user["email"], "name": user["name"], "created_at": user["created_at"]}

# --- Plants Endpoints ---

@api_router.get("/plants")
async def get_plants(user=Depends(get_current_user)):
    plants = await db.plants.find({"user_id": user["id"]}, {"_id": 0}).to_list(1000)
    return plants

@api_router.post("/plants")
async def create_plant(body: PlantCreate, user=Depends(get_current_user)):
    plant_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    freq = 7
    plant = {
        "id": plant_id,
        "user_id": user["id"],
        "nickname": body.nickname,
        "location": body.location,
        "scientific_name": body.scientific_name,
        "common_name": body.common_name,
        "family": body.family,
        "confidence": body.confidence,
        "images": body.images or [],
        "watering_frequency_days": freq,
        "last_watered": None,
        "next_watering": (datetime.now(timezone.utc) + timedelta(days=freq)).isoformat(),
        "created_at": now,
        "care_info": body.care_info or {},
        "placeholder_image": None,
    }
    await db.plants.insert_one(plant)
    result = {k: v for k, v in plant.items() if k != "_id"}
    return result

@api_router.put("/plants/{plant_id}")
async def update_plant(plant_id: str, body: PlantUpdate, user=Depends(get_current_user)):
    plant = await db.plants.find_one({"id": plant_id, "user_id": user["id"]})
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")
    updates = {k: v for k, v in body.dict().items() if v is not None}
    if "watering_frequency_days" in updates:
        last = plant.get("last_watered")
        base = datetime.fromisoformat(last) if last else datetime.now(timezone.utc)
        updates["next_watering"] = (base + timedelta(days=updates["watering_frequency_days"])).isoformat()
    if updates:
        await db.plants.update_one({"id": plant_id}, {"$set": updates})
    updated = await db.plants.find_one({"id": plant_id}, {"_id": 0})
    return updated

@api_router.delete("/plants/{plant_id}")
async def delete_plant(plant_id: str, user=Depends(get_current_user)):
    result = await db.plants.delete_one({"id": plant_id, "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Plant not found")
    await db.watering_logs.delete_many({"plant_id": plant_id})
    await db.health_logs.delete_many({"plant_id": plant_id})
    return {"message": "Plant deleted"}

@api_router.post("/plants/{plant_id}/water")
async def water_plant(plant_id: str, user=Depends(get_current_user)):
    plant = await db.plants.find_one({"id": plant_id, "user_id": user["id"]})
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")
    now = datetime.now(timezone.utc).isoformat()
    freq = plant.get("watering_frequency_days", 7)
    await db.plants.update_one({"id": plant_id}, {"$set": {
        "last_watered": now,
        "next_watering": (datetime.now(timezone.utc) + timedelta(days=freq)).isoformat(),
    }})
    log_id = str(uuid.uuid4())
    log = {"id": log_id, "user_id": user["id"], "plant_id": plant_id, "plant_nickname": plant["nickname"], "watered_at": now}
    await db.watering_logs.insert_one(log)
    return {"message": "Plant watered", "watering_log": {k: v for k, v in log.items() if k != "_id"}}

@api_router.post("/plants/{plant_id}/water-history")
async def water_plant_history(plant_id: str, body: WaterHistoryBody, user=Depends(get_current_user)):
    plant = await db.plants.find_one({"id": plant_id, "user_id": user["id"]})
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")
    log_id = str(uuid.uuid4())
    log = {"id": log_id, "user_id": user["id"], "plant_id": plant_id, "plant_nickname": plant["nickname"], "watered_at": body.watered_at}
    await db.watering_logs.insert_one(log)
    return {"message": "Watering history logged"}

# --- Plant Identification ---

PLANTNET_URL = "https://my-api.plantnet.org/v2/identify/all"

def identify_with_plantnet(image_data_list: list, organs: str = "leaf"):
    files = []
    organ_list = []
    for i, img_data in enumerate(image_data_list):
        files.append(("images", (f"plant_{i}.jpg", img_data, "image/jpeg")))
        organ_list.append(("organs", organs))
    try:
        resp = requests.post(
            PLANTNET_URL,
            params={"api-key": PLANTNET_API_KEY, "include-related-images": "false"},
            files=files,
            data=organ_list,
            timeout=30,
        )
        if resp.status_code != 200:
            logger.error(f"PlantNet error {resp.status_code}: {resp.text[:200]}")
            return None
        data = resp.json()
        if not data.get("results"):
            return None
        top = data["results"][0]
        species = top.get("species", {})
        care_info = generate_care_info(species.get("commonNames", [""])[0] if species.get("commonNames") else "")
        return {
            "scientific_name": species.get("scientificNameWithoutAuthor", "Unknown"),
            "common_names": species.get("commonNames", []),
            "confidence": round(top.get("score", 0), 4),
            "family": species.get("family", {}).get("scientificNameWithoutAuthor", ""),
            "genus": species.get("genus", {}).get("scientificNameWithoutAuthor", ""),
            "care_info": care_info,
        }
    except Exception as e:
        logger.error(f"PlantNet API error: {e}")
        return None

def generate_care_info(common_name: str) -> dict:
    return {
        "watering": "Water when top inch of soil is dry",
        "sunlight": "Bright indirect light",
        "humidity": "40-60% relative humidity",
        "temperature": "65-80°F (18-27°C)",
        "soil": "Well-draining potting mix",
        "fertilizer": "Monthly during growing season",
        "difficulty": "Moderate",
    }

@api_router.post("/plants/identify")
async def identify_plant(images: List[UploadFile] = File(...), organs: str = Form(default="leaf")):
    if not images:
        raise HTTPException(status_code=400, detail="At least one image required")
    image_data_list = []
    for img in images:
        data = await img.read()
        image_data_list.append(data)
    result = identify_with_plantnet(image_data_list, organs)
    if not result:
        raise HTTPException(status_code=422, detail="Could not identify plant. Try a clearer photo.")
    return result

@api_router.post("/plants/identify-multi")
async def identify_multi(images: List[UploadFile] = File(...)):
    if len(images) < 2:
        raise HTTPException(status_code=400, detail="At least 2 images required")
    results = []
    for i, img in enumerate(images):
        data = await img.read()
        result = identify_with_plantnet([data])
        if result:
            result["image_index"] = i
            results.append(result)
    if not results:
        raise HTTPException(status_code=422, detail="Could not identify any plants")
    # Check if all results are the same species
    species_set = set(r["scientific_name"] for r in results)
    is_same = len(species_set) == 1
    return {
        "is_same_plant": is_same,
        "plants": results,
        "message": "All images appear to be the same plant" if is_same else f"Detected {len(species_set)} different plants",
    }

# --- Watering Logs ---

@api_router.get("/watering-logs")
async def get_watering_logs(user=Depends(get_current_user)):
    logs = await db.watering_logs.find({"user_id": user["id"]}, {"_id": 0}).sort("watered_at", -1).to_list(1000)
    return logs

@api_router.delete("/watering-logs/{log_id}")
async def delete_watering_log(log_id: str, user=Depends(get_current_user)):
    result = await db.watering_logs.delete_one({"id": log_id, "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Watering log not found")
    return {"message": "Watering log deleted"}

# --- Rooms ---

@api_router.get("/rooms")
async def get_rooms(user=Depends(get_current_user)):
    doc = await db.rooms.find_one({"user_id": user["id"]}, {"_id": 0})
    return {"rooms": doc.get("rooms", []) if doc else []}

@api_router.post("/rooms")
async def create_room(body: RoomCreate, user=Depends(get_current_user)):
    doc = await db.rooms.find_one({"user_id": user["id"]})
    if doc and body.name in doc.get("rooms", []):
        raise HTTPException(status_code=400, detail="Room already exists")
    await db.rooms.update_one(
        {"user_id": user["id"]},
        {"$push": {"rooms": body.name}},
        upsert=True,
    )
    updated = await db.rooms.find_one({"user_id": user["id"]}, {"_id": 0})
    return {"message": "Room created", "rooms": updated.get("rooms", [])}

@api_router.put("/rooms/{room_name}")
async def rename_room(room_name: str, body: RoomRename, user=Depends(get_current_user)):
    doc = await db.rooms.find_one({"user_id": user["id"]})
    if not doc or room_name not in doc.get("rooms", []):
        raise HTTPException(status_code=404, detail="Room not found")
    rooms = doc["rooms"]
    idx = rooms.index(room_name)
    rooms[idx] = body.name
    await db.rooms.update_one({"user_id": user["id"]}, {"$set": {"rooms": rooms}})
    await db.plants.update_many({"user_id": user["id"], "location": room_name}, {"$set": {"location": body.name}})
    return {"message": "Room renamed"}

@api_router.delete("/rooms/{room_name}")
async def delete_room(room_name: str, user=Depends(get_current_user)):
    result = await db.rooms.update_one({"user_id": user["id"]}, {"$pull": {"rooms": room_name}})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Room not found")
    await db.plants.update_many({"user_id": user["id"], "location": room_name}, {"$set": {"location": None}})
    return {"message": "Room deleted"}

# --- Health Logs ---

@api_router.post("/health-logs")
async def create_health_log(body: HealthLogCreate, user=Depends(get_current_user)):
    plant = await db.plants.find_one({"id": body.plant_id, "user_id": user["id"]})
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")
    log_id = str(uuid.uuid4())
    log = {
        "id": log_id,
        "plant_id": body.plant_id,
        "user_id": user["id"],
        "notes": body.notes,
        "photo": body.photo,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.health_logs.insert_one(log)
    return {k: v for k, v in log.items() if k != "_id"}

@api_router.get("/health-logs/{plant_id}")
async def get_health_logs(plant_id: str, user=Depends(get_current_user)):
    logs = await db.health_logs.find({"plant_id": plant_id, "user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return logs

@api_router.delete("/health-logs/{log_id}")
async def delete_health_log(log_id: str, user=Depends(get_current_user)):
    result = await db.health_logs.delete_one({"id": log_id, "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Health log not found")
    return {"message": "Health log deleted"}

# --- Root ---

@api_router.get("/")
async def root():
    return {"message": "Plant Buddy API", "version": "1.0.0"}

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
