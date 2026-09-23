# SPYDEE Demo Sequence (3 minutes)

## Setup
1. Open http://localhost:5173
2. Sign in as `investigator` / `invest123`
3. Dark workstation layout loads; header shows case title when inside a case

## Step 1: Open Broken Chain Case (15s)
1. Click on "Broken Chain - Network Continuity Analysis" (BRK-2026-001)
2. Header updates to show BRK-2026-001 + case code
3. Observe the overview: 41 entities, 742 relations, 1227 events, 203 signals, 306 hypotheses
4. "Latest Analysis Run" card shows v3 with 203 signals, 306 hypotheses, 0 engine errors

## Step 2: Inspect Evidence (30s)
1. Click "Evidence" in the sidebar
2. Show 4 uploaded files with accepted/rejected counts
3. Show import history with status badges (all imported)
4. (Optional) Upload a new CSV to show upload flow

## Step 3: Intelligence Workbench (45s)
1. Click "Workbench" in the sidebar
2. Signals-by-family dashboard loads with real data:
   - Communication: 56 signals (CAD co-occurrence pairs)
   - Writing Style: 78 signals (SMS similarity)
   - Network Topology: 28 signals (shared contacts)
   - Spatial-Temporal: 28 signals (co-location encounters)
   - Financial: 11 signals (fan-in/out mule topology)
   - Device/SIM: 2 signals
3. Filter by family using the tab buttons
4. Click any signal to see feature details, score bar, and quality factor
5. Note: all scores are discriminating (0.84 - 0.89 for spatial), not saturating at 1.0

## Step 4: Investigation Graph (30s)
1. Click "Graph" in the sidebar
2. 41 nodes, 56 aggregated edges loaded (Cytoscape)
3. Click any node to expand its neighbourhood
4. Click any edge to see relationship evidence count and type
5. Click "Evidence" in edge detail to see source records

## Step 5: Inspect Hypotheses (30s)
1. Click "Hypotheses" in the sidebar
2. 306 hypotheses listed; select the highest-scoring
3. Detail panel shows: score/100, contributing signals (with CONTRADICTION badges if present)
4. Info-gap alert panel shows count of contradicting signals and penalty explanation
5. Recommended actions listed per hypothesis
6. Record a decision: add a note and click "Support"

## Step 6: Use Copilot (30s)
1. Click "Copilot" in the sidebar
2. Ask: "BRK strongest leads"
3. 8 citations returned with real signal references (communication, writing_style, network_topology)
4. Ask: "What contradicts this lead?"
5. Show the follow-up suggestions

## Step 7: Negative Controls (20s)
1. Return to Cases list
2. Open HBR-2026-002: click Workbench -> 0 signals (correct: bipartite financial flow, no mule topology)
3. Open QTM-2026-003: click Workbench -> 6 weak signals, 19 weak hypotheses (no strong lead)

## Step 8: Export Report (15s)
1. Open BRK-2026-001, click "Reports"
2. Enter a title, click "Generate Report"
3. Report preview: hypotheses waterfall, review decisions, limitations
4. Click "Export MD" or "Print / PDF"

## Key Points to Highlight
- All processing is real, not mocked (engine outputs verified)
- Same input produces same output (deterministic uuid5 hypothesis IDs)
- Evidence-strength index is not a guilt probability (0-100 scale, not 0-1 probability)
- Info-gap alerts surface contradictions driving the next investigation step
- Negative controls prove engines do not produce false positives on clean data
- Synthetic demo marker visible throughout (top-right "SYNTHETIC DATA" badge)

---

# New capabilities walkthrough (product-integration pass)

Reproducible via the automated scenario tests (`tests/integration/test_demo_scenarios.py`,
`test_entity_review.py`, `test_freshness.py`, `test_workspace_generation.py`). For a live
demo, run those tests to create the corresponding cases, then open each from the Cases list.

## Scenario 1 — Supported connection (strong link + auto lead)
1. Run `python -m pytest tests/integration/test_demo_scenarios.py::test_scenario1_supported_connection`.
2. Open the created case → Workbench: communication signals (20 calls) + a shared-handset
   device_sim signal both link the pair.
3. Hypotheses: the pair's subversive_activity score is ≈ 92/100. Notes state the fusion
   formula and the caveat: *"uncalibrated evidence scores, not probabilities … requires
   investigator verification."*
4. Leads → the high hypothesis auto-created a **lead** (reviewable, not auto-promoted).

## Scenario 2 — Misleading overlap (busy-tower coincidence is NOT a link)
1. Run `test_scenario2_misleading_overlap`.
2. Graph → the tower-registered stranger pair share only one encounter at a 42-identity
   public tower. GhostTower flags `busy_tower` and applies background_multiplier 0.51,
   so the co-location signal scores ≈ 0.18 (dark grey, well below any threat threshold).
3. Hypotheses: no hypothesis ≥ 50 exists for the pair. The coincidence is not presented
   as a link.

## Scenario 3 — Conflicting / insufficient evidence
1. Run `test_scenario3_conflicting_and_insufficient`.
2. Contradictions page: an **open contradiction record** is auto-created for the
   impossible travel (Delhi→Mumbai in 6 minutes, SIM relocation/spoofed telemetry).
3. The supporting co-location signal is re-flagged `contradicted` (dotted red edge in the
   graph legend), and any fused hypothesis carries the contradiction penalty.
4. The two single short messages produce **no writing-style signal** — StyloLink abstains
   rather than inventing an authorship link.

## Reversible entity resolution
1. Entities → generate merge candidates; apply one.
2. The merge now stores a manifest. Re-open the suggestion and click **Revert**: the
   merged entity is reactivated, identifiers/participants/relationship ends are restored
   to it, and the suggestion returns to NEW (audit logged `merge_reverted`). Nothing is
   silently undone — history is reviewable (`review-history`).

## Analysis freshness round-trip
1. Open any case → Case Overview shows the analysis run card.
2. Import a new evidence file (or add a SourceRecord post-run).
3. Re-open Overview: an amber **"Findings may be stale"** banner + STALE pill appears and
   the summary API returns `analysis_stale=true`; click **Re-run analysis** to refresh
   derived findings (prior run history and review decisions are preserved).