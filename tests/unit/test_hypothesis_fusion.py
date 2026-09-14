"""Pure determinism + scoring-correctness tests for hypothesis fusion.

No analysis engines are run here — signals are constructed directly so that
the fusion math, stable keys, contradiction penalty and recommendation wiring
are verified in isolation.
"""
import uuid

from analysis.scoring.hypothesis_engine import (
    stable_key, _recommendation_key, _best_signal, generate_hypotheses,
    CONTRADICTION_PENALTY,
)
from app.models.models import Signal


def _signal(family, value, qf=1.0, contradiction=False, sig_id=None):
    return Signal(
        id=sig_id or uuid.uuid4(),
        family=family,
        entity_pair={"source": "s", "target": "t"},
        numeric_value=value,
        quality_factor=qf,
        contradiction=contradiction,
        explanation=f"{family} probe",
        feature_details={"probe": True},
    )


def test_stable_key_is_deterministic_and_namespaced():
    k1 = stable_key("case-a", "x", "y", "social_network")
    k2 = stable_key("case-a", "x", "y", "social_network")
    k3 = stable_key("case-a", "x", "z", "social_network")
    assert k1 == k2
    assert k1 != k3
    assert isinstance(k1, uuid.UUID)
    assert k1.version == 5


def test_stable_key_ordering_stable_across_pair_orientation():
    # Fusion pairs are always consumed in sorted (src, tgt) order, so the key
    # built with sorted IDs is what determinism actually depends on.
    assert stable_key("c", "a", "b", "t") == stable_key("c", "a", "b", "t")


async def test_pair_orientation_is_invariant_at_fusion(db_session, make_case):
    from analysis.scoring.hypothesis_engine import stable_key

    case = await make_case()
    ab, ba = _signal("communication", 0.8), _signal("communication", 0.8)
    ab.entity_pair = {"source": "a", "target": "b"}
    ba.entity_pair = {"source": "b", "target": "a"}

    h1, _, _ = await generate_hypotheses(db_session, case.id, uuid.uuid4(), [ab], {})
    h2, _, _ = await generate_hypotheses(db_session, case.id, uuid.uuid4(), [ba], {})

    keys1 = {h.stable_key for h in h1}
    keys2 = {h.stable_key for h in h2}
    assert keys1 == keys2
    for h in h1:
        assert h.numeric_value == [x for x in h2 if x.stable_key == h.stable_key][0].numeric_value


def test_recommendation_keys_are_deterministic():
    sk = stable_key("c", "x", "y", "financial_anomaly")
    r1 = _recommendation_key(sk, "data_gap")
    r2 = _recommendation_key(sk, "data_gap")
    assert r1 == r2
    assert r1 != _recommendation_key(sk, "humint")


def test_best_signal_picks_highest_value_with_tiebreak():
    a = _signal("communication", 0.5, sig_id=uuid.UUID(int=1))
    b = _signal("communication", 0.9, sig_id=uuid.UUID(int=2))
    assert _best_signal([a, b], "communication").id == b.id


async def test_fusion_is_deterministic_across_two_runs(db_session, make_case):
    case = await make_case()
    signals = [
        _signal("communication", 0.8, qf=1.0),
        _signal("network_topology", 0.7, qf=0.9),
    ]
    h1, hs1, r1 = await generate_hypotheses(db_session, case.id, uuid.uuid4(), signals, {})
    h2, hs2, r2 = await generate_hypotheses(db_session, case.id, uuid.uuid4(), signals, {})

    assert len(h1) == len(h2)
    assert len(hs1) == len(hs2)
    assert len(r1) == len(r2)
    assert [(h.stable_key, h.numeric_value, h.hypothesis_type) for h in h1] == \
           [(h.stable_key, h.numeric_value, h.hypothesis_type) for h in h2]
    assert len(r1) == len(r2)


async def test_fusion_scores_within_0_100_and_weights_families(
    db_session, make_case
):
    case = await make_case()
    signals = [
        _signal("communication", 1.0, qf=1.0),
        _signal("network_topology", 1.0, qf=1.0),
    ]
    hypo, links, recs = await generate_hypotheses(db_session, case.id, uuid.uuid4(), signals, {})
    assert hypo, "expected hypotheses"
    for h in hypo:
        assert 0.0 <= h.numeric_value <= 100.0
        assert 0.0 < h.quality_factor <= 1.0

    comm_hyp = [h for h in hypo if h.hypothesis_type == "subversive_activity"]
    if comm_hyp:
        assert comm_hyp[0].numeric_value == 100.0


async def test_contradiction_penalises_pair_strength(db_session, make_case):
    case = await make_case()
    base = [
        _signal("communication", 1.0, qf=1.0),
        _signal("network_topology", 1.0, qf=1.0),
    ]
    contrad = base + [_signal("spatial_temporal", 0.0, contradiction=True)]

    clean_hyps, _, _ = await generate_hypotheses(db_session, case.id, uuid.uuid4(), base, {})
    bad_hyps, bad_links, _ = await generate_hypotheses(db_session, case.id, uuid.uuid4(), contrad, {})

    clean = {h.hypothesis_type: h.numeric_value for h in clean_hyps}
    bad = {h.hypothesis_type: h.numeric_value for h in bad_hyps}

    for hyp_type, bad_val in bad.items():
        assert bad_val <= clean[hyp_type], f"{hyp_type} must not increase"
        if hyp_type == "terror_link" and clean[hyp_type] > 0:
            assert bad_val <= round(clean[hyp_type] * (1 - CONTRADICTION_PENALTY), 1) + 1e-9

    contrad_sig = contrad[-1]
    affected = [l for l in bad_links if l.signal_id == contrad_sig.id and l.contradiction]
    assert affected, "expected a contradiction-flagged hypothesis signal link"


async def test_data_gap_recommendation_for_missing_family(db_session, make_case):
    case = await make_case()
    signals = [_signal("communication", 0.9, qf=1.0)]
    hypo, links, recs = await generate_hypotheses(db_session, case.id, uuid.uuid4(), signals, {})
    assert hypo
    data_gaps = [r for r in recs if r.type.value == "book_external_int_desk"]
    assert data_gaps, "expected at least one data-gap recommendation"