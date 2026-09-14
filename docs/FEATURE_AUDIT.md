# SPYDEE Prototype - Feature Audit

Audit date: 2026-09-14
Scope: existing prototype at repo root, repair + verification pass (SIH 2026, PS 26189).

## Status legend
- OK       - verified working end-to-end during this audit
- REPAIRED - was broken, fixed and verified this pass
- PARTIAL  - works but with known limitations
- TODO     - not yet addressed / out of scope for prototype

---

## 1. Authentication and roles
| Feature | Status | Notes |
|---|---|---|
| Login (investigator) | OK | `investigator` / `invest123`, JWT returned and stored |
| Token refresh / 401 redirect | OK | api.ts clears token and redirects to /login on 401 |
| User profile in sidebar | OK | display_name + role rendered from localStorage |
| Sign out | OK | clears token + user, navigates to /login |

## 2. Case management
| Feature | Status | Notes |
|---|---|---|
| Case list | OK | `/cases` returns all cases (3 demo + ~76 synthetic by test users) |
| Case detail counts | REPAIRED | Overview now includes entities, **relations**, events, **signals**, hypotheses |
| Latest-run summary card | REPAIRED | `AnalysisRunResponse` enriched with `signal_count`, `hypothesis_count`, `contradiction_count`, `engine_error_count` computed server-side |
| Status colors | OK | draft/active/under_review/archived mapped |

## 3. Evidence ingestion
| Feature | Status | Notes |
|---|---|---|
| Upload (CSV/JSON/TXT/PDF) | OK | `/evidence/{case_id}/upload`, SHA-256 dedup |
| Import records | OK | `/evidence/{case_id}/upload/{file_id}/import` |
| Files / imports / records listing | OK | 4 files on BRK, 50-record page default |
| Upload error surfacing | REPAIRED | EvidenceRoom now renders failure banners with `detail` from API |
| Import error surfacing | REPAIRED | amber failure banner on import errors |
| Import history | OK | accepted/rejected counts, failed status shown red |

## 4. Entity intelligence
| Feature | Status | Notes |
|---|---|---|
| Entity list | REPAIRED | CLI-verified path fixed - `EntityResponse.model_validate(e)` crashed on lazy `identifiers` (MissingGreenlet). Replaced with `model_construct()` helper |
| Entity detail | OK | identifiers, attributes, relationships load cleanly |
| Search / filter by type | PARTIAL | query params supported by router; UI filtering minimal |
| Entity review marking | OK | review endpoint available |

## 5. Network graph
| Feature | Status | Notes |
|---|---|---|
| Full graph POST | OK | `/graph/{case_id}` - BRK 41 nodes / 56 edges (aggregated), truncated=false |
| Neighbourhood | OK | hops-based expansion |
| Path search | OK | source_id/target_id |
| Relationship evidence (edge detail) | REPAIRED | Pair-scoped RelationshipEvidence lookup + EventParticipant two-endpoint fallback |
| Edge `evidence_count` | OK | summed across aggregated relationship ids |
| InvestigationGraph UI | REPAIRED | rewritten, TS clean, adjacency-expansion, statistics panel |

## 6. Timeline
| Feature | Status | Notes |
|---|---|---|
| Event listing | OK | `/timeline/{case_id}` BRK returns 100 (paginated) |
| Filters (type, from, to) | OK | supported |
| Event participants | PARTIAL | joined via EventParticipant; identifiers shown as joined labels |

## 7. Network map (Leaflet)
| Feature | Status | Notes |
|---|---|---|
| Map load (external tiles) | OK | loads Leaflet from unpkg; OSM tiles |
| Location markers | PARTIAL | depends on entity attributes lat/lon; synthetic location entities rarely carry coordinates |
| Review-state legends | OK | color-coded markers |

## 8. Analysis pipeline
| Feature | Status | Notes |
|---|---|---|
| Run trigger | OK | POST `/analysis/{case_id}/run` - BRK run v3 |
| Deterministic hypothesis ids | OK | uuid5(NAMESPACE_SPYDEE, stable_key) |
| Replace semantics (re-run) | OK | deletes prior-run signals/hypotheses/recommendations/review-actions; keeps run history |
| Engine registry | OK | communication, financial, network_topology, writing_style, device_sim, spatial_temporal |
| Engine errors stored as signals | OK | family=`engine_error`, surfaced in run summary |
| BRK 1 run | OK | 1227 events, 742 relationship pairs, 41 entities |
| BRK run v3 outputs | OK | 203 signals / 306 hypotheses / 0 engine errors |
| HBR negative control | OK | 0 signals (correct: bipartite financial flow, no mule topology) |
| QTM negative control | OK | 6 signals / 19 weak hypotheses (no strong lead) |
| Full graph aggregation | OK | 56 CALLED pairs present in graph edges |

