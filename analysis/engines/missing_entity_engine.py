"""SPYDEE Missing Entity / Shadow Broker Engine.

Detects structural holes where a mediator entity connects otherwise
disconnected clusters but shows no direct relationship, and flags
high-betweenness thin-flow entities as potential shadow brokers.
"""
import uuid
from collections import defaultdict
from typing import List

import networkx as nx
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Entity, Relationship, Signal, EntityType
from analysis.engines._shared import clamp01, score_round


async def analyze_missing_entities(db, case_id, analysis_run_id, records):
    signals: List[Signal] = []
    entities = (await db.execute(select(Entity).where(Entity.case_id == case_id))).scalars().all()
    rels = (await db.execute(select(Relationship).where(Relationship.case_id == case_id))).scalars().all()

    G = nx.DiGraph()
    for e in entities:
        G.add_node(str(e.id), label=e.label, type=e.entity_type.value, attrs=e.attributes or {})
    for r in rels:
        s, t = str(r.source_entity_id), str(r.target_entity_id)
        if s in G and t in G:
            G.add_edge(s, t, weight=r.evidence_count)

    if len(G.nodes) < 3:
        return signals

    UG = G.to_undirected()
    try:
        communities = list(nx.community.louvain_communities(UG, weight="weight", seed=42))
    except Exception:
        communities = []
    community_of = {}
    for idx, comm in enumerate(communities):
        for node in comm:
            community_of[node] = idx

    degree = dict(G.degree())
    try:
        between = nx.betweenness_centrality(G, normalized=True)
    except Exception:
        between = defaultdict(float)

    in_map = defaultdict(set)
    out_map = defaultdict(set)
    for s, t in G.edges():
        in_map[t].add(s)
        out_map[s].add(t)

    for node in G.nodes:
        if node in between and between[node] < 0.02:
            continue
        nb_in = in_map.get(node, set())
        nb_out = out_map.get(node, set())
        neighbors = nb_in | nb_out
        if len(neighbors) < 2:
            continue
        community = community_of.get(node)
        if community is None:
            continue
        comm_members = [n for n, c in community_of.items() if c == community]
        comm_size = len(comm_members)
        if comm_size < 5:
            continue

        # Structural hole: node connects otherwise-disconnected subgroups
        internal_in = 0
        internal_out = 0
        external_in = 0
        external_out = 0
        for s, t in G.edges():
            if s == node or t == node:
                continue
            s_comm = community_of.get(s)
            t_comm = community_of.get(t)
            if s_comm == community and t_comm == community:
                if G.has_edge(s, t) or G.has_edge(t, s):
                    internal_in += 1
                else:
                    external_in += 1
        mediation_count = 0
        mediated_pairs = 0
        for a in nb_in:
            for b in nb_out:
                if a == b:
                    continue
                mediated_pairs += 1
                if not (G.has_edge(a, b) or G.has_edge(b, a)):
                    mediation_count += 1

        mediation_ratio = mediation_count / max(1, mediated_pairs)

        own_degree = degree.get(node, 0)
        own_weight = 0
        for a in nb_in:
            e = G.get_edge_data(a, node, {})
            own_weight += e.get("weight", 1) if isinstance(e, dict) else 1
        for b in nb_out:
            e = G.get_edge_data(node, b, {})
            own_weight += e.get("weight", 1) if isinstance(e, dict) else 1

        # Thin-flow: low own activity but high structural role
        if own_weight <= 3 and mediated_pairs >= 3 and between[node] >= 0.03:
            score = clamp01(0.5 + mediation_ratio * 0.2 + between[node] * 3 + comm_size / 50.0)
            signals.append(Signal(
                case_id=case_id,
                analysis_run_id=analysis_run_id,
                engine_name="missing_entity",
                engine_version="v2.0",
                entity_pair={"source": node, "target": node},
                family="missing_entity",
                numeric_value=score_round(min(1.0, score)),
                quality_factor=round(clamp01(0.3 + between[node] * 20), 4),
                feature_details={
                    "flagged_missing_broker": True,
                    "mediation_ratio": round(mediation_ratio, 3),
                    "mediated_pairs": mediated_pairs,
                    "own_activity_weight": own_weight,
                    "community_size": comm_size,
                    "betweenness": round(between[node], 4),
                },
                explanation=(
                    f"Entity has high betweenness ({between[node]:.3f}) but low direct "
                    f"activity ({own_weight} events), mediating {mediation_count}/{mediated_pairs} "
                    "directed pairs across otherwise-disconnected sub-clusters — "
                    "possible shadow broker or operational relay."
                ),
            ))

        elif own_degree <= 2 and mediated_pairs >= 4 and between[node] >= 0.05:
            score = clamp01(0.6 + between[node] * 2.5 + comm_size / 40.0)
            signals.append(Signal(
                case_id=case_id,
                analysis_run_id=analysis_run_id,
                engine_name="missing_entity",
                engine_version="v2.0",
                entity_pair={"source": node, "target": node},
                family="missing_entity",
                numeric_value=score_round(min(1.0, score)),
                quality_factor=round(clamp01(0.4 + between[node] * 15), 4),
                feature_details={
                    "flagged_missing_broker": True,
                    "mediation_ratio": round(mediation_ratio, 3),
                    "mediated_pairs": mediated_pairs,
                    "own_degree": own_degree,
                    "community_size": comm_size,
                    "betweenness": round(between[node], 4),
                    "recommendation": "enrich_external_duniya_intel",
                },
                explanation=(
                    f"Thin node (degree={own_degree}) connecting distinct sub-clusters "
                    f"with {mediated_pairs} mediated pairs — likely external or under-documented "
                    "entity; requires further field data enrichment."
                ),
            ))

    return signals