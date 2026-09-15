# SPYDEE Prototype - Feature Audit

Audit date: 2026-09-15
Scope: existing prototype at repo root, repair + verification pass (SIH 2026, PS 26189).
Investigation workspace extension: contradictions, leads, gaps, actions, evidence detail, manual events, merge review, copilot/report enrichment.
Product-integration pass (this update): reversible entity resolution, honest specialist engines, transparent fusion, auto-provisioned contradictions/leads/gaps, analysis staleness, demo scenarios, frontend polish.

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

## 14. Investigation workspace
| Feature | Status | Notes |
|---|---|---|
| Workspace summary | OK | GET `/workspace/{case_id}/summary` — live counts of open contradictions/leads/gaps/actions, entity/evidence stats, recent activity |
| Contradictions create | OK | POST `/workspace/{case_id}/contradictions` — 2+ statements required; created status `open` |
| Contradictions list | OK | GET with `?status=open\|resolved\|...` filter |
| Contradictions detail + review | OK | detail returns statements + full review history; review sets status (open/needs_clarification/resolved/dismissed) and records reviewer + timestamp |
| Leads create | OK | POST — priority, origin_type, evidence refs stored |
| Leads list / status filter | OK | GET with `?status=open\|in_progress\|...` filter |
| Leads detail (linked gaps + actions) | OK | detail includes nested gaps + actions + review history |
| Leads priority re-triage | OK | PATCH — change priority/priority_rationale |
| Leads status transition | OK | review endpoint transitions (open → in_progress → resolved/dismissed) |
| Information gaps create + list | OK | POST/GET — linked to optional lead_id |
| Information gaps status transition | OK | PATCH — open → addressed/dismissed |
| Investigation actions create + list | OK | POST/GET — linked to optional lead_id and gap_id |
| Investigation actions status | OK | PATCH — proposed → in_progress → completed/failed, with outcome_notes |
| Workspace enum storage | OK | native PG enums uppercase labels; SQLAlchemy coerces lowercase query values; empirically verified via direct DB probe |
| Cross-case isolation | OK | non-members get 403; archived cases block writes for investigators |

## 15. Evidence detail & text extraction
| Feature | Status | Notes |
|---|---|---|
| Evidence file detail | OK | GET `/evidence/{case_id}/files/{file_id}` — metadata, extracted_text, extraction_error, retry_count, record_count, import history |
| Retry extract (TXT/PDF) | OK | POST `/retry-extract` — re-reads file, re-chunks, clears extraction_error, increments retry_count |
| TXT extraction on upload | OK | `save_uploaded_file` sets extracted_text + parser_version for txt/pdf; json without text extraction |
| Non-document rejection | OK | retry-extract returns 400 for non-TXT/PDF files |
| Frontend evidence detail drawer | OK | EvidenceRoom file rows clickable → detail modal showing stats, extraction error + retry button, extracted text toggle, import history |

## 16. Manual timeline events
| Feature | Status | Notes |
|---|---|---|
| Manual event creation | OK | POST `/timeline/{case_id}/events` — event_type, label, optional start_time, time_precision auto-set to `unknown` when no timestamp; `is_manual=True` |
| Manual event label in timeline list | OK | `is_manual` field rendered; details.text/amount shown |
| No timestamp fabrication | OK | start_time=None when not supplied; time_precision="unknown" |
| Entity participant linking | OK | participant_entity_ids attached as EventParticipant records with role="manual" |

