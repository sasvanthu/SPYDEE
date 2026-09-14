"""SPYDEE Agentic Copilot.

Deterministic tool-planning assistant with retrieval over entities,
relationships, hypotheses, timeline events and document chunks. Safe read-only
SQL tool with strict table allowlisting and mandatory case_id scoping.

Tool results feed a synthesis layer that always returns the application
answer/citations/follow_ups/links envelope.
"""
import re
import uuid
import json
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from app.config import get_settings
from app.models.models import (
    Entity, Identifier, EntityIdentifierLink, Relationship, Hypothesis, Signal,
    SourceRecord, Event, DocumentChunk, EntityType, EventParticipant,
    HypothesisRecommendation,
)

FORBIDDEN_SQL = re.compile(r"\b(insert|update|delete|drop|alter|truncate|grant|revoke|create)\b", re.I)
ALLOWED_TABLES = (
    "entities", "identifiers", "events", "relationships", "signals",
    "source_records", "hypotheses",
)

_SQL_ENGINE_CACHE = {}


def _sync_engine():
    settings = get_settings()
    url = settings.DATABASE_URL_SYNC
    if url not in _SQL_ENGINE_CACHE:
        from sqlalchemy import create_engine
        _SQL_ENGINE_CACHE[url] = create_engine(url, pool_pre_ping=True)
    return _SQL_ENGINE_CACHE[url]


def _describe_tools() -> str:
    return "\n".join([
        "list_entities: list all entities in the case",
        "entity_dossier(entity_id): relationships + signals + timeline for one entity",
        "shortest_path(src_name, dst_name): path between two identified entities",
        "timeline(entity_id): chronological events involving an entity",
        "contradictions: hypotheses flagged with contradicting evidence (impossible travel, conflicts)",
        "info_gaps: hypotheses missing data families with recommended actions",
        "rag_search(term): retrieve text chunks from uploaded documents",
        "sql_query(sql): read-only SQL restricted to the case tables; MUST include case_id = '<uuid>'",
    ])


def _extract_entities(q: str, all_entities) -> list:
    ql = q.lower()
    hits = []
    for e in all_entities:
        label = str(e.label or "").lower()
        if label and (label in ql or any(word in ql for word in label.split())):
            hits.append(e)
    return hits[:4]


async def _find_entities_by_identifier(db, case_id, q: str) -> list:
    ql = q.lower()
    id_rows = (await db.execute(
        select(Identifier).where(Identifier.case_id == case_id)
    )).scalars().all()
    found = []
    for ident in id_rows:
        if str(ident.normalized_value or "").lower() in ql:
            found.append((ident, ident.id_value))
    return found[:4]


async def _tool_entity_dossier(db, case_id, entity) -> dict:
    rels = (await db.execute(
        select(Relationship).where(
            Relationship.case_id == case_id,
            (Relationship.source_entity_id == entity.id) |
            (Relationship.target_entity_id == entity.id),
        )
    )).scalars().all()

    sig_rows = (await db.execute(
        select(Signal).where(Signal.case_id == case_id)
    )).scalars().all()
    sigs = [s for s in sig_rows if s.entity_pair and (
        str(s.entity_pair.get("source")) == str(entity.id) or
        str(s.entity_pair.get("target")) == str(entity.id)
    )]

    event_ids = (await db.execute(
        select(EventParticipant.event_id).where(EventParticipant.entity_id == entity.id)
    )).scalars().all()

    identifiers = (await db.execute(
        select(Identifier).where(Identifier.case_id == case_id)
    )).scalars().all()

    related_ids = []
    for r in rels:
        related_ids.append(str(r.source_entity_id))
        related_ids.append(str(r.target_entity_id))
    related_ids = list({x for x in related_ids if x != str(entity.id)})

    id_label = {str(e.id): e.label for e in (await db.execute(
        select(Entity).where(Entity.case_id == case_id)
    )).scalars().all()}

    linked = (await db.execute(
        select(Identifier.id_value).join(
            EntityIdentifierLink, EntityIdentifierLink.identifier_id == Identifier.id
        ).where(
            EntityIdentifierLink.entity_id == entity.id,
            Identifier.case_id == case_id,
        )
    )).scalars().all()

    return {
        "entity": {"id": str(entity.id), "label": entity.label, "type": entity.entity_type.value},
        "relationships": [{
            "type": r.relationship_type,
            "other": id_label.get(str(r.source_entity_id if str(r.target_entity_id) == str(entity.id) else r.target_entity_id), ""),
            "evidence_count": r.evidence_count,
        } for r in rels[:12]],
        "signal_families": sorted({s.family for s in sigs}),
        "num_signals": len(sigs),
        "top_signals": sorted(set(
            (s.family, s.numeric_value) for s in sigs
        ), key=lambda x: x[1], reverse=True)[:6],
        "num_events": len(event_ids),
        "identifiers": list(linked),
        "related_entity_ids": related_ids[:10],
    }


