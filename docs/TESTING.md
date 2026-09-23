# SPYDEE Testing

## Tests Run

### Database Setup
- [x] Migration creates all tables without errors
- [x] Seed script populates users, cases, evidence, entities, events

### Authentication
- [x] Login with valid credentials returns JWT token
- [x] Login with invalid credentials returns 401
- [x] Accessing protected routes without token returns 401
- [x] Token expiration returns 401

### Case Management
- [x] Create case with unique code
- [x] List cases filtered by membership
- [x] Case detail shows correct counts
- [x] Non-member cannot access case data

### Evidence Ingestion
- [x] Upload CSV/JSON file
- [x] Duplicate detection by SHA-256
- [x] Import processes all records
- [x] Source records stored with provenance
- [x] Re-import of same file does not multiply records

### Entity Resolution
- [x] Identifiers normalized deterministically
- [x] Entities created from imported records
- [x] Phone normalization strips formatting
- [x] Entity review decisions persist

### Graph Construction
- [x] Nodes represent entities
- [x] Edges represent relationships
- [x] Graph filters by entity type
- [x] Bounded expansion prevents hairball
- [x] Path finding works between connected entities

### Analysis
- [x] Communication signals computed
- [x] Graph structural signals computed
- [x] Hypotheses generated with score breakdown
- [x] Missing information identified
- [x] Same input produces same output

### Copilot
- [x] Query returns cited response
- [x] Follow-up suggestions provided
- [x] Refuses unsupported claims
- [x] Citations link to real records

### Reports
- [x] Report generation creates JSON content
- [x] Report preview shows hypotheses and limitations
- [x] Reports preserve analysis version

### Audit
- [x] All state changes logged
- [x] Audit events scoped to case

## Automated suite (2026-09-15)
Run per-file from repo root (the full `pytest tests` run times out; see VERIFICATION_REPORT.md section G):

| File | Covers |
|---|---|
| `tests/integration/test_entity_review.py` | merge apply → revert restores identifiers/participants/relationships, entity reactivation, suggestion reuse, audit history, 409 guards |
| `tests/integration/test_workspace_generation.py` | auto contradictions / leads (≥80) / info gaps, idempotent re-run |
| `tests/integration/test_demo_scenarios.py` | supported connection, misleading busy-tower overlap, conflicting/insufficient evidence (real pipeline) |
| `tests/integration/test_freshness.py` | `analysis_stale` flag when evidence post-dates latest completed run |
| `tests/unit/test_engine_limits.py` | stylometry abstention, GhostTower busy penalty, device IMEI reuse, fusion transparency notes |
| `tests/unit/test_hypothesis_fusion.py` | fusion determinism from direct signal construction |
| `tests/integration/test_rbac.py`, `test_contradiction.py`, `test_workspace.py` | case authorization, contradiction review, workspace CRUD |

43 tests total, all passing (2026-09-15).

## Known Limitations
- StyloLink is a stylistic heuristic, not authorship identification — abstains below
  minimum corpus (≥2 messages, ≥60 chars) and discloses the limitation.
- GhostTower busyness normalization uses per-run evidence (no historical tower baseline).
- PDF text extraction requires extractable text
- No real OCR for scanned documents
- Graph visualization uses external CDN for Cytoscape.js
