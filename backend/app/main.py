"""
Tukole backend — FastAPI app.

Run locally:
    uvicorn app.main:app --reload --port 8000

Deploy to Railway:
    Just connect this repo. Railway auto-detects FastAPI.
    Set DATABASE_URL, MOCK_NOTIFICATIONS, PUBLIC_BASE_URL env vars.
"""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db.database import Base, SessionLocal, engine
from app.db.models import Rider
from app.routes import admin, orders, riders, sellers, whatsapp

logger = logging.getLogger("tukole.startup")
logger.setLevel(logging.INFO)

# Auto-create tables on startup. For prod, swap to Alembic migrations.
Base.metadata.create_all(bind=engine)


def _ensure_demo_riders():
    """
    Make sure Moses and Grace exist as riders so any new seller (registered
    via signup form) can immediately have orders auto-assigned.

    Idempotent — safe to run on every startup.
    """
    db = SessionLocal()
    try:
        if not db.query(Rider).filter(Rider.phone == settings.demo_rider_moses_phone).first():
            db.add(Rider(
                full_name="Moses Kato",
                phone=settings.demo_rider_moses_phone,
                nin="CM00012345",
                plate_number="UBE 123A",
                stage="Bukoto Stage",
                chairman_reference="Chairman David",
                current_lat=0.3500,
                current_lng=32.5950,
            ))
            logger.info("Seeded rider Moses Kato")
            print("✓ Seeded rider Moses Kato")

        if not db.query(Rider).filter(Rider.phone == settings.demo_rider_grace_phone).first():
            db.add(Rider(
                full_name="Grace Nansubuga",
                phone=settings.demo_rider_grace_phone,
                nin="CM00067890",
                plate_number="UBF 456B",
                stage="Ntinda Stage",
                chairman_reference="Chairman Peter",
                current_lat=0.3580,
                current_lng=32.6100,
            ))
            logger.info("Seeded rider Grace Nansubuga")
            print("✓ Seeded rider Grace Nansubuga")

        db.commit()
    except Exception as e:
        logger.warning("Failed to seed demo riders: %s", e)
        db.rollback()
    finally:
        db.close()


_ensure_demo_riders()


app = FastAPI(
    title="Tukole API",
    description="Delivery + cash trust infrastructure for Kampala's online sellers.",
    version="0.1.0",
)

# CORS: open during dev. In prod, restrict to your Vercel domain.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "name": "Tukole API",
        "tagline": "We move orders + money reliably.",
        "env": settings.app_env,
        "docs": "/docs",
    }


@app.get("/healthz")
def health():
    return {"ok": True}


app.include_router(sellers.router)
app.include_router(riders.router)
app.include_router(orders.router)
app.include_router(whatsapp.router)
app.include_router(admin.router)