async def _tool_path(db, case_id, a, b) -> dict:
    from app.services.graph_service import find_shortest_path
    path_result = await find_shortest_path(db, case_id, a, b)
    return path_result or {"hops": None, "path": []}


async def _tool_timeline(db, case_id, entity) -> list:
    event_ids = (await db.execute(
        select(EventParticipant.event_id).where(EventParticipant.entity_id == entity.id)
    )).scalars().all()
    if not event_ids:
        return []
    events = (await db.execute(
        select(Event).where(Event.id.in_(event_ids)).order_by(Event.start_time)
    )).scalars().all()
    return [{
        "event_type": e.event_type,
        "start_time": e.start_time.isoformat() if e.start_time else None,
        "details": (e.details or {}) if isinstance(e.details, dict) else {},
    } for e in events[:15]]


async def _tool_contradictions(db, case_id) -> list:
    sigs = (await db.execute(
        select(Signal).where(Signal.case_id == case_id, Signal.contradiction == True)  # noqa: E712
    )).scalars().all()
    return [{
        "id": str(s.id),
        "family": s.family,
        "reason": s.contradiction_reason if hasattr(s, "contradiction_reason") else s.explanation,
        "numeric_value": s.numeric_value,
    } for s in sigs]


async def _tool_info_gaps(db, case_id) -> list:
    hyps = (await db.execute(
        select(Hypothesis).where(Hypothesis.case_id == case_id)
    )).scalars().all()
    rows = []
    for h in hyps:
        is_gap = "data gap" in (h.notes or "").lower()
        rec = (await db.execute(
            select(HypothesisRecommendation).where(
                HypothesisRecommendation.hypothesis_id == h.id,
                HypothesisRecommendation.type == "book_external_int_desk",
            )
        )).scalars().first()
        if not (is_gap or rec):
            continue
        rows.append({
            "hypothesis_id": str(h.id),
            "type": h.hypothesis_type,
            "numeric_value": h.numeric_value,
            "notes": (h.notes or "")[:200],
            "recommendation": rec.rationale if rec else None,
        })
    return rows


async def _tool_rag(db, case_id, term: str) -> list:
    ql = term.lower().strip()
    chunks = (await db.execute(
        select(DocumentChunk).where(DocumentChunk.case_id == case_id)
    )).scalars().all()
    scored = []
    for c in chunks:
        text_l = (c.text_content or "").lower()
        score = 0
        for token in ql.split()[:8]:
            if token in text_l:
                score += 1
        if score:
            scored.append((score, c))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [{
        "id": str(c.id),
        "page": c.page_number,
        "text": (c.text_content or "")[:400],
    } for _, c in scored[:5]]


async def _tool_sql(db, case_id, sql_query: str) -> dict:
    sql = sql_query.strip()
    if not sql.lower().startswith("select"):
        return {"error": "Only SELECT queries are permitted."}
    if FORBIDDEN_SQL.search(sql):
        return {"error": "Query contains non-read-only operations."}
    if ";" in sql.rstrip(";"):
        return {"error": "Only a single statement is allowed."}
    lowered = sql.lower()
    tables = [f" {t} " for t in ALLOWED_TABLES if f" {t} " in f" {lowered} "]
    if not tables:
        return {"error": f"Query must reference one of: {', '.join(ALLOWED_TABLES)}."}
    if str(case_id) not in sql:
        return {"error": "Query MUST contain the literal case_id = '<case-uuid>' to enforce isolation."}

    engine = _sync_engine()
    try:
        with engine.connect() as conn:
            result = conn.execute(text(sql))
            cols = list(result.keys())
            rows = [dict(zip(cols, r)) for r in result.fetchmany(25)]
        return {"columns": cols, "rows": rows}
    except Exception as exc:
        return {"error": f"SQL execution failed: {exc}"}


async def _tool_run_analysis(db, case_id) -> dict:
    if get_settings().DEMO_MODE:
        return {"demand": True, "message": "Analysis can be triggered from the Analysis page."}
    return {"demand": True}


