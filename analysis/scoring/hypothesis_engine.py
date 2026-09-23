"""SPYDEE Hypothesis Scoring Engine.

Deterministic weighted signal-fusion across families, contradiction penalties,
info-gap analysis, and per-signal HypothesisSignal linkage with deterministic
recommendation rows — fully reproducible across repeated runs.
"""
import uuid
from collections import defaultdict
from datetime import datetime
from typing import List, Dict, Tuple

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import (
    Hypothesis, HypothesisSignal, HypothesisRecommendation,
    Signal, HypothesisState, ReviewState, RecommendationType, RecommendationStatus,
)
from analysis.engines._shared import load_entities

ENGINE_VERSION = "v2.0"
CONTRADICTION_PENALTY = 0.25
NAMESPACE_SPYDEE = uuid.UUID("5f2e6c1a-8b4d-4f2e-9a3b-2c6d1e0f9a8b")

DEFAULT_FAMILY_WEIGHTS = {
    "communication": 0.20,
    "device_sim": 0.20,
    "spatial_temporal": 0.15,
    "writing_style": 0.15,
    "financial": 0.10,
    "infrastructure": 0.10,
    "network_topology": 0.10,
}

HYPOTHESIS_TYPES = [
    ("subversive_activity", RecommendationType.FLAG_SUBVERSIVE_ACTIVITY,
     "Subversive or unlawful activity indicated"),
    ("terror_link", RecommendationType.FLAG_TERROR_LINK,
     "Possible nexus to proscribed entity"),
    ("forged_documents", RecommendationType.FLAG_FORGED_DOCUMENTS,
     "Potential forged or fraudulently obtained documents"),
    ("social_network", RecommendationType.FLAG_SOCIAL_NETWORK,
     "Unusual or operationally significant social network concentration"),
    ("credential_inconsistency", RecommendationType.FLAG_CREDENTIAL_INCONSISTENCY,
     "Alias/credential data inconsistency requiring further verification"),
    ("financial_anomaly", RecommendationType.FLAG_FINANCIAL_ANOMALY,
     "Financial transaction pattern anomaly detected"),
]

TYPE_FAMILY_IMPORTANCE = {
    "subversive_activity": ["communication", "network_topology", "device_sim"],
    "terror_link": ["communication", "network_topology", "spatial_temporal"],
    "forged_documents": ["device_sim", "infrastructure"],
    "social_network": ["communication", "network_topology", "writing_style"],
    "credential_inconsistency": ["communication", "writing_style"],
    "financial_anomaly": ["financial", "communication"],
}


def stable_key(case_id, source: str, target: str, hypothesis_type: str) -> uuid.UUID:
    key = f"{case_id}:{source}:{target}:{hypothesis_type}"
    return uuid.uuid5(NAMESPACE_SPYDEE, key)


def _recommendation_key(stable_key_val: uuid.UUID, rec_type: str) -> uuid.UUID:
    return uuid.uuid5(NAMESPACE_SPYDEE, f"{stable_key_val}:{rec_type}")


def _best_signal(pair_signals: List[Signal], family: str) -> Signal:
    candidates = [s for s in pair_signals if s.family == family]
    if not candidates:
        return None
    return max(candidates, key=lambda s: (s.numeric_value or 0.0, str(s.id)))


