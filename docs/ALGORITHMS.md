# SPYDEE Algorithms

## Signal Families and Weights

Base family weights used for fusion (`analysis/scoring/hypothesis_engine.py`):

| Family           | Weight | Engine                              | Output family   |
|------------------|--------|-------------------------------------|-----------------|
| Communication    | 0.20   | `analysis/engines/communication_engine` | communication |
| Device/SIM       | 0.20   | `analysis/engines/device_engine`        | device_sim     |
| Spatial/Temporal | 0.15   | `analysis/engines/infra_engine`         | spatial_temporal |
| Writing Style    | 0.15   | `analysis/engines/stylo_engine`         | writing_style  |
| Financial        | 0.10   | `analysis/engines/financial_engine`     | financial      |
| Infrastructure   | 0.10   | `analysis/engines/infra_engine`         | infrastructure |
| Network Topology | 0.10   | `analysis/engines/graph_engine`         | network_topology |

## Hypothesis types restrict which families are applicable

| Hypothesis type   | Applicable families                          |
|-------------------|----------------------------------------------|
| subversive_activity | communication, network_topology, device_sim |
| terror_link         | communication, network_topology, spatial_temporal |
| social_network      | communication, network_topology, writing_style |

## Strength Index Computation (fusion)

For each entity-pair hypothesis:

1. Group signals by entity pair and family.
2. For each applicable family, take the best signal: `s_f = numeric_value`, `q_f = quality_factor`.
3. Weighted mean over applicable families only:
   `strength = 100 × (Σ w_f × s_f × q_f) / (Σ w_f)`.
4. If any applicable family signal is flagged as a **contradiction**, apply
   `strength = max(0, strength × (1 − 0.25))` and note the penalty in the notes.
5. Round to 0.1. Strength bands: High Plausibility ≥ 80, Medium 50–79, Low < 50.

The fused strength is disclosed in each hypothesis notes field exactly as it was
computed, e.g. `Fusion: strength = weighted mean of family evidence scores using
[communication (w=0.20), device_sim (w=0.20)]`. **Scores are uncalibrated
evidence scores, not probabilities.** A score of 80 does not mean 80% probability;
it means the available evidence families align. Verification by an investigator is
required before a link is treated as possible; below 50 a hypothesis states it
does not establish a link.

## Communication Engine (`communication_engine.py` v2.1)

- Counts pairwise calls/messages; normalizes phone identifiers.
- Score: `0.35·min(count/20,1) + 0.20·min(total_duration/3600,1) +
  0.20·burst + 0.15·night_ratio + 0.10·long_call_ratio`.
- Burst = max events in any 2-hour sliding window (max/6).
- Burner lifecycle: short-lived burst (≤3 days) then ≥2 days silence, count ≥ 8 → +0.15.
- Quality: `min(1.0, 0.5 + count × 0.05)`.
- Minimum: 2 communications per pair to emit a signal.

## Device / SIM Engine (`device_engine.py` v2.1)

- Groups events by handset; binds SIM/phone identities to devices.
- `sim_hop`: two or more distinct phone entities registered on one device →
  `swap_kind="device_hop"`; score saturates toward 1 with more device events.
- `co_travel`: distinct phones whose events are geo-co-located on the same handset.
- Signature reuse: the same IMEI appearing across distinct handset entities is
  surfaced as an `imei_reuse` signal (device-hopping indicator) rather than being
  silently absorbed.
- Fixes in v2.1: no duplicate record appends in bindings; binding exposes the
  device's `imeis`.

## StyloLink (`stylo_engine.py` v2.1) — honest abstention

- Compares short-message corpora per author with deterministic feature hashing
  (no external embeddings).
- **Abstains** (no signal) unless an author has **≥ 2 messages** and
  **≥ 60 total characters**. A single short message never produces an
  authorship-link signal.
- Every signal's feature_details and explanation state the limitation:
  "likelihood heuristic, not authorship identification; uncalibrated".

## GhostTower (`infra_engine.py` v2.2) — background normalization

- Co-location is computed for every tower from distinct identities, and signals
  report `tower_busyness_max` (number of distinct entities at the busy tower).
- Penalty for high-traffic towers: `background_multiplier = clamp(1.35 − 0.02 ×
  busyness, 0, 1)`, applied to the raw co-location score. Towers with ≥ 20
  distinct identities are flagged `busy_tower: true`.
- A busy-tower co-location therefore scores low (≈0.18 at busyness 42) instead
  of producing a strong "link" that is really just a coincidence of crowds.
- Impossible travel: entity appears at two towers ≥ `ANTENNA_LIMIT_KM` apart in
  less time than `SPEED_LIMIT_KMH` allows → contradiction signal
  (`contradiction=true`, `pattern=impossible_travel`, score 0). The contradiction
  is propagated onto affected co-location pair signals (which are re-flagged and
  the fused hypothesis penalized).
- Shared IP / subnet → `infrastructure` family signal.

## Graph Structure Engine (`graph_engine.py`)

- NetworkX directed graph from entities + relationships; degree and betweenness
  centrality. Score `0.3·min(centrality×2,1) + 0.7·min(betweenness×5,1)`.

## Financial Engine (`financial_engine.py`)

- Fan-in/fan-out money-mule topology detection around accounts.

## Hypothesis Generation and prioritization

- Deterministic ids via uuid5 over `(case_id, sorted pair, hypothesis_type)`.
- Reviews (needs_verification / supported_by_reviewer / rejected) are recorded
  and preserved across re-analysis runs.
- A re-run replaces derived outputs (signals, hypotheses, recommendations) but
  keeps AnalysisRun rows with an incrementing version; workspace summary sets
  `analysis_stale=true` when evidence arrives after the latest completed run so
  investigators are prompted to re-analyze instead of trusting outdated findings.

## Auto-provisioned workspace records

- **Contradiction records** are created from contradiction signals (keyed by
  detection method + sorted entity pair; idempotent on re-run).
- **Leads** are created for hypotheses with strength ≥ 80 (origin=analysis
  hypothesis; upserted per hypothesis on re-run).
- **Information gaps** are parsed from `Data gaps:` in hypothesis notes (upsert
  on matching title). All are reviewable workspace records.

## Limitations (Prototype)

- Weights are calibrated heuristics, not statistically validated.
- Strength index is a relative evidence score, **not** a probability.
- StyloLink is a stylistic heuristic; it never identifies an author.
- GhostTower uses per-tower busyness only (no historical baseline); busyness is
  computed within the imported evidence set.
- No Neo4j/Qdrant present; PostgreSQL + NetworkX back the graph and analysis.

## References

- NetworkX shortest path: networkx.org/documentation/stable/reference/algorithms/shortest_paths.html
- Cytoscape.js: js.cytoscape.org
- NIST SP 800-86 (forensic process context)