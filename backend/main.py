"""MIS Agent API.

A reporting layer over the connected systems: it reads from the ERP, CRM, HRMS
and databases, and never posts entries back into them. Every write in this
service is to the agent's own tables (runs, approvals, anomalies, audit log).
"""

from __future__ import annotations

import asyncio
import contextlib
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import database
import models
import seed
from routers import anomalies, approvals, chat, platform, reports
from services import anomaly_engine, report_engine

SCHEDULER_INTERVAL_SECONDS = int(os.getenv("MIS_SCHEDULER_INTERVAL", "900"))
SCHEDULER_ENABLED = os.getenv("MIS_SCHEDULER_ENABLED", "1") != "0"

# Deployments pin the exact origins. With none configured the API assumes local
# development and accepts any localhost port, because Vite silently moves to the
# next free port when 5173 is taken — a pinned list turns that into a wall of
# failed requests that looks like the API is down.
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("MIS_ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]
LOCALHOST_ORIGIN_PATTERN = r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$"

models.Base.metadata.create_all(bind=database.engine)


@contextlib.asynccontextmanager
async def lifespan(application: FastAPI):
    db = database.SessionLocal()
    try:
        seed.seed_all(db)
    finally:
        db.close()

    task = asyncio.create_task(_scheduler_loop()) if SCHEDULER_ENABLED else None
    try:
        yield
    finally:
        if task:
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task


app = FastAPI(
    title="MIS Agent API",
    description="Scheduled reports, approval routing, chat with data and anomaly detection.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=None if ALLOWED_ORIGINS else LOCALHOST_ORIGIN_PATTERN,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(reports.router)
app.include_router(approvals.router)
app.include_router(anomalies.router)
app.include_router(chat.router)
app.include_router(platform.router)


async def _scheduler_loop() -> None:
    """Generate due reports, escalate stale reviews and scan for anomalies.

    Deliberately in-process for a single-instance deployment. Running more than
    one API instance means moving this to a dedicated worker so two schedulers
    cannot generate the same period twice.
    """
    while True:
        await asyncio.sleep(SCHEDULER_INTERVAL_SECONDS)
        db = database.SessionLocal()
        try:
            report_engine.run_due_templates(db)
            report_engine.escalate_stale_reviews(db)
            anomaly_engine.scan(db)
        except Exception as exc:  # keep the loop alive across a bad cycle
            print(f"[scheduler] cycle failed: {type(exc).__name__}: {exc}")
        finally:
            db.close()


@app.get("/api/health")
def health():
    db = database.SessionLocal()
    try:
        return {
            "status": "ok",
            "templates": db.query(models.ReportTemplate).count(),
            "runs": db.query(models.ReportRun).count(),
            "anomalies": db.query(models.Anomaly).count(),
            "scheduler": "running" if SCHEDULER_ENABLED else "disabled",
        }
    finally:
        db.close()


@app.get("/")
def read_root():
    return {"service": "MIS Agent API", "docs": "/docs", "health": "/api/health"}
