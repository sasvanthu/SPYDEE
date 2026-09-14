"""SPYDEE Financial Flow Engine.

Detects money-mule topologies (fan-in then rapid fan-out), circular transaction
loops, and structuring/smurfing patterns just below reporting thresholds.
"""
import uuid
from collections import defaultdict
from datetime import timedelta
from typing import List

import networkx as nx

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Signal
from analysis.engines._shared import (
    clamp01, score_round, entity_matches, entity_pair_json,
    load_id_entity_map, parse_datetime, simple_cycles_deterministic,
)

FAN_IN_MIN = 3
FAN_OUT_MIN = 3
FAN_OUT_WINDOW_HOURS = 24
STRUCTURING_THRESHOLD = 200_000.0
STRUCTURING_BAND_LO = 0.55


async def analyze_financial_flows(db, case_id, analysis_run_id, records):
    signals: List[Signal] = []
    id_map = await load_id_entity_map(db, case_id)

    flows = defaultdict(lambda: {"count": 0, "amount": 0.0, "amounts": [],
                                 "records": [], "times": []})
    tx_by_src_dst = defaultdict(list)
    for r in records:
        c = r.normalized_content
        if not isinstance(c, dict) or "amount" not in c:
            continue
        src = entity_matches(id_map, "account", c.get("from_account_id") or c.get("from_upi"))
        tgt = entity_matches(id_map, "account", c.get("to_account_id") or c.get("to_upi"))
        if not src or not tgt or src == tgt:
            continue
        amount = float(c.get("amount") or 0.0)
        ts = parse_datetime(c.get("timestamp") or c.get("_observed_at"))
        key = (src, tgt, "TRANSFERRED")
        f = flows[key]
        f["count"] += 1
        f["amount"] += amount
        f["amounts"].append(amount)
        f["records"].append(str(r.id))
        if ts:
            f["times"].append(ts)
        tx_by_src_dst[(src, tgt)].append({"time": ts, "amount": amount, "record": str(r.id)})

    # ── Money-mule topology ──────────────────────────────────────────────────
    incoming = defaultdict(list)
    outgoing = defaultdict(list)
    for (src, tgt), txns in tx_by_src_dst.items():
        incoming[tgt].append((src, txns))
        outgoing[src].append((tgt, txns))

    for dst, in_edges in incoming.items():
        if len(in_edges) < FAN_IN_MIN:
            continue
        for src, txns in in_edges:
            # Does the collector then fan out quickly?
            out_edges = outgoing.get(dst, [])
            if len(out_edges) < FAN_OUT_MIN:
                continue
            out_txns = [t for _, tx2 in out_edges[:FAN_OUT_MIN] for t in tx2]
            immediate = True
            in_times = [t["time"] for t in txns if t["time"]]
            latest_in = max(in_times) if in_times else None
            if latest_in is not None:
                out_times = [t["time"] for t in out_txns if t["time"]]
                if out_times and (min(out_times) - latest_in) > timedelta(hours=FAN_OUT_WINDOW_HOURS):
                    immediate = False
            if not immediate:
                continue
            mule_score = clamp01((len(in_edges) / 5.0) * 0.6 + (len(out_edges) / 5.0) * 0.4)
            record_ids = [t["record"] for t in txns] + [t["record"] for t in out_txns]
            signals.append(Signal(
                case_id=case_id,
                analysis_run_id=analysis_run_id,
                engine_name="financial",
                engine_version="v2.0",
                entity_pair=entity_pair_json(src, dst),
                family="financial",
                contributing_record_ids=record_ids[:25],
                time_window_start=latest_in,
                numeric_value=score_round(mule_score),
                quality_factor=round(clamp01(0.4 + len(in_edges) * 0.1), 4),
                feature_details={
                    "fan_in_senders": len(in_edges),
                    "fan_out_receivers": len(out_edges),
                    "collector": str(dst),
                    "immediate_fan_out": True,
                    "pattern": "money_mule",
                },
                explanation=(
                    f"Account {str(dst)[:8]} received from {len(in_edges)} distinct "
                    f"senders and fanned out to {len(out_edges)} receivers within "
                    f"{FAN_OUT_WINDOW_HOURS}h — money-mule topology."
                ),
            ))

    # ── Circular loops ───────────────────────────────────────────────────────
    account_entities = list({e for (s, t, _) in flows.keys() for e in (s, t)})
    G = nx.DiGraph()
    for node in account_entities:
        G.add_node(node)
    for (s, t, _), f in flows.items():
        G.add_edge(s, t, weight=f["count"])
    cycles = simple_cycles_deterministic(G)
    cycle_keys = set()
    for cyc in cycles:
        nodes = list(cyc)
        for i in range(len(nodes)):
            for j in range(i + 1, len(nodes)):
                a, b = nodes[i], nodes[j]
                key = (min(a, b), max(a, b))
                if key in cycle_keys:
                    continue
                cycle_keys.add(key)
                fwd = flows.get((a, b, "TRANSFERRED"))
                rev = flows.get((b, a, "TRANSFERRED"))
                eff = (fwd["count"] if fwd else 0) + (rev["count"] if rev else 0)
                cycle_score = clamp01(0.5 + len(cycles) * 0.08 + eff / 10.0)
                record_ids = (fwd["records"] if fwd else []) + (rev["records"] if rev else [])
                signals.append(Signal(
                    case_id=case_id,
                    analysis_run_id=analysis_run_id,
                    engine_name="financial",
                    engine_version="v2.0",
                    entity_pair=entity_pair_json(a, b),
                    family="financial",
                    contributing_record_ids=record_ids[:25],
                    numeric_value=score_round(min(1.0, cycle_score)),
                    quality_factor=0.7,
                    feature_details={
                        "pattern": "circular_loop",
                        "cycle_length": len(nodes),
                        "cycle": [str(x) for x in nodes],
                    },
                    explanation=(
                        f"Accounts participate in a {len(nodes)}-hop circular loop "
                        f"(flow without net economic purpose)."
                    ),
                ))

    # ── Structuring / smurfing ──────────────────────────────────────────────
    for (src, tgt), txns in tx_by_src_dst.items():
        band = [t for t in txns
                if t["amount"] and STRUCTURING_THRESHOLD * STRUCTURING_BAND_LO
                <= t["amount"] < STRUCTURING_THRESHOLD]
        if len(band) < 3:
            continue
        struct_score = clamp01(len(band) / 8.0)
        signals.append(Signal(
            case_id=case_id,
            analysis_run_id=analysis_run_id,
            engine_name="financial",
            engine_version="v2.0",
            entity_pair=entity_pair_json(src, tgt),
            family="financial",
            contributing_record_ids=[t["record"] for t in band][:25],
            numeric_value=score_round(struct_score),
            quality_factor=round(clamp01(0.4 + len(band) * 0.1), 4),
            feature_details={
                "pattern": "structuring",
                "band_amounts": [round(t["amount"], 2) for t in band][:10],
                "threshold": STRUCTURING_THRESHOLD,
                "band_count": len(band),
            },
            explanation=(
                f"{len(band)} transfers parked just below the ₹{STRUCTURING_THRESHOLD:,.0f} "
                "reporting threshold between the same accounts — structuring risk."
            ),
        ))

    return signals