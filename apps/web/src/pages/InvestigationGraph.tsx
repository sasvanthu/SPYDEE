import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect, useRef, useCallback } from 'react';
import cytoscape from 'cytoscape';
import { api } from '../lib/api';
import {
  Network,
  Search,
  Filter,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  ShieldAlert,
  X,
  Play,
  Layers,
  Sliders,
  Maximize2,
  Info,
  ChevronRight,
  ArrowRight
} from 'lucide-react';
import { TerminalPanel } from '../components/common/TerminalPanel';
import { StatusBadge } from '../components/common/StatusBadge';
import { ConfidenceMeter } from '../components/common/ConfidenceMeter';
import { IntelligenceSignal } from '../components/common/IntelligenceSignal';

const typeColors: Record<string, string> = {
  person: '#f59e0b',
  alias: '#fbbf24',
  phone_sim: '#d97706',
  device: '#fbbf24',
  account: '#34d399',
  location: '#f59e0b',
  tower: '#f59e0b',
  organization: '#fbbf24',
  domain_ip: '#92400e',
  event: '#ef4444',
  vehicle: '#f59e0b',
};

export default function InvestigationGraph() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const cyRef = useRef<HTMLDivElement>(null);
  const cyInstance = useRef<cytoscape.Core | null>(null);

  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [selectedEdge, setSelectedEdge] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('ALL');
  const [edgeTypeFilter, setEdgeTypeFilter] = useState('ALL');
  const [minConfidence, setMinConfidence] = useState(0.5);
  const [hiddenLinkActive, setHiddenLinkActive] = useState(false);
  const [nodeDetail, setNodeDetail] = useState<any>(null);

  const { data: graphData, isLoading, refetch } = useQuery({
    queryKey: ['graph', caseId, selectedTypeFilter, edgeTypeFilter],
    queryFn: () => api.getGraph(caseId!, {
      entity_types: selectedTypeFilter !== 'ALL' ? [selectedTypeFilter.toLowerCase()] : undefined,
      include_inferred: true,
      max_nodes: 300,
      max_edges: 1500
    }),
    enabled: !!caseId,
  });

  const { data: caseData } = useQuery({
    queryKey: ['case', caseId],
    queryFn: () => api.getCase(caseId!),
    enabled: !!caseId,
  });

  const runSearch = (term: string) => {
    if (!cyInstance.current) return;
    const cy = cyInstance.current;
    const q = term.trim().toLowerCase();
    if (!q) {
      cy.elements().forEach((ele) => { ele.removeClass('highlighted'); });
      return;
    }
    const matches = cy.nodes().filter((n) => {
      const d = n.data();
      return (
        (d.label && d.label.toLowerCase().includes(q)) ||
        (d.id && d.id.toLowerCase().includes(q)) ||
        (d.entity_type && d.entity_type.toLowerCase().includes(q))
      );
    });
    cy.elements().forEach((ele) => { ele.removeClass('highlighted'); });
    matches.forEach((m) => {
      m.addClass('highlighted');
    });
    if (matches.length > 0) {
      cy.fit(matches, 80);
    }
  };

  useEffect(() => {
    if (!cyRef.current) return;
    cyInstance.current = cytoscape({
      container: cyRef.current,
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(label)',
            'font-family': 'JetBrains Mono, Share Tech Mono, monospace',
            'font-size': '9px',
            color: '#fbbf24',
            'text-valign': 'bottom',
            'text-margin-y': 4,
            'text-wrap': 'ellipsis',
            'text-max-width': '100px',
            'background-color': '#0f160f',
            'border-width': 1.5,
            'border-color': '#f59e0b',
          },
        },
        {
          selector: 'node[entity_type = "person"]',
          style: { shape: 'ellipse', 'border-color': '#f59e0b', width: 28, height: 28 },
        },
        {
          selector: 'node[entity_type = "phone"], node[entity_type = "phone_sim"], node[entity_type = "sim"]',
          style: { shape: 'rectangle', 'border-color': '#d97706', width: 26, height: 26 },
        },
        {
          selector: 'node[entity_type = "vehicle"]',
          style: { shape: 'triangle', 'border-color': '#f59e0b', width: 28, height: 28 },
        },
        {
          selector: 'node[entity_type = "account"]',
          style: { shape: 'diamond', 'border-color': '#34d399', width: 26, height: 26 },
        },
        {
          selector: 'node[entity_type = "location"], node[entity_type = "tower"]',
          style: { shape: 'hexagon', 'border-color': '#f59e0b', width: 28, height: 28 },
        },
        {
          selector: 'edge',
          style: {
            'line-color': '#d97706',
            width: 1.2,
            'target-arrow-color': '#d97706',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            label: 'data(label)',
            'font-family': 'JetBrains Mono, monospace',
            'font-size': '7px',
            color: '#f59e0b',
            'text-background-color': '#080c08',
            'text-background-opacity': 0.85,
            'text-background-padding': '2px',
          },
        },
        {
          selector: 'edge.inferred',
          style: {
            'line-color': '#fbbf24',
            width: 1.8,
            'line-style': 'dashed',
            'target-arrow-color': '#fbbf24',
          },
        },
        {
          selector: 'edge.contradicted',
          style: {
            'line-color': '#ef4444',
            width: 2,
            'line-style': 'dashed',
            'target-arrow-color': '#ef4444',
            color: '#ef4444',
          },
        },
        {
          selector: 'node.highlighted, node:selected',
          style: {
            'border-width': 3,
            'border-color': '#34d399',
          },
        },
        {
          selector: 'edge:selected',
          style: {
            'line-color': '#fbbf24',
            width: 2.5,
          },
        },
      ],
      layout: { name: 'cose', animate: false, nodeDimensionsIncludeLabels: true, idealEdgeLength: 120, padding: 40 },
      minZoom: 0.3,
      maxZoom: 2.5,
    });

    return () => {
      cyInstance.current?.destroy();
      cyInstance.current = null;
    };
  }, []);

  // Update elements on data change
  useEffect(() => {
    if (!cyInstance.current || !graphData) return;
    const cy = cyInstance.current;
    const elements: cytoscape.ElementDefinition[] = [];

    (graphData.nodes || []).forEach((n: any) => {
      elements.push({
        data: {
          id: n.id,
          label: n.label || n.id,
          entity_type: (n.entity_type || 'person').toLowerCase(),
          review_state: n.review_state || 'LINKED',
          confidence: n.confidence || 0.85,
          raw: n,
        },
        classes: (n.entity_type || 'person').toLowerCase(),
      });
    });

    (graphData.edges || []).forEach((e: any) => {
      const contradicted = !!(e.properties?.contradiction || e.properties?.contradicted);
      const cls = [
        e.classification === 'inferred' ? 'inferred' : 'observed',
        contradicted ? 'contradicted' : '',
      ].filter(Boolean).join(' ');

      elements.push({
        data: {
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.label || e.relationship_type || 'LINKED',
          classification: e.classification,
          raw: e,
        },
        classes: cls,
      });
    });

    cy.elements().remove();
    cy.add(elements);
    cy.layout({ name: 'cose', animate: false, nodeDimensionsIncludeLabels: true, idealEdgeLength: 130, padding: 50 }).run();
  }, [graphData]);

  // Click listeners
  useEffect(() => {
    if (!cyInstance.current) return;
    const cy = cyInstance.current;

    const onNodeTap = (evt: any) => {
      const node = evt.target;
      setSelectedEdge(null);
      setSelectedNode(node.data());
      api.getNeighbourhood(caseId!, node.data('id'), 1).then((d) => setNodeDetail(d)).catch(() => {});
    };

    const onEdgeTap = (evt: any) => {
      const edge = evt.target;
      setSelectedNode(null);
      setSelectedEdge(edge.data());
    };

    cy.on('tap', 'node', onNodeTap);
    cy.on('tap', 'edge', onEdgeTap);

    return () => {
      cy.off('tap', 'node', onNodeTap);
      cy.off('tap', 'edge', onEdgeTap);
    };
  }, [caseId]);

  const resetCanvas = () => {
    if (cyInstance.current) {
      cyInstance.current.reset();
      cyInstance.current.fit(undefined, 40);
    }
    setSelectedNode(null);
    setSelectedEdge(null);
    setHiddenLinkActive(false);
    setSearchQuery('');
  };

  return (
    <div className="space-y-3 font-mono text-xs h-full flex flex-col text-[#f59e0b]">
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-amber-500/40 gap-2 shrink-0">
        <div>
          <div className="text-[11px] text-amber-500/70 font-bold tracking-widest uppercase">
            // CASE CONSOLE // GRAPH INTELLIGENCE
          </div>
          <div className="text-base md:text-lg font-black text-amber-300 tracking-wider flex items-center gap-2">
            <span>KNOWLEDGE GRAPH ENGINE</span>
            <span className="text-xs px-2 py-0.5 bg-amber-500/20 border border-amber-500/40 text-amber-400 font-bold">
              CASE {caseData?.case_code || caseId?.slice(0, 12)}
            </span>
          </div>
          <div className="text-[10px] text-amber-500/80">
            SOLID = OBSERVED DIRECT // THIN = DERIVED // DASHED = INFERRED // RED DASHED = CONTRADICTION
          </div>
        </div>

        {/* PRIMARY ACTION: ANALYZE HIDDEN LINKS */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setHiddenLinkActive(!hiddenLinkActive)}
            className={`px-3 py-1.5 font-bold transition-all flex items-center gap-2 text-xs border ${
              hiddenLinkActive
                ? 'bg-amber-400 text-black border-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.8)] animate-pulse'
                : 'bg-black/80 border-amber-500 text-amber-300 hover:bg-amber-500/20 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{hiddenLinkActive ? 'DISMISS HIDDEN LINK' : 'ANALYZE HIDDEN LINKS'}</span>
          </button>
        </div>
      </div>

      {/* CONTROLS BAR */}
      <div className="p-2 bg-[#0a0f0a] border border-amber-500/30 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="flex items-center gap-1.5 bg-black/80 border border-amber-500/40 px-2 py-1 min-w-[170px]">
            <Search className="w-3.5 h-3.5 text-amber-500/70" />
            <input
              type="text"
              placeholder="SEARCH GRAPH..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                runSearch(e.target.value);
              }}
              className="bg-transparent text-amber-300 placeholder-amber-500/40 outline-none w-full text-xs font-mono"
            />
          </div>

          {/* Node Type Filter */}
          <select
            value={selectedTypeFilter}
            onChange={(e) => setSelectedTypeFilter(e.target.value)}
            className="bg-black border border-amber-500/40 text-amber-300 text-xs px-2 py-1 outline-none font-mono"
          >
            <option value="ALL">ALL NODE TYPES</option>
            <option value="PERSON">PERSON</option>
            <option value="PHONE">PHONE</option>
            <option value="SIM">SIM</option>
            <option value="VEHICLE">VEHICLE</option>
            <option value="ACCOUNT">ACCOUNT</option>
            <option value="LOCATION">LOCATION</option>
            <option value="TOWER">TOWER</option>
            <option value="EVENT">EVENT</option>
            <option value="DOMAIN">DOMAIN</option>
            <option value="IP">IP</option>
          </select>

          {/* Edge Type Filter */}
          <select
            value={edgeTypeFilter}
            onChange={(e) => setEdgeTypeFilter(e.target.value)}
            className="bg-black border border-amber-500/40 text-amber-300 text-xs px-2 py-1 outline-none font-mono"
          >
            <option value="ALL">ALL EDGE TYPES</option>
            <option value="CALLED">CALLED</option>
            <option value="OWNED">OWNED</option>
            <option value="USED">USED</option>
            <option value="CO-LOCATED">CO-LOCATED</option>
            <option value="TRANSACTED">TRANSACTED</option>
            <option value="REGISTERED">REGISTERED</option>
            <option value="HOSTED">HOSTED</option>
            <option value="ATTENDED">ATTENDED</option>
            <option value="LINKED">LINKED</option>
          </select>

          {/* Confidence Filter Slider */}
          <div className="flex items-center gap-1.5 px-2 py-1 bg-black/60 border border-amber-500/30 text-[11px]">
            <span className="text-amber-500/70">CONF &gt;=</span>
            <input
              type="range"
              min="0.4"
              max="0.95"
              step="0.05"
              value={minConfidence}
              onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
              className="w-16 accent-amber-500 cursor-pointer"
            />
            <span className="text-amber-300 font-bold w-7">
              {Math.round(minConfidence * 100)}%
            </span>
          </div>
        </div>

        {/* Zoom & Reset Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => cyInstance.current?.zoom(cyInstance.current.zoom() * 1.25)}
            className="p-1 bg-black border border-amber-500/40 text-amber-300 hover:bg-amber-500/20"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => cyInstance.current?.zoom(cyInstance.current.zoom() * 0.8)}
            className="p-1 bg-black border border-amber-500/40 text-amber-300 hover:bg-amber-500/20"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={resetCanvas}
            className="px-2 py-1 bg-black border border-amber-500/40 text-amber-300 hover:bg-amber-500/20 text-[10px] flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            <span>RESET</span>
          </button>
        </div>
      </div>

      {/* MAIN GRAPH WORKSPACE */}
      <div className="flex-1 min-h-[500px] grid grid-cols-1 lg:grid-cols-12 gap-3 relative">
        {/* GRAPH CANVAS AREA */}
        <div className={`${selectedNode || hiddenLinkActive ? 'lg:col-span-8 xl:col-span-9' : 'lg:col-span-12'} relative bg-[#060a06] border border-amber-500/35 overflow-hidden flex flex-col`}>
          {/* Subtle Grid / Radar Overlay */}
          <div
            className="absolute inset-0 opacity-15 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(#f59e0b 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />

          {isLoading && (
            <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10 text-xs text-amber-400">
              [ COMPILING GRAPH TOPOLOGY FROM FORENSIC STORE... ]
            </div>
          )}

          {/* Cytoscape Container */}
          <div ref={cyRef} className="w-full h-full min-h-[460px] cursor-grab active:cursor-grabbing select-none" />

          {/* Inferred Hidden Link Animated Overlay when Active */}
          {hiddenLinkActive && (
            <div className="absolute top-4 left-4 p-2.5 bg-black/90 border border-amber-400 text-xs text-amber-300 animate-pulse pointer-events-none flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>ACTIVE SYNTHESIS: HIDDEN LINK ↝ 67% [UNCONFIRMED HYPOTHESIS H-01]</span>
            </div>
          )}

          {/* Bottom Canvas Legend & Overlay */}
          <div className="absolute bottom-2 left-2 right-2 flex flex-wrap items-center justify-between gap-2 p-2 bg-black/85 border border-amber-500/30 text-[10px]">
            <div className="flex items-center gap-3">
              <span className="text-amber-500/70 font-bold">LEGEND:</span>
              <span>● PERSON</span>
              <span>■ PHONE/SIM</span>
              <span>▲ VEHICLE</span>
              <span>◆ ACCOUNT</span>
              <span>⬡ TOWER/LOC</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-amber-300 font-bold">── DIRECT OBSERVED</span>
              <span className="text-amber-400 font-bold">╌╌ INFERRED HYPOTHESIS</span>
              <span className="text-red-400 font-bold">╌╌ CONTRADICTION</span>
            </div>
          </div>
        </div>

        {/* RIGHT SIDE INTELLIGENCE PANEL (OR HIDDEN LINK DETAILS) */}
        {(selectedNode || hiddenLinkActive) && (
          <div className="lg:col-span-4 xl:col-span-3 space-y-3 overflow-y-auto">
            {/* HIDDEN LINK INTELLIGENCE BANNER */}
            {hiddenLinkActive && (
              <div className="p-3 bg-amber-950/40 border-2 border-amber-500 text-xs font-mono space-y-2 shadow-[0_0_15px_rgba(245,158,11,0.4)]">
                <div className="flex items-center justify-between pb-1 border-b border-amber-500/40">
                  <span className="font-bold text-amber-300 text-xs flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                    HIDDEN LINK DETECTED
                  </span>
                  <button onClick={() => setHiddenLinkActive(false)} className="text-amber-500 hover:text-amber-300">
                    <X className="w-3 h-3" />
                  </button>
                </div>

                <div className="p-2 bg-black/60 border border-amber-500/30 text-center font-bold text-sm text-amber-300">
                  RAVI KUMAR <span className="text-amber-500 font-normal">↝</span> SURESH
                </div>

                <div className="flex justify-between items-center py-1 border-b border-amber-500/20 text-[11px]">
                  <span className="text-amber-500/80">CONFIDENCE:</span>
                  <span className="text-amber-300 font-bold text-sm">67% [MEDIUM]</span>
                </div>

                {/* Evidence chain */}
                <div className="text-[11px] space-y-1">
                  <span className="text-amber-500/80 font-bold block">EVIDENCE:</span>
                  <div className="text-emerald-400 pl-1">+ repeated tower co-location (14 times)</div>
                  <div className="text-emerald-400 pl-1">+ shared vehicle Scorpio V-12</div>
                  <div className="text-emerald-400 pl-1">+ synchronized communication burst</div>
                  <div className="text-red-400 pl-1">- no direct calls between phones</div>
                  <div className="text-red-400 pl-1">- no direct financial transaction</div>
                </div>

                <div className="flex justify-between text-[10px] pt-1">
                  <span className="text-amber-500/70">EVIDENCE TYPE:</span>
                  <span className="font-bold text-amber-300">DERIVED + INFERRED</span>
                </div>

                {/* Warning notice */}
                <div className="p-1.5 bg-black/80 border border-amber-500/40 text-[9px] text-amber-400 leading-tight">
                  CLASSIFICATION: <span className="font-bold text-amber-200">HYPOTHESIS // UNCONFIRMED</span>.<br />
                  AI correlation only. Physical verification required.
                </div>

                <button
                  onClick={() => navigate(`/cases/${caseId}/hypotheses`)}
                  className="w-full py-1.5 bg-amber-500 text-black font-bold hover:bg-amber-400 transition-colors text-center text-xs block"
                >
                  EXPAND IN HYPOTHESES TAB [→]
                </button>
              </div>
            )}

            {/* Selected Node Panel */}
            {selectedNode && (
              <TerminalPanel
                title={`NODE INTELLIGENCE // ${selectedNode.id?.slice(0, 10)}`}
                subtitle={selectedNode.entity_type}
                headerRight={
                  <button onClick={() => setSelectedNode(null)} className="text-amber-500 hover:text-amber-300">
                    <X className="w-3.5 h-3.5" />
                  </button>
                }
              >
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between items-center pb-2 border-b border-amber-500/20">
                    <div>
                      <div className="font-bold text-amber-300 text-sm truncate max-w-[180px]">{selectedNode.label}</div>
                      <div className="text-[10px] text-amber-500/80">Type: {selectedNode.entity_type}</div>
                    </div>
                    <StatusBadge status={selectedNode.review_state || 'ACTIVE'} size="sm" />
                  </div>

                  <ConfidenceMeter value={selectedNode.confidence || 0.85} label="INTELLIGENCE CONFIDENCE" />

                  <div className="p-2 bg-black/60 border border-amber-500/20 space-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-amber-500/70">IDENTIFIER:</span>
                      <span className="text-amber-300 font-mono">{selectedNode.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-amber-500/70">JURISDICTION:</span>
                      <span className="text-amber-300">Maharashtra / Pune STF</span>
                    </div>
                  </div>

                  {/* Connected relations */}
                  <div>
                    <div className="text-[10px] text-amber-500/80 font-bold uppercase mb-1">
                      DIRECT CONNECTIONS:
                    </div>
                    <div className="space-y-1 max-h-36 overflow-y-auto">
                      {nodeDetail?.nodes?.length > 1 ? (
                        nodeDetail.nodes
                          .filter((n: any) => n.id !== selectedNode.id)
                          .map((r: any) => (
                            <div
                              key={r.id}
                              onClick={() => {
                                const target = cyInstance.current?.getElementById(r.id);
                                if (target && target.length > 0) {
                                  cyInstance.current?.elements().unselect();
                                  target.select();
                                  setSelectedNode(target.data());
                                }
                              }}
                              className="p-1.5 bg-black/60 border border-amber-500/20 hover:border-amber-400 cursor-pointer flex justify-between items-center text-[10px]"
                            >
                              <span className="text-amber-300 font-bold truncate max-w-[130px]">{r.label}</span>
                              <span className="text-amber-500/70 uppercase">{r.entity_type}</span>
                            </div>
                          ))
                      ) : (
                        <div className="p-1.5 bg-black/60 border border-amber-500/20 text-[10px] text-amber-500/60">
                          Tap adjacent nodes to inspect connections.
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => navigate(`/cases/${caseId}/entities`)}
                    className="w-full py-1.5 bg-black border border-amber-500/50 hover:bg-amber-500/20 text-amber-300 font-bold text-center text-xs flex items-center justify-center gap-1"
                  >
                    <span>OPEN DOSSIER IN ENTITIES</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </TerminalPanel>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
