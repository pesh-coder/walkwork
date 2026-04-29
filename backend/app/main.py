"""
Tukole backend — FastAPI app.

Run locally:
    uvicorn app.main:app --reload --port 8000

Deploy to Railway:
    Just connect this repo. Railway auto-detects FastAPI.
    Set DATABASE_URL, MOCK_NOTIFICATIONS, PUBLIC_BASE_URL env vars.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db.database import Base, engine
from app.routes import admin, orders, riders, sellers, whatsapp

# Auto-create tables on startup. For prod, swap to Alembic migrations.
Base.metadata.create_all(bind=engine)

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
