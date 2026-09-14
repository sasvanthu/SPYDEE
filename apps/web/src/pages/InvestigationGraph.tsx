import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useRef, useCallback } from 'react';
import cytoscape from 'cytoscape';
import { api } from '../lib/api';

const typeColors: Record<string, string> = {
  person: '#22d3ee', alias: '#22d3ee', phone_sim: '#06b6d4', device: '#f59e0b',
  account: '#22c55e', location: '#8b5cf6', organization: '#ec4899', domain_ip: '#64748b',
  event: '#f97316', document: '#6366f1',
};

export default function InvestigationGraph() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const cyRef = useRef<HTMLDivElement>(null);
  const cyInstance = useRef<cytoscape.Core | null>(null);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [selectedEdge, setSelectedEdge] = useState<any>(null);
  const [filters, setFilters] = useState<any>({ include_inferred: true, max_nodes: 300, max_edges: 1500 });
  const [nodeDetail, setNodeDetail] = useState<any>(null);
  const [edgeDetail, setEdgeDetail] = useState<any>(null);
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set());

  const { data: graphData, isLoading, refetch } = useQuery({
    queryKey: ['graph', caseId, filters],
    queryFn: () => api.getGraph(caseId!, filters),
    enabled: !!caseId,
  });

  const edgeRange = useCallback(() => {
    let min: number | null = null;
    let max: number | null = null;
    (graphData?.edges || []).forEach((e: any) => {
      ['valid_from', 'valid_to'].forEach((k) => {
        const v = e.properties?.[k];
        if (!v) return;
        const t = new Date(v).getTime();
        if (Number.isNaN(t)) return;
        if (min === null || t < min) min = t;
        if (max === null || t > max) max = t;
      });
    });
    return { min: min !== null ? new Date(min).toISOString() : undefined, max: max !== null ? new Date(max).toISOString() : undefined };
  }, [graphData]);

  const applyDates = (from?: string, to?: string) => {
    setDateFrom(from || '');
    setDateTo(to || '');
    setFilters((f: any) => ({
      ...f,
      date_from: from ? new Date(from).toISOString() : undefined,
      date_to: to ? new Date(to).toISOString() : undefined,
    }));
  };

  const applyPreset = (hours: number | null) => {
    if (hours === null) { applyDates(undefined, undefined); return; }
    const range = edgeRange();
    if (!range.max) return;
    const to = new Date(range.max);
    applyDates(new Date(to.getTime() - hours * 3600 * 1000).toISOString(), to.toISOString());
  };

  const range = edgeRange();

  // Search: find matching nodes and highlight them
  const searchResults = useQuery({
    queryKey: ['entities', caseId, searchTerm],
    queryFn: () => api.getEntities(caseId!, undefined, searchTerm || undefined),
    enabled: !!caseId && searchTerm.trim().length > 0,
  });

  const runSearch = (name: string) => {
    const results = searchResults.data || [];
    if (name === '') { setHighlightIds(new Set()); return; }
    const ids = results.map((e: any) => e.id);
    setHighlightIds(new Set(ids));
    if (results.length > 0) {
      cyInstance.current?.nodes().forEach((n) => {
        if (ids.includes(n.id())) n.addClass('highlighted');
        else n.removeClass('highlighted');
      });
      if (results[0]?.id) {
        cyInstance.current?.animate({ fit: { eles: cyInstance.current!.elements(`#${CSS.escape(results[0].id)}`) as any, padding: 80 }, duration: 400 });
      }
    }
  };

  useEffect(() => {
    if (!cyRef.current) return;
    cyInstance.current = cytoscape({
      container: cyRef.current as unknown as HTMLElement,
      styleEnabled: true,
      style: [
        { selector: 'node', style: { 'background-color': '#22d3ee', label: 'data(label)', 'font-size': '10px', color: '#e2e8f0', 'text-valign': 'bottom', 'text-margin-y': 5, 'text-wrap': 'ellipsis', 'text-max-width': '120px' } },
        ...Object.entries(typeColors).map(([type, color]) => ({
          selector: `node.${type}`, style: { 'background-color': color },
        })),
        { selector: 'edge.observed', style: { 'line-color': '#64748b', width: 1.5, 'target-arrow-color': '#64748b', 'target-arrow-shape': 'triangle', 'curve-style': 'bezier' } },
        { selector: 'edge.inferred', style: { 'line-color': '#f59e0b', width: 1.5, 'line-style': 'dashed', 'target-arrow-color': '#f59e0b', 'target-arrow-shape': 'triangle', 'curve-style': 'bezier' } },
        { selector: 'node.highlighted', style: { 'border-width': 3, 'border-color': '#facc15' } },
        { selector: 'node:selected', style: { 'border-width': 3, 'border-color': '#22d3ee' } },
        { selector: 'edge:selected', style: { 'line-color': '#22d3ee', 'width': 3 } },
      ],
      layout: { name: 'cose', animate: false, nodeDimensionsIncludeLabels: true, idealEdgeLength: 120, padding: 40 },
      minZoom: 0.2,
      maxZoom: 3,
    });
    return () => { cyInstance.current?.destroy(); cyInstance.current = null; };
  }, []);

  useEffect(() => {
    if (!cyInstance.current || !graphData) return;
    const cy = cyInstance.current!;
    const elements: cytoscape.ElementDefinition[] = [];
    graphData.nodes.forEach((n: any) => {
      elements.push({
        data: { id: n.id, label: n.label, entity_type: n.entity_type, review_state: n.review_state },
        classes: n.entity_type,
      });
    });
    graphData.edges.forEach((e: any) => {
      elements.push({
        data: { id: e.id, source: e.source, target: e.target, label: e.label, classification: e.classification, relationship_type: e.relationship_type, props: e.properties },
        classes: e.classification === 'inferred' ? 'inferred' : 'observed',
      });
    });
    cy.elements().remove();
    cy.add(elements);
    cy.elements().unselect();
    cy.layout({ name: 'cose', animate: false, nodeDimensionsIncludeLabels: true, idealEdgeLength: 120, padding: 40 }).run();
    cy.elements().forEach((ele) => { ele.removeClass('highlighted'); });
  }, [graphData]);

  useEffect(() => {
    if (!cyInstance.current) return;
    const cy = cyInstance.current!;
    const onNodeTap = (evt: any) => {
      const node = evt.target;
      setSelectedEdge(null);
      setEdgeDetail(null);
      setSelectedNode(node.data());
      api.getNeighbourhood(caseId!, node.data('id'), 1).then((detail) => setNodeDetail(detail));
    };
    const onEdgeTap = async (evt: any) => {
      const edge = evt.target;
      setSelectedNode(null);
      setNodeDetail(null);
      setSelectedEdge(edge.data());
      const evidence = await api.getRelEvidence(caseId!, edge.data('id')).catch(() => ({ evidence: [] }));
      setEdgeDetail({ ...edge.data(), evidence: evidence.evidence || [] });
    };
    const onBgrTap = (evt: any) => {
      if (evt.target === cy) { setSelectedNode(null); setSelectedEdge(null); setNodeDetail(null); setEdgeDetail(null); }
    };
    cy.on('tap', 'node', onNodeTap);
    cy.on('tap', 'edge', onEdgeTap);
    cy.on('tap', onBgrTap);
    return () => { cy.removeListener('tap'); };
  }, [caseId]);

  const typeOptions = ['person', 'alias', 'phone_sim', 'device', 'account', 'location', 'organization', 'domain_ip'];

  return (
    <div className="h-[calc(100vh-9rem)] flex flex-col min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h1 className="text-xl font-bold text-white">Investigation Graph</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); runSearch(e.target.value); }}
              onKeyDown={(e) => { if (e.key === 'Enter') runSearch(searchTerm); }}
              placeholder="Search entity name / ID..."
              className="px-3 py-1.5 border rounded text-sm bg-gray-800 text-gray-100 border-gray-700 placeholder-gray-500 w-56 focus:ring-2 focus:ring-azure-500 outline-none"
            />
          </div>
          <select
            onChange={e => setFilters({ ...filters, entity_types: e.target.value ? [e.target.value] : undefined })}
            className="px-3 py-1.5 border rounded text-sm bg-gray-800 text-gray-100 border-gray-700"
          >
            <option value="">All entity types</option>
            {typeOptions.map(t => <option key={t} value={t}>{t.replace('_', '/')}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input type="checkbox" checked={filters.include_inferred}
              onChange={e => setFilters({ ...filters, include_inferred: e.target.checked })} className="rounded" />
            Inferred
          </label>
          <button onClick={() => refetch()} className="bg-azure-500 text-white px-3 py-1.5 rounded text-sm hover:bg-azure-600">Refresh</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 px-3 py-2 bg-gray-800/80 border border-gray-700 rounded-lg mb-3">
        <span className="text-xs font-semibold text-gray-300">Time scope</span>
        <input type="datetime-local" value={dateFrom ? toLocalInput(dateFrom) : ''}
          onChange={e => applyDates(e.target.value ? new Date(e.target.value).toISOString() : undefined, dateTo || undefined)}
          className="px-2 py-1 border rounded text-xs bg-gray-800 border-gray-700 text-gray-100" />
        <span className="text-gray-500 text-xs">→</span>
        <input type="datetime-local" value={dateTo ? toLocalInput(dateTo) : ''}
          onChange={e => applyDates(dateFrom || undefined, e.target.value ? new Date(e.target.value).toISOString() : undefined)}
          className="px-2 py-1 border rounded text-xs bg-gray-800 border-gray-700 text-gray-100" />
        <div className="flex gap-1">
          {[24, 24 * 7, 24 * 30].map(h => (
            <button key={h} onClick={() => applyPreset(h)}
              className="px-2 py-1 rounded text-xs border border-gray-700 hover:bg-gray-700 text-gray-300">
              {h === 24 ? '24h' : h === 24 * 7 ? '7d' : '30d'}
            </button>
          ))}
          <button onClick={() => applyPreset(null)} className="px-2 py-1 rounded text-xs border border-gray-700 hover:bg-gray-700 text-gray-300">All</button>
        </div>
        <span className="text-xs text-gray-400 ml-auto">
          {dateFrom ? (
            `${new Date(dateFrom).toLocaleString()} – ${dateTo ? new Date(dateTo).toLocaleString() : 'now'}`
          ) : (
            range.min ? `Data spans ${new Date(range.min).toLocaleString()} – ${new Date(range.max!).toLocaleString()}` : 'No time-aware edges'
          )}
        </span>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        <div className="flex-1 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden relative min-w-0">
          {isLoading && <div className="absolute inset-0 bg-gray-900/80 flex items-center justify-center z-10 text-gray-300">Loading graph...</div>}
          <div ref={cyRef} className="w-full h-full" />
          {graphData && (
            <div className="absolute bottom-3 left-3 bg-gray-900/90 border border-gray-700 rounded px-3 py-2 text-xs text-gray-300">
              Nodes: {graphData.total_nodes} | Edges: {graphData.total_edges}
              {graphData.truncated && <span className="text-amber-500 ml-2">(truncated)</span>}
            </div>
          )}
          <div className="absolute top-3 right-3 bg-gray-900/90 border border-gray-700 rounded px-3 py-2 text-xs text-gray-300 space-y-1">
            <div className="font-semibold text-gray-400 mb-1">Legend</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-cyan-400 inline-block"></span> Person / Alias</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-amber-500 inline-block"></span> Device</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-500 inline-block"></span> Account</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block"></span> Phone / SIM</div>
            <div className="border-t border-gray-700 pt-1 mt-1">
              <div className="flex items-center gap-2"><span className="w-4 h-0.5 bg-gray-400 inline-block"></span> Observed (direct)</div>
              <div className="flex items-center gap-2"><span className="w-4 h-0.5 bg-amber-500 inline-block border-dashed"></span> Inferred</div>
            </div>
          </div>
        </div>

        {(selectedNode || selectedEdge) && (
          <div className="w-96 bg-gray-800 border border-gray-700 rounded-lg p-4 h-fit sticky top-0 max-h-[calc(100vh-10rem)] overflow-y-auto sidebar-drawer">
            {selectedNode && (
              <>
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-gray-100">{selectedNode.label}</h3>
                  <button onClick={() => { setSelectedNode(null); setNodeDetail(null); }}
                    className="text-gray-500 hover:text-gray-300 text-sm px-1" aria-label="Close">✕</button>
                </div>
                <div className="text-sm space-y-1 mb-3 text-gray-400">
                  <div><span className="text-gray-500">Type:</span> {selectedNode.entity_type}</div>
                  <div><span className="text-gray-500">State:</span> {selectedNode.review_state}</div>
                </div>
                {nodeDetail && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-sm text-gray-300">Connections ({nodeDetail.edges?.length || 0})</h4>
                      <button
                        onClick={() => navigate(`/cases/${caseId}/timeline`)}
                        className="text-xs text-azure-400 hover:underline">Timeline</button>
                    </div>
                    <div className="space-y-1 max-h-60 overflow-y-auto">
                      {nodeDetail.edges && nodeDetail.edges.length > 0 ? nodeDetail.edges.slice(0, 20).map((e: any, i: number) => (
                        <div key={i} className="text-xs bg-gray-700/50 p-2 rounded text-gray-300 flex items-center justify-between">
                          <span className="truncate">{e.relationship_type || e.label || 'connected'}</span>
                          <span className={`ml-2 shrink-0 ${e.classification === 'inferred' ? 'text-amber-400' : 'text-gray-500'}`}>
                            {e.classification || 'observed'}
                          </span>
                        </div>
                      )) : (
                        <div className="text-xs text-gray-500">No direct connections</div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
            {selectedEdge && (
              <>
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-gray-100">Relationship</h3>
                  <button onClick={() => { setSelectedEdge(null); setEdgeDetail(null); }}
                    className="text-gray-500 hover:text-gray-300 text-sm px-1" aria-label="Close">✕</button>
                </div>
                <div className="text-sm space-y-1 mb-3 text-gray-400">
                  <div><span className="text-gray-500">Type:</span> {selectedEdge.relationship_type || selectedEdge.label}</div>
                  <div><span className="text-gray-500">Status:</span>
                    <span className={`ml-1 ${selectedEdge.classification === 'inferred' ? 'text-amber-400' : 'text-green-400'}`}>
                      {selectedEdge.classification || 'observed'}
                    </span>
                  </div>
                </div>
                {edgeDetail?.evidence?.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm text-gray-300 mb-2">Supporting evidence ({edgeDetail.evidence.length})</h4>
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {edgeDetail.evidence.slice(0, 15).map((ev: any, i: number) => (
                        <div key={i} className="text-xs bg-gray-700/50 rounded p-2">
                          <div className="text-gray-400 mb-1">Record: {ev.source_record_id?.slice(0, 8)} (weight {ev.weight})</div>
                          <pre className="text-gray-300 whitespace-pre-wrap font-mono text-[10px] break-words max-h-32 overflow-auto">{prettyJson(ev.record_data)}</pre>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {edgeDetail && edgeDetail.evidence?.length === 0 && (
                  <div className="text-xs text-gray-500">No evidence rows linked to this relationship.</div>
                )}
              </>
            )}
            <div className="mt-4 border-t border-gray-700 pt-3">
              <button
                onClick={() => { setSelectedNode(null); setSelectedEdge(null); setNodeDetail(null); setEdgeDetail(null); cyInstance.current?.elements().unselect(); }}
                className="w-full text-left text-xs text-gray-400 hover:text-gray-200">
                Clear selection (Esc)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function prettyJson(v: any): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  try { return JSON.stringify(v, null, 1); } catch { return String(v); }
}