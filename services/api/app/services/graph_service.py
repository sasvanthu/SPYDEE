import uuid
import networkx as nx
from typing import Optional, List
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.models import (
    Entity, Relationship, Event, RelationshipEvidence,
    SourceRecord, EntityType, RelationshipDirection
)


async def build_case_graph(
    db: AsyncSession,
    case_id: uuid.UUID,
    entity_types: List[str] = None,
    relationship_types: List[str] = None,
    date_from: datetime = None,
    date_to: datetime = None,
    include_inferred: bool = True,
    max_nodes: int = 500,
    max_edges: int = 2000,
) -> dict:
    entity_query = select(Entity).where(Entity.case_id == case_id)
    if entity_types:
        entity_query = entity_query.where(Entity.entity_type.in_(entity_types))

    result = await db.execute(entity_query)
    entities = result.scalars().all()

    rel_query = select(Relationship).where(Relationship.case_id == case_id)
    if relationship_types:
        rel_query = rel_query.where(Relationship.relationship_type.in_(relationship_types))
    if date_from:
        rel_query = rel_query.where(Relationship.valid_from >= date_from)
    if date_to:
        rel_query = rel_query.where(Relationship.valid_to <= date_to)
    if not include_inferred:
        rel_query = rel_query.where(Relationship.classification == "observed")

    rel_result = await db.execute(rel_query)
    relationships = rel_result.scalars().all()

    # Aggregate duplicate rows for the same (source, target) pair: multiple
    # relationship rows can come from distinct evidence records. Sum their
    # evidence counts instead of letting one row overwrite another.
    aggregated: dict[tuple[str, str], dict] = {}
    for r in relationships:
        src = str(r.source_entity_id)
        tgt = str(r.target_entity_id)
        key = (src, tgt)
        entry = aggregated.get(key)
        if entry is None:
            aggregated[key] = {
                "relationship_type": r.relationship_type,
                "classification": r.classification,
                "label": r.relationship_type.replace("_", " ").title(),
                "valid_from": r.valid_from,
                "valid_to": r.valid_to,
                "review_state": r.review_state.value,
                "evidence_count": (r.evidence_count or 1),
                "ids": [str(r.id)],
            }
        else:
            entry["evidence_count"] += (r.evidence_count or 1)
            entry["ids"].append(str(r.id))
            if r.valid_from and (entry["valid_from"] is None or r.valid_from < entry["valid_from"]):
                entry["valid_from"] = r.valid_from
            if r.valid_to and (entry["valid_to"] is None or r.valid_to > entry["valid_to"]):
                entry["valid_to"] = r.valid_to
            if r.classification == "inferred":
                entry["classification"] = "inferred"

    G = nx.DiGraph()
    entity_map = {}
    for e in entities:
        G.add_node(str(e.id), label=e.label, entity_type=e.entity_type.value, review_state=e.review_state.value)
        entity_map[str(e.id)] = e

    for (src, tgt), entry in aggregated.items():
        if src in G.nodes and tgt in G.nodes:
            G.add_edge(
                src, tgt,
                id=entry["ids"][0],
                relationship_type=entry["relationship_type"],
                classification=entry["classification"],
                label=entry["label"],
                valid_from=entry["valid_from"].isoformat() if entry["valid_from"] else None,
                valid_to=entry["valid_to"].isoformat() if entry["valid_to"] else None,
                review_state=entry["review_state"],
                evidence_count=entry["evidence_count"],
            )

    truncated = False
    total_nodes = len(G.nodes)
    total_edges = len(G.edges)

    if len(G.nodes) > max_nodes:
        if G.nodes:
            degree_sorted = sorted(G.nodes, key=lambda n: G.degree(n), reverse=True)
            keep = set(degree_sorted[:max_nodes])
            G = G.subgraph(keep).copy()
            truncated = True

    if len(G.edges) > max_edges:
        edges_sorted = sorted(G.edges(data=True), key=lambda e: e[2].get("evidence_count", 1), reverse=True)
        keep_edges = edges_sorted[:max_edges]
        new_g = nx.DiGraph()
        for n, d in G.nodes(data=True):
            new_g.add_node(n, **d)
        for u, v, d in keep_edges:
            new_g.add_edge(u, v, **d)
        G = new_g
        truncated = True

    nodes = []
    for nid, data in G.nodes(data=True):
        nodes.append({
            "id": nid,
            "label": data.get("label", nid),
            "entity_type": data.get("entity_type", "person"),
            "review_state": data.get("review_state", "new"),
            "properties": {"degree": G.degree(nid)},
        })

    edges = []
    for u, v, data in G.edges(data=True):
        edges.append({
            "id": data.get("id", f"{u}-{v}"),
            "source": u,
            "target": v,
            "relationship_type": data.get("relationship_type", "unknown"),
            "classification": data.get("classification", "observed"),
            "label": data.get("label", ""),
            "properties": {
                "valid_from": data.get("valid_from"),
                "valid_to": data.get("valid_to"),
                "evidence_count": data.get("evidence_count", 1),
                "review_state": data.get("review_state", "new"),
            },
        })

    return {
        "nodes": nodes,
        "edges": edges,
        "truncated": truncated,
        "total_nodes": total_nodes,
        "total_edges": total_edges,
    }


async def find_shortest_path(
    db: AsyncSession,
    case_id: uuid.UUID,
    source_id: uuid.UUID,
    target_id: uuid.UUID,
    max_hops: int = 6,
) -> Optional[dict]:
    graph_data = await build_case_graph(db, case_id, max_nodes=2000, max_edges=5000)
    G = nx.DiGraph()
    for n in graph_data["nodes"]:
        G.add_node(n["id"], **n)
    for e in graph_data["edges"]:
        G.add_edge(e["source"], e["target"], **e)

    src, tgt = str(source_id), str(target_id)
    if src not in G or tgt not in G:
        return None

    try:
        path = nx.shortest_path(G, src, tgt)
        if len(path) - 1 > max_hops:
            return None
        path_edges = []
        for i in range(len(path) - 1):
            if G.has_edge(path[i], path[i + 1]):
                edata = G.edges[path[i], path[i + 1]]
                path_edges.append({
                    "source": path[i],
                    "target": path[i + 1],
                    "relationship_type": edata.get("relationship_type", ""),
                    "label": edata.get("label", ""),
                })
        return {"path": path, "edges": path_edges, "hops": len(path) - 1}
    except nx.NetworkXNoPath:
        return None


async def get_neighbourhood(
    db: AsyncSession,
    case_id: uuid.UUID,
    entity_id: uuid.UUID,
    hops: int = 1,
) -> dict:
    graph_data = await build_case_graph(db, case_id, max_nodes=5000, max_edges=10000)
    G = nx.DiGraph()
    for n in graph_data["nodes"]:
        G.add_node(n["id"], **n)
    for e in graph_data["edges"]:
        G.add_edge(e["source"], e["target"], **e)

    target = str(entity_id)
    if target not in G:
        return {"nodes": [], "edges": []}

    neighbors = set()
    current = {target}
    for _ in range(hops):
        next_level = set()
        for node in current:
            next_level.update(G.successors(node))
            next_level.update(G.predecessors(node))
        neighbors.update(next_level)
        current = next_level

    neighbors.add(target)
    subgraph = G.subgraph(neighbors)

    nodes = [{"id": n, **d} for n, d in subgraph.nodes(data=True)]
    edges = [{"source": u, "target": v, **d} for u, v, d in subgraph.edges(data=True)]

    return {"nodes": nodes, "edges": edges}
