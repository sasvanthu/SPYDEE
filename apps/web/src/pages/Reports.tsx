import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api';

export default function Reports() {
  const { caseId } = useParams<{ caseId: string }>();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [generating, setGenerating] = useState(false);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [analysisRunId, setAnalysisRunId] = useState('');

  const { data: reports } = useQuery({
    queryKey: ['reports', caseId],
    queryFn: () => api.getReports(caseId!),
    enabled: !!caseId,
  });

  const { data: hypotheses } = useQuery({
    queryKey: ['hypotheses', caseId],
    queryFn: () => api.getHypotheses(caseId!),
    enabled: !!caseId,
  });

  const { data: runs } = useQuery({
    queryKey: ['analysis-runs', caseId],
    queryFn: () => api.getAnalysisRuns(caseId!),
    enabled: !!caseId,
  });

  const generateMutation = useMutation({
    mutationFn: () => api.createReport(caseId!, {
      title: title || `Report - ${new Date().toLocaleDateString()}`,
      include_unresolved: true,
      analysis_run_id: analysisRunId || undefined,
    }),
    onSuccess: (data) => { queryClient.invalidateQueries({ queryKey: ['reports', caseId] }); setSelectedReport(data); setGenerating(false); },
  });

  return (
    <div className="max-w-6xl mx-auto flex gap-6">
      <div className="flex-1">
        <h1 className="text-2xl font-bold text-navy-700 mb-6">Reports & Audit</h1>

        <div className="bg-white border rounded-lg p-6 mb-6">
          <h2 className="font-semibold text-navy-700 mb-4">Generate Report</h2>
          <div className="flex items-center gap-4">
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Report title..." className="flex-1 px-3 py-2 border rounded-md text-sm" />
            {runs && runs.length > 1 && (
              <select value={analysisRunId} onChange={e => setAnalysisRunId(e.target.value)}
                className="px-3 py-2 border rounded-md text-sm bg-gray-50">
                <option value="">Latest analysis run</option>
                {[...runs].reverse().map((r: any) => (
                  <option key={r.id} value={r.id}>v{r.version} — {r.created_at ? new Date(r.created_at).toLocaleString() : r.id.slice(0, 8)}</option>
                ))}
              </select>
            )}
            <button onClick={() => { setGenerating(true); generateMutation.mutate(); }} disabled={generating}
              className="bg-azure-500 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-azure-600 disabled:opacity-50">
              {generating ? 'Generating...' : 'Generate Report'}
            </button>
          </div>
        </div>

        <div className="bg-white border rounded-lg overflow-hidden mb-6">
          <div className="px-6 py-3 border-b bg-gray-50">
            <h2 className="font-semibold text-navy-700">Generated Reports</h2>
          </div>
          {reports && reports.length > 0 ? (
            <div className="divide-y">
              {reports.map((r: any) => (
                <div key={r.id} onClick={() => setSelectedReport(r)}
                  className={`px-6 py-4 cursor-pointer hover:bg-gray-50 ${selectedReport?.id === r.id ? 'bg-azure-50' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-navy-700 text-sm">{r.title}</div>
                      <div className="text-xs text-navy-400 mt-1">{new Date(r.created_at).toLocaleString()}</div>
                    </div>
                    <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{r.format}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-navy-400 text-sm">No reports generated yet</div>
          )}
        </div>

        <div className="bg-white border rounded-lg overflow-hidden">
          <div className="px-6 py-3 border-b bg-gray-50">
            <h2 className="font-semibold text-navy-700">Audit Log</h2>
          </div>
          <div className="p-6 text-sm text-navy-400">
            <AuditLog caseId={caseId!} />
          </div>
        </div>
      </div>

      {selectedReport && (
        <div className="w-96 bg-white border rounded-lg p-5 h-fit sticky top-16 max-h-[calc(100vh-6rem)] overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-navy-700">Report Preview</h3>
            <div className="flex gap-2">
              <button onClick={() => downloadMarkdown(selectedReport)}
                className="bg-azure-500 text-white px-2 py-1 rounded text-xs hover:bg-azure-600">Export MD</button>
              <button onClick={() => printReport(selectedReport)}
                className="bg-navy-600 text-white px-2 py-1 rounded text-xs hover:bg-navy-700">Print / PDF</button>
            </div>
          </div>
          <div className="text-xs space-y-3">
            <div><span className="text-navy-400">Title:</span> {selectedReport.title}</div>
            <div><span className="text-navy-400">Generated:</span> {new Date(selectedReport.created_at).toLocaleString()}</div>
            {selectedReport.content?.summary && (
              <div className="bg-gray-50 p-3 rounded">
                <div className="font-medium text-navy-700 text-xs mb-1">Summary</div>
                <div className="grid grid-cols-3 gap-x-2 gap-y-1 text-xs text-navy-600">
                  <div>Entities: {selectedReport.content.summary.total_entities}</div>
                  <div>Relations: {selectedReport.content.summary.total_relationships}</div>
                  <div>Hypotheses: {selectedReport.content.summary.total_hypotheses}</div>
                  <div>Signals: {selectedReport.content.summary.total_signals ?? '-'}</div>
                  <div>Evidence files: {selectedReport.content.summary.total_evidence_files}</div>
                  <div>Source records: {selectedReport.content.summary.total_source_records}</div>
                  <div>Open contradictions: {selectedReport.content.summary.open_contradictions ?? 0}</div>
                  <div>Open leads: {selectedReport.content.summary.open_leads ?? 0}</div>
                  <div>Open gaps: {selectedReport.content.summary.open_gaps ?? 0}</div>
                  <div>Pending actions: {selectedReport.content.summary.open_actions ?? 0}</div>
                </div>
                {selectedReport.content.analysis_version != null && (
                  <div className="text-[11px] text-navy-400 mt-2">Analysis run: v{selectedReport.content.analysis_version}{selectedReport.content.analysis_run_id ? ` (${selectedReport.content.analysis_run_id.slice(0, 8)})` : ''}</div>
                )}
              </div>
            )}

            {selectedReport.content?.evidence?.length > 0 && (
              <div className="mt-2">
                <strong className="text-xs">Evidence ({selectedReport.content.evidence.length})</strong>
                {selectedReport.content.evidence.slice(0, 8).map((e: any) => (
                  <div key={e.id} className="text-[11px] bg-gray-50 p-2 rounded mt-1 text-navy-600">
                    <span className="font-medium">{e.filename}</span>
                    <span className="ml-2 text-navy-400">{e.source_type}</span>
                    <span className={`ml-2 px-1 rounded ${e.status === 'failed' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>{e.status}</span>
                    <span className="ml-2 text-navy-400">{e.accepted_count} accepted</span>
                  </div>
                ))}
              </div>
            )}

            {selectedReport.content?.contradictions?.length > 0 && (
              <div className="mt-2">
                <strong className="text-xs">Contradictions ({selectedReport.content.contradictions.length})</strong>
                {selectedReport.content.contradictions.map((c: any) => (
                  <div key={c.id} className="text-[11px] bg-orange-50 border border-orange-200 p-2 rounded mt-1 text-navy-600">
                    <span className="font-medium">{c.title}</span>
                    <span className={`ml-2 px-1 rounded ${c.status === 'resolved' ? 'bg-green-100 text-green-600' : c.status === 'dismissed' ? 'bg-gray-100 text-gray-500' : 'bg-orange-100 text-orange-600'}`}>{c.status}</span>
                    {c.explanation && <div className="text-[10px] text-navy-400 mt-1">{c.explanation}</div>}
                  </div>
                ))}
              </div>
            )}

            {selectedReport.content?.leads?.length > 0 && (
              <div className="mt-2">
                <strong className="text-xs">Leads ({selectedReport.content.leads.length})</strong>
                {selectedReport.content.leads.map((l: any) => (
                  <div key={l.id} className="text-[11px] bg-blue-50 border border-blue-200 p-2 rounded mt-1 text-navy-600">
                    <span className="font-medium">{l.title}</span>
                    <span className={`ml-2 px-1 rounded ${
                      l.priority === 'critical' ? 'bg-red-100 text-red-600' :
                      l.priority === 'high' ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-600'
                    }`}>{l.priority}</span>
                    <span className={`ml-2 text-navy-400`}>{l.status}</span>
                  </div>
                ))}
              </div>
            )}

            {selectedReport.content?.information_gaps?.length > 0 && (
              <div className="mt-2">
                <strong className="text-xs">Information Gaps ({selectedReport.content.information_gaps.length})</strong>
                {selectedReport.content.information_gaps.map((g: any) => (
                  <div key={g.id} className="text-[11px] bg-purple-50 border border-purple-200 p-2 rounded mt-1 text-navy-600">
                    <span className="font-medium">{g.title}</span>
                    <span className={`ml-2 px-1 rounded ${g.status === 'addressed' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'}`}>{g.status}</span>
                  </div>
                ))}
              </div>
            )}

            {selectedReport.content?.actions?.length > 0 && (
              <div className="mt-2">
                <strong className="text-xs">Investigation Actions ({selectedReport.content.actions.length})</strong>
                {selectedReport.content.actions.map((a: any) => (
                  <div key={a.id} className="text-[11px] bg-teal-50 border border-teal-200 p-2 rounded mt-1 text-navy-600">
                    <span className="font-medium">{a.title}</span>
                    <span className={`ml-2 px-1 rounded ${
                      a.status === 'completed' ? 'bg-green-100 text-green-600' :
                      a.status === 'failed' ? 'bg-red-100 text-red-600' :
                      a.status === 'in_progress' ? 'bg-blue-100 text-blue-600' :
                      'bg-gray-100 text-gray-600'
                    }`}>{a.status}</span>
                    {a.proposed_step && <div className="text-[10px] text-navy-400 mt-1">{a.proposed_step}</div>}
                  </div>
                ))}
              </div>
            )}

            {selectedReport.content?.hypotheses?.length > 0 && (
              <div className="mt-2">
                <strong className="text-xs">Hypotheses ({selectedReport.content.hypotheses.length})</strong>
                <div className="mt-1 space-y-1">
                  {[...selectedReport.content.hypotheses]
                    .sort((a: any, b: any) => (b.numeric_value || 0) - (a.numeric_value || 0))
                    .slice(0, 12)
                    .map((h: any, i: number) => (
                      <div key={h.id || i} className="flex items-center gap-2">
                        <span className="w-8 text-navy-400 flex-shrink-0">{h.numeric_value ?? 0}</span>
                        <div className="flex-1 bg-gray-100 rounded h-4 relative overflow-hidden">
                          <div className={`h-full ${stateColor(h.review_state || h.state)}`}
                            style={{ width: `${Math.max(2, h.numeric_value || 0)}%` }} />
                        </div>
                        <span className="w-14 text-right text-navy-400 flex-shrink-0">{h.review_state || 'pending'}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
            {selectedReport.content?.review_decisions?.length > 0 && (
              <div>
                <strong>Review Decisions:</strong>
                <ul className="text-navy-400 mt-1 space-y-1">
                  {selectedReport.content.review_decisions.map((r: any, i: number) => (
                    <li key={i}>• {r.action}{r.note ? ` — ${r.note}` : ''}</li>
                  ))}
                </ul>
              </div>
            )}
            {selectedReport.content?.limitations && (
              <div>
                <strong>Limitations:</strong>
                <ul className="text-navy-400 mt-1 space-y-1">
                  {selectedReport.content.limitations.map((l: string, i: number) => <li key={i}>• {l}</li>)}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function stateColor(state?: string): string {
  const s = (state || '').toLowerCase();
  if (s.includes('accept') || s === 'confirmed') return 'bg-green-500';
  if (s.includes('reject') || s === 'refuted') return 'bg-red-500';
  if (s.includes('flag')) return 'bg-amber-500';
  return 'bg-navy-300';
}

function markdownFromReport(r: any): string {
  const c = r.content || {};
  const lines: string[] = [];
  lines.push(`# ${c.case?.title || r.title}`);
  lines.push('');
  lines.push(`- Case code: ${c.case?.code || '-'}`);
  lines.push(`- Status: ${c.case?.status || '-'}`);
  lines.push(`- Generated: ${c.generated_at || r.created_at}`);
  lines.push(`- Analysis version: ${c.analysis_version ?? '-'}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Entities: ${c.summary?.total_entities ?? '-'}`);
  lines.push(`- Relationships: ${c.summary?.total_relationships ?? '-'}`);
  lines.push(`- Hypotheses: ${c.summary?.total_hypotheses ?? '-'}`);
  lines.push('');
  lines.push('## Hypotheses (ranked by strength)');
  lines.push('');
  [...(c.hypotheses || [])]
    .sort((a: any, b: any) => (b.numeric_value || 0) - (a.numeric_value || 0))
    .forEach((h: any, i: number) => {
      const name = h.entity_pair_name || h.stable_key || h.hypothesis_type || 'Unknown';
      lines.push(`### ${i + 1}. ${name}`);
      lines.push(`- Strength: ${h.numeric_value}/100`);
      lines.push(`- Type: ${h.hypothesis_type || '-'}`);
      lines.push(`- Review: ${h.review_state || h.state || 'pending'}`);
      if (h.notes) lines.push(`- Notes: ${h.notes}`);
      if (h.contributing_signal_highlights?.length) {
        lines.push(`- Key signals: ${h.contributing_signal_highlights.join('; ')}`);
      }
      lines.push('');
    });
  if (c.review_decisions?.length) {
    lines.push('## Review Decisions');
    lines.push('');
    c.review_decisions.forEach((rv: any) => {
      lines.push(`- **${rv.action}** ${rv.note ? `— ${rv.note}` : ''} (${rv.created_at})`);
    });
    lines.push('');
  }
  lines.push('## Limitations');
  lines.push('');
  (c.limitations || []).forEach((l: string) => lines.push(`- ${l}`));
  lines.push('');
  lines.push('---');
  lines.push('*Generated with the SPYDEE intelligence platform. Findings are evidence-strength indices, not proof.*');
  return lines.join('\n');
}

function downloadMarkdown(r: any) {
  const md = markdownFromReport(r);
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(r.title || 'report').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function printReport(r: any) {
  const c = r.content || {};
  const esc = (s: any) => String(s ?? '').replace(/[&<>"]/g, (ch) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as Record<string, string>)[ch]);
  const hyps = [...(c.hypotheses || [])]
    .sort((a: any, b: any) => (b.numeric_value || 0) - (a.numeric_value || 0))
    .map((h: any, i: number) =>
      `<tr>
        <td>${i + 1}</td>
        <td><strong>${esc(h.entity_pair_name || h.stable_key || h.hypothesis_type || '-')}</strong><br>
        <span class="muted">Type: ${esc(h.hypothesis_type || '-')}</span></td>
        <td class="num">${h.numeric_value ?? '-'}/100</td>
        <td>${esc(h.review_state || h.state || 'pending')}</td>
        <td class="muted">${esc(h.notes || '')}</td>
      </tr>`).join('');
  const reviews = (c.review_decisions || [])
    .map((rv: any) => `<li><strong>${esc(rv.action)}</strong> ${rv.note ? `— ${esc(rv.note)}` : ''} <span class="muted">(${esc(rv.created_at)})</span></li>`)
    .join('');
  const limitations = (c.limitations || [])
    .map((l: string) => `<li>${esc(l)}</li>`)
    .join('');

  const html = `<!doctype html><html><head><meta charset="utf-8">
      <title>${esc(r.title)}</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 40px; color: #1a1a2e; }
        h1 { color: #16213e; border-bottom: 3px solid #2a9d8f; padding-bottom: 8px; }
        h2 { color: #16213e; margin-top: 28px; }
        table { border-collapse: collapse; width: 100%; font-size: 12px; margin-top: 12px; }
        th, td { border: 1px solid #d0d5e0; padding: 8px; text-align: left; vertical-align: top; }
        th { background: #f1f5f9; }
        .num { font-weight: 600; white-space: nowrap; }
        .muted { color: #64748b; font-size: 11px; }
        ul { margin-top: 6px; }
        .footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #d0d5e0; color: #64748b; font-size: 11px; }
        @media print { body { margin: 16mm; } }
      </style></head><body>
      <h1>${esc(r.title)}</h1>
      <p class="muted">
        Case: ${esc(c.case?.title || '-')} (${esc(c.case?.code || '-')}) &middot;
        Status: ${esc(c.case?.status || '-')} &middot;
        Generated: ${esc(c.generated_at || r.created_at)} &middot;
        Analysis version: ${esc(c.analysis_version ?? '-')}
      </p>
      <h2>Summary</h2>
      <p>Entities: <strong>${c.summary?.total_entities ?? '-'}</strong> &middot;
        Relationships: <strong>${c.summary?.total_relationships ?? '-'}</strong> &middot;
        Hypotheses: <strong>${c.summary?.total_hypotheses ?? '-'}</strong></p>
      <h2>Hypotheses (ranked by strength)</h2>
      <table>
        <thead><tr><th>#</th><th>Hypothesis</th><th>Strength</th><th>Review</th><th>Notes</th></tr></thead>
        <tbody>${hyps || '<tr><td colspan="5" class="muted">No hypotheses.</td></tr>'}</tbody>
      </table>
      ${reviews ? `<h2>Review Decisions</h2><ul>${reviews}</ul>` : ''}
      <h2>Limitations</h2><ul>${limitations || '<li>None recorded.</li>'}</ul>
      <div class="footer">Generated with the SPYDEE intelligence platform. Findings are evidence-strength indices, not proof.</div>
      </body></html>`;

  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) { alert('Pop-up blocked. Allow pop-ups to print the report.'); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 250);
}

function AuditLog({ caseId }: { caseId: string }) {
  const { data: events } = useQuery({
    queryKey: ['audit', caseId],
    queryFn: () => api.getAuditLog(caseId),
    enabled: !!caseId,
  });

  if (!events || events.length === 0) return <div>No audit events yet</div>;

  return (
    <div className="space-y-2">
      {events.slice(0, 20).map((e: any) => (
        <div key={e.id} className="flex items-center justify-between py-2 border-b last:border-0">
          <div>
            <span className="font-medium">{e.action}</span>
            {e.resource_type && <span className="text-navy-400 ml-2">({e.resource_type})</span>}
          </div>
          <span className="text-navy-400">{new Date(e.created_at).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}
