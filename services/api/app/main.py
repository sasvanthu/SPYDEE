import os
import sys

# Ensure the repo-root `analysis` package resolves regardless of launch cwd.
_API_APP_DIR = os.path.dirname(os.path.abspath(__file__))
_REPO_ROOT = os.path.abspath(os.path.join(_API_APP_DIR, "..", "..", ".."))
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.config import get_settings
from app.routers import (
    auth_router, case_router, evidence_router, entity_router,
    graph_router, timeline_router, analysis_router, hypothesis_router,
    copilot_router, report_router, audit_router, job_router, users_router
)

settings = get_settings()

app = FastAPI(
    title="SPYDEE API",
    description="AI-Assisted Investigative Intelligence and Criminal-Network Analysis",
    version="0.1.0-prototype",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

origins = [o.strip() for o in settings.CORS_ORIGINS.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(case_router.router)
app.include_router(evidence_router.router)
app.include_router(entity_router.router)
app.include_router(graph_router.router)
app.include_router(timeline_router.router)
app.include_router(analysis_router.router)
app.include_router(hypothesis_router.router)
app.include_router(copilot_router.router)
app.include_router(report_router.router)
app.include_router(audit_router.router)
app.include_router(job_router.router)
app.include_router(users_router.router)


@app.get("/")
async def root():
    return {
        "service": "SPYDEE Investigative Intelligence API",
        "status": "online",
        "docs": "/api/docs",
        "health": "/api/v1/health",
        "frontend": "http://localhost:5173"
    }


@app.get("/api/v1/health")
async def health_check():
    return {"status": "ok", "service": "spydee-api", "version": "0.1.0"}
