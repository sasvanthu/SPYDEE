import html as html_lib
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


def _esc(value) -> str:
    return html_lib.escape(str(value))


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
<html><head><title>{_esc(report.title)}</title>
<style>
body {{ font-family: Arial, sans-serif; margin: 40px; color: #1a1a2e; }}
h1 {{ color: #0f3460; }}
h2 {{ color: #16213e; border-bottom: 2px solid #e94560; padding-bottom: 5px; }}
table {{ border-collapse: collapse; width: 100%; margin: 10px 0; }}
th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; vertical-align: top; }}
th {{ background: #f0f0f0; }}
.limited {{ color: #888; font-style: italic; }}
.strong {{ color: #e94560; font-weight: bold; }}
.muted {{ color: #666; font-size: 0.9em; }}
</style></head><body>
<h1>{_esc(report.title)}</h1>
<p><strong>Case:</strong> {_esc(content.get('case', {}).get('title', 'N/A'))} ({_esc(content.get('case', {}).get('code', ''))})</p>
<p><strong>Generated:</strong> {_esc(content.get('generated_at', ''))}</p>
<p><strong>Analysis version:</strong> {_esc(content.get('analysis_version', 'n/a'))} <span class="muted">(run {_esc(content.get('analysis_run_id', 'n/a'))})</span></p>
<p><strong>Synthetic Demo:</strong> {'Yes' if content.get('case', {}).get('is_synthetic') else 'No'}</p>

<h2>Summary</h2>
<ul>
<li>Entities: {content.get('summary', {}).get('total_entities', 0)}</li>
<li>Relationships: {content.get('summary', {}).get('total_relationships', 0)}</li>
<li>Hypotheses: {content.get('summary', {}).get('total_hypotheses', 0)}</li>
<li>Evidence files: {content.get('summary', {}).get('total_evidence_files', 0)} / source records: {content.get('summary', {}).get('total_source_records', 0)}</li>
<li>Open contradictions: {content.get('summary', {}).get('open_contradictions', 0)} | Open leads: {content.get('summary', {}).get('open_leads', 0)} | Open gaps: {content.get('summary', {}).get('open_gaps', 0)} | Open actions: {content.get('summary', {}).get('open_actions', 0)}</li>
</ul>

<h2>Evidence Reviewed</h2>
"""
    if content.get("evidence"):
        html += '<table><tr><th>File</th><th>Source</th><th>Status</th><th>Accepted</th><th>Rejected</th><th>Uploaded</th><th>SHA-256</th></tr>'
        for e in content.get("evidence", []):
            html += (
                f"<tr><td>{_esc(e.get('filename'))}</td><td>{_esc(e.get('source_type'))}</td>"
                f"<td>{_esc(e.get('status'))}</td><td>{e.get('accepted_count', 0)}</td><td>{e.get('rejected_count', 0)}</td>"
                f"<td>{_esc(e.get('uploaded_at', ''))}</td><td class='muted'>{_esc(e.get('sha256', ''))[:16]}</td></tr>"
            )
        html += "</table>"
    else:
        html += "<p class='limited'>No evidence files.</p>"

    html += "<h2>Hypotheses</h2>\n"
    for h in content.get("hypotheses", []):
        strength = h.get("numeric_value", 0)
        band = "strong" if strength >= 70 else ("moderate" if strength >= 40 else "limited")
        html += f"""<div style="margin:15px 0;padding:10px;border:1px solid #ddd;border-left:4px solid {'#e94560' if band=='strong' else '#f5a623' if band=='moderate' else '#ccc'};">
<h3>{_esc(h.get('hypothesis_type', 'N/A'))} — {_esc(h.get('notes', ''))[:200]}</h3>
<p>Strength: <span class="{band}">{strength}/100</span> | State: {_esc(h.get('review_state', 'new'))} | Run: {_esc(h.get('analysis_run_id', 'n/a'))}</p>
<p><strong>Pair:</strong> {_esc(h.get('entity_pair', {}))}</p>
<p><strong>Signals:</strong> {_esc(', '.join(h.get('contributing_signal_highlights', [])) or 'None')}</p>
</div>"""

    if content.get("contradictions"):
        html += "<h2>Contradictions</h2>"
        for c in content.get("contradictions", []):
            html += (
                f"<div style='margin:10px 0;padding:8px;border:1px solid #e9456066;border-left:4px solid #e94560;'>"
                f"<strong>{_esc(c.get('title'))}</strong> <span class='muted'>({_esc(c.get('status'))}, {_esc(c.get('detection_method'))})</span><br/>"
            )
            for st in c.get("statements", []):
                text = st.get("text") if isinstance(st, dict) else str(st)
                src = (st.get("source_ref") or {}) if isinstance(st, dict) else {}
                evidence_id = (src or {}).get("evidence_id", "") if isinstance(src, dict) else ""
                locator = (src or {}).get("locator", "") if isinstance(src, dict) else ""
                html += f"<div class='muted'>• {_esc(text)} <em>(evidence {_esc(evidence_id or 'n/a')} {_esc(locator or '')})</em></div>"
            if c.get("explanation"):
                html += f"<div class='muted'><em>Why conflicting:</em> {_esc(c.get('explanation'))}</div>"
            html += "</div>"

    if content.get("leads"):
        html += "<h2>Open Leads</h2><table><tr><th>Lead</th><th>Priority</th><th>Status</th><th>Origin</th></tr>"
        for l in content.get("leads", []):
            html += (
                f"<tr><td><strong>{_esc(l.get('title'))}</strong><br/><span class='muted'>{_esc(l.get('description', ''))}</span></td>"
                f"<td>{_esc(l.get('priority'))}</td><td>{_esc(l.get('status'))}</td><td>{_esc(l.get('origin_type'))}</td></tr>"
            )
        html += "</table>"

    if content.get("information_gaps"):
        html += "<h2>Information Gaps</h2><table><tr><th>Gap</th><th>Status</th><th>Lead</th></tr>"
        for g in content.get("information_gaps", []):
            html += (
                f"<tr><td><strong>{_esc(g.get('title'))}</strong><br/><span class='muted'>{_esc(g.get('description', ''))}</span></td>"
                f"<td>{_esc(g.get('status'))}</td><td>{_esc(g.get('lead_id') or 'n/a')}</td></tr>"
            )
        html += "</table>"

    if content.get("actions"):
        html += "<h2>Proposed Actions</h2><table><tr><th>Action</th><th>Status</th><th>Proposed step</th><th>Expected information</th></tr>"
        for a in content.get("actions", []):
            html += (
                f"<tr><td><strong>{_esc(a.get('title'))}</strong></td><td>{_esc(a.get('status'))}</td>"
                f"<td>{_esc(a.get('proposed_step', ''))}</td><td>{_esc(a.get('expected_information', ''))}</td></tr>"
            )
        html += "</table>"

    html += "<h2>Limitations</h2><ul>"
    for lim in content.get("limitations", []):
        html += f"<li>{_esc(lim)}</li>"
    html += "</ul>"

    html += "<h2>Review Decisions</h2><ul>"
    for rd in content.get("review_decisions", []):
        html += f"<li>{_esc(rd.get('action', ''))}: {_esc(rd.get('note', ''))} ({_esc(rd.get('created_at', ''))})</li>"
    html += "</ul>"
    html += "</body></html>"

    return HTMLResponse(content=html)
