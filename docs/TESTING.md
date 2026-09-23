# 🧪 SPYDEE Comprehensive Verification & Test Specification

**Smart India Hackathon 2026 — Problem Statement ID: 26189**  
**Module:** Automated Test Harness, Scenario Validation & Benchmark Verification  
**Team:** `EXIT(0);`

---

## 1. Test Architecture & Coverage Matrix

SPYDEE's verification suite tests every layer of the system:
1. **Unit Tests:** Mathematical engine calculations, honest abstention thresholds, busy-tower normalization, and entity identifier normalization.
2. **Integration Tests:** Database transactions, case-scoped access isolation (RBAC), multi-tenant foreign key barriers, and analysis run versioning.
3. **End-to-End Scenario Benchmarks:** Full pipeline simulations covering positive syndicate discovery, crowd coincidence suppression, and negative control verification.

---

## 2. Test Execution Guide

### Running Unit Tests
```bash
# Execute unit tests for all 6 intelligence engines
pytest tests/unit/test_communication_engine.py -v
pytest tests/unit/test_infra_engine.py -v
pytest tests/unit/test_stylo_engine.py -v
pytest tests/unit/test_financial_engine.py -v
pytest tests/unit/test_engine_limits.py -v
pytest tests/unit/test_hypothesis_fusion.py -v
```

### Running Integration & Security Tests
```bash
# Verify Case-scoped RBAC and data isolation
pytest tests/integration/test_rbac.py -v

# Verify Entity resolution, merging, and revert capabilities
pytest tests/integration/test_entity_review.py -v

# Verify automated contradiction detection and lead generation
pytest tests/integration/test_contradiction.py -v
pytest tests/integration/test_workspace_generation.py -v
pytest tests/integration/test_freshness.py -v
```

### Running the 3 Canonical SIH Scenario Benchmarks
```bash
# Run the complete scenario validation suite
pytest tests/integration/test_demo_scenarios.py -v
```

---

## 3. The 3 SIH Canonical Scenario Benchmarks

### Scenario 1: Supported Connection (True Positive Syndicate Discovery)
- **Target Case:** `BRK-2026-001` (Broken Chain) / `IND-2026-004` (Operation Trishul)
- **Data Ingested:** 20 high-frequency calls + shared handset device hop + repeated tower co-locations.
- **Expected Outcome:** Subversive activity hypothesis score $\ge 85.0$ (typically $\approx 92.0$).
- **Verification Rule:** Automatically promotes a **Reviewable Lead** in the investigator workspace with full evidence citations.

### Scenario 2: Misleading Overlap (Crowd Coincidence Suppression)
- **Target Case:** High-Density Public Tower (e.g. Majestic Transit Terminal, Bengaluru).
- **Data Ingested:** Two stranger entities connect to the same tower once during peak rush hour (42 distinct entities logged).
- **Expected Outcome:** GhostTower engine flags `busy_tower: true` and applies `background_multiplier = 0.51`.
- **Verification Rule:** Signal score suppressed to $\approx 0.18$. No hypothesis $\ge 50$ is formed. The system refuses to fabricate a criminal link.

### Scenario 3: Conflicting & Negative Control (Honest Abstention)
- **Target Case:** `QTM-2026-003` (Quiet Market)
- **Data Ingested:** Clean, sparse, non-correlated synthetic background records.
- **Expected Outcome:** All generated hypotheses score $< 50.0$.
- **Verification Rule:** The system outputs an explicit warning: *"Evidence insufficient. Does not establish a link."*

---

## 4. Completed Test Verification Checklist

### Database & Ingestion Integrity
- [x] Schema migration runs cleanly from 001 to 006 via Alembic without errors.
- [x] Ingested evidence files verified via immutable SHA-256 cryptographic hashes.
- [x] Source records normalized into canonical entities with zero duplicate multiplication on re-import.

### Role-Based Access Control (RBAC) & Tenant Isolation
- [x] Authentication returns signed JWT with cryptographic bcrypt password verification.
- [x] Non-member investigators receive 403 Forbidden when attempting to access unauthorized cases.
- [x] API tokens properly expire and redirect to `/login`.

### Engine Mechanics & XAI Reasoning
- [x] Communication burst and burner SIM lifecycle bonuses calculate deterministically.
- [x] StyloLink strictly abstains on sparse text ($< 2$ messages or $< 60$ characters).
- [x] Speed-of-light / impossible travel triggers an automatic 25% contradiction penalty.
- [x] Cytoscape graph canvas visualizes typed edges (Observed, Derived, Inferred, Hypothesis, Contradiction).
- [x] Automated report generation produces Section 65B Bharatiya Sakshya Adhiniyam compliance certificates.
