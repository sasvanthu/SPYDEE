import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.models import (
    Entity, Identifier, Relationship, Hypothesis, Signal,
    SourceRecord, Event, EntityType
)


async def answer_copilot_query(
    db: AsyncSession,
    case_id: uuid.UUID,
    query: str,
) -> dict:
    q = query.lower().strip()

    entities_found = []
    result = await db.execute(
        select(Entity).where(Entity.case_id == case_id)
    )
    all_entities = result.scalars().all()

    for entity in all_entities:
        if entity.label.lower() in q or any(
            word in q for word in entity.label.lower().split()
        ):
            entities_found.append(entity)

    identifiers_found = []
    id_result = await db.execute(
        select(Identifier).where(Identifier.case_id == case_id)
    )
    all_ids = id_result.scalars().all()
    for ident in all_ids:
        if ident.id_value.lower() in q or ident.normalized_value in q:
            identifiers_found.append(ident)

    if "contradict" in q or "conflict" in q:
        hyp_result = await db.execute(
            select(Hypothesis).where(
                Hypothesis.case_id == case_id,
                Hypothesis.contradicting_records.isnot(None)
            )
        )
        hyps = hyps = [h for h in (hyp_result.scalars().all()) if h.contradicting_records]
        if hyps:
            answer_parts = []
            citations = []
            for h in hyps[:3]:
                answer_parts.append(
                    f"Hypothesis: {h.statement}\n"
                    f"Contradicting records: {len(h.contradicting_records or [])}\n"
                    f"Action: {h.proposed_action or 'Review evidence manually'}"
                )
                citations.append({
                    "type": "hypothesis",
                    "id": str(h.id),
                    "statement": h.statement[:200],
                })
            return {
                "answer": "\n\n".join(answer_parts),
                "citations": citations,
                "follow_ups": ["Show contradicting records in detail", "Export this finding"],
                "links": [{"type": "hypothesis", "id": str(hyps[0].id)}] if hyps else [],
            }
        else:
            return {
                "answer": "No hypotheses with contradicting records found in this case yet.",
                "citations": [],
                "follow_ups": ["Run analysis to generate hypotheses"],
                "links": [],
            }

    if "path" in q or "connect" in q:
        if len(entities_found) >= 2:
            from app.services.graph_service import find_shortest_path
            path_result = await find_shortest_path(
                db, case_id, entities_found[0].id, entities_found[1].id
            )
            if path_result:
                path_desc = " → ".join([
                    e.label for eid in path_result["path"]
                    for e in all_entities if str(e.id) == eid
                ])
                return {
                    "answer": f"Path found ({path_result['hops']} hops): {path_desc}",
                    "citations": [{"type": "path", "hops": path_result["hops"]}],
                    "follow_ups": ["Expand graph view", "Show timeline for this path"],
                    "links": [{"type": "graph", "path": path_result["path"]}],
                }
            else:
                return {
                    "answer": f"No path found between {entities_found[0].label} and {entities_found[1].label} in the current graph.",
                    "citations": [],
                    "follow_ups": ["Import more evidence", "Lower hop limit"],
                    "links": [],
                }
        else:
            return {
                "answer": "Please specify two entity names to find a path between them. Example: 'Show path between Phone-01 and Device-03'",
                "citations": [],
                "follow_ups": ["List all entities"],
                "links": [],
            }

    if "explain" in q and entities_found:
        entity = entities_found[0]
        rel_result = await db.execute(
            select(Relationship).where(
                Relationship.case_id == case_id,
                (Relationship.source_entity_id == entity.id) |
                (Relationship.target_entity_id == entity.id)
            )
        )
        rels = rel_result.scalars().all()

        sig_result = await db.execute(
            select(Signal).where(
                Signal.case_id == case_id,
                Signal.entity_pair["source"].as_string() == str(entity.id)
            )
        )
        sigs = sig_result.scalars().all()

        answer = f"Entity: {entity.label} ({entity.entity_type.value})\n"
        answer += f"Review state: {entity.review_state.value}\n"
        answer += f"Relationships: {len(rels)}\n"
        answer += f"Signals: {len(sigs)}\n"

        if rels:
            answer += "\nKey relationships:\n"
            for r in rels[:5]:
                answer += f"  - {r.relationship_type} ({r.classification}) evidence_count={r.evidence_count}\n"

        return {
            "answer": answer,
            "citations": [{"type": "entity", "id": str(entity.id), "label": entity.label}],
            "follow_ups": [f"Show timeline for {entity.label}", "Open graph view"],
            "links": [{"type": "entity", "id": str(entity.id)}],
        }

    if entities_found:
        entity = entities_found[0]
        return {
            "answer": f"Found entity: {entity.label} ({entity.entity_type.value}, state: {entity.review_state.value}). What would you like to know about it?",
            "citations": [{"type": "entity", "id": str(entity.id)}],
            "follow_ups": [f"Explain {entity.label}", "Show graph path", "Show timeline"],
            "links": [{"type": "entity", "id": str(entity.id)}],
        }

    if "missing" in q or "gap" in q:
        hyp_result = await db.execute(
            select(Hypothesis).where(
                Hypothesis.case_id == case_id,
                Hypothesis.missing_information.isnot(None)
            )
        )
        hyps = [h for h in (hyp_result.scalars().all()) if h.missing_information]
        if hyps:
            answer_parts = []
            citations = []
            for h in hyps[:3]:
                answer_parts.append(
                    f"Gap in: {h.statement}\n"
                    f"Missing: {', '.join(h.missing_information or [])}\n"
                    f"Suggested: {h.proposed_action or 'Import more evidence'}"
                )
                citations.append({"type": "hypothesis", "id": str(h.id)})
            return {
                "answer": "\n\n".join(answer_parts),
                "citations": citations,
                "follow_ups": ["Import relevant evidence", "Review this hypothesis"],
                "links": [],
            }
        return {
            "answer": "No identified information gaps yet. Run analysis to detect missing connections.",
            "citations": [],
            "follow_ups": ["Run analysis"],
            "links": [],
        }

    entity_count = len(all_entities)
    return {
        "answer": (
            f"This case has {entity_count} entities. "
            "I can help you: find an entity, explain a hypothesis, show paths between entities, "
            "list observations in a time interval, or identify missing evidence. "
            "Try asking: 'Show path between Phone-01 and Device-03' or 'What contradicts this lead?'"
        ),
        "citations": [],
        "follow_ups": [
            "List all entities",
            "Show all hypotheses",
            "Open graph view",
        ],
        "links": [],
    }
