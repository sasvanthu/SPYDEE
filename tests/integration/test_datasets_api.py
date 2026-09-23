"""
Integration tests for /api/v1/datasets API routes.
"""

import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_api_list_datasets():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/datasets")
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 25
        assert any(d["name"] == "InLegalNER" for d in data)
        assert any("UVH-26" in d["name"] for d in data)
        assert any("Synthetic Data Vault" in d["name"] for d in data)

@pytest.mark.asyncio
async def test_api_dataset_summary():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/datasets/summary")
        assert res.status_code == 200
        data = res.json()
        assert data["total_datasets"] == 25
        assert data["active_in_prototype"] == 25

@pytest.mark.asyncio
async def test_api_get_dataset_and_sample():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Check dataset #13 (UPI 2024)
        res = await client.get("/api/v1/datasets/13")
        assert res.status_code == 200
        data = res.json()
        assert data["id"] == 13
        assert "UPI" in data["name"]

        # Check sample for dataset #9 (UVH-26)
        res_sample = await client.get("/api/v1/datasets/9/sample")
        assert res_sample.status_code == 200
        sample_data = res_sample.json()
        assert "sample" in sample_data
        assert "detections" in sample_data["sample"]