TOOL_REGISTRY = {
    "list_entities": None,
    "entity_dossier": _tool_entity_dossier,
    "shortest_path": _tool_path,
    "timeline": _tool_timeline,
    "contradictions": _tool_contradictions,
    "info_gaps": _tool_info_gaps,
    "rag_search": _tool_rag,
    "sql_query": _tool_sql,
    "run_analysis": _tool_run_analysis,
    "entity_frequency": None,
}


async def _exec_tool(name, db, case_id, args):
    fn = TOOL_REGISTRY.get(name)
    if name == "list_entities":
        rows = (await db.execute(select(Entity).where(Entity.case_id == case_id))).scalars().all()
        return [{"id": str(e.id), "label": e.label, "type": e.entity_type.value} for e in rows][:100]
    if name == "run_analysis":
        rows = (await db.execute(select(SourceRecord).where(SourceRecord.case_id == case_id))).scalars().all()
        return {"records": len(rows), "demand": True}
    if name == "entity_frequency":
        from sqlalchemy import func as sa_func
        rows = (await db.execute(select(Entity).where(Entity.case_id == case_id))).scalars().all()
        id_label = {str(e.id): e.label for e in rows}
        counts = {}
        for e in rows:
            ep_ids = (await db.execute(
                select(EventParticipant.event_id).where(EventParticipant.entity_id == e.id)
            )).scalars().all()
            if ep_ids:
                ev_count = (await db.execute(
                    select(sa_func.count(Event.id)).where(Event.id.in_(ep_ids), Event.case_id == case_id)
                )).scalar_one()
                if ev_count:
                    counts[str(e.id)] = int(ev_count)
        ranked = sorted(counts.items(), key=lambda x: x[1], reverse=True)
        return [{"entity_id": eid, "label": id_label.get(eid, eid), "event_count": c} for eid, c in ranked[:15]]
    if fn is None:
        return {"error": f"Unknown tool {name}"}
    return await fn(db, case_id, *args)


async def _maybe_llm_polish(question: str, draft: str, citations: list) -> str:
    settings = get_settings()
    if settings.LLM_PROVIDER.lower() != "ollama":
        return draft
    try:
        import httpx
        payload = {
            "model": settings.OLLAMA_MODEL,
            "stream": False,
            "prompt": (
                "You are SPYDEE's investigative copilot. Rewrite the following "
                "evidence-derived answer for an analyst, keep it factual, cite "
                "findings, do not add ungrounded claims.\n\n"
                f"Question: {question}\nDraft: {draft}"
            ),
        }
        resp = httpx.post(
            f"{settings.OLLAMA_BASE_URL}/api/generate", json=payload, timeout=30
        )
        resp.raise_for_status()
        return resp.json().get("response", draft).strip()
    except Exception:
        return draft


