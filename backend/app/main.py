"""
Tukole backend — FastAPI app.

Run locally:
    uvicorn app.main:app --reload --port 8000
"""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from app.config import settings
from app.db.database import Base, SessionLocal, engine
from app.db.models import Rider
from app.routes import admin, orders, riders, sellers, whatsapp

logger = logging.getLogger("tukole.startup")
logger.setLevel(logging.INFO)


def _initialize_schema():
    """
    Bring the database schema up to date.

    Strategy: SQLAlchemy's `create_all` only creates missing tables — it
    never alters existing ones. For the v2 escrow rewrite we have new columns
    on Order, Seller, Rider plus new tables (Customer, OrderPhoto, Dispute).

    To handle this cleanly without Alembic, we check for one of the new tables.
    If it's missing, we drop everything and recreate. This is destructive but
    safe in our context: the prior data on Railway is all demo data anyway,
    and we explicitly require RESET_DB_ON_SCHEMA_MISMATCH=true to do it.
    """
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    # Sentinel: 'customers' is a v2-only table
    if existing_tables and "customers" not in existing_tables:
        if settings.reset_db_on_schema_mismatch:
            logger.warning(
                "v2 schema detected but 'customers' table missing. "
                "Dropping all tables and recreating (RESET_DB_ON_SCHEMA_MISMATCH=true)."
            )
            print("⚠️  Schema mismatch — dropping & recreating tables")
            Base.metadata.drop_all(bind=engine)
        else:
            logger.warning(
                "v2 schema detected but 'customers' table missing. "
                "Set RESET_DB_ON_SCHEMA_MISMATCH=true to auto-migrate, "
                "or run manual ALTER statements."
            )

    Base.metadata.create_all(bind=engine)


_initialize_schema()


def _ensure_demo_riders():
    """
    Make sure Moses + Grace exist as default riders so brand-new sellers can
    immediately place orders that get auto-assigned.
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
    description="Escrow-secured deliveries for Kampala's online sellers.",
    version="0.2.0",
)

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
        "version": "0.2.0",
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