## 17. Merge suggestions
| Feature | Status | Notes |
|---|---|---|
| Generate candidates | OK | POST `/entities/{case_id}/merge/candidates` — deterministic pairwise identity/conflict scoring |
| List suggestions | OK | GET `/entities/{case_id}/merge-suggestions` — ordered by confidence desc, shows review_state, basis |
| Apply merge | OK | POST `/{suggestion_id}/apply` — relinks identifiers, participants, relationships; archives secondary; idempotent guard (409) |
| Dismiss merge | OK | POST `/{suggestion_id}/dismiss` — sets review_state=rejected |
| Route shadowing fix | REPAIRED | `GET /merge-suggestions` was shadowed by `GET /{entity_id}` (422); moved above generic route |
| Merge manifest recorded | OK | applied merges store `merge_manifest` JSON (identifier links, event participants, relationship ends changed) for reversibility |
| **Revert merge** | OK | POST `/{suggestion_id}/revert` — restores identifiers/participants/relationship ends to the secondary entity, reactivates it, resets suggestion to NEW with manifest cleared, logs `merge_reverted`; 409 if not applied |
| Review history | OK | GET `/entities/{case_id}/{entity_id}/review-history` — chronological review decisions with reviewer + note |
| Entity review enum fix | REPAIRED | `review_entity` previously bound lowercase strings against native PG `reviewstate` enum and failed; decision now coerced via `ReviewState[...]` (invalid → 422 with allowed values) |

## 18. Enhanced copilot (workspace-aware)
| Feature | Status | Notes |
|---|---|---|
| Contradictions tool | OK | query "contradict/conflict/impossible" returns workspace contradictions + signals, with `type: "contradiction"` citations |
| Information gaps tool | OK | query "gap/missing/insufficient" returns workspace gaps + hypothesis-derived gaps |
| Open leads tool | OK | query "lead(s)" returns workspace leads with priority/status |
| Open actions tool | OK | query "action/next step" returns proposed+in-progress actions |
| Citation types | OK | contradictions, leads, information_gap, hypothesis, entity, signal, document_chunk |
| Nav link rendering | OK | citation links rendered as colored pills navigating to contradictions/leads/hypothesis pages |

## 19. Enhanced reports
| Feature | Status | Notes |
|---|---|---|
| Workspace section in content | OK | report JSON includes contradictions[], leads[], information_gaps[], actions[] |
| Summary counters | OK | open_contradictions, open_leads, open_gaps, open_actions in summary block |
| Analysis run versioning | OK | analysis_run_id parameter; frontend shows run selector when >1 run exists |
| HTML export | OK | contradictions, leads, gaps, actions sections rendered in HTML report |

## 20. Frontend routing & navigation
| Feature | Status | Notes |
|---|---|---|
| Contradictions page | OK | `/cases/:caseId/contradictions` — list with status filter, create modal, detail modal with review history |
| Leads/Gaps/Actions page | OK | `/cases/:caseId/leads` — tabs for leads/gaps/actions, create forms, status transitions, detail modals with linked data |
| Navigation grouped sections | OK | Layout nav grouped into Overview / Evidence & Site / Intelligence / Partner Tools / Output |
| TypeScript compile | OK | `npx tsc --noEmit` exit 0 after workspace changes |
| Vite build | OK | 96 modules, built in 28s, chunk-size warning only |

## 21. Cross-cutting
| Feature | Status | Notes |
|---|---|---|
| Layout / navigation | REPAIRED | dark workstation theme; active nav highlight; header shows real case title + case_code + section; sticky |
| Case header context | REPAIRED | added getCase into Layout |
| TS compile | OK | `npx tsc --noEmit` exit 0 |
| API smoke suite | OK | 16 endpoints verified (see VERIFICATION_REPORT.md) |
| Server reload safety | REPAIRED | documented launch via `pythonw.exe` through WMI (console-inherited processes are killed by shell cleanup; `--reload` watcher is unreliable) |

## 22. Analysis freshness
| Feature | Status | Notes |
|---|---|---|
| Staleness flag | OK | `CaseWorkspaceSummary.analysis_stale` + `analysis_stale_reason` |
| Comparator | OK | newest `SourceRecord.created_at` vs latest completed `AnalysisRun.completed_at`; stale (with reason) when no run exists |
| CaseOverview banner | OK | amber "Findings may be stale" banner with reason + "Re-run analysis" button |
| Run card freshness badge | OK | STALE / UP TO DATE pill on the Latest Analysis Run card, clickable to re-run |
| Freshness tests | OK | `test_summary_fresh_when_no_new_evidence`, `test_summary_stale_after_new_evidence` |

