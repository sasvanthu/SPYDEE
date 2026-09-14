# SPYDEE Prototype - Repair Log

Session: 2026-09-14 repair + verification pass.
All repairs verified in place; no schema migrations, no data wipes.

---

## R1. Communication engine crash on empty records
**Root cause:** `analysis/engines/communication_engine.py` called `max([])` when no initiator/originator records existed in a partition (e.g. HBR financial flow case with no CDR).
**Fix:** added `if not from_ids: continue` guard at start of each partition loop.
**Verified:** HBR 2026-002 returns 0 signals, 0 engine_errors (correct negative-control behavior).

## R2. Identifier synonym resolution across engine families
**Root cause:** demo seeded entities had `id_type="phone_sim"` and un-normalized values; engines looked up by exact label/identifier string and missed matches.
**Fix:** `_shared.py` builds synonym index: `phone_sim` -> `phone`, `account_number` -> `account`. Index maps normalized lowercase value -> list of entity ids. All engines resolve via `resolve_entities()` helper.
**Verified:** BRK analysis uses the synonyms to resolve phone_sim entities.

## R3. Edge evidence lookup returning 404
**Root cause:** graph router's relationship-evidence endpoint used a single RelationshipEvidence lookup for a pair's representative relationship id only. The pair's first relationship id may have no direct RelationshipEvidence record; evidence was stored under all pair relationships.
**Fix:** collect all relationship ids belonging to the same source-target pair via EventParticipant, then query all of them. Also filter EventParticipant endpoint result by endpoint_count to show matched participants only.
**Verified:** `GET /graph/{case}/relationship/{rel_id}/evidence` returns 200 on BRK pairs.

## R4. Entity router 500 (MissingGreenlet)
**Root cause:** `EntityResponse.model_validate(e)` triggered lazy-load of `identifiers` relationship; async greenlet not available in sync context.
**Fix:** rewrote entity_router.py with `_entity_to_response()` helper using `EntityResponse.model_construct()` to bypass lazy-loading, explicitly mapping all fields including synthesized `identifier_display`.
**Verified:** `GET /entities/{case}` returns 200 with 41 entities.

## R5. AnalysisRunResponse missing count fields
**Root cause:** `AnalysisRunResponse` had no fields for signal/hypothesis/engine_error counts; CaseOverview "latest run" panel could not show them.
**Fix:** added `signal_count`, `hypothesis_count`, `contradiction_count`, `engine_error_count` to schema. Endpoint computes counts via SQL aggregates (func.count, func.sum with case-when for contradictions and engine_error family).
**Verified:** `GET /analysis/{BRK}` returns v3 with `signal_count=203, hypothesis_count=306, engine_error_count=0`.

## R6. IntelligenceWorkbench showing stale / no real outputs
**Root cause:** Workbench did not call the new `/analysis/{case}/signals` endpoint; UI was a pipeline diagram with placeholder data.
**Fix:** added `api.getSignals()` to api.ts, rewrote Workbench to fetch real signals grouped by family, with score bars, feature details, and family-filter tabs.
**Verified:** BRK workbench shows communication:56, writing_style:78, network_topology:28, spatial_temporal:28, financial:11, device_sim:2.

## R7. Copilot returning generic answers
**Root cause:** timeline tool scanned `details` JSON for label strings (entity matching failed); frequency tool not present; compare/linked showed raw pair list.
**Fix:** rewrote `_tool_timeline` to join EventParticipant; added `_tool_entity_frequency`; improved compare/linked to show shared relationships; added intents for "strongest leads" / "leads"; improved entity resolution in tools.
**Verified:** "BRK strongest leads" returns 8 citations with real signal references.

## R8. Spatial-temporal co-location per-encounter signal explosion
**Root cause:** infra_engine emitted one signal per tower-encounter pair (v1.0); heavy demo data produced many low-unique signals.
**Fix:** v2.1 aggregates all encounters per entity pair into a single signal: encounter_count, distinct_towers, span_hours, closest_encounter_min. Score uses saturating curve `1 - exp(-encounters/80)` so discriminates instead of saturating at 1.0.
**Verified:** BRK v3: 28 spatial_temporal signals (down from 60+ per-encounter), scores 0.84-0.89.

## R9. Layout/nav: header showing generic "Case Workspace"
**Root cause:** Layout header used static text; no case data loaded.
**Fix:** added `useQuery` for `api.getCase(caseId)` into Layout; header now renders `caseData.title`, `caseData.case_code`, and current section label.
**Verified:** tsx compiles clean; header shows BRK-2026-001 title in dark workstation chrome.

## R10. HypothesisList missing contradiction/weakness signals
**Root cause:** list items showed only score and state; contradiction flags were not surfaced at a glance.
**Fix:** added CONTRADICTION badge when any contributing signal has `contradiction=true`; added info-gap alert panel in detail pane with count and penalty explanation.
**Verified:** tsc clean.

## R11. EvidenceRoom silent failure on upload/import error
**Root cause:** mutations had no onError handler; failures swallowed in the network tab.
**Fix:** added `onError` callbacks to both uploadMutation and importMutation; banner state renders red/amber alert with `detail` from API.
**Verified:** tsc clean.

## R12. CaseOverview stats missing relations + signal count
**Root cause:** showed entities, evidence files, events, hypotheses only; no relation count, no signal count, no run summary.
**Fix:** added relation_count, signals count (from latest run), and a "Latest Analysis Run" card showing run version, hypothesis/signal/engine-error counts from enriched runs endpoint.
**Verified:** API returns v3 run with counts.

## R13. Frontend write-tool backtick encoding
**Root cause:** Write tool content containing adjacent backtick+single-quote (`` `' ``) was dropping the closing backtick in template literal strings, causing cascading TS1005 errors.
**Fix:** corrected by running a Node script to repair all 8 broken nav items; avoided the `` `' `` adjacency in subsequent writes.
**Verified:** `npx tsc --noEmit` exit 0 after fix.

---

## Data preservation confirmation
- BRK-2026-001: 41 entities, 1227 events, 742 relationships, 203 signals, 306 hypotheses preserved across all re-runs (re-run deletes derived outputs only).
- HBR-2026-002: 8 ACCOUNT entities, 117 records, 0 signals (negative control preserved).
- QTM-2026-003: 6 weak signals, 19 hypotheses (negative control preserved).
- ~76 synthetic test-case records untouched (source records, imported files, user accounts).