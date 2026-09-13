import uuid
import networkx as nx
from collections import defaultdict
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.models import (
    Entity, Relationship, EntityIdentifierLink, Identifier, Signal, SourceRecord
)


async def analyze_graph_structure(
    db: AsyncSession,
    case_id: uuid.UUID,
    analysis_run_id: uuid.UUID,
    records: List[SourceRecord],
) -> List[Signal]:
    signals = []

    entities_result = await db.execute(select(Entity).where(Entity.case_id == case_id))
    entities = entities_result.scalars().all()

    rels_result = await db.execute(select(Relationship).where(Relationship.case_id == case_id))
    rels = rels_result.scalars().all()

    G = nx.DiGraph()
    for e in entities:
        G.add_node(str(e.id), label=e.label, type=e.entity_type.value)
    for r in rels:
        G.add_edge(str(r.source_entity_id), str(r.target_entity_id), type=r.relationship_type)

    if len(G.nodes) < 2:
        return signals

    degree_cent = nx.degree_centrality(G)
    between_cent = nx.betweenness_centrality(G, normalized=True)

    entity_pairs = set()
    for node in G.nodes:
        for neighbor in G.successors(node):
            entity_pairs.add((node, neighbor))
        for neighbor in G.predecessors(node):
            entity_pairs.add((neighbor, node))

    for src, tgt in entity_pairs:
        if src == tgt:
            continue

        path_signals = []

        if G.has_edge(src, tgt) or G.has_edge(tgt, src):
            centrality_score = (degree_cent.get(src, 0) + degree_cent.get(tgt, 0)) / 2
            between_score = (between_cent.get(src, 0) + between_cent.get(tgt, 0)) / 2

            s_f = 0.3 * min(centrality_score * 2, 1.0) + 0.7 * min(between_score * 5, 1.0)

            signals.append(Signal(
                case_id=case_id,
                analysis_run_id=analysis_run_id,
                engine_name="graph_structure",
                engine_version="v1",
                entity_pair={"source": src, "target": tgt},
                family="spatial_temporal",
                numeric_value=round(s_f, 4),
                quality_factor=0.6,
                feature_details={
                    "degree_centrality_src": round(degree_cent.get(src, 0), 4),
                    "degree_centrality_tgt": round(degree_cent.get(tgt, 0), 4),
                    "betweenness_src": round(between_cent.get(src, 0), 4),
                    "betweenness_tgt": round(between_cent.get(tgt, 0), 4),
                },
                explanation=f"Graph structural proximity between {src[:8]} and {tgt[:8]}.",
            ))

    return signals
