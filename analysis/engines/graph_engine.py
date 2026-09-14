"""SPYDEE Graph Topology Engine.

Computes centrality (degree, betweenness, PageRank, eigenvector), community
structure (deterministic Louvain), bridge/cut-vertex detection, and emits
network-topology signals for structurally significant entity pairs.
"""
import uuid
from collections import defaultdict
from typing import List

import networkx as nx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Entity, Relationship, Signal
from analysis.engines._shared import clamp01, score_round


async def analyze_graph_structure(db, case_id, analysis_run_id, records=None):
    signals: List[Signal] = []
    entities = (await db.execute(select(Entity).where(Entity.case_id == case_id))).scalars().all()
    rels = (await db.execute(select(Relationship).where(Relationship.case_id == case_id))).scalars().all()

    G = nx.DiGraph()
    for e in entities:
        G.add_node(str(e.id), label=e.label, type=e.entity_type.value)
    for r in rels:
        s, t = str(r.source_entity_id), str(r.target_entity_id)
        if s in G and t in G:
            G.add_edge(s, t, weight=max(0.05, r.evidence_count), type=r.relationship_type)

    if len(G.nodes) < 2:
        return signals

    UG = G.to_undirected()
    for u, v in UG.edges():
        w = UG[u][v].get("weight", 0.05) if isinstance(UG[u][v], dict) else 0.05
        UG[u][v]["weight"] = w

    degree_cent = nx.degree_centrality(G)
    try:
        between_cent = nx.betweenness_centrality(G, normalized=True)
    except Exception:
        between_cent = defaultdict(float)
    try:
        pagerank = nx.pagerank(G, alpha=0.85, max_iter=200, weight="weight")
    except Exception:
        pagerank = defaultdict(lambda: 1.0 / max(1, len(G.nodes)))
    try:
        eigen = nx.eigenvector_centrality(UG, max_iter=500, weight="weight")
    except Exception:
        eigen = defaultdict(lambda: 1.0 / max(1, len(UG.nodes)))

    communities = []
    try:
        communities = nx.community.louvain_communities(UG, weight="weight", seed=42)
    except Exception:
        pass
    community_of = {}
    for idx, comm in enumerate(communities):
        for node in comm:
            community_of[node] = idx

    try:
        articulation = set(nx.articulation_points(UG) if UG.is_directed() is False else set())
    except Exception:
        articulation = set()
    try:
        bridges = set(nx.bridges(UG))
    except Exception:
        bridges = set()

    node_score = {}
    for node in G.nodes:
        node_score[node] = {
            "degree": degree_cent.get(node, 0),
            "betweenness": between_cent.get(node, 0),
            "pagerank": pagerank.get(node, 0),
            "eigenvector": eigen.get(node, 0),
            "articulation": node in articulation,
        }

    # Community cohesion signals
    community_groups = defaultdict(list)
    for node, cid in community_of.items():
        community_groups[cid].append(node)

    processed = set()
    for cid, members in community_groups.items():
        if len(members) < 2:
            continue
        pairs = []
        for i in range(len(members)):
            for j in range(i + 1, len(members)):
                a, b = members[i], members[j]
                src, tgt = sorted((a, b))
                if (src, tgt) in processed:
                    continue
                processed.add((src, tgt))
                connected = G.has_edge(a, b) or G.has_edge(b, a)
                if not connected and len(members) > 10:
                    continue
                pairs.append((a, b, connected))

        for a, b, connected in pairs:
            src, tgt = sorted((a, b))
            ca = node_score[a]
            cb = node_score[b]
            cent = (ca["degree"] + cb["degree"]) / 2
            pr = (ca["pagerank"] + cb["pagerank"]) / 2
            btw = (ca["betweenness"] + cb["betweenness"]) / 2
            eve = (ca["eigenvector"] + cb["eigenvector"]) / 2

            base = (0.4 * clamp01(cent * 2.5) + 0.25 * clamp01(pr * 5)
                    + 0.20 * clamp01(btw * 6) + 0.15 * clamp01(eve * 4))
            if connected:
                base = min(1.0, base + 0.15)
            if ca["articulation"] or cb["articulation"]:
                base = min(1.0, base + 0.10)

            if base < 0.15 and (not ca["articulation"] and not cb["articulation"]):
                continue

            bridge_flag = (a, b) in bridges or (b, a) in bridges
            signal = Signal(
                case_id=case_id,
                analysis_run_id=analysis_run_id,
                engine_name="graph_structure",
                engine_version="v2.1",
                entity_pair={"source": src, "target": tgt},
                family="network_topology",
                numeric_value=score_round(base),
                quality_factor=round(clamp01(0.5 + 0.1 * (cent * 3 + pr * 2)), 4),
                feature_details={
                    "degree_centrality_src": round(ca["degree"], 4),
                    "degree_centrality_tgt": round(cb["degree"], 4),
                    "betweenness_src": round(ca["betweenness"], 4),
                    "betweenness_tgt": round(cb["betweenness"], 4),
                    "pagerank_src": round(ca["pagerank"], 4),
                    "pagerank_tgt": round(cb["pagerank"], 4),
                    "eigenvector_src": round(ca["eigenvector"], 4),
                    "eigenvector_tgt": round(cb["eigenvector"], 4),
                    "same_community": community_of.get(a) == community_of.get(b),
                    "community_id": community_of.get(a),
                    "articulation_point": ca["articulation"] or cb["articulation"],
                    "bridge_edge": bridge_flag,
                },
                explanation=(
                    f"Entities share community C{community_of.get(a)} with "
                    f"combined centrality {cent:.3f}; structural signal "
                    f"'strong' if connector/bridge present."
                ),
            )
            signals.append(signal)

    # K-hop brokerage: articulation points bridging otherwise-disconnected clusters
    if articulation:
        base_nodes = [n for n in articulation]
        for i in range(len(base_nodes)):
            for j in range(i + 1, len(base_nodes)):
                a, b = sorted((base_nodes[i], base_nodes[j]))
                if (a, b) in processed:
                    continue
                processed.add((a, b))
                if not nx.has_path(G, a, b):
                    continue
                try:
                    hops = nx.shortest_path_length(G, a, b)
                except nx.NetworkXError:
                    continue
                if hops not in (2, 3):
                    continue
                joint = (node_score[a]["pagerank"] + node_score[b]["pagerank"]) / 2
                score = clamp01(0.45 + hops * 0.1 + joint * 2)
                signals.append(Signal(
                    case_id=case_id,
                    analysis_run_id=analysis_run_id,
                    engine_name="graph_structure",
                    engine_version="v2.1",
                    entity_pair={"source": a, "target": b},
                    family="network_topology",
                    numeric_value=score_round(score),
                    quality_factor=0.6,
                    feature_details={
                        "hop_distance": hops,
                        "both_articulation_points": True,
                        "pagerank_combined": round(joint, 4),
                    },
                    explanation=(
                        f"Both entities are cut-vertices ({hops}-hop apart), "
                        "structurally positioned to broker otherwise "
                        "disconnected clusters."
                    ),
                ))

    return signals