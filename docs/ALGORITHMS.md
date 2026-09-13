# SPYDEE Algorithms

## Signal Families and Weights

| Family           | Weight | Engine                    |
|------------------|--------|---------------------------|
| Communication    | 0.20   | communication_engine      |
| Device/SIM       | 0.25   | (future: device_engine)   |
| Spatial/Temporal | 0.15   | graph_engine              |
| Writing Style    | 0.15   | (future: stylo_engine)    |
| Financial        | 0.15   | (future: financial_engine)|
| Infrastructure   | 0.10   | (future: infra_engine)    |

## Strength Index Computation

For each entity-pair hypothesis:

1. Collect signals grouped by family
2. For each family, select the best signal: `s_f = numeric_value`, `q_f = quality_factor`
3. Compute weighted sum: `Σ(w_f × s_f × q_f)`
4. Normalize by total applicable weight
5. Scale to [0, 100]: `strength = round(100 × clamp(normalized, 0, 1))`

## Communication Engine

- Counts pairwise calls/messages between entities
- Normalizes phone identifiers (strips formatting, handles +91 prefix)
- Score: `0.6 × min(count/20, 1) + 0.4 × min(total_duration/3600, 1)`
- Quality: `min(1.0, 0.5 + count × 0.05)`
- Minimum threshold: 2 communications to generate a signal

## Graph Structure Engine

- Builds NetworkX directed graph from entities and relationships
- Computes degree centrality and betweenness centrality
- Score: `0.3 × min(centrality×2, 1) + 0.7 × min(betweenness×5, 1)`

## Hypothesis Generation

- Groups signals by entity pair
- Counts independent families present
- Generates statement with strength band (Weak < 40, Moderate 40-69, Strong 70+)
- Identifies missing signal families
- Proposes next-best investigation action

## Missing-Entity Analysis

- Detects gaps: unexplained paths, identifier transitions without records, missing connections
- Reports as unresolved connector hypotheses
- Never invents names or asserts identities

## Limitations (Prototype)

- Only communication and graph engines are implemented
- StyloLink, GhostTower, Device/SIM Continuity are planned
- Weights are uncalibrated prototype defaults
- No statistical significance testing on signals
- Strength index is relative, not absolute probability

## References

- NetworkX shortest path: networkx.org/documentation/stable/reference/algorithms/shortest_paths.html
- Cytoscape.js: js.cytoscape.org
- NIST SP 800-86 (forensic process context)
