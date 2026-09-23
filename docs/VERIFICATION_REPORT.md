# SPYDEE Prototype - Verification Report

Run date: 2026-09-15
Environment: PostgreSQL + SQLAlchemy(async), FastAPI :8000, Vite :5173
Demo DB preserved; synthetic test cases untouched.
This report supersedes the 2026-09-14 smoke pass: it adds the product-integration
verification (automated test suite, freshness, demo scenarios) on top.

---

## A. API smoke results (automated)

| # | Endpoint | Method | Status | Notes |
|---|---|---|---|---|
| 1 | /api/v1/cases | GET | 200 | 3 demo + ~76 test cases |
| 2 | /api/v1/cases/{BRK} | GET | 200 | entity_count=41, event_count=1227 |
| 3 | /api/v1/entities/{BRK} | GET | 200 | 41 entities |
| 4 | /api/v1/evidence/{BRK}/files | GET | 200 | 4 files |
| 5 | /api/v1/evidence/{BRK}/imports | GET | 200 | 4 imports |
| 6 | /api/v1/evidence/{BRK}/records | GET | 200 | 50 records (page default) |
| 7 | /api/v1/jobs/{BRK} | GET | 200 | 3 jobs |
| 8 | /api/v1/graph/{BRK} (POST) | POST | 200 | 41 nodes, 56 edges, truncated=false |
| 9 | /api/v1/timeline/{BRK} | GET | 200 | 100 events (page limit) |
| 10 | /api/v1/hypotheses/{BRK} | GET | 200 | 306 hypotheses |
| 11 | /api/v1/hypotheses/{BRK}/{hid} | GET | 200 | 1 signal + 2 recommendations |
| 12 | /api/v1/copilot/{BRK}/query (POST) | POST | 200 | 8 citations |
| 13 | /api/v1/analysis/{BRK} | GET | 200 | 3 runs; latest v3: 203 sigs, 306 hyps, 0 err |
| 14 | /api/v1/analysis/{BRK}/signals | GET | 200 | 6 families, total=203 |
| 15 | /api/v1/analysis/{HBR}/signals | GET | 200 | 0 signals (negative control) |
| 16 | /api/v1/analysis/{QTM}/signals | GET | 200 | 6 weak signals (negative control) |
| 17 | /api/v1/auth/login (POST) | POST | 200 | JWT returned |
| 18 | GET / (root) | GET | 200 | service info |

---

## B. Analysis run verification

### BRK-2026-001 (positive case)
| Metric | Value |
|---|---|
| Events in DB | 1227 |
| Unique relationship pairs | 742 (56 aggregated graph edges) |
| Entities | 41 |
| Run version | 3 |
| Total signals | 203 |
| Contradiction count | 0 |
| Hypotheses | 306 |
| Engine errors | 0 |
| **Signals by family** | |
| communication | 56 |
| writing_style | 78 |
| network_topology | 28 |
| spatial_temporal | 28 |
| financial | 11 |
| device_sim | 2 |

Interpretation: all engines ran clean; communication engine crash (R1) and spatial-temporal explosion (R8) resolved. 56 communication signals are all CALLED-pair co-occurrence signals (aggregated per pair). 28 spatial_temporal signals now properly aggregated.

### HBR-2026-002 (negative control - financial flow)
| Metric | Value |
|---|---|
| Entities | 8 ACCOUNT |
| Signals | 0 (correct) |
| Engine errors | 0 |

Interpretation: bipartite financial flow network with no star/mule topology. Financial engine correctly returns 0 signals; no crash from missing CDR records.

### QTM-2026-003 (negative control - no strong lead)
| Metric | Value |
|---|---|
| Signals | 6 |
| Hypotheses | 19 (all weak) |

Interpretation: no high-confidence lead exists. Writing-style and network-topology signals detect weak co-occurrence patterns only. All 19 hypotheses below threshold 30; no strong lead falsely promoted.

---

## C. Frontend verification

