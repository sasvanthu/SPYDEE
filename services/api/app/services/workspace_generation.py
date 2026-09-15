"""Connect analysis engine outputs to the investigation workspace.

After a run completes, high-strength hypotheses become investigator-reviewable
leads, missing-family hypotheses become information gaps, and contradiction
signals become contradiction records. All records are REVIEWABLE (created in an
open/pending state); nothing is treated as confirmed. Records are keyed so
re-running analysis refreshes content instead of accumulating duplicates.
"""
import uuid
from typing import List, Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import (
    Signal, Hypothesis, Contradiction, Lead, InformationGap,
    ContradictionStatus, LeadPriority, LeadStatus, GapStatus,
)

LEAD_THRESHOLD = 80.0

ORIGIN_LEAD = "analysis:hypothesis"
ORIGIN_GAP = "analysis:hypothesis"


async def generate_workspace_from_run(
    db: AsyncSession,
    case_id: uuid.UUID,
    run,
    hypotheses: Sequence[Hypothesis],
    signals: List[Signal],
) -> dict:
    """Idempotently create/refresh workspace records derived from a run."""
    created = {"contradictions": 0, "leads": 0, "gaps": 0}
    updated = {"leads": 0, "gaps": 0}

    # ── Contradiction records from contradiction signals ──────────────────
    existing_contras = {
        (c.detection_method or "", tuple(sorted((c.entity_ids or []))))
        for c in (await db.execute(
            select(Contradiction).where(Contradiction.case_id == case_id)
        )).scalars().all()
    }
    for sig in signals:
        if not sig.contradiction:
            continue
        ep = sig.entity_pair or {}
        entity_ids = sorted({str(x) for x in (ep.get("source"), ep.get("target")) if x})
        method = f"{sig.engine_name}:{sig.family}:{str(sig.id)[:8]}"
        key = (method, tuple(entity_ids))
        if key in existing_contras:
            continue
        reason = sig.contradiction_reason or sig.explanation or "Contradictory evidence"
        statements = [
            {
                "statement": reason,
                "evidence": sig.explanation,
                "record_ids": sig.contributing_record_ids or [],
                "time": sig.time_window_start.isoformat() if sig.time_window_start else None,
            }
        ]
        db.add(Contradiction(
            case_id=case_id,
            title=(
                f"Contradiction: {statements[0]['statement'][:120]}"
            ),
            statements=statements,
            entity_ids=entity_ids,
            time_context=(
                f"{sig.time_window_start:%Y-%m-%d %H:%M} → {sig.time_window_end:%Y-%m-%d %H:%M}"
                if sig.time_window_start and sig.time_window_end else None
            ),
            detection_method=method,
            explanation=sig.explanation,
            analysis_run_id=run.id,
        ))
        existing_contras.add(key)
        created["contradictions"] += 1

    # ── Leads from high-strength hypotheses ───────────────────────────────
    for hyp in hypotheses:
        if not hyp.numeric_value or hyp.numeric_value < LEAD_THRESHOLD:
            continue
        ep = hyp.entity_pair or {}
        entity_ids = sorted({str(x) for x in (ep.get("source"), ep.get("target")) if x})
        existing = (await db.execute(
            select(Lead).where(
                Lead.case_id == case_id,
                Lead.origin_type == ORIGIN_LEAD,
                Lead.origin_id == hyp.id,
            )
        )).scalar_one_or_none()
        priority = "critical" if hyp.numeric_value >= 90 else "high"
        title = (
            f"High-plausibility {hyp.hypothesis_type.replace('_', ' ')} link "
            f"(strength {hyp.numeric_value:.0f}/100)"
        )
        if existing:
            existing.title = title
            existing.description = hyp.notes
            existing.entity_ids = entity_ids
            existing.priority_rationale = (
                f"Fused strength {hyp.numeric_value:.0f}/100 across families "
                f"({'/'.join(hyp.contributing_signal_highlights or [])})."
            )
            updated["leads"] += 1
        else:
            db.add(Lead(
                case_id=case_id,
                title=title,
                description=hyp.notes,
                origin_type=ORIGIN_LEAD,
                origin_id=hyp.id,
                entity_ids=entity_ids,
                supporting_evidence_refs=[
                    {"family": fam, "note": note}
                    for fam, note in (x.split("@", 1) for x in (hyp.contributing_signal_highlights or []))
                ],
                priority=priority,
                priority_rationale=(
                    f"Fused strength {hyp.numeric_value:.0f}/100 across families "
                    f"({'/'.join(hyp.contributing_signal_highlights or [])})."
                ),
                status=LeadStatus.OPEN,
            ))
            created["leads"] += 1

    # ── Information gaps from hypotheses with missing data families ───────
    for hyp in hypotheses:
        gap_families = _gap_families_from_notes(hyp.notes or "")
        if not gap_families:
            continue
        ep = hyp.entity_pair or {}
        entity_ids = sorted({str(x) for x in (ep.get("source"), ep.get("target")) if x})
        existing = (await db.execute(
            select(InformationGap).where(
                InformationGap.case_id == case_id,
                InformationGap.lead_id.is_(None),
            )
        )).scalars().all()
        dup = next(
            (g for g in existing
             if g.title == f"Data gap: {', '.join(gap_families)} for {hyp.hypothesis_type}"),
            None,
        )
        title = f"Data gap: {', '.join(gap_families)} for {hyp.hypothesis_type}"
        description = (
            f"Families {', '.join(gap_families)} carry no supportive evidence for "
            f"{hyp.hypothesis_type} between {', '.join(entity_ids)}. "
            f"Hypothesis: {hyp.notes}"
        )
        if dup is not None:
            dup.description = description
            dup.related_entity_ids = entity_ids
            dup.status = GapStatus.OPEN
            updated["gaps"] += 1
        else:
            db.add(InformationGap(
                case_id=case_id,
                title=title,
                description=description,
                related_entity_ids=entity_ids,
                status=GapStatus.OPEN,
            ))
            created["gaps"] += 1

    await db.flush()
    return {"created": created, "updated": updated}


def _gap_families_from_notes(notes: str) -> List[str]:
    marker = "Data gaps:"
    if marker not in notes:
        return []
    tail = notes.split(marker, 1)[1]
    end = tail.find(".")
    fams = (tail[:end] if end != -1 else tail).strip()
    return [f.strip() for f in fams.replace("Fusion:", ",").split(",") if f.strip()]