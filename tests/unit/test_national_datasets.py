"""
Unit tests for SPYDEE National & Cross-Validation Datasets Catalog & Service.
Verifies all 25 datasets are present, properly categorized, and structured.
"""

import pytest
from app.services.national_datasets_service import (
    DATASETS_CATALOG,
    get_all_datasets,
    get_dataset_by_id,
    get_dataset_sample
)

def test_all_25_datasets_present():
    assert len(DATASETS_CATALOG) == 25, "Expected precisely 25 national datasets"

def test_dataset_ids_sequential():
    ids = [d["id"] for d in DATASETS_CATALOG]
    assert ids == list(range(1, 26)), "Dataset IDs should run consecutively from 1 to 25"

def test_dataset_required_attributes():
    required_fields = [
        "id", "code", "name", "category", "domain", "url",
        "organization", "technology", "priority", "description",
        "case_usage", "associated_cases", "benchmark_metrics", "sample_record"
    ]
    for ds in DATASETS_CATALOG:
        for field in required_fields:
            assert field in ds, f"Dataset #{ds['id']} missing field: {field}"
            assert ds[field] is not None, f"Dataset #{ds['id']} field {field} is None"

def test_filtering_by_domain():
    legal_ds = get_all_datasets(category="Document Intelligence")
    assert len(legal_ds) >= 8, f"Expected at least 8 Legal NLP datasets, got {len(legal_ds)}"

    cctv_ds = get_all_datasets(category="CCTV")
    assert len(cctv_ds) >= 4, f"Expected at least 4 CCTV/Face datasets, got {len(cctv_ds)}"

    financial_ds = get_all_datasets(category="Financial")
    assert len(financial_ds) >= 4, f"Expected at least 4 Financial datasets, got {len(financial_ds)}"

def test_dataset_lookup_and_sample():
    # Test InLegalNER (ID 1)
    ds1 = get_dataset_by_id(1)
    assert ds1["name"] == "InLegalNER"
    s1 = get_dataset_sample(1)
    assert "entities" in s1["sample"]

    # Test UVH-26 (ID 9)
    ds9 = get_dataset_by_id(9)
    assert "UVH-26" in ds9["name"]
    s9 = get_dataset_sample(9)
    assert "detections" in s9["sample"]

    # Test SDV (ID 25)
    ds25 = get_dataset_by_id(25)
    assert "SDV" in ds25["code"] or "Synthetic Data Vault" in ds25["name"]
    s25 = get_dataset_sample(25)
    assert "relational_tables" in s25["sample"]
