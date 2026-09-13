import uuid
from collections import defaultdict
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.models import Signal, Hypothesis, Entity, ReviewState


FAMILY_WEIGHTS = {
    "communication": 0.20,
    "device_sim": 0.25,
    "spatial_temporal": 0.15,
    "writing_style": 0.15,
    "financial": 0.15,
    "infrastructure": 0.10,
}

STRONG_MIN_FAMILIES = 3
STRONG_MIN_INDEPENDENT = 3
LOW_MAX = 40
MODERATE_MIN = 40
MODERATE_MAX = 70
CONTRADICTION_PENALTY = 0.25


async def generate_hypotheses(
    db: AsyncSession,
    case_id: uuid.UUID,
    analysis_run_id: uuid.UUID,
    signals: List[Signal],
) -> List[Hypothesis]:
    entity_pairs = defaultdict(list)
    for sig in signals:
        key = _pair_key(sig.entity_pair)
        entity_pairs[key].append(sig)

    hypotheses = []

    for pair_key, pair_signals in entity_pairs.items():
        src_id, tgt_id = pair_key

        families = defaultdict(list)
        for sig in pair_signals:
            families[sig.family].append(sig)

        num_families = len(families)

        family_scores = {}
        family_quality = {}
        for family, fam_signals in families.items():
            best = max(fam_signals, key=lambda s: s.numeric_value * s.quality_factor)
            family_scores[family] = best.numeric_value
            family_quality[family] = best.quality_factor

        weighted_sum = 0.0
        total_weight = 0.0
        for family, w in FAMILY_WEIGHTS.items():
            if family in family_scores:
                weighted_sum += w * family_scores[family] * family_quality[family]
                total_weight += w

        if total_weight > 0:
            normalized = weighted_sum / total_weight
        else:
            normalized = 0.0

        strength_raw = normalized * 100
        strength = max(0, min(100, int(round(strength_raw))))

        supporting = []
        contradicting = []
        for sig in pair_signals:
            for rid in (sig.contributing_record_ids or []):
                if rid not in supporting:
                    supporting.append(rid)

        missing = []
        all_families = set(FAMILY_WEIGHTS.keys())
        present = set(families.keys())
        missing_families = all_families - present
        if missing_families:
            missing.append(f"Missing signal families: {', '.join(sorted(missing_families))}")
        if num_families < STRONG_MIN_FAMILIES:
            missing.append(f"Only {num_families} independent families (need {STRONG_MIN_FAMILIES} for strong)")

        if num_families >= STRONG_MIN_INDEPENDENT and strength >= 70:
            review_state = "new"
        elif strength >= LOW_MAX:
            review_state = "new"
        else:
            review_state = "new"

        statement = _build_statement(src_id, tgt_id, families, strength)
        action = _propose_action(families, missing, strength)

        score_breakdown = {
            "weighted_normalized": round(normalized, 4),
            "strength_raw": round(strength_raw, 1),
            "family_scores": {f: {"score": round(s, 4), "quality": round(family_quality[f], 4), "weight": FAMILY_WEIGHTS.get(f, 0)} for f, s in family_scores.items()},
            "num_families": num_families,
        }

        data_coverage = {
            "families_present": list(present),
            "families_missing": list(missing_families),
            "total_signals": len(pair_signals),
        }

        hyp = Hypothesis(
            case_id=case_id,
            analysis_run_id=analysis_run_id,
            stable_key=f"{src_id}-{tgt_id}-v{analysis_run_id}",
            statement=statement,
            target_relationship_type="POSSIBLE_LINK",
            source_entity_id=uuid.UUID(src_id),
            target_entity_id=uuid.UUID(tgt_id),
            strength_index=strength,
            supporting_records=supporting[:50],
            contradicting_records=contradicting,
            missing_information=missing,
            proposed_action=action,
            score_breakdown=score_breakdown,
            data_coverage=data_coverage,
            review_state=review_state,
        )
        hypotheses.append(hyp)

    return hypotheses


def _pair_key(entity_pair):
    src = str(entity_pair.get("source", ""))
    tgt = str(entity_pair.get("target", ""))
    return tuple(sorted([src, tgt]))


def _build_statement(src_id, tgt_id, families, strength):
    family_names = list(families.keys())
    if strength >= 70:
        level = "Strong"
    elif strength >= 40:
        level = "Moderate"
    else:
        level = "Weak"
    return (
        f"{level} evidence-strength index ({strength}/100) suggests possible link between "
        f"entities {src_id[:8]} and {tgt_id[:8]} "
        f"based on {', '.join(family_names)} signals."
    )


def _propose_action(families, missing, strength):
    if strength < 40:
        return "Insufficient evidence. Consider importing more records before review."
    if len(families) < 2:
        return "Only one signal family present. Seek independent evidence types."
    if missing:
        return f"Address gaps: {'; '.join(missing[:2])}. Then re-review."
    return "Review independent signal sources and record decision."
