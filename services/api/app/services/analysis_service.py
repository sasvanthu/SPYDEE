"""Centralised analysis orchestration shared by the API and the worker.

Runs the deterministic intelligence engine registry over a case's source
records, persists signals, fuses them into scored hypotheses with per-signal
linkage, and attaches actionable recommendations.
"""
from typing import List

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import AnalysisRun
from analysis.engines.communication_engine import analyze_communication
from analysis.engines.graph_engine import analyze_graph_structure
from analysis.engines.device_engine import analyze_device_continuity
from analysis.engines.stylo_engine import analyze_stylometry
from analysis.engines.financial_engine import analyze_financial_flows
from analysis.engines.infra_engine import analyze_infrastructure
from analysis.engines.missing_entity_engine import analyze_missing_entities
from analysis.scoring.hypothesis_engine import generate_hypotheses

ENGINE_REGISTRY = [
    ("communication", "v2.1", analyze_communication),
    ("graph_structure", "v2.1", analyze_graph_structure),
    ("device_sim", "v2.0", analyze_device_continuity),
    ("stylometry", "v2.0", analyze_stylometry),
    ("financial", "v2.0", analyze_financial_flows),
    ("infrastructure", "v2.0", analyze_infrastructure),
    ("missing_entity", "v2.0", analyze_missing_entities),
]


async def run_analysis(db: AsyncSession, run: AnalysisRun, records: List) -> dict:
    """Execute all engines, persist signals, and generate hypotheses.

    Deterministic: iteration order is fixed by ENGINE_REGISTRY and engines
    are order-stable given the same input ordering.
    """
    run.status = "running"
    run.started_at = __import__("datetime").datetime.utcnow()

    signals = []
    for name, version, engine in ENGINE_REGISTRY:
        try:
            signals.extend(await engine(db, run.case_id, run.id, records))
        except Exception as exc:  # engine failures must not abort the run
            signals.append(_engine_failure_signal(db, run, name, version, exc))

    for sig in signals:
        db.add(sig)
    await db.flush()

    hypotheses, hyps_signals, recommendations = await generate_hypotheses(
        db, run.case_id, run.id, signals, run.configuration or {}
    )
    for item in hypotheses + hyps_signals + recommendations:
        db.add(item)
    await db.flush()

    run.engine_versions = {
        name: version for name, version, _ in ENGINE_REGISTRY
    }
    run.completed_at = __import__("datetime").datetime.utcnow()
    run.status = "completed"
    await db.flush()

    return {
        "signals": len(signals),
        "hypotheses": len(hypotheses),
        "signal_links": len(hyps_signals),
        "recommendations": len(recommendations),
    }


def _engine_failure_signal(db, run, name, version, exc):
    from app.models.models import Signal
    return Signal(
        case_id=run.case_id,
        analysis_run_id=run.id,
        engine_name=name,
        engine_version=version,
        entity_pair={"source": "system", "target": "system"},
        family="engine_error",
        numeric_value=0.0,
        quality_factor=0.0,
        explanation=f"Engine {name} failed: {type(exc).__name__}: {exc}",
        feature_details={"engine_error": True},
    )