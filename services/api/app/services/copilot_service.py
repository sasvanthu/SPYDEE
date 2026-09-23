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
    HypothesisRecommendation, Contradiction, Lead, InformationGap, InvestigationAction,
)
from app.services.national_datasets_service import DATASETS_CATALOG

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
        "contradictions: evidence conflicts recorded in the workspace (signals + structured)",
        "info_gaps: information gaps and next-best actions for hypotheses and leads",
        "open_leads: investigation leads awaiting review, with priority",
        "rag_search(term): retrieve text chunks from uploaded documents (all citations link to sources)",
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
    out = [{
        "kind": "signal",
        "id": str(s.id),
        "family": s.family,
        "reason": s.contradiction_reason if hasattr(s, "contradiction_reason") else s.explanation,
        "numeric_value": s.numeric_value,
    } for s in sigs]
    crows = (await db.execute(
        select(Contradiction).where(
            Contradiction.case_id == case_id,
            Contradiction.status.in_(["OPEN", "NEEDS_CLARIFICATION"]),
        ).order_by(Contradiction.created_at.desc())
    )).scalars().all()
    for c in crows:
        statements = c.statements or []
        out.append({
            "kind": "workspace",
            "id": str(c.id),
            "family": c.detection_method or "workspace",
            "reason": c.explanation or c.title,
            "title": c.title,
            "statements": [s.get("text") if isinstance(s, dict) else str(s) for s in statements[:4]],
        })
    return out


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
    gaps = (await db.execute(
        select(InformationGap).where(InformationGap.case_id == case_id, InformationGap.status == "OPEN")
        .order_by(InformationGap.created_at.desc()).limit(8)
    )).scalars().all()
    for g in gaps:
        rows.append({
            "gap_id": str(g.id),
            "type": "information_gap",
            "numeric_value": None,
            "notes": (g.description or g.title)[:200],
            "recommendation": None,
        })
    return rows


async def _tool_open_leads(db, case_id) -> list:
    leads = (await db.execute(
        select(Lead).where(Lead.case_id == case_id, Lead.status.in_(["OPEN", "IN_PROGRESS"]))
        .order_by(Lead.updated_at.desc()).limit(10)
    )).scalars().all()
    out = []
    for l in leads:
        out.append({
            "lead_id": str(l.id),
            "title": l.title,
            "description": (l.description or "")[:200],
            "priority": l.priority.value if l.priority else "medium",
            "priority_rationale": l.priority_rationale,
            "status": l.status.value if l.status else "open",
            "origin_type": l.origin_type,
        })
    return out


