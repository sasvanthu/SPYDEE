import uuid
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.models import Report, User
from app.auth.auth import get_current_user
from app.schemas.schemas import ReportRequest, ReportResponse
from app.services.case_service import check_case_membership, check_case_write_access, log_audit_event
from app.services.report_service import generate_report

router = APIRouter(prefix="/api/v1/reports", tags=["reports"])


@router.post("/{case_id}", response_model=ReportResponse)
async def create_report(
    case_id: uuid.UUID,
    req: ReportRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await check_case_write_access(db, user, case_id)

    content = await generate_report(
        db, case_id, req.title,
        include_hypotheses=req.include_hypotheses,
        include_unresolved=req.include_unresolved,
        analysis_run_id=req.analysis_run_id,
        generated_by=user.id,
    )

    report = Report(
        case_id=case_id,
        title=req.title,
        content=content,
        format="json",
        analysis_run_id=req.analysis_run_id,
        generated_by=user.id,
    )
    db.add(report)
    await log_audit_event(db, case_id, user.id, "report_generated", "report", None, {"title": req.title})
    await db.commit()
    await db.refresh(report)
    return ReportResponse.model_validate(report)


@router.get("/{case_id}", response_model=list[ReportResponse])
async def list_reports(
    case_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await check_case_membership(db, user.id, case_id)
    result = await db.execute(
        select(Report).where(Report.case_id == case_id).order_by(Report.created_at.desc())
    )
    return [ReportResponse.model_validate(r) for r in result.scalars().all()]


@router.get("/{case_id}/{report_id}", response_model=ReportResponse)
async def get_report(
    case_id: uuid.UUID,
    report_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await check_case_membership(db, user.id, case_id)
    result = await db.execute(
        select(Report).where(Report.id == report_id, Report.case_id == case_id)
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return ReportResponse.model_validate(report)


@router.get("/{case_id}/{report_id}/html")
async def get_report_html(
    case_id: uuid.UUID,
    report_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await check_case_membership(db, user.id, case_id)
    result = await db.execute(
        select(Report).where(Report.id == report_id, Report.case_id == case_id)
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    content = report.content
    html = f"""<!DOCTYPE html>
<html><head><title>{report.title}</title>
<style>
body {{ font-family: Arial, sans-serif; margin: 40px; color: #1a1a2e; }}
h1 {{ color: #0f3460; }}
h2 {{ color: #16213e; border-bottom: 2px solid #e94560; padding-bottom: 5px; }}
table {{ border-collapse: collapse; width: 100%; margin: 10px 0; }}
th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
th {{ background: #f0f0f0; }}
.limited {{ color: #888; font-style: italic; }}
.strong {{ color: #e94560; font-weight: bold; }}
</style></head><body>
<h1>{report.title}</h1>
<p><strong>Case:</strong> {content.get('case', {}).get('title', 'N/A')} ({content.get('case', {}).get('code', '')})</p>
<p><strong>Generated:</strong> {content.get('generated_at', '')}</p>
<p><strong>Synthetic Demo:</strong> {'Yes' if content.get('case', {}).get('is_synthetic') else 'No'}</p>

<h2>Summary</h2>
<ul>
<li>Entities: {content.get('summary', {}).get('total_entities', 0)}</li>
<li>Relationships: {content.get('summary', {}).get('total_relationships', 0)}</li>
<li>Hypotheses: {content.get('summary', {}).get('total_hypotheses', 0)}</li>
</ul>

<h2>Hypotheses</h2>
"""
    for h in content.get("hypotheses", []):
        strength = h.get("numeric_value", 0)
        band = "strong" if strength >= 70 else ("moderate" if strength >= 40 else "limited")
        html += f"""<div style="margin:15px 0;padding:10px;border:1px solid #ddd;border-left:4px solid {'#e94560' if band=='strong' else '#f5a623' if band=='moderate' else '#ccc'};">
<h3>{h.get('hypothesis_type', 'N/A')} — {h.get('notes', '')[:200]}</h3>
<p>Strength: <span class="{band}">{strength}/100</span> | State: {h.get('review_state', 'new')}</p>
<p><strong>Pair:</strong> {h.get('entity_pair', {})}</p>
<p><strong>Signals:</strong> {', '.join(h.get('contributing_signal_highlights', [])) or 'None'}</p>
</div>"""

    html += "<h2>Limitations</h2><ul>"
    for lim in content.get("limitations", []):
        html += f"<li>{lim}</li>"
    html += "</ul>"

    html += "<h2>Review Decisions</h2><ul>"
    for rd in content.get("review_decisions", []):
        html += f"<li>{rd.get('action', '')}: {rd.get('note', '')} ({rd.get('created_at', '')})</li>"
    html += "</ul>"
    html += "</body></html>"

    return HTMLResponse(content=html)