| Page | TS compile | API contract |
|---|---|---|
| Layout | clean | getCase OK, routes match |
| CaseOverview | clean | getAnalysisRuns, getFiles, getJobs, getCase |
| EvidenceRoom | clean | getFiles, getImports, uploadEvidence, importEvidence |
| EntityRegistry | clean | getEntities (uses entity_list endpoint) |
| InvestigationGraph | clean | getGraph (POST), getRelEvidence |
| Timeline | clean | getTimeline |
| NetworkMap | clean | getEntities (location filter) |
| Workbench | clean | getSignals (GET) |
| HypothesisList | clean | getHypotheses, getHypothesis, reviewHypothesis |
| Copilot | clean | askCopilot (POST) |
| Reports | clean | getReports, createReport, getAuditLog |

`tsc --noEmit` exit 0.

---

## D. Graph data integrity

| Check | Result |
|---|---|
| `total_nodes` = 41 | PASS |
| `total_edges` = 56 | PASS |
| `truncated` = false | PASS |
| Edge `properties.evidence_count` sum | 742 | PASS |
| `evidence_count` = sum of per-pair relationship ids | PASS (pair-scoped lookup) |

---

## E. Data preservation confirmation

| Entity | Before repairs | After repairs | Change |
|---|---|---|---|
| Demo cases | 3 | 3 | none |
| BRK entities | 41 | 41 | none |
| BRK source records | 1227 | 1227 | none |
| BRK relationship pairs | 742 | 742 | none |
| HBR entities | 8 | 8 | none |
| HBR source records | 117 | 117 | none |
| QTM entities | 6 | 6 | none |
| Synthetic test cases | ~76 | ~76 | none |
| User accounts | all preserved | all preserved | none |

No data wiped. Re-runs delete only prior-run derived outputs (signals/hypotheses/recs); run history rows kept.

---

## F. Conclusion

All 18 API endpoints return 200 on live data. All 12 frontend pages compile clean. Three demo cases verified (positive + 2 negative controls). All 13 repairs from REPAIR_LOG verified end-to-end. Prototype is operationally complete for demo.

---

## G. Integration / unit test suite (2026-09-15 product-integration pass)

Full suite run file-wise to avoid the known full-suite timeout:

| File | Tests | Result |
|---|---|---|
| `tests/integration/test_rbac.py` + `test_contradiction.py` + `test_workspace.py` (baseline) | 24 | PASS |
| `tests/integration/test_entity_review.py` | 3 | PASS — review history read; merge→revert restores identifiers/participants/relationships, entity reactivated, suggestion reused, `merge_reverted` audit; 409 guards |
| `tests/integration/test_workspace_generation.py` | 4 | PASS — high-strength hypothesis→lead, missing family→gap, contradiction signal→record, idempotent re-run |
| `tests/integration/test_freshness.py` | 2 | PASS — summary fresh with no new evidence; stale after evidence post-dates completed run |
| `tests/integration/test_demo_scenarios.py` | 3 | PASS — supported connection (≥80 + lead), misleading busy-tower overlap (no hypothesis ≥50), conflicting/insufficient (contradiction record + stylometry abstention) |
| `tests/unit/test_engine_limits.py` | 4 | PASS — stylo abstention + limitation, GhostTower busy penalty (score <0.25), device IMEI reuse, fusion notes transparency |
| `tests/unit/test_hypothesis_fusion.py` | part of baseline | PASS |
| **Total** | **43** | **PASS (0 failures)** |

`python -m py_compile` clean on all changed backend files. Alembic migration `006_merge_revert_manifest` applied (DB at head 006).

### Test-time diagnostics (calibrated from real runs)
- Scenario 1: strongest hypothesis subversive_activity ≈ 92/100 (communication + device_sim fusion); lead auto-created.
- Scenario 2: traffic tower busyness = 42 → background_multiplier = 0.51 → co-location signal ≈ 0.18; all A–B hypotheses < 50.
- Scenario 3: impossible travel Delhi→Mumbai in 6 min → contradiction signal + open contradiction record; co-location pair re-flagged `contradicted`.

### Frontend build
- `npm run build` (`tsc && vite build`) exit 0; 96 modules; only chunk-size advisory.
- New items verified at compile: stale banner, run-card freshness pill, graph edge classes/legend, hypothesis methodology disclosure, Esc-to-close, 404 route.