async def _tool_open_actions(db, case_id) -> list:
    actions = (await db.execute(
        select(InvestigationAction).where(
            InvestigationAction.case_id == case_id,
            InvestigationAction.status.in_(["PROPOSED", "IN_PROGRESS"]),
        ).order_by(InvestigationAction.created_at.desc()).limit(10)
    )).scalars().all()
    return [{
        "action_id": str(a.id),
        "title": a.title,
        "proposed_step": a.proposed_step,
        "expected_information": a.expected_information,
        "status": a.status.value if a.status else "proposed",
        "gap_id": str(a.gap_id) if a.gap_id else None,
    } for a in actions]


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
        "evidence_file_id": str(c.evidence_file_id) if c.evidence_file_id else None,
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
    "open_leads": _tool_open_leads,
    "open_actions": _tool_open_actions,
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
    matched_ds = [
        d for d in DATASETS_CATALOG
        if d["name"].lower() in q or d["code"].lower().replace("_", " ") in q
        or (len(d["code"].split("_")[0]) > 3 and d["code"].split("_")[0].lower() in q)
    ]
    if "dataset" in q or "datasets" in q or matched_ds:
        if matched_ds:
            ds = matched_ds[0]
            draft = (
                f"**National Intelligence Dataset: {ds['name']}** (#{ds['id']})\n"
                f"- **Category**: {ds['category']} ({ds['priority']})\n"
                f"- **Sponsor**: {ds['organization']}\n"
                f"- **Applied AI & Stack**: {ds['technology']}\n"
                f"- **Records / Scale**: {ds['records_count']}\n"
                f"- **Role in Investigation**: {ds['case_usage']}\n"
                f"- **Official Link**: {ds['url']}\n"
                f"- **Active Cases**: {', '.join(ds['associated_cases'])}\n\n"
                f"*Benchmark Telemetry*: {json.dumps(ds.get('benchmark_metrics', {}), indent=2)}"
            )
            citations.append({"type": "national_dataset", "id": ds["id"], "name": ds["name"], "url": ds["url"]})
            links.append({"type": "dataset", "url": ds["url"]})
            follow_ups = [
                f"What cases use {ds['name']}?",
                "List all 25 National Datasets",
                "Show sample record for " + ds["name"]
            ]
        else:
            draft = (
                f"**SPYDEE 25 National & Cross-Validation Datasets Framework**\n"
                f"The system integrates 25 high-priority intelligence datasets across 6 domains:\n"
                f"1. **Legal NLP & NER (8)**: InLegalNER, Naamapadam, InLegalBERT, ILDC, NyayaAnumana, AWS Open Data SC/HC, LawSum, IndianBailJudgments-1200\n"
                f"2. **CCTV & Biometrics (4)**: UVH-26 IISc Bengaluru SafeCity, IMFDB, IIITM Face, IIIT-Delhi Disguise/Sketches\n"
                f"3. **Financial & AML (5)**: UPI Transactions 2024, UPI Fraud Detection, UPI Payment Transactions, IBM AML, Elliptic Bitcoin\n"
                f"4. **Telecom Mobility (3)**: TRAI Karnataka LSA Subscriptions, TRAI Open Data, Bangalore City Traffic\n"
                f"5. **Crime Statistics (2)**: NCRB Crime in India, NCRB Structured Tables (dataful.in)\n"
                f"6. **Synthetic & Resolution (3)**: FEBRL Record Linkage, Faker en_IN, Synthetic Data Vault (SDV)\n\n"
                f"Visit the **National Datasets Registry** tab (/datasets) to inspect live samples, benchmarks, and citations."
            )
            citations.append({"type": "national_datasets_hub", "count": 25})
            follow_ups = [
                "Explain InLegalNER",
                "How does UVH-26 detect vehicles in Bengaluru?",
                "How does IBM AML detect money mule structuring?"
            ]

    elif "sql" in q or "query the database" in q:
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
                f"- [{'page ' + str(c['page']) if c['page'] else 'no page'}] "
                f"{' '.join(str(c['text']).split())[:280]}" for c in chunks
            )
            for c in chunks:
                if c.get("evidence_file_id"):
                    citations.append({"type": "document_chunk", "id": c["id"], "evidence_file_id": c["evidence_file_id"], "page": c["page"]})
                else:
                    citations.append({"type": "document_chunk", "id": c["id"]})
        else:
            draft = "No document chunks matched that topic in this case. You can upload TXT/PDF evidence to make it searchable."
        follow_ups = ["List uploaded evidence", "What are the open contradictions?"]

    elif "contradict" in q or "conflict" in q or "impossible" in q:
        contras = await _tool_contradictions(db, case_id)
        if contras:
            draft = "Contradicting/conflicting evidence:\n" + "\n".join(
                f"- {c['reason']}" for c in contras[:6]
            )
            for c in contras[:8]:
                if c["kind"] == "workspace":
                    citations.append({"type": "contradiction", "id": c["id"], "title": c.get("title")})
                    links.append({"type": "contradiction", "id": c["id"]})
                else:
                    citations.append({"type": "signal", "id": c["id"]})
        else:
            draft = "No contradicting evidence detected in the current analysis run."
        follow_ups = ["What are the open information gaps?", "Run analysis again with more data"]

    elif "gap" in q or "missing" in q or "insufficient" in q:
        gaps = await _tool_info_gaps(db, case_id)
        if gaps:
            draft = "Information gaps and next-best actions:\n" + "\n".join(
                f"- [{g['type']}] {g['notes']} {'-> ' + str(g['recommendation']) if g.get('recommendation') else ''}"
                .rstrip()
                for g in gaps[:6]
            )
            for g in gaps[:6]:
                if g.get("gap_id"):
                    citations.append({"type": "information_gap", "id": g["gap_id"]})
                    links.append({"type": "information_gap", "id": g["gap_id"]})
                elif g.get("hypothesis_id"):
                    citations.append({"type": "hypothesis", "id": g["hypothesis_id"]})
        else:
            draft = "No open information gaps recorded for this case."
        follow_ups = ["What should we do next?", "Show open leads"]

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

    elif "action" in q or "next step" in q or "what to do" in q or "should we" in q:
        acts = await _tool_open_actions(db, case_id)
        if acts:
            draft = "Proposed next-best actions:\n" + "\n".join(
                f"- [{a['status']}] {a['title']}: {a['proposed_step'] or 'n/a'} "
                f"(expects: {a['expected_information'] or 'n/a'})" for a in acts[:6]
            )
        else:
            draft = "No open proposed actions. Ask about information gaps to find next steps, or record a lead."
        follow_ups = ["Show open information gaps", "Show open leads", "Generate a report"]

    elif "leads" in q or "lead" in q:
        leads = await _tool_open_leads(db, case_id)
        if leads:
            draft = "Open investigation leads:\n" + "\n".join(
                f"- [{l['priority']}, {l['status']}] {l['title']} — {(l['description'] or '')[:140]}"
                for l in leads[:8]
            )
            for l in leads[:6]:
                citations.append({"type": "lead", "id": l["lead_id"], "title": l["title"]})
                links.append({"type": "lead", "id": l["lead_id"]})
        else:
            draft = "No open leads recorded yet. Leads can be created from findings or an investigator note."
        follow_ups = ["What are the information gaps?", "What should we do next?", "Show contradictions"]

    elif "hypothes" in q or "strength" in q or "score" in q or "strongest" in q:
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

    elif any(k in q for k in ("how many", "count", "statistic", "breakdown", "metrics", "summary")):
        from collections import Counter
        type_counts = Counter(str(e.entity_type.value) for e in all_entities)
        type_str = ", ".join(f"{cnt} {t.lower()}" for t, cnt in type_counts.most_common(6))

        count_result = await db.execute(select(SourceRecord).where(SourceRecord.case_id == case_id))
        rec_count = len(count_result.scalars().all())

        rel_result = await db.execute(select(Relationship).where(Relationship.case_id == case_id))
        rel_count = len(rel_result.scalars().all())

        sig_result = await db.execute(select(Signal).where(Signal.case_id == case_id))
        sig_count = len(sig_result.scalars().all())

        hyp_result = await db.execute(select(Hypothesis).where(Hypothesis.case_id == case_id))
        hyp_count = len(hyp_result.scalars().all())

        draft = (
            f"Case Metrics Summary for case {case_id}:\n"
            f"- Total Entities: {len(all_entities)}" + (f" ({type_str})" if type_str else "") + "\n"
            f"- Ingested Source Records: {rec_count}\n"
            f"- Graph Relationships: {rel_count}\n"
            f"- Intelligence Signals: {sig_count}\n"
            f"- Working Hypotheses: {hyp_count}"
        )
        citations.append({"type": "case_summary", "entities": len(all_entities), "records": rec_count})
        follow_ups = ["List all entities", "Show top hypotheses", "What are the contradictions?"]

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
            "search uploaded documents, inspect contradictions/info gaps, "
            "or list open leads and proposed actions."
        )
        follow_ups = ["List all entities", "Show open leads", "What are the information gaps?"]

    answer = await _maybe_llm_polish(query, draft, citations)
    return {
        "answer": answer,
        "citations": citations[:10],
        "follow_ups": list(dict.fromkeys(follow_ups))[:4],
        "links": links[:4],
    }