## 9. Signals engine details
| Engine | Status | Notes |
|---|---|---|
| communication | REPAIRED | crash on `max([])` when no initiator/a-origin records; horizon guard added |
| Identifier synonym resolution | REPAIRED | `_shared.py` synonym index (phone_sim vs phone, un-normalized demo values) |
| financial (money mule) | OK | 11 signals on BRK, all score 1.0 |
| network_topology | OK | 28 signals |
| spatial_temporal co-location | REPAIRED | v2.1 aggregates repeated tower encounters per pair into ONE signal with encounter_count, distinct_towers, span_hours, closest_encounter_min; saturating density curve (1 - exp(-n/80)) no longer saturates at 1.0 |
| writing_style | OK | 78 signals |
| device_sim | OK | 2 signals |

## 10. Hypotheses + gap + action + verification loop
| Feature | Status | Notes |
|---|---|---|
| Hypothesis list | OK | 306 for BRK, state filter works |
| Hypothesis detail (signals + recs) | OK | returns `{hypothesis, signals, recommendations}` |
| Contradiction flag | OK | signals flagged with weight + reason |
| Contradiction badge in UI | REPAIRED | HypothesisDetail now shows CONTRADICTION badges on list and detail, plus info-gap alert panel |
| Quality factor + score | OK | score column 0-100 with thresholds |
| Review decisions | OK | needs_verification / supported_by_reviewer / rejected with note |
| Signal highlights | OK | rendered per hypothesis |

## 11. Intelligence Workbench
| Feature | Status | Notes |
|---|---|---|
| Signals-by-family view | REPAIRED | real data from `/analysis/{case}/signals` with counts_by_family, filters tabs |
| Score bars + feature details | OK | numeric_value, quality_factor, feature_details rendered |
| Contradiction markers | OK | red styling + warning |
| Pipeline visualization | OK | step diagram |

## 12. Copilot
| Feature | Status | Notes |
|---|---|---|
| 8 core questions answered with citations | OK | 8 citations returned on BRK lead query |
| Timeline tool | REPAIRED | EventParticipant join now used instead of label-in-details scan |
| Entity frequency tool | REPAIRED | added - ranks entities by event count in case |
| Compare / linked entities | REPAIRED | shared-relationship view between two entities |
| Leads / strongest-leads intent | REPAIRED | added to hypotheses branch |
| Entity resolution in tools | REPAIRED | label + id + identifier value matching |

## 13. Reports
| Feature | Status | Notes |
|---|---|---|
| Report generation | OK | returns content with summary, hypotheses waterfall, review decisions, limitations |
| Export MD / Print | OK | client-side |
| Audit log | OK | `/audit/{case_id}` - 3 events on BRK |
| Report listing | OK | 0 existing on BRK (none generated yet) |

## 14. Cross-cutting
| Feature | Status | Notes |
|---|---|---|
| Layout / navigation | REPAIRED | dark workstation theme; active nav highlight; header shows real case title + case_code + section; sticky |
| Case header context | REPAIRED | added getCase into Layout |
| TS compile | OK | `npx tsc --noEmit` exit 0 |
| API smoke suite | OK | 16 endpoints verified (see VERIFICATION_REPORT.md) |
| Server reload safety | REPAIRED | documented launch via `pythonw.exe` through WMI (console-inherited processes are killed by shell cleanup; `--reload` watcher is unreliable) |

## Known limitations (accepted for prototype)
- Network map: synthetic location entities lack lat/lon attributes in most cases -> empty map.
- Writing-style signals: many feature-detail texts; explanation quality is heuristic.
- Pagination: timeline & records default to server limits (50/100); UI lacks pager.
- Copilot: rule-based intent routing, not LLM; answers are assembly of engine outputs.
- No Neo4j/Qdrant present in this prototype (PostgreSQL + NetworkX). ARCHITECTURE.md documents actual stack.