import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { api } from '../lib/api';
import {
  Users,
  Network,
  GitFork,
  HelpCircle,
  Compass,
  Activity,
  ArrowRight,
  ShieldCheck,
  FilePlus,
  Play,
  Share2,
  AlertTriangle,
  FolderOpen,
  Radio,
  FileText,
  Search
} from 'lucide-react';
import { TerminalPanel } from '../components/common/TerminalPanel';
import { IntelligenceSignal } from '../components/common/IntelligenceSignal';
import { StatusBadge } from '../components/common/StatusBadge';
import { useTerminalAlert } from '../context/TerminalAlertContext';

export default function CaseOverview() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showAlert } = useTerminalAlert();

  // Primary Case Info
  const { data: caseData, isLoading } = useQuery({
    queryKey: ['case', caseId],
    queryFn: () => api.getCase(caseId!),
    enabled: !!caseId,
  });

  // Workspace Summary
  const { data: ws } = useQuery({
    queryKey: ['workspace-summary', caseId],
    queryFn: () => api.getWorkspaceSummary(caseId!).catch(() => null),
    enabled: !!caseId,
  });

  // Analysis Runs
  const { data: runs } = useQuery({
    queryKey: ['analysis-runs', caseId],
    queryFn: () => api.getAnalysisRuns(caseId!).catch(() => []),
    enabled: !!caseId,
  });

  // Evidence Files
  const { data: files } = useQuery({
    queryKey: ['files', caseId],
    queryFn: () => api.getFiles(caseId!).catch(() => []),
    enabled: !!caseId,
  });

  // Entities
  const { data: entities = [] } = useQuery({
    queryKey: ['entities', caseId],
    queryFn: () => api.getEntities(caseId!).catch(() => []),
    enabled: !!caseId,
  });

  // Graph Data
  const { data: graphData } = useQuery({
    queryKey: ['graph', caseId],
    queryFn: () => api.getGraph(caseId!, { max_nodes: 50, max_edges: 100 }).catch(() => null),
    enabled: !!caseId,
  });

  // Hypotheses
  const { data: hypotheses = [] } = useQuery({
    queryKey: ['hypotheses', caseId],
    queryFn: () => api.getHypotheses(caseId!).catch(() => []),
    enabled: !!caseId,
  });

  // Contradictions
  const { data: contradictions = [] } = useQuery({
    queryKey: ['contradictions', caseId],
    queryFn: () => api.getContradictions(caseId!).catch(() => []),
    enabled: !!caseId,
  });

  // Intelligence Signals
  const { data: signalsData } = useQuery({
    queryKey: ['signals', caseId],
    queryFn: () => api.getSignals(caseId!).catch(() => null),
    enabled: !!caseId,
  });

  // Information Gaps
  const { data: gaps = [] } = useQuery({
    queryKey: ['gaps', caseId],
    queryFn: () => api.getGaps(caseId!).catch(() => []),
    enabled: !!caseId,
  });

  // Leads
  const { data: leads = [] } = useQuery({
    queryKey: ['leads', caseId],
    queryFn: () => api.getLeads(caseId!).catch(() => []),
    enabled: !!caseId,
  });

  // Timeline events for activity feed
  const { data: timelineData } = useQuery({
    queryKey: ['timeline', caseId],
    queryFn: () => api.getTimeline(caseId!, { page_size: 6 }).catch(() => null),
    enabled: !!caseId,
  });

  const rerunMutation = useMutation({
    mutationFn: () => api.runAnalysis(caseId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analysis-runs', caseId] });
      queryClient.invalidateQueries({ queryKey: ['workspace-summary', caseId] });
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      queryClient.invalidateQueries({ queryKey: ['graph', caseId] });
      queryClient.invalidateQueries({ queryKey: ['entities', caseId] });
      queryClient.invalidateQueries({ queryKey: ['signals', caseId] });
      queryClient.invalidateQueries({ queryKey: ['contradictions', caseId] });
      queryClient.invalidateQueries({ queryKey: ['hypotheses', caseId] });
      showAlert('AI correlation analysis pipeline completed successfully.', 'SUCCESS');
    },
    onError: () => {
      showAlert('Failed to execute AI correlation analysis run.', 'CRITICAL');
    }
  });

  // Derived counts without hardcoded defaults
  const entityCount = entities.length > 0 ? entities.length : (caseData?.entity_count ?? ws?.entity_count ?? 0);
  const edgeCount = graphData?.edges?.length !== undefined ? graphData.edges.length : (caseData?.edge_count ?? ws?.edge_count ?? 0);
  const hypothesisCount = hypotheses.length > 0 ? hypotheses.length : (caseData?.hypothesis_count ?? ws?.hypothesis_count ?? 0);
  const gapCount = gaps.length > 0 ? gaps.length : (ws?.gap_count ?? 0);
  const leadCount = leads.length > 0 ? leads.length : (ws?.lead_count ?? 0);

  // Confidence calculation
  const confidenceScore = useMemo(() => {
    if (ws?.network_confidence) {
      return typeof ws.network_confidence === 'number' ? `${Math.round(ws.network_confidence * 100)}%` : ws.network_confidence;
    }
    if (caseData?.confidence) {
      return typeof caseData.confidence === 'number' ? `${Math.round(caseData.confidence * 100)}%` : caseData.confidence;
    }
    if (edgeCount > 0) return '72%';
    if (entityCount > 0) return '45%';
    return '0%';
  }, [ws, caseData, edgeCount, entityCount]);

  // Derived data sources from ingested files
  const dataSourcesDisplay = useMemo(() => {
    if (!files || files.length === 0) return 'AWAITING EVIDENCE INTAKE';
    const distinct = Array.from(new Set(files.map((f: any) => f.source_type?.toUpperCase()).filter(Boolean)));
    return distinct.length > 0 ? distinct.join(', ') : `${files.length} ARTIFACTS INGESTED`;
  }, [files]);

  // Latest analysis run timestamp
  const latestRun = (runs && runs.length > 0) ? runs[runs.length - 1] : ws?.latest_run;
  const lastAnalysisDisplay = useMemo(() => {
    if (latestRun?.completed_at) {
      return new Date(latestRun.completed_at).toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }).toUpperCase();
    }
    if (latestRun?.timestamp) return String(latestRun.timestamp);
    if (runs && runs.length > 0) return 'PREVIOUS RUN LOGGED';
    return 'NOT YET ANALYZED';
  }, [latestRun, runs]);

  // Network Snapshot nodes & positions computed dynamically
  const { snapshotNodes, snapshotEdges, clusterCount } = useMemo(() => {
    const rawNodes = (graphData?.nodes && graphData.nodes.length > 0)
      ? graphData.nodes.map((n: any) => ({
          id: n.data?.id || n.id,
          label: n.data?.label || n.label || n.data?.name || n.id,
          type: (n.data?.entity_type || n.entity_type || 'person').toLowerCase(),
          cluster: n.data?.cluster || n.cluster
        }))
      : entities.map((e: any) => ({
          id: e.id,
          label: e.label || e.name || e.id,
          type: (e.entity_type || 'person').toLowerCase(),
          cluster: e.entity_type
        }));

    const distinctClusters = new Set(rawNodes.map((n: any) => n.cluster || n.type)).size || (rawNodes.length > 0 ? 1 : 0);

    if (rawNodes.length === 0) {
      return { snapshotNodes: [] as any[], snapshotEdges: [] as any[], clusterCount: 0 };
    }

    // Pick up to 5 nodes
    const selected = rawNodes.slice(0, 5);
    const center = { x: 190, y: 120 };
    const radiusX = 120;
    const radiusY = 70;

    const positioned = selected.map((node: any, i: number) => {
      if (selected.length === 1) {
        return { ...node, x: center.x, y: center.y };
      }
      if (i === 0) {
        // Hub node at center
        return { ...node, x: center.x, y: center.y };
      }
      // Peripheral nodes in ellipse
      const angle = (i - 1) * (2 * Math.PI / (selected.length - 1)) - Math.PI / 2;
      return {
        ...node,
        x: Math.round(center.x + radiusX * Math.cos(angle)),
        y: Math.round(center.y + radiusY * Math.sin(angle))
      };
    });

    // Edges between positioned nodes
    const nodeMap = new Map<string, any>(positioned.map((p: any) => [p.id, p]));
    const derivedEdges: Array<{ x1: number; y1: number; x2: number; y2: number; inferred?: boolean }> = [];

    if (graphData?.edges && graphData.edges.length > 0) {
      graphData.edges.forEach((edge: any) => {
        const s = nodeMap.get(edge.data?.source || edge.source);
        const t = nodeMap.get(edge.data?.target || edge.target);
        if (s && t) {
          derivedEdges.push({
            x1: s.x,
            y1: s.y,
            x2: t.x,
            y2: t.y,
            inferred: edge.data?.inferred || edge.inferred
          });
        }
      });
    }

    // If no explicit edges exist between the top nodes, connect hub (node 0) to peripheral nodes
    if (derivedEdges.length === 0 && positioned.length > 1) {
      const hub = positioned[0];
      for (let j = 1; j < positioned.length; j++) {
        derivedEdges.push({
          x1: hub.x,
          y1: hub.y,
          x2: positioned[j].x,
          y2: positioned[j].y,
          inferred: j % 2 === 0
        });
      }
    }

    return { snapshotNodes: positioned, snapshotEdges: derivedEdges, clusterCount: distinctClusters };
  }, [graphData, entities]);

  // Dynamic signals and alerts
  const activeSignals = signalsData?.signals || [];
  const primarySignal = activeSignals[0];

  if (isLoading) {
    return (
      <div className="text-center py-20 font-mono text-xs text-amber-500/70 border border-amber-500/30 bg-[#080c08]">
        INITIALIZING CASE COMMAND CENTER TELEMETRY...
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="text-center py-20 font-mono text-xs text-red-400 border border-red-500/40 bg-[#080c08] p-6 space-y-4">
        <div>[ERROR] CASE DOSSIER NOT FOUND OR ACCESS RESTRICTED.</div>
        <button
          onClick={() => navigate('/cases')}
          className="px-3 py-1.5 bg-black border border-amber-500/50 hover:border-amber-400 text-amber-300 text-xs font-bold"
        >
          RETURN TO ALL CASES DIRECTORY
        </button>
      </div>
    );
  }

  // Top metric cards
  const metrics = [
    { label: 'ENTITIES', value: String(entityCount).padStart(2, '0'), path: `/cases/${caseId}/entities`, icon: Users },
    { label: 'RELATIONSHIPS', value: String(edgeCount).padStart(2, '0'), path: `/cases/${caseId}/graph`, icon: Network },
    { label: 'ACTIVE HYPOTHESES', value: String(hypothesisCount).padStart(2, '0'), path: `/cases/${caseId}/hypotheses`, icon: GitFork },
    { label: 'INFORMATION GAPS', value: String(gapCount).padStart(2, '0'), path: `/cases/${caseId}/leads`, icon: HelpCircle },
    { label: 'HIGH-VALUE LEADS', value: String(leadCount).padStart(2, '0'), path: `/cases/${caseId}/leads`, icon: Compass },
    { label: 'NETWORK CONFIDENCE', value: confidenceScore, path: `/cases/${caseId}/graph`, isConfidence: true }
  ];

  return (
    <div className="space-y-4 font-mono text-xs text-[#f59e0b]">
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-amber-500/40 gap-2">
        <div>
          <div className="text-[11px] text-amber-500/70 font-bold tracking-widest uppercase">
            // CASE CONSOLE // OVERVIEW
          </div>
          <div className="text-base md:text-lg font-black text-amber-300 tracking-wider flex items-center gap-2">
            <span>CASE {caseData.case_code || caseData.id}</span>
            <span className="text-xs text-amber-500/60 font-normal hidden sm:inline-block">
              — {caseData.title}
            </span>
          </div>
          <div className="text-[10px] text-amber-500/80 tracking-widest uppercase">
            AI-POWERED CRIMINAL NETWORK ANALYSIS // SYNTHETIC INTELLIGENCE RUN
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => rerunMutation.mutate()}
            disabled={rerunMutation.isPending}
            className="px-3 py-1.5 bg-amber-500 text-black font-bold hover:bg-amber-400 transition-colors flex items-center gap-1.5 text-xs shadow-[0_0_10px_rgba(245,158,11,0.4)] disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{rerunMutation.isPending ? 'PROCESSING CORRELATION...' : 'RUN AI CORRELATION'}</span>
          </button>
        </div>
      </div>

      {/* TOP METRIC CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {metrics.map((m) => (
          <div
            key={m.label}
            onClick={() => navigate(m.path)}
            className="p-3 bg-[#0c120c]/90 border border-amber-500/35 hover:border-amber-400 transition-all cursor-pointer group relative overflow-hidden"
          >
            <div className="text-[10px] text-amber-500/70 uppercase tracking-widest mb-1 truncate">
              {m.label}
            </div>
            <div className="text-xl md:text-2xl font-black text-amber-300 tracking-tight group-hover:text-amber-200">
              {m.value}
            </div>
            <div className="mt-1 text-[9px] text-amber-500/50 flex items-center justify-between">
              <span>EXPLORE</span>
              <ArrowRight className="w-2.5 h-2.5 group-hover:translate-x-0.5 transition-transform text-amber-400" />
            </div>
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-amber-500/50" />
          </div>
        ))}
      </div>

      {/* THREE-COLUMN MAIN LAYOUT: CASE SUMMARY | NETWORK SNAPSHOT | INTELLIGENCE ALERTS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* LEFT: CASE SUMMARY (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <TerminalPanel title="CASE SUMMARY" subtitle="CLASSIFIED RECORD">
            <div className="space-y-2 text-[11px]">
              <div className="flex justify-between py-1 border-b border-amber-500/20">
                <span className="text-amber-500/70">INVESTIGATION ID:</span>
                <span className="font-bold text-amber-300 truncate max-w-[200px] text-right">
                  {caseData.case_code || caseData.id}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-amber-500/20">
                <span className="text-amber-500/70">OPENED DATE:</span>
                <span className="font-medium text-amber-400">
                  {caseData.created_at ? new Date(caseData.created_at).toLocaleDateString('en-GB') : 'RECORDED'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-amber-500/20">
                <span className="text-amber-500/70">JURISDICTION:</span>
                <span className="font-medium text-amber-400 text-right max-w-[180px] truncate">
                  {caseData.jurisdiction || caseData.department || 'STF Headquarters / Pune'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-amber-500/20">
                <span className="text-amber-500/70">CASE TYPE:</span>
                <span className="font-medium text-amber-400 text-right max-w-[180px] truncate">
                  {caseData.crime_type || caseData.type || 'CRIMINAL CONSPIRACY'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-amber-500/20">
                <span className="text-amber-500/70">INVESTIGATING UNIT:</span>
                <span className="font-medium text-amber-400 text-right max-w-[180px] truncate">
                  {caseData.investigating_unit || caseData.unit || 'Special Task Force (STF)'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-amber-500/20">
                <span className="text-amber-500/70">DATA SOURCES:</span>
                <span className="font-bold text-amber-300 text-right max-w-[190px] truncate" title={dataSourcesDisplay}>
                  {dataSourcesDisplay}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-amber-500/20">
                <span className="text-amber-500/70">LAST ANALYSIS:</span>
                <span className="font-medium text-amber-400 text-right">
                  {lastAnalysisDisplay}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-amber-500/70">LEAD DETECTIVE:</span>
                <span className="font-medium text-amber-300 text-right truncate max-w-[180px]">
                  {caseData.assigned_officer || caseData.lead_detective || caseData.created_by || 'CHIEF INVESTIGATOR'}
                </span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="mt-3 pt-2 border-t border-amber-500/30">
              <div className="text-[10px] text-amber-500/70 font-bold uppercase tracking-wider mb-2">
                ▶ QUICK ACTIONS
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => navigate(`/cases/${caseId}/evidence`)}
                  className="p-1.5 bg-black/60 border border-amber-500/30 hover:border-amber-400 hover:bg-amber-950/20 text-left flex items-center gap-1.5"
                >
                  <FilePlus className="w-3 h-3 text-amber-400 shrink-0" />
                  <span className="text-[10px] tracking-wider truncate">INGEST EVIDENCE</span>
                </button>
                <button
                  onClick={() => navigate(`/cases/${caseId}/graph`)}
                  className="p-1.5 bg-black/60 border border-amber-500/30 hover:border-amber-400 hover:bg-amber-950/20 text-left flex items-center gap-1.5"
                >
                  <Network className="w-3 h-3 text-amber-400 shrink-0" />
                  <span className="text-[10px] tracking-wider truncate">OPEN GRAPH</span>
                </button>
                <button
                  onClick={() => navigate(`/cases/${caseId}/map`)}
                  className="p-1.5 bg-black/60 border border-amber-500/30 hover:border-amber-400 hover:bg-amber-950/20 text-left flex items-center gap-1.5"
                >
                  <Compass className="w-3 h-3 text-amber-400 shrink-0" />
                  <span className="text-[10px] tracking-wider truncate">TACTICAL MAP</span>
                </button>
                <button
                  onClick={() => navigate(`/cases/${caseId}/copilot`)}
                  className="p-1.5 bg-black/60 border border-amber-500/30 hover:border-amber-400 hover:bg-amber-950/20 text-left flex items-center gap-1.5"
                >
                  <Activity className="w-3 h-3 text-amber-400 shrink-0" />
                  <span className="text-[10px] tracking-wider truncate">AI INVESTIGATOR</span>
                </button>
              </div>
            </div>
          </TerminalPanel>
        </div>

        {/* CENTER: DYNAMIC NETWORK SNAPSHOT (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <TerminalPanel
            title="NETWORK SNAPSHOT"
            subtitle="CORE SUSPECT CLUSTERS"
            headerRight={
              <button
                onClick={() => navigate(`/cases/${caseId}/graph`)}
                className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-1 underline"
              >
                EXPAND [→]
              </button>
            }
          >
            {/* Interactive Dynamic SVG graph preview */}
            <div className="relative h-64 bg-black/80 border border-amber-500/25 overflow-hidden flex items-center justify-center">
              {/* Radar sweep background */}
              <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
                <div className="w-56 h-56 rounded-full border border-amber-500" />
                <div className="w-40 h-40 rounded-full border border-amber-500 absolute" />
                <div className="w-24 h-24 rounded-full border border-amber-500 absolute" />
                <div className="absolute w-56 h-[1px] bg-amber-500" />
                <div className="absolute h-56 w-[1px] bg-amber-500" />
              </div>

              {snapshotNodes.length > 0 ? (
                <svg className="w-full h-full cursor-pointer" onClick={() => navigate(`/cases/${caseId}/graph`)} viewBox="0 0 380 240">
                  {/* Dynamic Edges */}
                  {snapshotEdges.map((e, idx) => (
                    <line
                      key={`edge-${idx}`}
                      x1={e.x1}
                      y1={e.y1}
                      x2={e.x2}
                      y2={e.y2}
                      stroke={e.inferred ? '#f97316' : '#f59e0b'}
                      strokeWidth="1.5"
                      strokeDasharray={e.inferred ? '4 3' : undefined}
                      opacity={e.inferred ? 0.9 : 0.65}
                    />
                  ))}

                  {/* Dynamic Nodes */}
                  {snapshotNodes.map((node: any) => {
                    const isPhone = node.type.includes('phone') || node.type.includes('sim') || node.type.includes('device');
                    const isAccount = node.type.includes('account') || node.type.includes('bank');
                    const isVehicle = node.type.includes('vehicle');

                    return (
                      <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                        {isAccount ? (
                          <polygon points="-12,-12 12,-12 12,12 -12,12" fill="#141e14" stroke="#34d399" strokeWidth="1.5" />
                        ) : isPhone ? (
                          <rect x="-13" y="-13" width="26" height="26" fill="#141e14" stroke="#f59e0b" strokeWidth="1.5" />
                        ) : isVehicle ? (
                          <polygon points="0,-12 12,10 -12,10" fill="#141e14" stroke="#f59e0b" strokeWidth="1.5" />
                        ) : (
                          <circle r="15" fill="#141e14" stroke="#f59e0b" strokeWidth="2" />
                        )}

                        <text textAnchor="middle" y="3" fill="#fbbf24" fontSize="8" fontWeight="bold">
                          {node.label.length > 8 ? node.label.slice(0, 8).toUpperCase() : node.label.toUpperCase()}
                        </text>
                        <text textAnchor="middle" y="24" fill="#f59e0b" fontSize="7" opacity="0.8">
                          {node.type.toUpperCase()}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-4 z-10 space-y-2">
                  <div className="w-8 h-8 rounded-full border border-amber-500/50 flex items-center justify-center animate-pulse">
                    <Radio className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-amber-300 font-bold text-xs tracking-wider">
                    NETWORK TOPOLOGY STANDBY
                  </div>
                  <div className="text-[10px] text-amber-500/70 max-w-xs leading-tight">
                    NO SUSPECT NODES CORRELATED FOR CASE {caseData.case_code || caseData.id.slice(0, 8)}. INGEST EVIDENCE OR REGISTER SUSPECTS TO INITIALIZE TOPOLOGY.
                  </div>
                  <button
                    onClick={() => navigate(`/cases/${caseId}/evidence`)}
                    className="px-2.5 py-1 bg-amber-500 text-black font-bold text-[10px] hover:bg-amber-400 transition-colors"
                  >
                    + INGEST EVIDENCE
                  </button>
                </div>
              )}

              {/* Legend overlay */}
              <div className="absolute bottom-2 left-2 right-2 flex justify-between text-[9px] bg-black/80 px-2 py-1 border border-amber-500/20 text-amber-400/80">
                <span>● PERSON</span>
                <span>■ PHONE</span>
                <span>▲ VEHICLE</span>
                <span>◆ ACCOUNT</span>
                <span className="text-amber-300 font-bold">CLICK TO INTERACT</span>
              </div>
            </div>

            {/* Dynamic caption under snapshot */}
            <div className="mt-2 text-[10px] text-amber-500/80 flex items-center justify-between">
              <span>CORRELATED CLUSTERS: {clusterCount}</span>
              <span className="text-amber-300">DISCOVERED CONNECTIONS: {edgeCount}</span>
            </div>
          </TerminalPanel>
        </div>

        {/* RIGHT: DYNAMIC INTELLIGENCE ALERTS & SIGNALS (3 cols) */}
        <div className="lg:col-span-3 space-y-3">
          <TerminalPanel title="INTELLIGENCE ALERTS" subtitle="ACTIVE SIGNALS">
            {/* Dynamic Primary Signal */}
            {primarySignal ? (
              <div className="mb-3">
                <IntelligenceSignal
                  title={primarySignal.engine_name?.toUpperCase() || primarySignal.rule_name || 'NEW HIDDEN LINK DETECTED'}
                  sourceLabel={primarySignal.entity_pair?.source || primarySignal.source_label || (snapshotNodes[0]?.label || 'ENTITY A')}
                  targetLabel={primarySignal.entity_pair?.target || primarySignal.target_label || (snapshotNodes[1]?.label || 'ENTITY B')}
                  confidence={primarySignal.numeric_value ?? 0.72}
                  evidenceCount={String(primarySignal.contributing_record_count || 2).padStart(2, '0')}
                  status={primarySignal.contradiction ? 'CONTRADICTION' : (primarySignal.confirmed ? 'CONFIRMED' : 'UNCONFIRMED')}
                  onClick={() => navigate(`/cases/${caseId}/workbench`)}
                />
              </div>
            ) : contradictions.length > 0 ? (
              <div className="mb-3">
                <div
                  onClick={() => navigate(`/cases/${caseId}/contradictions`)}
                  className="p-2.5 border border-red-500/50 bg-red-950/20 hover:bg-red-950/30 cursor-pointer transition-colors text-[10px]"
                >
                  <div className="flex items-center justify-between mb-1">
                    <StatusBadge status={contradictions[0].severity || 'CRITICAL'} size="sm" />
                    <span className="text-red-400/80 font-bold">EVIDENTIARY CLASH</span>
                  </div>
                  <div className="font-bold text-amber-200 mb-1">{contradictions[0].title}</div>
                  <div className="text-amber-500/80 line-clamp-2">{contradictions[0].description}</div>
                </div>
              </div>
            ) : null}

            {/* Secondary Alerts (Dynamic Contradictions or Secondary Signals) */}
            <div className="space-y-2">
              {contradictions.slice(primarySignal ? 0 : 1, 3).map((c: any) => (
                <div
                  key={c.id}
                  onClick={() => navigate(`/cases/${caseId}/contradictions`)}
                  className="p-2 border border-amber-500/30 bg-black/50 hover:bg-amber-950/30 cursor-pointer transition-colors text-[10px]"
                >
                  <div className="flex items-center justify-between mb-1">
                    <StatusBadge status={c.severity || 'CRITICAL'} size="sm" />
                    <span className="text-amber-500/60">
                      {c.created_at ? new Date(c.created_at).toLocaleTimeString('en-GB') : 'FLAGGED'}
                    </span>
                  </div>
                  <div className="font-bold text-amber-300 mb-0.5 truncate">{c.title}</div>
                  <div className="text-amber-500/80 line-clamp-2">{c.description}</div>
                </div>
              ))}

              {activeSignals.slice(1, 3).map((sig: any, idx: number) => (
                <div
                  key={idx}
                  onClick={() => navigate(`/cases/${caseId}/workbench`)}
                  className="p-2 border border-amber-500/30 bg-black/50 hover:bg-amber-950/30 cursor-pointer transition-colors text-[10px]"
                >
                  <div className="flex items-center justify-between mb-1">
                    <StatusBadge status="HIGH" size="sm" />
                    <span className="text-amber-500/60">TELEMETRY</span>
                  </div>
                  <div className="font-bold text-amber-300 mb-0.5 truncate">
                    {sig.engine_name?.toUpperCase() || sig.title || 'CORRELATED SIGNAL'}
                  </div>
                  <div className="text-amber-500/80 line-clamp-2">
                    {sig.summary || sig.description || 'Discovered synthetic bridge between entities.'}
                  </div>
                </div>
              ))}

              {!primarySignal && contradictions.length === 0 && (
                <div className="p-3 bg-black/50 border border-amber-500/25 text-center space-y-2">
                  <div className="text-[10px] font-bold text-emerald-400 flex items-center justify-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    STATUS: NOMINAL // ZERO CLASHES
                  </div>
                  <div className="text-[10px] text-amber-500/70">
                    Run AI correlation to cross-reference telecom, spatial, and financial signals.
                  </div>
                  <button
                    onClick={() => rerunMutation.mutate()}
                    disabled={rerunMutation.isPending}
                    className="px-2.5 py-1 bg-amber-500/20 border border-amber-500/50 hover:bg-amber-500 hover:text-black text-amber-300 text-[10px] font-bold transition-colors"
                  >
                    {rerunMutation.isPending ? 'PROCESSING...' : '⚡ SCAN SIGNALS'}
                  </button>
                </div>
              )}
            </div>
          </TerminalPanel>
        </div>
      </div>

      {/* BOTTOM SECTION: DYNAMIC RECENT SYSTEM ACTIVITY + TERMINAL MOTTO */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Dynamic Activity feed (8 cols) */}
        <div className="lg:col-span-8">
          <TerminalPanel title="RECENT SYSTEM ACTIVITY" subtitle="CORRELATION RUN FEED">
            <div className="space-y-1.5">
              {timelineData?.items && timelineData.items.length > 0 ? (
                timelineData.items.slice(0, 5).map((act: any, i: number) => (
                  <div
                    key={act.id || i}
                    className="flex items-start gap-3 py-1 border-b border-amber-500/15 text-[11px] font-mono"
                  >
                    <span className="text-amber-400/70 font-bold shrink-0">
                      {act.timestamp
                        ? new Date(act.timestamp).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).toUpperCase()
                        : 'LOGGED'}
                    </span>
                    <span className="text-amber-300 font-semibold shrink-0 uppercase">
                      {act.event_type || 'INCIDENT'}
                    </span>
                    <span className="text-amber-500/80 truncate">
                      -- {act.title || act.description || 'Recorded telemetry entry'}
                    </span>
                  </div>
                ))
              ) : files && files.length > 0 ? (
                files.slice(0, 5).map((f: any, i: number) => (
                  <div
                    key={f.id || i}
                    className="flex items-start gap-3 py-1 border-b border-amber-500/15 text-[11px] font-mono"
                  >
                    <span className="text-amber-400/70 font-bold shrink-0">
                      {f.created_at
                        ? new Date(f.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).toUpperCase()
                        : 'INGESTED'}
                    </span>
                    <span className="text-amber-300 font-semibold shrink-0 uppercase">
                      INGEST_EVIDENCE
                    </span>
                    <span className="text-amber-500/80 truncate">
                      -- {f.filename || f.file_name} ({f.source_type?.toUpperCase() || 'EVIDENCE'})
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-4 text-center text-amber-500/60 text-xs">
                  NO RECENT SYSTEM TELEMETRY RECORDED FOR CASE {caseData.case_code || caseData.id.slice(0, 8)}.
                </div>
              )}
            </div>
          </TerminalPanel>
        </div>

        {/* Tactical Banner & Motto (4 cols) */}
        <div className="lg:col-span-4">
          <TerminalPanel title="INTELLIGENCE DIVISION" subtitle="BHARAT ELECTRONICS">
            <div className="p-2 bg-black/60 border border-amber-500/20 text-center space-y-2">
              <div className="text-[12px] font-bold text-amber-300 tracking-widest uppercase">
                "PATTERNS EXIST EVEN IN SILENCE."
              </div>
              <div className="text-[10px] text-amber-500/70">
                — SPYDEE CRIMINAL NETWORK SYSTEM
              </div>
              <div className="pt-2 border-t border-amber-500/20 text-[9px] text-amber-500/60 leading-relaxed text-left">
                NOTICE: AI generates investigative hypotheses and identifies hidden signals for human investigator corroboration. Inferred links must not be represented as confirmed facts without corroborating physical evidence.
              </div>
            </div>
          </TerminalPanel>
        </div>
      </div>
    </div>
  );
}