async def generate_hypotheses(
    db: AsyncSession,
    case_id: uuid.UUID,
    analysis_run_id: uuid.UUID,
    signals: List[Signal],
    config: Dict = None,
) -> Tuple[List[Hypothesis], List[HypothesisSignal], List[HypothesisRecommendation]]:
    """Return (hypotheses, hypothesis_signals, recommendations).

    Fully deterministic from the input signal set: identical stable_keys,
    numeric_value, quality_factor, and contribution weighting across runs.
    """
    config = config or {}
    weights = dict(DEFAULT_FAMILY_WEIGHTS)
    weights.update(config.get("family_weights", {}) or {})

    entity_rows = await load_entities(db, case_id)
    entity_type_map = {str(e.id): (e.entity_type.value if hasattr(e.entity_type, "value") else str(e.entity_type)) for e in entity_rows}

    pairs = defaultdict(list)
    for s in signals:
        ep = s.entity_pair or {}
        src, tgt = ep.get("source"), ep.get("target")
        if src and tgt and src != tgt:
            pairs[tuple(sorted((str(src), str(tgt))))].append(s)

    hypotheses: List[Hypothesis] = []
    hyp_signals: List[HypothesisSignal] = []
    recommendations: List[HypothesisRecommendation] = []

    for (src, tgt), pair_signals in pairs.items():
        src_type = entity_type_map.get(src, "unknown")
        tgt_type = entity_type_map.get(tgt, "unknown")
        for hyp_type, rec_type, description in HYPOTHESIS_TYPES:
            important_families = TYPE_FAMILY_IMPORTANCE.get(hyp_type, list(weights.keys()))
            applicable = []
            for fam in important_families:
                if weights.get(fam, 0) <= 0:
                    continue
                sig = _best_signal(pair_signals, fam)
                if sig is not None and (sig.numeric_value or 0) > 0:
                    applicable.append((fam, sig))
            if not applicable:
                continue

            contradicting = [
                s for s in pair_signals
                if s.contradiction
                and s.family in important_families
                and weights.get(s.family, 0) > 0
            ]
            has_contradiction = bool(contradicting)
            missing_families = [f for f in important_families
                                if all(f != ff for ff, _ in applicable)]

            total_weight = sum(weights[f] for f, _ in applicable)
            weighted_sum = sum(weights[f] * (s.numeric_value or 0.0) * (s.quality_factor or 1.0)
                               for f, s in applicable)
            strength = round(100.0 * weighted_sum / total_weight, 1)
            if has_contradiction:
                strength = round(max(0.0, strength * (1.0 - CONTRADICTION_PENALTY)), 1)
            quality = round(sum(s.quality_factor or 1.0 for _, s in applicable)
                            / len(applicable), 4)

            if strength >= 80:
                label = "High Plausibility"
            elif strength >= 50:
                label = "Medium Plausibility"
            else:
                label = "Low Plausibility"

            notes = (
                f"{description}. Strength {strength}/100 ({label}). "
                + ("Contradiction detected — penalty applied." if has_contradiction else "")
                + (f" Data gaps: {', '.join(missing_families)}." if missing_families else "")
            )
            # Fusion transparency: state exactly how the strength was combined.
            # Scores are uncalibrated evidence scores, NOT probabilities.
            applied = ", ".join(f"{fam} (w={weights[fam]:.2f})" for fam, _ in applicable)
            notes += f" Fusion: strength = weighted mean of family evidence scores using [{applied}]; "
            notes += "scores are uncalibrated evidence scores, not probabilities. "
            notes += ("Indicative of a possible link; requires investigator verification." if strength >= 50
                      else "Weak signal set; does not establish a link.")

            skey = stable_key(case_id, src, tgt, hyp_type)
            highlights = [
                f"{fam}@{s.numeric_value:.2f}"
                for fam, s in applicable
            ]

            hyp = Hypothesis(
                id=skey,
                case_id=case_id,
                analysis_run_id=analysis_run_id,
                stable_key=str(skey),
                entity_pair={"source": src, "target": tgt,
                             "types": {"source": src_type, "target": tgt_type}},
                notes=notes,
                timestamp_hypothesis_generated=None,
                contributing_signal_highlights=highlights,
                state=HypothesisState.CANDIDATE,
                review_state=ReviewState.NEW,
                numeric_value=strength,
                quality_factor=quality,
                engine_version=ENGINE_VERSION,
                hypothesis_type=hyp_type,
            )
            hypotheses.append(hyp)

            link_sources = list(applicable)
            for cs in contradicting:
                if all(cs is not s for _, s in applicable):
                    link_sources.append((cs.family, cs))
            for fam, sig in link_sources:
                contribution = round(weights[fam] * (sig.numeric_value or 0.0)
                                     * (sig.quality_factor or 1.0) / total_weight, 4)
                hsig = HypothesisSignal(
                    id=uuid.uuid5(NAMESPACE_SPYDEE,
                                  f"{skey}:{fam}:{str(sig.id)[:8]}"),
                    hypothesis_id=skey,
                    signal_id=sig.id,
                    family=fam,
                    entity_pair=sig.entity_pair,
                    weight=weights[fam],
                    contribution=contribution,
                    quality_factor=sig.quality_factor or 1.0,
                    feature_details=(sig.feature_details or {}) | {
                        "signal_explanation": sig.explanation,
                    },
                    contradiction=bool(sig.contradiction),
                )
                hyp_signals.append(hsig)

            rec_desc = {
                "subversive_activity": "Escalate for field investigation.",
                "terror_link": "Coordinate with specialized desk for linkage validation.",
                "forged_documents": "Verify document authenticity via issuing authority.",
                "social_network": "Map extended network and prioritize high-brokerage nodes.",
                "credential_inconsistency": "Cross-validate identity attributes across sources.",
                "financial_anomaly": "Escalate to financial intelligence desk for KYC/AML review.",
            }[hyp_type]

            if missing_families:
                recommendations.append(HypothesisRecommendation(
                    id=_recommendation_key(skey, "data_gap"),
                    hypothesis_id=skey,
                    type=RecommendationType.BOOK_EXTERNAL_INT_DESK,
                    status=RecommendationStatus.PENDING,
                    estimated_completion_days=5,
                    rationale=f"Missing data families: {', '.join(missing_families)}.",
                ))
            if strength < 50 and not missing_families:
                recommendations.append(HypothesisRecommendation(
                    id=_recommendation_key(skey, "humint"),
                    hypothesis_id=skey,
                    type=RecommendationType.COLLECT_HUMAN_INTEL,
                    status=RecommendationStatus.PENDING,
                    estimated_completion_days=3,
                    rationale="Score below 50 — recommend HUMINT or additional field data.",
                ))

            recommendations.append(HypothesisRecommendation(
                id=_recommendation_key(skey, str(rec_type.value)),
                hypothesis_id=skey,
                type=rec_type,
                status=RecommendationStatus.PENDING,
                estimated_completion_days=2,
                rationale=rec_desc,
            ))

    return hypotheses, hyp_signals, recommendations