"""SPYDEE Communication Pattern Engine.

Enhances pairwise contact analysis with burst episodes, night-owl anomalies,
duration weighting and burner-phone lifecycle detection. Fully deterministic.
"""
import uuid
from collections import defaultdict
from datetime import timedelta
from typing import List

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Signal
from analysis.engines._shared import (
    clamp01, score_round, entity_matches, entity_pair_json, load_id_entity_map,
    parse_datetime,
)

NIGHT_START = 0
NIGHT_END = 5
BURST_WINDOW_HOURS = 2.0
BURNER_SPAN_DAYS = 3
SILENCE_DAYS = 2.0
MIN_MESSAGES = 3


def _chrono(records, content_key="start_time"):
    return sorted(
        (parse_datetime(r.normalized_content.get(content_key)) for r in records),
        key=lambda x: (x is None, x),
    )


def _max_in_sliding_window(times, window_hours):
    """Deterministic two-pointer for max events inside any sliding window."""
    ts = [t for t in times if t is not None]
    ts.sort()
    if not ts:
        return 0
    window = timedelta(hours=window_hours)
    best = 1
    left = 0
    for right in range(len(ts)):
        while ts[right] - ts[left] > window:
            left += 1
        best = max(best, right - left + 1)
    return best


async def analyze_communication(db, case_id, analysis_run_id, records):
    signals: List[Signal] = []
    id_map = await load_id_entity_map(db, case_id)

    cdr_records = []
    msg_records = []
    for r in records:
        c = r.normalized_content
        if not isinstance(c, dict):
            continue
        if "caller_id" in c or "callee_id" in c or "calling_number" in c or "called_number" in c:
            cdr_records.append(r)
        elif "text" in c or "message_text" in c:
            msg_records.append(r)

    pair_stats = defaultdict(lambda: {
        "count": 0, "total_duration": 0.0, "times": [], "records": [],
        "night_count": 0, "first": None, "last": None, "duration_ok": 0,
    })

    def bump(key, call_time, duration, rid, night):
        s = pair_stats[key]
        s["count"] += 1
        s["total_duration"] += max(0.0, float(duration or 0))
        s["times"].append(call_time)
        s["records"].append(str(rid))
        if call_time is not None:
            if s["first"] is None or call_time < s["first"]:
                s["first"] = call_time
            if s["last"] is None or call_time > s["last"]:
                s["last"] = call_time
        if night:
            s["night_count"] += 1
        if (duration or 0) > 60:
            s["duration_ok"] += 1

    for r in cdr_records:
        c = r.normalized_content
        caller = c.get("caller_id") or c.get("calling_number")
        callee = c.get("callee_id") or c.get("called_number")
        src = entity_matches(id_map, "phone", caller)
        tgt = entity_matches(id_map, "phone", callee)
        if not src or not tgt or src == tgt:
            continue
        ts = parse_datetime(c.get("start_time") or c.get("_observed_at"))
        night = ts is not None and NIGHT_START <= ts.hour < NIGHT_END
        bump((src, tgt), ts, c.get("duration_seconds", 0), r.id, night)

    for r in msg_records:
        c = r.normalized_content
        sender = c.get("alias_id") or c.get("sender_alias") or c.get("handle")
        receiver = c.get("target_alias")
        if not receiver:
            # Ingroup/group messages still anchor the sender
            continue
        src = entity_matches(id_map, "alias", sender) or entity_matches(id_map, "handle", sender)
        tgt = entity_matches(id_map, "alias", receiver)
        if not src or not tgt or src == tgt:
            continue
        ts = parse_datetime(c.get("timestamp") or c.get("_observed_at"))
        bump((src, tgt), ts, 0, r.id, night=ts is not None and NIGHT_START <= ts.hour < NIGHT_END)

    # Wall-clock horizon for silence (burner) detection
    all_times = []
    for s in pair_stats.values():
        all_times.extend(s["times"])
    valid_times = [t for t in all_times if t is not None]
    horizon = max(valid_times) if valid_times else None
    horizon_end = horizon + timedelta(days=14) if horizon else None

    for (src, tgt), s in pair_stats.items():
        if s["count"] < 2:
            continue

        count_score = clamp01(s["count"] / 20.0)
        duration_score = clamp01(s["total_duration"] / 3600.0)
        burst = _max_in_sliding_window(s["times"], BURST_WINDOW_HOURS)
        burst_score = clamp01(burst / 6.0)
        night_score = clamp01(s["night_count"] / max(1, s["count"]) / 0.5)
        long_call_score = clamp01(s["duration_ok"] / max(1, s["count"]))

        s_f = (0.35 * count_score + 0.20 * duration_score +
               0.20 * burst_score + 0.15 * night_score + 0.10 * long_call_score)

        burner = False
        if (s["first"] is not None and s["last"] is not None
                and (s["last"] - s["first"]).days <= BURNER_SPAN_DAYS
                and s["count"] >= 8
                and horizon_end is not None
                and (horizon_end - s["last"]).days >= SILENCE_DAYS):
            burner = True
            s_f = min(1.0, s_f + 0.15)

        quality = clamp01(0.5 + s["count"] * 0.05)

        feature = {
            "call_count": s["count"],
            "total_duration_seconds": round(s["total_duration"], 1),
            "max_burst_in_2h": burst,
            "night_call_count": s["night_count"],
            "long_call_count": s["duration_ok"],
            "burner_lifecycle": burner,
        }
        explanation = (
            f"Pair contacted {s['count']} times ({s['total_duration']:.0f}s total). "
            f"Peak burst {burst}/2h, {s['night_count']} night calls."
            + (" Burner-style short-lived burst followed by silence." if burner else "")
        )
        signals.append(Signal(
            case_id=case_id,
            analysis_run_id=analysis_run_id,
            engine_name="communication",
            engine_version="v2.1",
            entity_pair=entity_pair_json(src, tgt),
            family="communication",
            contributing_record_ids=s["records"][:25],
            time_window_start=s["first"],
            time_window_end=s["last"],
            numeric_value=score_round(s_f),
            quality_factor=round(quality, 4),
            feature_details=feature,
            explanation=explanation,
        ))

    return signals