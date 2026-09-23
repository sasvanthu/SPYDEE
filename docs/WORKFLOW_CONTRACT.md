# SPYDEE Workflow Contract

End-to-end workflow: Evidence -> Analysis -> Hypothesis -> Gap -> Action -> Verification.

---

## 1. Data flow overview

```
User uploads CSV/JSON/TXT/PDF
  -> EvidenceRouter.upload     (stores file, SHA-256 dedup)
  -> EvidenceRouter.import     (parses, normalizes, creates SourceRecords + entities + relationships)
  -> EntityRegistry            (phone, account, location, identity entities)
  -> EventDatabase             (Events, EventParticipants linking entities)
  -> RelationshipAggregation   (pairs of entities with relationship_type, event_count)

User clicks "Run Analysis"
  -> AnalysisRouter.run        (creates AnalysisRun, kicks off engines)
  -> Engines                   (communication, financial, spatial_temporal, network_topology, writing_style, device_sim)
  -> Signals                   (one signal per entity-pair per family, score 0-100, quality_factor)
  -> HypothesisEngine          (fuses signals per pair into hypotheses, applies contradiction penalty)
  -> Hypotheses                (hypothesis_type, numeric_value, quality_factor, contributing_signal_highlights)
  -> Recommendations           (follow-up actions derived from hypotheses)
```

## 2. Replace semantics (not accumulate)

On re-run (`POST /analysis/{case_id}/run`):

1. All Signals belonging to prior runs for this case are **deleted**.
2. All Hypotheses belonging to prior runs for this case are **deleted**.
3. All HypothesisSignal rows (signal->hypothesis linkage) for prior runs are **deleted**.
4. All HypothesisRecommendation rows for prior runs are **deleted**.
5. Prior AnalysisRun rows are **kept** (history preserved with version counter).
6. New AnalysisRun created with incremented version number.
7. Engines run on current SourceRecords; new Signals, Hypotheses, Recommendations written.

**Consequence:** Re-running analysis on the same data produces the same signals (deterministic), but review decisions on prior hypotheses are orphaned (review_state not carried forward). This is intentional for the prototype.

## 3. Entity resolution

All engines use the shared `_shared.py` module:

- **normalize_identifier(value, id_type):** lowercases, strips whitespace, applies synonym mapping (`phone_sim` -> `phone`, `account_number` -> `account`).
- **build_synonym_index(entities):** maps normalized lowercase identifier value -> list of entity IDs. Supports multiple id_types per entity.
- **resolve_entities(values, index, id_type):** looks up a list of values in the synonym index; returns matching entity IDs.
- **pair_signature(eid_a, eid_b):** deterministic ordered tuple `(min, max)` for pair-keying.

All signal hypothesis keys use uuid5(NAMESPACE_SPYDEE, stable_key) for reproducibility.

## 4. Signal scoring

Each engine produces a `Signal` with:
- `numeric_value`: weighted evidence strength (0-100 scale)
- `quality_factor`: confidence/coverage factor (0-1)
- `family`: engine family tag (e.g. `communication`, `spatial_temporal`)
- `contradiction`: boolean flag
- `contradiction_reason`: optional text
- `feature_details`: engine-specific JSON (e.g. call_count, encounter_count, shared_count)
- `explanation`: human-readable description

### Communication engine
`score = base (30) + call_score + text_score + night_score + away_score`
- call_score = (0.4 * pair_ratio) + (0.35 * recency) + (0.25 * volume)
- text_score = 0-15 for SMS patterns
- night_score = 0-12 for off-hours activity
- away_score = 0-13 for distant-tower contacts

### Spatial-temporal engine (v2.1 aggregated)
Per-pair signal with encounter_count, distinct_towers, span_hours, closest_encounter_min.
`score = 0.25 + 0.6 * (1 - exp(-encounters/80)) + 0.08 * tower_ratio + 0.16 * proximity_bonus`

### Financial engine
Fan-in/fan-out topology detection with in-degree/out-degree and 24h windowing.

### Network topology
Shared-contact counting across CDR pairs.

### Writing style
TF-IDF + character n-gram similarity between SMS message sets per pair.

## 5. Hypothesis engine

Signal fusion rule:
1. Collect signals per (source, target) pair.
2. For each pair, calculate `raw_value` as weighted sum of signal scores.
3. Penalty for contradiction: if any signal has `contradiction=true`, subtract `contradiction_penalty * weight`.
4. Quality factor: geometric mean of signal quality factors.
5. Hypothesis type: most common engine family among contributing signals.
6. Contributing highlights: top-3 signal explanations.

