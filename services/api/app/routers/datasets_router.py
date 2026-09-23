"""
SPYDEE: National Datasets API Router
Endpoints exposing metadata, live samples, and benchmarks for all 25 Indian & Cross-Validation Datasets.
"""

import sys
import os
import subprocess
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from pydantic import BaseModel

from app.services.national_datasets_service import (
    DATASETS_CATALOG,
    get_all_datasets,
    get_dataset_by_id,
    get_dataset_sample
)

router = APIRouter(prefix="/api/v1/datasets", tags=["National Datasets"])


@router.get("", response_model=List[Dict[str, Any]])
async def list_datasets(
    category: Optional[str] = Query(None, description="Filter by domain or category"),
    priority: Optional[str] = Query(None, description="Filter by priority (P1, P2, P3)"),
    search: Optional[str] = Query(None, description="Search term for title or organization")
):
    """
    Retrieve all 25 National and Cross-Validation datasets utilized in SPYDEE.
    """
    datasets = get_all_datasets(category=category, priority=priority)
    if search:
        s_lower = search.lower()
        datasets = [
            d for d in datasets
            if s_lower in d["name"].lower()
            or s_lower in d["organization"].lower()
            or s_lower in d["description"].lower()
            or s_lower in d["technology"].lower()
        ]
    return datasets


@router.get("/summary")
async def get_datasets_summary():
    """
    Get high-level summary telemetry across all 25 datasets.
    """
    total = len(DATASETS_CATALOG)
    by_priority = {}
    by_category = {}
    for d in DATASETS_CATALOG:
        p = d.get("priority", "Unknown").split(" - ")[0]
        by_priority[p] = by_priority.get(p, 0) + 1
        cat = d.get("category", "General")
        by_category[cat] = by_category.get(cat, 0) + 1

    return {
        "total_datasets": total,
        "active_in_prototype": total,
        "by_priority": by_priority,
        "by_category_count": len(by_category),
        "primary_sponsors": [
            "IISc Bengaluru", "AI4Bharat IIT Madras", "Law-AI IIT Kharagpur",
            "IIT Kanpur", "IIIT Hyderabad", "IIIT Delhi", "NPCI / RBI",
            "TRAI", "NCRB", "IBM Research", "Elliptic"
        ]
    }


@router.get("/{dataset_id}", response_model=Dict[str, Any])
async def get_dataset(dataset_id: int):
    """
    Retrieve full metadata, description, and benchmark statistics for a specific dataset (1 to 25).
    """
    ds = get_dataset_by_id(dataset_id)
    if not ds:
        raise HTTPException(status_code=404, detail=f"Dataset with ID {dataset_id} not found.")
    return ds


@router.get("/{dataset_id}/sample")
async def get_sample(dataset_id: int):
    """
    Retrieve interactive sample record and schema for a specific dataset.
    """
    sample = get_dataset_sample(dataset_id)
    if not sample:
        raise HTTPException(status_code=404, detail=f"Sample for dataset {dataset_id} not found.")
    return sample


@router.post("/seed-all")
async def seed_all_datasets_endpoint(background_tasks: BackgroundTasks):
    """
    Trigger full seeding of all 25 datasets into cases across the database.
    """
    script_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", "..", "demo", "generator", "seed_all_25_datasets.py")
    )
    if not os.path.exists(script_path):
        raise HTTPException(status_code=500, detail=f"Seeder script not found at {script_path}")

    # Launch in background or subprocess
    def run_seeder():
        subprocess.run([sys.executable, script_path], check=False)

    background_tasks.add_task(run_seeder)
    return {
        "status": "QUEUED",
        "message": "Full multi-modal dataset synchronization and case synthesis initiated.",
        "datasets_targeted": 25
    }