## 23. Honest specialist engines
| Feature | Status | Notes |
|---|---|---|
| GhostTower busyness penalty | OK | `background_multiplier=clamp01(1.35−0.02·busyness)`; `busy_tower` at ≥20 identities; busy co-location scores ≈0.18, never a strong link |
| Impossible-travel contradiction | OK | towers ≥`ANTENNA_LIMIT_KM` apart in less than `SPEED_LIMIT_KMH` time → contradiction signal, score 0, propagated to affected co-location pairs |
| StyloLink abstention | OK | requires ≥2 messages AND ≥60 chars per author; limitation disclosed in feature_details + explanation |
| Device/SIM IMEI reuse | OK | signature reuse across distinct handsets surfaced (`imei_reuse`, `device_hop`); record-append dedupe fix |
| Fusion transparency | OK | hypothesis notes state exact weighted-mean formula, family weights, "uncalibrated evidence scores, not probabilities", and verification caveat |
| Engine version bump | OK | infra v2.2, stylo v2.1, device v2.1, communication v2.1 |
| Engine-limits tests | OK | `tests/unit/test_engine_limits.py` (4 passing) |

## 24. Auto-provisioned workspace + demo scenarios
| Feature | Status | Notes |
|---|---|---|
| Contradiction records from signals | OK | idempotent, keyed (detection_method, sorted entity_ids); autos `open` |
| Leads from high hypotheses | OK | strength ≥ 80 → lead (origin `analysis:hypothesis`); upserted on re-run |
| Info gaps from hypothesis notes | OK | `Data gaps:` parsed; upsert on matching title |
| Wired into run | OK | `generate_workspace_from_run` called after run completes (config `auto_workspace`, default true; never fails a run) |
| Scenario 1 — supported connection | OK | strong calls + shared handset + quiet co-location → fused strength ≥ 80 and auto lead |
| Scenario 2 — misleading overlap | OK | single busy-tower co-location (40 background identities) → busy_tower penalty, no hypothesis ≥ 50 |
| Scenario 3 — conflicting/insufficient | OK | impossible travel → contradiction record + penalised fusion; single short messages → no stylometry signal |
| Demo scenario tests | OK | `tests/integration/test_demo_scenarios.py` (3 passing, real pipeline) |

## 25. Frontend (Stage F)
| Feature | Status | Notes |
|---|---|---|
| Graph edge classes | OK | contradicted edges (dotted red) + evidence-weight width (`strong` ≥10, `moderate` ≥3) |
| Graph legend | OK | observed / inferred / contradicted / evidence-weight rows |
| Edge detail evidence count | OK | displayed alongside classification; contradicted edge warning |
| Hypothesis methodology disclosure | OK | detail shows weighted-mean formula + "not probabilities" + verification caveat |
| Keyboard accessibility | OK | Esc closes graph/hypothesis detail panels; close buttons carry aria-labels |
| 404 route | OK | catch-all NotFound page with link home |

## Known limitations (accepted for prototype)
- Network map: synthetic location entities lack lat/lon attributes in most cases -> empty map.
- Writing-style signals: many feature-detail texts; explanation quality is heuristic.
- Pagination: timeline & records default to server limits (50/100); UI lacks pager.
- Copilot: rule-based intent routing, not LLM; answers are assembly of engine outputs.
- No Neo4j/Qdrant present in this prototype (PostgreSQL + NetworkX). ARCHITECTURE.md documents actual stack.
- Hypotheses.review_state is VARCHAR (not native PG enum) — values stored lowercase; workspace summary filter relies on SQLAlchemy value coercion (empirically tested for other enums; reasoned correct for VARCHAR).
- Analysis pipeline (ingest + full analysis) takes ~1.5–6 min on the local setup depending on dataset size; integration test suite should be run per-file with generous timeouts.