Hypothesis states:
- `new` -> created by engine
- `needs_verification` -> after reviewer clicks Verify
- `supported_by_reviewer` -> after reviewer clicks Support
- `rejected` -> after reviewer clicks Reject

## 6. Evidence provenance

- Every Event has an EventParticipant linking to entity(s) and a SourceRecord (import_id + row_index).
- Every Relationship links to SourceRecords via `contributing_record_ids` (JSON array of record UUIDs).
- The EvidenceRoom page allows import (which creates Events, Entities, Relationships).
- The Evidence detail endpoint (`GET /graph/{case}/relationship/{rel_id}/evidence`) returns:
  1. The specific SourceRecords associated with that relationship (via `contributing_record_ids`).
  2. SourceRecords where both endpoint entities appear as EventParticipants (contextual evidence).
  3. The pair's aggregated `evidence_count` (total relationship ids in the same source-target pair).

## 7. Demo cases

| Case | Type | Key feature | Expected analysis result |
|---|---|---|---|
| BRK-2026-001 | Positive (criminal network) | 41 entities, CDR + SMS + location + financial | Strong signals: 56 comm, 28 spatial, 28 topo, 11 financial, 78 writing |
| HBR-2026-002 | Negative control (financial flow) | 8 ACCOUNT entities, 117 tx records | 0 signals (no mule topology) |
| QTM-2026-003 | Negative control (no strong lead) | Sparse data, weak co-occurrence | 6 weak signals, 19 weak hypotheses |

## 8. Launch sequence

```
# 1. Start API (detached pythonw via WMI)
$pyw = (Get-Command pythonw.exe).Source
Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{
  CommandLine = "`"$pyw`" C:\Users\sasva\AppData\Local\Temp\opencode\run_api.py"
} | Select-Object ProcessId

# 2. Start Vite dev server (foreground or backgrounded)
cd apps/web && npx vite --port 5173

# 3. Navigate to http://localhost:5173
# 4. Login: investigator / invest123
# 5. Open BRK-2026-001
# 6. Click "Intelligence Workbench" to see signals
# 7. Click "Hypotheses" to see leads
# 8. Click "Copilot" and ask "who are the strongest leads?"
```

## 9. API contract summary

| Endpoint | Method | Purpose |
|---|---|---|
| /api/v1/auth/login | POST | JWT authentication |
| /api/v1/cases | GET | List cases |
| /api/v1/cases/{id} | GET | Case detail |
| /api/v1/entities/{case_id} | GET | Entity list |
| /api/v1/entities/{case_id}/{entity_id} | GET | Entity detail |
| /api/v1/evidence/{case_id}/upload | POST | Upload file |
| /api/v1/evidence/{case_id}/upload/{file_id}/import | POST | Import records |
| /api/v1/evidence/{case_id}/files | GET | Uploaded files |
| /api/v1/evidence/{case_id}/imports | GET | Import history |
| /api/v1/evidence/{case_id}/records | GET | Source records |
| /api/v1/graph/{case_id} | POST | Full graph |
| /api/v1/graph/{case_id}/neighbourhood/{entity_id} | GET | Neighbourhood expansion |
| /api/v1/graph/{case_id}/path | GET | Path between entities |
| /api/v1/graph/{case_id}/relationship/{rel_id}/evidence | GET | Relationship evidence |
| /api/v1/timeline/{case_id} | GET | Timeline events |
| /api/v1/analysis/{case_id}/run | POST | Run analysis |
| /api/v1/analysis/{case_id} | GET | Analysis runs history |
| /api/v1/analysis/{case_id}/signals | GET | Latest run signals |
| /api/v1/hypotheses/{case_id} | GET | Hypothesis list |
| /api/v1/hypotheses/{case_id}/{hyp_id} | GET | Hypothesis detail |
| /api/v1/hypotheses/{case_id}/{hyp_id}/review | POST | Review decision |
| /api/v1/copilot/{case_id}/query | POST | Ask copilot |
| /api/v1/copilot/{case_id}/history | GET | Copilot history |
| /api/v1/jobs/{case_id} | GET | Job history |
| /api/v1/reports/{case_id} | GET | Reports list |
| /api/v1/reports/{case_id} | POST | Generate report |
| /api/v1/audit/{case_id} | GET | Audit log |