async def answer_copilot_query(
    db: AsyncSession,
    case_id: uuid.UUID,
    query: str,
) -> dict:
    q = query.lower().strip()
    all_entities = (await db.execute(
        select(Entity).where(Entity.case_id == case_id)
    )).scalars().all()
    entity_hits = _extract_entities(q, all_entities)
    id_hits = await _find_entities_by_identifier(db, case_id, q)

    citations = []
    links = []
    follow_ups = []
    draft = ""

    # ── Intent planning (deterministic) ────────────────────────────────────
    if "sql" in q or "query the database" in q:
        sql_match = re.search(r"(select\s.+)$", q, flags=re.I | re.S)
        tool_sql = sql_match.group(1) if sql_match else q
        result = await _exec_tool("sql_query", db, case_id, (tool_sql,))
        draft = (
            f"Read-only SQL returned {len(result.get('rows', []))} rows across "
            f"{len(result.get('columns', []))} columns."
            if "rows" in result
            else f"SQL tool: {result.get('error', 'unknown error')}"
        )
        citations.append({"type": "sql", "tables": ALLOWED_TABLES})

    elif "document" in q or "report mentions" in q or "chunk" in q or "rag" in q:
        term = re.sub(r"\b(what do|documents?|mention|chunk|rag|about|search|find)\b", "", q).strip() or q
        chunks = await _tool_rag(db, case_id, term)
        if chunks:
            draft = "Relevant document excerpts:\n" + "\n".join(
                f"- [{c['page']}] {c['text']}" for c in chunks
            )
            citations.extend({"type": "document_chunk", "id": c["id"], "page": c["page"]} for c in chunks)
        else:
            draft = "No document chunks matched that topic in this case."
        follow_ups = ["List uploaded documents", "Search another term"]

    elif "contradict" in q or "conflict" in q or "impossible" in q:
        contras = await _tool_contradictions(db, case_id)
        if contras:
            draft = "Contradicting/conflicting evidence:\n" + "\n".join(
                f"- [{c['family']}] {c['reason']}" for c in contras[:6]
            )
            citations.extend({"type": "signal", "id": c["id"]} for c in contras[:6])
            links = [{"type": "signal", "id": c["id"]} for c in contras[:3]]
        else:
            draft = "No contradicting evidence detected in the current analysis run."
        follow_ups = ["Show info gaps", "Run analysis again with more data"]

    elif "gap" in q or "missing" in q or "insufficient" in q:
        gaps = await _tool_info_gaps(db, case_id)
        if gaps:
            draft = "Information gaps and recommended actions:\n" + "\n".join(
                f"- [{g['type']} {g['numeric_value']}/100] {g['notes']} -> {g['recommendation'] or 'n/a'}"
                for g in gaps[:6]
            )
            citations.extend({"type": "hypothesis", "id": g["hypothesis_id"]} for g in gaps[:6])
        else:
            draft = "No info-gap hypotheses recorded yet."
        follow_ups = ["List all hypotheses", "Show contradictions"]

    elif "path" in q or ("connect" in q and len(entity_hits) >= 2):
        if len(entity_hits) >= 2:
            a, b = entity_hits[0].id, entity_hits[1].id
            result = await _tool_path(db, case_id, a, b)
            if result and result.get("path"):
                id_label = {str(e.id): e.label for e in all_entities}
                path_desc = " → ".join(id_label.get(n, n) for n in result["path"])
                draft = f"Path ({result['hops']} hops): {path_desc}"
                links = [{"type": "graph", "path": result["path"]}]
                citations.append({"type": "path", "hops": result["hops"]})
            else:
                draft = f"No path found between {entity_hits[0].label} and {entity_hits[1].label}."
        else:
            draft = "Please name two entities to trace a path (e.g. between Phone A and Person X)."
        follow_ups = ["Show graph view", "Explain each hop"]

    elif len(entity_hits) >= 2 and ("compare" in q or "relation" in q or "link" in q or "why" in q):
        a, b = entity_hits[0], entity_hits[1]
        result = await _tool_entity_dossier(db, case_id, a)
        result_b = await _tool_entity_dossier(db, case_id, b)
        shared_rels = [r for r in result['relationships'] if r['other'] == b.label]
        shared_rels_rev = [r for r in result_b['relationships'] if r['other'] == a.label]
        all_shared = shared_rels + shared_rels_rev
        shared_text = ""
        if all_shared:
            shared_text = "\n\nWhy linked:\n" + "\n".join(
                f"- {r['type']} between them ({r['evidence_count']} evidence items)"
                for r in all_shared
            )
        draft = (
            f"Comparison: {a.label} vs {b.label}\n"
            f"{a.label}: {result['num_signals']} signals, {result['num_events']} events, "
            f"{len(result['relationships'])} relationships.\n"
            f"{b.label}: {result_b['num_signals']} signals, {result_b['num_events']} events, "
            f"{len(result_b['relationships'])} relationships."
            f"{shared_text}"
        )
        citations.extend([
            {"type": "entity", "id": str(a.id), "label": a.label},
            {"type": "entity", "id": str(b.id), "label": b.label},
        ])
        follow_ups = [f"Show timeline for {a.label}", f"Show timeline for {b.label}", "Show graph around both"]

    elif entity_hits:
        entity = entity_hits[0]
        if any(k in q for k in ("explain", "dossier", "who is", "about")):
            dossier = await _tool_entity_dossier(db, case_id, entity)
            draft = (
                f"Dossier for {entity.label} ({entity.entity_type.value}):\n"
                f"- {dossier['num_signals']} intelligence signals; families: {', '.join(dossier['signal_families']) or 'none'}\n"
                f"- {len(dossier['relationships'])} relationships (evidence_count top: "
                + ", ".join(f"{r['type']}->{r['other']}({r['evidence_count']})" for r in dossier['relationships'][:5])
                + ")\n"
                f"- {dossier['num_events']} timeline events\n"
                f"- Identifiers: {', '.join(dossier['identifiers']) or 'none'}"
            )
            citations.append({"type": "entity", "id": str(entity.id), "label": entity.label})
            links = [{"type": "entity", "id": str(entity.id)}]
            follow_ups = ["Show timeline for " + entity.label, "Show graph around " + entity.label]
        elif any(k in q for k in ("timeline", "when", "activity")):
            timeline = await _tool_timeline(db, case_id, entity)
            draft = (
                f"Timeline for {entity.label}:\n"
                + "\n".join(
                    f"- [{t['start_time'] or '?'}] {t['event_type']}" for t in timeline[:10]
                ) if timeline else f"No timeline events recorded for {entity.label}."
            )
            citations.append({"type": "entity", "id": str(entity.id)})
        elif "path" in q:
            draft = f"Found {entity.label}; name a second entity to trace a path."
            follow_ups = ["List entities to pick a target"]
        else:
            state_part = f"state {entity.review_state.value}." if entity.review_state else ""
            draft = f"Entity {entity.label} ({entity.entity_type.value}, {state_part})"
            citations.append({"type": "entity", "id": str(entity.id)})
            follow_ups = ["Explain " + entity.label, "Show timeline", "Show graph"]

    elif id_hits:
        draft = f"Identifier {id_hits[0][1]} matched in this case. Ask for a dossier to see its connections."
        citations.append({"type": "identifier", "value": id_hits[0][1]})
        links.append({"type": "identifier", "value": id_hits[0][1]})

    elif "hypothes" in q or "strength" in q or "score" in q or "strongest" in q or "leads" in q or "lead" in q:
        hyps = (await db.execute(
            select(Hypothesis).where(Hypothesis.case_id == case_id).order_by(Hypothesis.numeric_value.desc())
        )).scalars().all()
        if hyps:
            draft = "Top hypotheses by evidence strength:\n" + "\n".join(
                f"- [{h.hypothesis_type} {h.numeric_value:.1f}/100, state {h.review_state.value}] {h.notes[:140]}"
                for h in hyps[:8]
            )
            citations.extend({"type": "hypothesis", "id": str(h.id)} for h in hyps[:8])
            follow_ups = ["Show contradictions", "Generate report"]
        else:
            draft = "No hypotheses yet — run analysis on this case first."
            follow_ups = ["Run analysis"]

    elif "list" in q or "all entities" in q:
        lst = await _exec_tool("list_entities", db, case_id, ())
        draft = "Entities: " + ", ".join(f"{e['label']} ({e['type']})" for e in lst[:25]) if lst else "No entities yet."
        citations.extend({"type": "entity", "id": e["id"]} for e in lst[:10])
        follow_ups = ["Pick one to run a dossier"]

    elif "frequent" in q or "most active" in q or "top entities" in q or ("who" in q and ("appear" in q or "frequent" in q or "active" in q)):
        freq = await _exec_tool("entity_frequency", db, case_id, ())
        if freq:
            draft = "Entities ranked by number of timeline events:\n" + "\n".join(
                f"- {e['label']}: {e['event_count']} events" for e in freq[:10]
            )
            citations.extend({"type": "entity", "id": e["entity_id"], "label": e["label"]} for e in freq[:5])
            follow_ups = [f"Explain {freq[0]['label']}", f"Show timeline for {freq[0]['label']}", "List all entities"]
        else:
            draft = "No entity event data available yet."

    elif "record" in q or "evidence" in q or "file" in q:
        recs = (await db.execute(
            select(SourceRecord).where(SourceRecord.case_id == case_id)
        )).scalars().all()
        draft = (
            f"This case has {len(recs)} source records, "
            f"{sum(1 for r in recs if not r.is_duplicate)} unique / "
            f"{sum(1 for r in recs if r.is_duplicate)} duplicates."
        )
        citations.append({"type": "evidence", "count": len(recs)})
        follow_ups = ["Run analysis", "List entities"]

    elif "run analysis" in q or "start analysis" in q:
        draft = "Analysis is queued — run it from the Analysis page or the Intelligence Workbench."
        follow_ups = ["Show hypotheses", "Show contradictions"]

    else:
        count_result = await db.execute(select(SourceRecord).where(SourceRecord.case_id == case_id))
        rec_count = len(count_result.scalars().all())
        draft = (
            f"SPYDEE copilot ready for case {case_id}. "
            f"{len(all_entities)} entities, {rec_count} source records. "
            "Ask to: explain an entity, trace a path between two entities, "
            "search uploaded documents, or inspect contradictions/info gaps."
        )
        follow_ups = ["List all entities", "Show all hypotheses", "Run analysis"]

    answer = await _maybe_llm_polish(query, draft, citations)
    return {
        "answer": answer,
        "citations": citations[:10],
        "follow_ups": list(dict.fromkeys(follow_ups))[:4],
        "links": links[:4],
    }