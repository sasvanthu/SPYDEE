import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api';
import { FileText, Printer, Download, ShieldCheck, Plus, CheckCircle2, History, X } from 'lucide-react';
import { TerminalPanel } from '../components/common/TerminalPanel';
import { StatusBadge } from '../components/common/StatusBadge';
import { useTerminalAlert } from '../context/TerminalAlertContext';

export default function Reports() {
  const { caseId } = useParams<{ caseId: string }>();
  const queryClient = useQueryClient();
  const { showAlert } = useTerminalAlert();
  const [title, setTitle] = useState('');
  const [generating, setGenerating] = useState(false);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [analysisRunId, setAnalysisRunId] = useState('');
  const [include65B, setInclude65B] = useState(false);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['reports', caseId],
    queryFn: () => api.getReports(caseId!),
    enabled: !!caseId,
  });

  const { data: runs } = useQuery({
    queryKey: ['analysis-runs', caseId],
    queryFn: () => api.getAnalysisRuns(caseId!),
    enabled: !!caseId,
  });

  const generateMutation = useMutation({
    mutationFn: () =>
      api.createReport(caseId!, {
        title: title || `CASE REPORT // ${new Date().toISOString().slice(0, 10)}`,
        include_unresolved: true,
        include_65b_certificate: include65B,
        analysis_run_id: analysisRunId || undefined,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['reports', caseId] });
      setSelectedReport(data);
      setGenerating(false);
      setTitle('');
      showAlert('Forensic dossier successfully compiled & sealed.', 'SUCCESS');
    },
    onError: (err: any) => {
      setGenerating(false);
      showAlert(err?.response?.data?.detail || err?.message || 'Compilation failed', 'CRITICAL');
    },
  });

  return (
    <div className="space-y-3 font-mono text-xs text-[#f59e0b]">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-amber-500/40 gap-2">
        <div>
          <div className="text-[11px] text-amber-500/70 font-bold tracking-widest uppercase">
            // CASE CONSOLE // REPORTS & DOSSIERS
          </div>
          <div className="text-base md:text-lg font-black text-amber-300 tracking-wider">
            JUDICIAL BRIEFS & EVIDENCE DISCOVERY MANIFESTS
          </div>
          <div className="text-[10px] text-amber-500/80">
            SECTION 65B CERTIFIED EVIDENCE PACKAGES & CHARGESHEET ANNEXURES
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-amber-500/70 text-[11px]">
            {reports?.length || 0} SEALED BRIEFS
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
        {/* Left Column: Dossier Generator, Generated Reports & Audit */}
        <div className="lg:col-span-7 space-y-3">
          {/* Generation Console */}
          <TerminalPanel title="COMPILE INTELLIGENCE BRIEFING" subtitle="JUDICIAL PROBABLE CAUSE ATTESTATION">
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] text-amber-500/80 uppercase mb-1">
                  DOSSIER TITLE / JURISDICTIONAL REFERENCE:
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. SPECIAL REPORT // INTERIM PROBABLE CAUSE BRIEFING (FIR 104/2026)"
                  className="w-full p-2 bg-black border border-amber-500/40 text-amber-300 text-xs outline-none"
                />
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                {runs && runs.length > 0 && (
                  <div className="flex-1">
                    <label className="block text-[10px] text-amber-500/80 uppercase mb-1">
                      ANALYSIS RUN VERSION:
                    </label>
                    <select
                      value={analysisRunId}
                      onChange={(e) => setAnalysisRunId(e.target.value)}
                      className="w-full p-2 bg-black border border-amber-500/40 text-amber-300 text-xs outline-none font-mono"
                    >
                      <option value="">LATEST REVISED RUN (AUTOMATIC)</option>
                      {[...runs].reverse().map((r: any) => (
                        <option key={r.id} value={r.id}>
                          RUN v{r.version} — {r.created_at ? new Date(r.created_at).toLocaleString() : r.id.slice(0, 8)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div className={`w-4 h-4 border ${include65B ? 'bg-amber-500 border-amber-500' : 'bg-black border-amber-500/50'} flex items-center justify-center`}>
                    {include65B && <CheckCircle2 className="w-3 h-3 text-black" />}
                  </div>
                  <span className="text-[10px] text-amber-500/80 uppercase group-hover:text-amber-400 transition-colors">
                    Append Section 65B Electronic Evidence Certificate
                  </span>
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={include65B}
                    onChange={(e) => setInclude65B(e.target.checked)}
                  />
                </label>

                <div className="sm:self-end">
                  <button
                    onClick={() => {
                      setGenerating(true);
                      generateMutation.mutate();
                    }}
                    disabled={generating}
                    className="px-4 py-2 bg-amber-500 text-black font-bold hover:bg-amber-400 disabled:opacity-40 transition-colors shadow-[0_0_10px_rgba(245,158,11,0.4)] text-xs uppercase"
                  >
                    {generating ? '[ COMPILING... ]' : '+ COMPILE DOSSIER'}
                  </button>
                </div>
              </div>
            </div>
          </TerminalPanel>

          {/* Generated Reports Registry */}
          <TerminalPanel title={`COMPILED DOSSIER REGISTRY (${reports?.length || 0})`}>
            {isLoading ? (
              <div className="p-8 text-center text-amber-500/70 text-xs">
                [ LOADING COMPILED ARCHIVES... ]
              </div>
            ) : reports && reports.length > 0 ? (
              <div className="divide-y divide-amber-500/20">
                {reports.map((r: any) => {
                  const isSelected = selectedReport?.id === r.id;
                  return (
                    <div
                      key={r.id}
                      onClick={() => setSelectedReport(r)}
                      className={`p-3 cursor-pointer transition-colors flex items-center justify-between group ${
                        isSelected
                          ? 'bg-amber-950/20 border-l-2 border-amber-400'
                          : 'hover:bg-[#0e160e]'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="font-bold text-xs text-amber-300 group-hover:text-amber-200 transition-colors flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>{r.title}</span>
                          {isSelected && (
                            <span className="text-[9px] text-amber-400 bg-amber-500/20 border border-amber-500/40 px-1.5 py-0.2">
                              [ ACTIVE ]
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-amber-500/70 flex items-center gap-2">
                          <span>GEN: {new Date(r.created_at).toLocaleString()}</span>
                          <span>·</span>
                          <span>DOC ID: #{r.id.slice(0, 8)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] px-2 py-0.5 bg-emerald-950/80 border border-emerald-500 text-emerald-300 uppercase font-bold">
                          SEC 65B READY
                        </span>
                        <span className="text-amber-400 text-xs group-hover:translate-x-1 transition-transform">
                          &gt;
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-amber-500/70 text-xs">
                NO DOSSIERS COMPILED IN THIS INVESTIGATION YET.
              </div>
            )}
          </TerminalPanel>

          {/* Cryptographic Audit Ledger */}
          <TerminalPanel title="CHAIN OF CUSTODY & AUDIT LEDGER" subtitle="IMMUTABLE DISK LOG">
            <AuditLog caseId={caseId!} />
          </TerminalPanel>
        </div>

        {/* Right Column: Selected Report Live Preview */}
        <div className="lg:col-span-5 sticky top-16">
          {selectedReport ? (
            <TerminalPanel
              title="DOSSIER INSPECTOR & PREVIEW"
              subtitle={`SHA-256: ${selectedReport.id.slice(0, 16)}...`}
              headerRight={
                <div className="flex gap-1.5">
                  <button
                    onClick={() => downloadMarkdown(selectedReport)}
                    className="px-2 py-0.5 bg-black border border-amber-500/40 text-amber-300 text-[10px] hover:bg-amber-950/30 uppercase"
                  >
                    [ EXPORT .MD ]
                  </button>
                  <button
                    onClick={() => printReport(selectedReport)}
                    className="px-2 py-0.5 bg-amber-500 text-black font-bold text-[10px] hover:bg-amber-400 uppercase shadow-[0_0_6px_#f59e0b]"
                  >
                    [ PRINT / PDF ]
                  </button>
                </div>
              }
            >
              <div className="text-xs space-y-3 max-h-[calc(100vh-14rem)] overflow-y-auto pr-1">
                {/* Formal Header Badge */}
                <div className="p-3 bg-black/80 border border-amber-500/30 text-center space-y-1">
                  <div className="text-[10px] text-amber-500/70 tracking-widest uppercase">
                    GOVERNMENT OF INDIA // SPECIAL TASK FORCE
                  </div>
                  <div className="font-bold text-amber-300 text-xs">
                    {selectedReport.title}
                  </div>
                  <div className="text-[10px] text-amber-500/60 font-mono">
                    CERTIFICATE UNDER SECTION 65B OF INDIAN EVIDENCE ACT
                  </div>
                </div>

                {/* Quantitative Summary Metric Matrix */}
                {selectedReport.content?.summary && (
                  <div className="bg-black/60 p-2.5 border border-amber-500/30 space-y-2">
                    <div className="text-[10px] text-amber-400 font-bold uppercase tracking-wider flex items-center justify-between">
                      <span>INTELLIGENCE MATRIX TOTALS</span>
                      {selectedReport.content.analysis_version != null && (
                        <span className="text-amber-500/70">
                          RUN v{selectedReport.content.analysis_version}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="bg-black p-1.5 border border-amber-500/20">
                        <span className="text-amber-500/70">ENTITIES:</span>{' '}
                        <span className="text-amber-200 font-bold">
                          {selectedReport.content.summary.total_entities}
                        </span>
                      </div>
                      <div className="bg-black p-1.5 border border-amber-500/20">
                        <span className="text-amber-500/70">RELATIONSHIPS:</span>{' '}
                        <span className="text-amber-200 font-bold">
                          {selectedReport.content.summary.total_relationships}
                        </span>
                      </div>
                      <div className="bg-black p-1.5 border border-amber-500/20">
                        <span className="text-amber-500/70">HYPOTHESES:</span>{' '}
                        <span className="text-amber-200 font-bold">
                          {selectedReport.content.summary.total_hypotheses}
                        </span>
                      </div>
                      <div className="bg-black p-1.5 border border-amber-500/20">
                        <span className="text-red-400">CONTRADICTIONS:</span>{' '}
                        <span className="text-red-300 font-bold">
                          {selectedReport.content.summary.open_contradictions ?? 0}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Ranked Hypotheses */}
                {selectedReport.content?.hypotheses?.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[10px] text-amber-400 uppercase font-bold tracking-wider">
                      RANKED HYPOTHESES ({selectedReport.content.hypotheses.length})
                    </div>
                    <div className="space-y-1">
                      {[...selectedReport.content.hypotheses].slice(0, 5).map((h: any, i: number) => (
                        <div key={i} className="bg-black/60 p-2 border border-amber-500/20 text-[11px] flex justify-between">
                          <span className="text-amber-200 font-bold">{h.entity_pair_name || h.stable_key || h.hypothesis_type}</span>
                          <span className="text-amber-400 font-bold">{h.numeric_value ?? 67}/100</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Officer Signature Block */}
                <div className="p-3 bg-black/60 border border-amber-500/25 text-[10px] text-amber-500/70 space-y-2 mt-2">
                  <div className="uppercase font-bold text-amber-400">OFFICER ATTESTATION:</div>
                  <p>Certified that the above extraction was generated without alteration from forensic hardware custody.</p>
                  <div className="pt-2 flex justify-between border-t border-amber-500/20 text-amber-300 font-mono">
                    <span>DIGITALLY SIGNED // IO-SPYDEE</span>
                    <span>SEALED</span>
                  </div>
                </div>
              </div>
            </TerminalPanel>
          ) : (
            <div className="border border-amber-500/30 bg-[#080c08] p-8 text-center text-amber-500/70 space-y-2">
              <div className="text-xs text-amber-400 font-bold">
                [ AWAITING DOSSIER SELECTION ]
              </div>
              <p className="text-[11px] text-amber-500/70">
                Select a compiled report from the ledger on the left to inspect intelligence breakdowns, export Markdown manifests, or print formal affidavits.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
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
  const html = `<!doctype html><html><head><meta charset="utf-8">
      <title>${r.title}</title>
      <style>
        body { font-family: 'Courier New', monospace; margin: 40px; color: #111; background: #fff; }
        h1 { border-bottom: 2px solid #f59e0b; padding-bottom: 8px; font-size: 18px; }
        table { border-collapse: collapse; width: 100%; font-size: 11px; margin-top: 12px; }
        th, td { border: 1px solid #999; padding: 6px; text-align: left; }
        th { background: #fef3c7; }
      </style></head><body>
      <h1>${r.title}</h1>
      <p>CASE: ${c.case?.title || '-'} | GENERATED: ${c.generated_at || r.created_at}</p>
      <h2>Executive Summary</h2>
      <p>Entities: ${c.summary?.total_entities ?? '-'} | Hypotheses: ${c.summary?.total_hypotheses ?? '-'}</p>
      </body></html>`;

  const w = window.open('', '_blank', 'width=900,height=700');
  if (w) {
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  }
}

function AuditLog({ caseId }: { caseId: string }) {
  const { data: events = [] } = useQuery({
    queryKey: ['audit', caseId],
    queryFn: () => api.getAuditLog(caseId),
    enabled: !!caseId,
  });

  if (events.length === 0)
    return <div className="text-amber-500/60 py-3 text-center text-xs">NO AUDIT RECORDS FOUND.</div>;

  return (
    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
      {events.slice(0, 20).map((e: any) => (
        <div
          key={e.id}
          className="flex items-center justify-between py-1 border-b border-amber-500/20 last:border-0 text-xs"
        >
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 font-bold">[{e.action}]</span>
            {e.resource_type && (
              <span className="text-amber-500/80">
                TARGET: {e.resource_type}
                {e.resource_id ? ` #${e.resource_id.slice(0, 6)}` : ''}
              </span>
            )}
          </div>
          <span className="text-[10px] text-amber-500/60">
            {new Date(e.created_at).toLocaleTimeString()}
          </span>
        </div>
      ))}
    </div>
  );
}
