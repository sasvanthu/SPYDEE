import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';

export default function InvestigationGraph() {
  const { caseId } = useParams<{ caseId: string }>();
  const cyRef = useRef<HTMLDivElement>(null);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [filters, setFilters] = useState<any>({ include_inferred: true, max_nodes: 300, max_edges: 1500 });
  const [nodeDetail, setNodeDetail] = useState<any>(null);

  const { data: graphData, isLoading, refetch } = useQuery({
    queryKey: ['graph', caseId, filters],
    queryFn: () => api.getGraph(caseId!, filters),
    enabled: !!caseId,
  });

  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const applyDates = (from?: string, to?: string) => {
    setDateFrom(from || '');
    setDateTo(to || '');
    setFilters((f: any) => ({
      ...f,
      date_from: from ? new Date(from).toISOString() : undefined,
      date_to: to ? new Date(to).toISOString() : undefined,
    }));
  };

  const edgeRange = () => {
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
  };

  const applyPreset = (hours: number | null) => {
    if (hours === null) { applyDates(undefined, undefined); return; }
    const range = edgeRange();
    if (!range.max) return;
    const to = new Date(range.max);
    applyDates(new Date(to.getTime() - hours * 3600 * 1000).toISOString(), to.toISOString());
  };

  const range = edgeRange();

  useEffect(() => {
    if (!graphData || !cyRef.current) return;

    const cy = (window as any).cytoscape;
    if (!cy) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/cytoscape@3.29.2/dist/cytoscape.min.js';
      script.onload = () => renderGraph(graphData);
      document.head.appendChild(script);
    } else {
      renderGraph(graphData);
    }
  }, [graphData]);

  const renderGraph = (data: any) => {
    const Cytoscape = (window as any).cytoscape;
    if (!Cytoscape || !cyRef.current) return;

    const existing = Cytoscape({ container: cyRef.current });
    existing.destroy();

    const typeColors: Record<string, string> = {
      person: '#007bff', alias: '#22d3ee', phone_sim: '#06b6d4', device: '#f59e0b',
      account: '#22c55e', location: '#8b5cf6', organization: '#ec4899', domain_ip: '#64748b',
      event: '#f97316', document: '#6366f1',
    };

    const elements: any[] = [];
    data.nodes.forEach((n: any) => {
      elements.push({
        data: { id: n.id, label: n.label, entity_type: n.entity_type, review_state: n.review_state },
        classes: n.entity_type,
      });
    });
    data.edges.forEach((e: any) => {
      elements.push({
        data: { id: e.id, source: e.source, target: e.target, label: e.label, classification: e.classification },
        classes: e.classification === 'inferred' ? 'inferred' : 'observed',
      });
    });

    const instance = Cytoscape({
      container: cyRef.current,
      elements,
      style: [
        { selector: 'node', style: { 'background-color': '#007bff', label: 'data(label)', 'font-size': '10px', color: '#1a1a2e', 'text-valign': 'bottom', 'text-margin-y': 5 } },
        ...Object.entries(typeColors).map(([type, color]) => ({
          selector: `node.${type}`, style: { 'background-color': color },
        })),
        { selector: 'edge.observed', style: { 'line-color': '#64748b', width: 2, 'target-arrow-color': '#64748b', 'target-arrow-shape': 'triangle', 'curve-style': 'bezier' } },
        { selector: 'edge.inferred', style: { 'line-color': '#f59e0b', width: 2, 'line-style': 'dashed', 'target-arrow-color': '#f59e0b', 'target-arrow-shape': 'triangle', 'curve-style': 'bezier' } },
        { selector: 'node:selected', style: { 'border-width': 3, 'border-color': '#007bff' } },
      ],
      layout: { name: 'cose', animate: false, nodeDimensionsIncludeLabels: true, idealEdgeLength: 120 },
      minZoom: 0.3,
      maxZoom: 3,
    });

    instance.on('tap', 'node', async (evt: any) => {
      const node = evt.target;
      setSelectedNode(node.data());
      const detail = await api.getNeighbourhood(caseId!, node.data('id'), 1);
      setNodeDetail(detail);
    });

    instance.on('tap', (evt: any) => {
      if (evt.target === instance) { setSelectedNode(null); setNodeDetail(null); }
    });
  };

  const typeOptions = ['person', 'alias', 'phone_sim', 'device', 'account', 'location', 'organization', 'domain_ip'];

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-bold text-navy-700">Investigation Graph</h1>
        <div className="flex items-center gap-3">
          <select onChange={e => setFilters({ ...filters, entity_types: e.target.value ? [e.target.value] : undefined })}
            className="px-3 py-1.5 border rounded text-sm">
            <option value="">All entity types</option>
            {typeOptions.map(t => <option key={t} value={t}>{t.replace('_', '/')}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={filters.include_inferred}
              onChange={e => setFilters({ ...filters, include_inferred: e.target.checked })} className="rounded" />
            Inferred
          </label>
          <button onClick={() => refetch()} className="bg-azure-500 text-white px-3 py-1.5 rounded text-sm hover:bg-azure-600">Refresh</button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 px-3 py-2 bg-white border rounded-lg mb-3">
        <span className="text-xs font-semibold text-navy-700">Timeline scrubber</span>
        <input type="datetime-local" value={dateFrom ? toLocalInput(dateFrom) : ''}
          onChange={e => applyDates(e.target.value ? new Date(e.target.value).toISOString() : undefined, dateTo || undefined)}
          className="px-2 py-1 border rounded text-xs" />
        <span className="text-navy-400 text-xs">→</span>
        <input type="datetime-local" value={dateTo ? toLocalInput(dateTo) : ''}
          onChange={e => applyDates(dateFrom || undefined, e.target.value ? new Date(e.target.value).toISOString() : undefined)}
          className="px-2 py-1 border rounded text-xs" />
        <div className="flex gap-1">
          {[24, 24 * 7, 24 * 30].map(h => (
            <button key={h} onClick={() => applyPreset(h)}
              className="px-2 py-1 rounded text-xs border hover:bg-gray-50">
              {h === 24 ? '24h' : h === 24 * 7 ? '7d' : '30d'}
            </button>
          ))}
          <button onClick={() => applyPreset(null)} className="px-2 py-1 rounded text-xs border hover:bg-gray-50">All</button>
        </div>
        {dateFrom ? (
          <span className="text-xs text-navy-400 ml-auto">
            {new Date(dateFrom).toLocaleString()} – {dateTo ? new Date(dateTo).toLocaleString() : 'now'}
          </span>
        ) : (
          <span className="text-xs text-navy-400 ml-auto">
            {range.min ? `Edge data spans ${new Date(range.min).toLocaleString()} – ${new Date(range.max!).toLocaleString()}` : 'No time-aware edges'}
          </span>
        )}
      </div>
      <div className="flex-1 flex gap-4">
        <div className="flex-1 bg-white border rounded-lg overflow-hidden relative">
          {isLoading && <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">Loading graph...</div>}
          <div ref={cyRef} className="w-full h-full" />
          {graphData && (
            <div className="absolute bottom-3 left-3 bg-white/90 border rounded px-3 py-2 text-xs text-navy-400">
              Nodes: {graphData.total_nodes} | Edges: {graphData.total_edges}
              {graphData.truncated && <span className="text-amber-600 ml-2">(truncated)</span>}
            </div>
          )}
          <div className="absolute top-3 right-3 bg-white/90 border rounded px-3 py-2 text-xs space-y-1">
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-azure-500 inline-block"></span> Person</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-cyan-400 inline-block"></span> Alias</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-amber-500 inline-block"></span> Device</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-500 inline-block"></span> Account</div>
            <div className="border-t pt-1 mt-1">
              <div className="flex items-center gap-2"><span className="w-4 h-0.5 bg-gray-500 inline-block"></span> Observed</div>
              <div className="flex items-center gap-2"><span className="w-4 h-0.5 bg-amber-500 inline-block border-dashed"></span> Inferred</div>
            </div>
          </div>
        </div>
        {selectedNode && (
          <div className="w-80 bg-white border rounded-lg p-4 h-fit sticky top-16">
            <h3 className="font-semibold text-navy-700 mb-2">{selectedNode.label}</h3>
            <div className="text-sm space-y-1 mb-3">
              <div><span className="text-navy-400">Type:</span> {selectedNode.entity_type}</div>
              <div><span className="text-navy-400">State:</span> {selectedNode.review_state}</div>
            </div>
            {nodeDetail && (
              <div>
                <h4 className="font-medium text-sm text-navy-600 mb-2">Connections ({nodeDetail.edges?.length || 0})</h4>
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {nodeDetail.edges?.slice(0, 20).map((e: any, i: number) => (
                    <div key={i} className="text-xs bg-gray-50 p-2 rounded">
                      {e.relationship_type || e.label || 'connected'}
                    </div>
                  ))}
                </div>
              </div>
            )}
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
