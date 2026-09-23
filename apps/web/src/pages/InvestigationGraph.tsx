import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  ArrowRight,
  User,
  Smartphone,
  Cpu,
  Wallet,
  MapPin,
  Truck,
  Globe,
  Video,
  AlertTriangle,
  Clock,
  Menu,
  Minus,
  Plus,
  Eye,
  EyeOff,
  Settings,
  Target,
  Link,
  Unlink,
  Copy,
  Download,
  HelpCircle,
} from 'lucide-react';
import { TerminalPanel } from '../components/common/TerminalPanel';
import { StatusBadge } from '../components/common/StatusBadge';
import { ConfidenceMeter } from '../components/common/ConfidenceMeter';
import { IntelligenceSignal } from '../components/common/IntelligenceSignal';

const ENTITY_TYPE_CONFIG: Record<string, { color: string; icon: React.ReactNode; shape: string; label: string }> = {
  person: { color: '#06b6d4', icon: <User className="w-4 h-4" />, shape: 'ellipse', label: 'PERSON' },
  phone_sim: { color: '#3b82f6', icon: <Smartphone className="w-4 h-4" />, shape: 'rectangle', label: 'PHONE' },
  sim: { color: '#6366f1', icon: <Smartphone className="w-4 h-4" />, shape: 'rectangle', label: 'SIM' },
  device: { color: '#a855f7', icon: <Cpu className="w-4 h-4" />, shape: 'rectangle', label: 'DEVICE' },
  account: { color: '#eab308', icon: <Wallet className="w-4 h-4" />, shape: 'diamond', label: 'ACCOUNT' },
  location: { color: '#22c55e', icon: <MapPin className="w-4 h-4" />, shape: 'hexagon', label: 'LOCATION' },
  tower: { color: '#22c55e', icon: <MapPin className="w-4 h-4" />, shape: 'hexagon', label: 'TOWER' },
  vehicle: { color: '#f97316', icon: <Truck className="w-4 h-4" />, shape: 'triangle', label: 'VEHICLE' },
  domain_ip: { color: '#ef4444', icon: <Globe className="w-4 h-4" />, shape: 'round-rectangle', label: 'DOMAIN' },
  organization: { color: '#f59e0b', icon: <Network className="w-4 h-4" />, shape: 'ellipse', label: 'ORG' },
  event: { color: '#ef4444', icon: <AlertTriangle className="w-4 h-4" />, shape: 'diamond', label: 'EVENT' },
  document: { color: '#8b5cf6', icon: <HelpCircle className="w-4 h-4" />, shape: 'rectangle', label: 'DOC' },
  cctv: { color: '#9ca3af', icon: <Video className="w-4 h-4" />, shape: 'round-rectangle', label: 'CCTV' },
  ghost: { color: '#ffffff', icon: <Target className="w-4 h-4" />, shape: 'ellipse', label: 'GHOST' },
};

const EDGE_TYPE_CONFIG: Record<string, { color: string; lineStyle: string; width: number; label: string }> = {
  observed: { color: '#06b6d4', lineStyle: 'solid', width: 1.5, label: 'OBSERVED' },
  derived: { color: '#a855f7', lineStyle: 'dashed', width: 1.8, label: 'DERIVED' },
  inferred: { color: '#9ca3af', lineStyle: 'dotted', width: 1.2, label: 'INFERRED' },
  hypothesis: { color: '#f59e0b', lineStyle: 'solid', width: 2.5, label: 'HYPOTHESIS PATH' },
  contradicted: { color: '#ef4444', lineStyle: 'dashed', width: 2, label: 'CONTRADICTION' },
};

const CLUSTER_CONFIG: Record<string, { x: number; y: number; label: string }> = {
  communication: { x: -400, y: -300, label: 'COMMUNICATION CLUSTER' },
  financial: { x: -400, y: 300, label: 'FINANCIAL CLUSTER' },
  physical: { x: 400, y: -300, label: 'PHYSICAL/GEOSPATIAL CLUSTER' },
  cyber: { x: 400, y: 300, label: 'CYBER/INFRASTRUCTURE CLUSTER' },
};

function getClusterForEntity(entityType: string): keyof typeof CLUSTER_CONFIG {
  switch (entityType) {
    case 'person':
    case 'phone_sim':
    case 'sim':
      return 'communication';
    case 'account':
      return 'financial';
    case 'location':
    case 'tower':
    case 'vehicle':
    case 'cctv':
      return 'physical';
    case 'device':
    case 'domain_ip':
    case 'organization':
    case 'event':
    case 'document':
    case 'ghost':
    default:
      return 'cyber';
  }
}

export default function InvestigationGraph() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const cyRef = useRef<HTMLDivElement>(null);
  const cyInstance = useRef<cytoscape.Core | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [selectedEdge, setSelectedEdge] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('ALL');
  const [edgeTypeFilter, setEdgeTypeFilter] = useState('ALL');
  const [minConfidence, setMinConfidence] = useState(0.5);
  const [hiddenLinkActive, setHiddenLinkActive] = useState(false);
  const [nodeDetail, setNodeDetail] = useState<any>(null);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(true);

  const caseIdRef = useRef(caseId);
  useEffect(() => {
    caseIdRef.current = caseId;
  }, [caseId]);

  useEffect(() => {
    if (cyInstance.current) {
      const timer = setTimeout(() => {
        cyInstance.current?.resize();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [showSidePanel, showFilterPanel]);
  const [showTimeSlider, setShowTimeSlider] = useState(false);
  const [timeRange, setTimeRange] = useState<[number, number]>([0, 100]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId?: string; edgeId?: string } | null>(null);
  const [layoutMode, setLayoutMode] = useState<'cose' | 'cose-bilkent' | 'grid' | 'circle'>('cose');
  const [showLabels, setShowLabels] = useState(true);
  const [showEdgeLabels, setShowEdgeLabels] = useState(false);

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

  const { data: cctvData } = useQuery({
    queryKey: ['cctv-observations', caseId],
    queryFn: () => api.getCCTVObservations(caseId!),
    enabled: !!caseId,
  });

  const { data: caseData } = useQuery({
    queryKey: ['case', caseId],
    queryFn: () => api.getCase(caseId!),
    enabled: !!caseId,
  });

  const runSearch = useCallback((term: string) => {
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
  }, []);

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
            'text-opacity': showLabels ? 1 : 0,
          },
        },
        {
          selector: 'node[entity_type = "person"]',
          style: { shape: 'ellipse', 'border-color': '#06b6d4', width: 28, height: 28, 'background-color': '#081a1a' },
        },
        {
          selector: 'node[entity_type = "phone_sim"], node[entity_type = "sim"]',
          style: { shape: 'rectangle', 'border-color': '#3b82f6', width: 26, height: 26, 'background-color': '#1a1a2e' },
        },
        {
          selector: 'node[entity_type = "device"]',
          style: { shape: 'rectangle', 'border-color': '#a855f7', width: 26, height: 26, 'background-color': '#1a0a2e' },
        },
        {
          selector: 'node[entity_type = "account"]',
          style: { shape: 'diamond', 'border-color': '#eab308', width: 26, height: 26, 'background-color': '#1f1a08' },
        },
        {
          selector: 'node[entity_type = "location"], node[entity_type = "tower"]',
          style: { shape: 'hexagon', 'border-color': '#22c55e', width: 28, height: 28, 'background-color': '#0a1f0a' },
        },
        {
          selector: 'node[entity_type = "vehicle"]',
          style: { shape: 'triangle', 'border-color': '#f97316', width: 28, height: 28, 'background-color': '#1f0f08' },
        },
        {
          selector: 'node[entity_type = "domain_ip"]',
          style: { shape: 'round-rectangle', 'border-color': '#ef4444', width: 26, height: 26, 'background-color': '#1f0808' },
        },
        {
          selector: 'node[entity_type = "organization"]',
          style: { shape: 'ellipse', 'border-color': '#f59e0b', width: 28, height: 28, 'background-color': '#1f1508' },
        },
        {
          selector: 'node[entity_type = "event"]',
          style: { shape: 'diamond', 'border-color': '#ef4444', width: 24, height: 24, 'background-color': '#1f0808' },
        },
        {
          selector: 'node[entity_type = "document"]',
          style: { shape: 'rectangle', 'border-color': '#8b5cf6', width: 24, height: 24, 'background-color': '#150a1f' },
        },
        {
          selector: 'node[entity_type = "cctv"]',
          style: { shape: 'round-rectangle', 'border-color': '#9ca3af', width: 24, height: 24, 'background-color': '#0f0f0f' },
        },
        {
          selector: 'node[entity_type = "ghost"]',
          style: { shape: 'ellipse', 'border-color': '#ffffff', width: 30, height: 30, 'background-color': '#000000', 'border-width': 2, 'border-style': 'dashed' },
        },
        {
          selector: 'node.hypothesis-node',
          style: { 'border-color': '#f59e0b', 'border-width': 3, 'background-color': '#1f1508' },
        },
        {
          selector: 'edge',
          style: {
            'line-color': '#d97706',
            width: 1.2,
            'target-arrow-color': '#d97706',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            label: 'data(edge_label)',
            'font-family': 'JetBrains Mono, monospace',
            'font-size': '7px',
            color: '#f59e0b',
            'text-background-color': '#080c08',
            'text-background-opacity': 0.85,
            'text-background-padding': '2px',
            'text-opacity': showEdgeLabels ? 1 : 0,
          },
        },
        {
          selector: 'edge.observed',
          style: { 'line-color': '#06b6d4', width: 1.5, 'line-style': 'solid', 'target-arrow-color': '#06b6d4', 'target-arrow-shape': 'triangle' },
        },
        {
          selector: 'edge.derived',
          style: { 'line-color': '#a855f7', width: 1.8, 'line-style': 'dashed', 'target-arrow-color': '#a855f7', 'target-arrow-shape': 'triangle' },
        },
        {
          selector: 'edge.inferred',
          style: { 'line-color': '#9ca3af', width: 1.2, 'line-style': 'dotted', 'target-arrow-color': '#9ca3af', 'target-arrow-shape': 'triangle' },
        },
        {
          selector: 'edge.hypothesis',
          style: { 'line-color': '#f59e0b', width: 2.5, 'line-style': 'solid', 'target-arrow-color': '#f59e0b', 'target-arrow-shape': 'triangle-tee' },
        },
        {
          selector: 'edge.contradicted',
          style: { 'line-color': '#ef4444', width: 2, 'line-style': 'dashed', 'target-arrow-color': '#ef4444', 'target-arrow-shape': 'tee' },
        },
        {
          selector: 'node.highlighted, node:selected',
          style: { 'border-width': 3, 'border-color': '#34d399' },
        },
        {
          selector: 'edge:selected',
          style: { 'line-color': '#fbbf24', width: 2.5 },
        },
        {
          selector: '.cluster-label',
          style: {
            'font-family': 'JetBrains Mono, monospace',
            'font-size': '10px',
            color: '#f59e0b',
            'text-opacity': 0.7,
            'text-valign': 'center',
            'text-halign': 'center',
            width: '200px',
            height: '30px',
            'background-color': 'transparent',
            'border-width': 0,
          },
        },
      ],
      layout: { name: 'cose', animate: false, nodeDimensionsIncludeLabels: true, idealEdgeLength: 120, padding: 40 },
      minZoom: 0.1,
      maxZoom: 3,
      boxSelectionEnabled: true,
    });

    const cy = cyInstance.current;

    cy.on('tap', 'node', (evt: any) => {
      const node = evt.target;
      const data = node.data();
      const nodeId = data?.id || node.id();
      // Skip cluster label nodes
      if (!nodeId || nodeId.startsWith('cluster-')) return;

      setSelectedEdge(null);
      setSelectedNode(data);
      setShowSidePanel(true);
      setContextMenu(null);

      // Fetch neighbourhood details for real entities
      if (!nodeId.startsWith('cctv-') && caseIdRef.current) {
        api.getNeighbourhood(caseIdRef.current, nodeId, 1)
          .then((d) => setNodeDetail(d))
          .catch(() => {});
      }
    });

    cy.on('tap', 'edge', (evt: any) => {
      const edge = evt.target;
      setSelectedNode(null);
      setSelectedEdge(edge.data());
      setShowSidePanel(true);
      setContextMenu(null);
    });

    cy.on('tap', (evt: any) => {
      if (evt.target === cy) {
        setSelectedNode(null);
        setSelectedEdge(null);
        setShowSidePanel(false);
        setContextMenu(null);
      }
    });

    cy.on('cxttap', 'node', (evt: any) => {
      const node = evt.target;
      const nodeId = node.id();
      // Skip context menu for cluster label nodes (non-UUID IDs)
      if (nodeId.startsWith('cluster-')) return;
      const pos = evt.position || evt.renderedPosition;
      setContextMenu({ x: pos.x, y: pos.y, nodeId: nodeId });
    });

    cy.on('cxttap', 'edge', (evt: any) => {
      const edge = evt.target;
      const pos = evt.position || evt.renderedPosition;
      setContextMenu({ x: pos.x, y: pos.y, edgeId: edge.id() });
    });

    cy.on('mouseover', 'node', (evt: any) => {
      const node = evt.target;
      const pos = evt.renderedPosition;
      node.emit('show-tooltip', { x: pos.x, y: pos.y, data: node.data() });
    });

    cy.on('mouseout', 'node', () => {
      cy.emit('hide-tooltip');
    });

    return () => {
      cyInstance.current?.destroy();
      cyInstance.current = null;
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [showLabels, showEdgeLabels]);

  useEffect(() => {
    if (!cyInstance.current || !graphData) return;
    const cy = cyInstance.current;

    const elements: cytoscape.ElementDefinition[] = [];

    const clusterPositions: Record<string, { x: number; y: number; count: number }> = {
      communication: { x: -400, y: -300, count: 0 },
      financial: { x: -400, y: 300, count: 0 },
      physical: { x: 400, y: -300, count: 0 },
      cyber: { x: 400, y: 300, count: 0 },
    };

    (graphData.nodes || []).forEach((n: any, index: number) => {
      const entityType = (n.entity_type || 'person').toLowerCase();
      const cluster = getClusterForEntity(entityType);
      const clusterPos = clusterPositions[cluster];
      const angle = (clusterPos.count * 0.5) + (index * 0.1);
      const radius = 80 + clusterPos.count * 5;

      elements.push({
        data: {
          id: n.id,
          label: n.label || n.id,
          entity_type: entityType,
          review_state: n.review_state || 'NEW',
          confidence: n.confidence || 0.85,
          raw: n,
          cluster,
        },
        classes: `${entityType.toLowerCase()}`,
        position: {
          x: clusterPos.x + Math.cos(angle) * radius,
          y: clusterPos.y + Math.sin(angle) * radius,
        },
      });
      clusterPos.count++;
    });

    // Add CCTV observations as nodes
    (cctvData || []).forEach((obs: any, index: number) => {
      const cluster = 'physical';
      const clusterPos = clusterPositions[cluster];
      const angle = (clusterPos.count * 0.5) + (index * 0.1);
      const radius = 80 + clusterPos.count * 5;

      elements.push({
        data: {
          id: `cctv-${obs.id}`,
          label: obs.id,
          entity_type: 'cctv',
          review_state: 'NEW',
          confidence: obs.confidence === 'HIGH' ? 0.9 : obs.confidence === 'MEDIUM' ? 0.7 : 0.5,
          raw: obs,
          cluster,
          location: obs.location,
          camera_id: obs.camera_id,
          timestamp: obs.timestamp,
          signals: obs.signals,
        },
        classes: 'cctv',
        position: {
          x: clusterPos.x + Math.cos(angle) * radius,
          y: clusterPos.y + Math.sin(angle) * radius,
        },
      });
      clusterPos.count++;
    });

    Object.entries(clusterPositions).forEach(([key, pos]) => {
      if (pos.count > 0) {
        elements.push({
          data: { id: `cluster-${key}`, label: CLUSTER_CONFIG[key].label },
          classes: 'cluster-label',
          position: { x: pos.x, y: pos.y - 120 },
          selectable: false,
          grabbable: false,
        });
      }
    });

    (graphData.edges || []).forEach((e: any) => {
      const classification = e.classification || 'observed';
      const contradicted = !!(e.properties?.contradiction || e.properties?.contradicted);
      const isHypothesis = classification === 'hypothesis' || e.relationship_type?.includes('HYPOTHESIS');

      let edgeClass = classification;
      if (isHypothesis) edgeClass = 'hypothesis';
      else if (contradicted) edgeClass = 'contradicted';

      elements.push({
        data: {
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.label || e.relationship_type || 'LINKED',
          edge_label: showEdgeLabels ? (e.label || e.relationship_type || '') : '',
          classification,
          raw: e,
          is_hypothesis: isHypothesis,
          contradicted,
        },
        classes: edgeClass,
      });
    });

    cy.elements().remove();
    if (elements.length === 0) return;
    cy.add(elements);

    if (layoutMode === 'cose') {
      cy.layout({
        name: 'cose',
        animate: true,
        animationDuration: 500,
        nodeDimensionsIncludeLabels: true,
        idealEdgeLength: (edge: any) => {
          const cls = edge.classes();
          if (cls.includes('hypothesis')) return 180;
          if (cls.includes('inferred')) return 150;
          return 120;
        },
        padding: 50,
        gravity: 80,
        nodeRepulsion: 4000,
        edgeElasticity: 0.45,
        nestingFactor: 0.1,
        numIter: 1000,
        fit: true,
      }).run();
    } else if (layoutMode === 'grid') {
      cy.layout({ name: 'grid', animate: true, fit: true, padding: 50 }).run();
    } else if (layoutMode === 'circle') {
      cy.layout({ name: 'circle', animate: true, fit: true, padding: 50 }).run();
    }
  }, [graphData, layoutMode, showEdgeLabels]);

  useEffect(() => {
    document.addEventListener('click', () => setContextMenu(null));
    return () => document.removeEventListener('click', () => setContextMenu(null));
  }, []);

  const resetCanvas = () => {
    if (cyInstance.current) {
      cyInstance.current.reset();
      cyInstance.current.fit(undefined, 40);
    }
    setSelectedNode(null);
    setSelectedEdge(null);
    setHiddenLinkActive(false);
    setSearchQuery('');
    setShowSidePanel(false);
  };

  const runLayout = (name: typeof layoutMode) => {
    setLayoutMode(name);
    if (cyInstance.current && cyInstance.current.elements().length > 0) {
      if (name === 'cose') {
        cyInstance.current.layout({ name: 'cose', animate: true, nodeDimensionsIncludeLabels: true, idealEdgeLength: 120, padding: 50 }).run();
      } else if (name === 'grid') {
        cyInstance.current.layout({ name: 'grid', animate: true, fit: true, padding: 50 }).run();
      } else if (name === 'circle') {
        cyInstance.current.layout({ name: 'circle', animate: true, fit: true, padding: 50 }).run();
      }
    }
  };

  const handleContextAction = (action: string) => {
    if (!cyInstance.current || !contextMenu) return;
    const cy = cyInstance.current;

    if (contextMenu.nodeId) {
      const node = cy.getElementById(contextMenu.nodeId);
      switch (action) {
        case 'expand':
          // Skip API call for cluster label nodes
          if (!contextMenu.nodeId.startsWith('cluster-')) {
            api.getNeighbourhood(caseId!, contextMenu.nodeId, 2).then((d) => {
              if (d.nodes) {
                const newNodes = d.nodes.filter((n: any) => !cy.getElementById(n.id).length);
                newNodes.forEach((n: any) => {
                  cy.add({ data: n, classes: n.entity_type.toLowerCase() });
                });
                if (cy.elements().length > 0) {
                  cy.layout({ name: 'cose', animate: true, fit: false }).run();
                }
              }
            });
          }
          break;
        case 'focus':
          cy.fit(node.closedNeighborhood(), 80);
          break;
        case 'compare':
          if (!contextMenu.nodeId.startsWith('cluster-')) {
            navigate(`/cases/${caseId}/entities?compare=${contextMenu.nodeId}`);
          }
          break;
        case 'path':
          if (selectedNode && selectedNode.id !== contextMenu.nodeId && !contextMenu.nodeId.startsWith('cluster-')) {
            api.getPath(caseId!, selectedNode.id, contextMenu.nodeId).then((d) => {
              if (d.path) {
                d.path.forEach((pid: string, i: number) => {
                  if (i < d.path.length - 1) {
                    const edge = cy.edges(`[source = "${pid}"][target = "${d.path[i + 1]}"]`);
                    if (edge.length) edge.addClass('hypothesis').removeClass('observed derived inferred');
                  }
                });
              }
            });
          }
          break;
        case 'hidden':
          setHiddenLinkActive(true);
          break;
      }
    } else if (contextMenu.edgeId) {
      const edge = cy.getElementById(contextMenu.edgeId);
      switch (action) {
        case 'evidence':
          api.getRelEvidence(caseId!, contextMenu.edgeId).then((d) => {
            console.log('Edge evidence:', d);
          });
          break;
        case 'remove':
          edge.remove();
          break;
      }
    }
    setContextMenu(null);
  };

  const entityTypeOptions = useMemo(() => {
    const types = new Set(graphData?.nodes?.map((n: any) => n.entity_type.toUpperCase()) || []);
    return Array.from(types).sort();
  }, [graphData]);

  const entityTypeOptionsTyped = useMemo(() => entityTypeOptions as string[], [entityTypeOptions]);

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
            SOLID CYAN = OBSERVED // DASHED VIOLET = DERIVED // DOTTED GREY = INFERRED // GLOWING AMBER = HYPOTHESIS PATH // RED DASHED = CONTRADICTION
          </div>
        </div>

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
          <button
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className={`p-1.5 bg-black border border-amber-500/40 text-amber-300 hover:bg-amber-500/20 flex items-center gap-1 ${showFilterPanel ? 'shadow-[0_0_8px_rgba(245,158,11,0.3)]' : ''}`}
            title="Toggle Filter Panel"
          >
            <Filter className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setShowTimeSlider(!showTimeSlider)}
            className={`p-1.5 bg-black border border-amber-500/40 text-amber-300 hover:bg-amber-500/20 flex items-center gap-1 ${showTimeSlider ? 'shadow-[0_0_8px_rgba(245,158,11,0.3)]' : ''}`}
            title="Toggle Time Slider"
          >
            <Clock className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* CONTROLS BAR */}
      <div className="p-2 bg-[#0a0f0a] border border-amber-500/30 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-black/80 border border-amber-500/40 px-2 py-1 min-w-[170px]">
            <Search className="w-3.5 h-3.5 text-amber-500/70" />
            <input
              type="text"
              placeholder="SEARCH GRAPH..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); runSearch(e.target.value); }}
              className="bg-transparent text-amber-300 placeholder-amber-500/40 outline-none w-full text-xs font-mono"
            />
          </div>

          <select
            value={selectedTypeFilter}
            onChange={(e) => setSelectedTypeFilter(e.target.value)}
            className="bg-black border border-amber-500/40 text-amber-300 text-xs px-2 py-1 outline-none font-mono"
          >
            <option value="ALL">ALL NODE TYPES</option>
            {entityTypeOptionsTyped.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>

          <select
            value={edgeTypeFilter}
            onChange={(e) => setEdgeTypeFilter(e.target.value)}
            className="bg-black border border-amber-500/40 text-amber-300 text-xs px-2 py-1 outline-none font-mono"
          >
            <option value="ALL">ALL EDGE TYPES</option>
            <option value="OBSERVED">OBSERVED</option>
            <option value="DERIVED">DERIVED</option>
            <option value="INFERRED">INFERRED</option>
            <option value="HYPOTHESIS">HYPOTHESIS PATH</option>
            <option value="CONTRADICTION">CONTRADICTION</option>
          </select>

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
            <span className="text-amber-300 font-bold w-7">{Math.round(minConfidence * 100)}%</span>
          </div>

          <select
            value={layoutMode}
            onChange={(e) => runLayout(e.target.value as typeof layoutMode)}
            className="bg-black border border-amber-500/40 text-amber-300 text-xs px-2 py-1 outline-none font-mono"
          >
            <option value="cose">FORCE-DIRECTED</option>
            <option value="grid">GRID</option>
            <option value="circle">CIRCLE</option>
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <button onClick={() => cyInstance.current?.zoom(cyInstance.current.zoom() * 1.25)} className="p-1 bg-black border border-amber-500/40 text-amber-300 hover:bg-amber-500/20" title="Zoom In"><ZoomIn className="w-3.5 h-3.5" /></button>
          <button onClick={() => cyInstance.current?.zoom(cyInstance.current.zoom() * 0.8)} className="p-1 bg-black border border-amber-500/40 text-amber-300 hover:bg-amber-500/20" title="Zoom Out"><ZoomOut className="w-3.5 h-3.5" /></button>
          <button onClick={resetCanvas} className="px-2 py-1 bg-black border border-amber-500/40 text-amber-300 hover:bg-amber-500/20 text-[10px] flex items-center gap-1"><RotateCcw className="w-3 h-3" /><span>RESET</span></button>
          <button onClick={() => setShowLabels(!showLabels)} className={`p-1 bg-black border border-amber-500/40 text-amber-300 hover:bg-amber-500/20 ${showLabels ? 'shadow-[0_0_8px_rgba(245,158,11,0.3)]' : ''}`} title="Toggle Labels"><Eye className="w-3.5 h-3.5" /></button>
          <button onClick={() => setShowEdgeLabels(!showEdgeLabels)} className={`p-1 bg-black border border-amber-500/40 text-amber-300 hover:bg-amber-500/20 ${showEdgeLabels ? 'shadow-[0_0_8px_rgba(245,158,11,0.3)]' : ''}`} title="Toggle Edge Labels"><Link className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {/* TIME SLIDER */}
      {showTimeSlider && (
        <div className="p-2 bg-[#0a0f0a] border border-amber-500/30 shrink-0">
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-amber-500/70 font-bold">TIME RANGE:</span>
            <input type="range" min="0" max="100" value={timeRange[0]} onChange={(e) => setTimeRange([parseInt(e.target.value), timeRange[1]])} className="flex-1 accent-amber-500" />
            <span className="text-amber-300 font-bold w-20">{timeRange[0]}%</span>
            <span className="text-amber-500/70">TO</span>
            <input type="range" min="0" max="100" value={timeRange[1]} onChange={(e) => setTimeRange([timeRange[0], parseInt(e.target.value)])} className="flex-1 accent-amber-500" />
            <span className="text-amber-300 font-bold w-20">{timeRange[1]}%</span>
            <button onClick={() => setTimeRange([0, 100])} className="px-2 py-0.5 bg-black border border-amber-500/40 text-amber-300 hover:bg-amber-500/20 text-[10px]">RESET</button>
          </div>
        </div>
      )}

      {/* MAIN GRAPH WORKSPACE */}
      <div className="w-full flex-1 min-h-[500px] grid grid-cols-1 lg:grid-cols-12 gap-3 relative">
        {/* FILTER PANEL */}
        {showFilterPanel && (
          <div className="lg:col-span-3 xl:col-span-2 space-y-3 overflow-y-auto">
            <TerminalPanel title="FILTER CONTROLS" subtitle="GRAPH REFINEMENT">
              <div className="space-y-3 text-xs">
                <div>
                  <div className="text-[10px] text-amber-500/70 font-bold uppercase mb-1">ENTITY TYPES</div>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {Object.entries(ENTITY_TYPE_CONFIG).map(([key, config]) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer text-[11px] p-1 hover:bg-amber-500/10">
                        <input type="checkbox" defaultChecked className="accent-amber-500 w-3 h-3" />
                        <span className="flex items-center gap-1.5">
                          {config.icon}
                          <span className="text-amber-300">{config.label}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="border-t border-amber-500/20 pt-2">
                  <div className="text-[10px] text-amber-500/70 font-bold uppercase mb-1">EVIDENCE TYPES</div>
                  <div className="space-y-1">
                    {['OBSERVED', 'DERIVED', 'INFERRED', 'HYPOTHESIS PATH', 'CONTRADICTION'].map((type) => (
                      <label key={type} className="flex items-center gap-2 cursor-pointer text-[11px] p-1 hover:bg-amber-500/10">
                        <input type="checkbox" defaultChecked className="accent-amber-500 w-3 h-3" />
                        <span className="text-amber-300">{type}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="border-t border-amber-500/20 pt-2">
                  <div className="text-[10px] text-amber-500/70 font-bold uppercase mb-1">CONFIDENCE THRESHOLD</div>
                  <input type="range" min="0" max="100" value={minConfidence * 100} onChange={(e) => setMinConfidence(parseInt(e.target.value) / 100)} className="w-full accent-amber-500" />
                  <div className="flex justify-between text-[10px] text-amber-500/70 mt-1">
                    <span>0%</span>
                    <span className="text-amber-300 font-bold">{Math.round(minConfidence * 100)}%</span>
                    <span>100%</span>
                  </div>
                </div>

                <div className="border-t border-amber-500/20 pt-2">
                  <div className="text-[10px] text-amber-500/70 font-bold uppercase mb-1">DATE RANGE</div>
                  <div className="space-y-1">
                    <input type="date" className="w-full bg-black border border-amber-500/40 text-amber-300 text-[11px] px-1 py-0.5 outline-none" />
                    <input type="date" className="w-full bg-black border border-amber-500/40 text-amber-300 text-[11px] px-1 py-0.5 outline-none" />
                  </div>
                </div>

                <div className="border-t border-amber-500/20 pt-2">
                  <div className="text-[10px] text-amber-500/70 font-bold uppercase mb-1">HYPOTHESIS FILTER</div>
                  <select className="w-full bg-black border border-amber-500/40 text-amber-300 text-xs px-2 py-1 outline-none font-mono">
                    <option value="">ALL HYPOTHESES</option>
                    <option value="H-001">H-001: Suspect A ↝ Suspect B</option>
                    <option value="H-002">H-002: Device D-021 ↔ SIM Churn</option>
                  </select>
                </div>
              </div>
            </TerminalPanel>
          </div>
        )}

        {/* GRAPH CANVAS AREA */}
        <div className={`${
          showSidePanel && (selectedNode || selectedEdge)
            ? showFilterPanel ? 'lg:col-span-6 xl:col-span-7' : 'lg:col-span-9 xl:col-span-9'
            : showFilterPanel ? 'lg:col-span-9 xl:col-span-10' : 'lg:col-span-12'
        } relative bg-[#060a06] border border-amber-500/35 overflow-hidden flex flex-col`}>
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
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

          <div ref={cyRef} className="w-full h-full min-h-[460px] cursor-grab active:cursor-grabbing select-none relative" />

          {contextMenu && (
            <div
              className="fixed bg-[#0b100b] border border-amber-500/60 p-1 text-xs z-50 shadow-[0_0_15px_rgba(245,158,11,0.4)]"
              style={{ left: contextMenu.x + 280, top: contextMenu.y + 100 }}
            >
              {contextMenu.nodeId && (
                <>
                  <button onClick={() => handleContextAction('expand')} className="w-full text-left px-2 py-1 text-amber-300 hover:bg-amber-500/20 flex items-center gap-1"><Plus className="w-3 h-3" /><span>EXPAND NEIGHBORS</span></button>
                  <button onClick={() => handleContextAction('focus')} className="w-full text-left px-2 py-1 text-amber-300 hover:bg-amber-500/20 flex items-center gap-1"><Target className="w-3 h-3" /><span>FOCUS PATH</span></button>
                  <button onClick={() => handleContextAction('compare')} className="w-full text-left px-2 py-1 text-amber-300 hover:bg-amber-500/20 flex items-center gap-1"><Link className="w-3 h-3" /><span>COMPARE ENTITIES</span></button>
                  <button onClick={() => handleContextAction('path')} className="w-full text-left px-2 py-1 text-amber-300 hover:bg-amber-500/20 flex items-center gap-1"><ArrowRight className="w-3 h-3" /><span>FIND HIDDEN LINKS</span></button>
                  <button onClick={() => handleContextAction('hidden')} className="w-full text-left px-2 py-1 text-amber-400 hover:bg-amber-500/20 flex items-center gap-1"><Sparkles className="w-3 h-3" /><span>ANALYZE HIDDEN LINK</span></button>
                </>
              )}
              {contextMenu.edgeId && (
                <>
                  <button onClick={() => handleContextAction('evidence')} className="w-full text-left px-2 py-1 text-amber-300 hover:bg-amber-500/20 flex items-center gap-1"><Info className="w-3 h-3" /><span>VIEW EVIDENCE DETAIL</span></button>
                  <button onClick={() => handleContextAction('remove')} className="w-full text-left px-2 py-1 text-red-400 hover:bg-red-500/20 flex items-center gap-1"><X className="w-3 h-3" /><span>HIDE EDGE</span></button>
                </>
              )}
            </div>
          )}

          {hiddenLinkActive && (
            <div className="absolute top-4 left-4 p-2.5 bg-black/90 border border-amber-400 text-xs text-amber-300 animate-pulse pointer-events-none flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>ACTIVE SYNTHESIS: HIDDEN LINK ↝ 67% [UNCONFIRMED HYPOTHESIS H-01]</span>
            </div>
          )}

          <div className="absolute bottom-2 left-2 right-2 flex flex-wrap items-center justify-between gap-2 p-2 bg-black/85 border border-amber-500/30 text-[10px]">
            <div className="flex items-center gap-3">
              <span className="text-amber-500/70 font-bold">NODE TYPES:</span>
              {Object.entries(ENTITY_TYPE_CONFIG).map(([key, config]) => (
                <span key={key} className="flex items-center gap-1" style={{ color: config.color }}>
                  {config.icon}
                  <span>{config.label}</span>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-amber-300 font-bold" style={{ borderBottom: '1px solid #06b6d4' }}>── OBSERVED</span>
              <span className="text-amber-400 font-bold" style={{ borderBottom: '2px dashed #a855f7' }}>╌╌ DERIVED</span>
              <span className="text-amber-500/70 font-bold" style={{ borderBottom: '1px dotted #9ca3af' }}>⋯⋯ INFERRED</span>
              <span className="text-amber-400 font-bold" style={{ borderBottom: '2px solid #f59e0b', boxShadow: '0 0 8px #f59e0b' }}>── HYPOTHESIS</span>
              <span className="text-red-400 font-bold" style={{ borderBottom: '2px dashed #ef4444' }}>╌╌ CONTRADICTION</span>
            </div>
          </div>
        </div>

        {/* SIDE DETAIL DRAWER */}
        {showSidePanel && (selectedNode || selectedEdge) && (
          <div className="lg:col-span-3 xl:col-span-3 bg-[#0a0f0a] border border-amber-500/40 p-3 space-y-3 overflow-y-auto max-h-[calc(100vh-220px)] min-h-[520px] w-full justify-self-end">
            {selectedNode && (
              <>
                <div className="flex items-center justify-between border-b border-amber-500/30 pb-2">
                  <span className="font-bold text-amber-300 text-xs uppercase flex items-center gap-1.5">
                    {ENTITY_TYPE_CONFIG[selectedNode.entity_type]?.icon || <Target className="w-3.5 h-3.5 text-amber-400" />}
                    <span>{(selectedNode.entity_type || 'ENTITY').toUpperCase()} NODE DOSSIER</span>
                  </span>
                  <button
                    onClick={() => {
                      setShowSidePanel(false);
                      setSelectedNode(null);
                      setSelectedEdge(null);
                    }}
                    className="text-amber-500 hover:text-amber-300 text-xs font-bold px-1"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-2 text-[11px]">
                  <div>
                    <div className="text-[9px] text-amber-500/60 uppercase">LABEL / IDENTIFIER:</div>
                    <div className="font-bold text-amber-200 text-xs">{selectedNode.label || selectedNode.id}</div>
                    <div className="text-[9px] text-amber-500/70 font-mono mt-0.5 truncate">{selectedNode.id}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 p-1.5 bg-black/60 border border-amber-500/20 text-[10px]">
                    <div>
                      <span className="text-amber-500/70">ENTITY TYPE:</span>
                      <div className="text-amber-300 font-bold uppercase">{selectedNode.entity_type || 'UNKNOWN'}</div>
                    </div>
                    <div>
                      <span className="text-amber-500/70">CLUSTER:</span>
                      <div className="text-amber-300 font-bold uppercase">{selectedNode.cluster || 'COMMUNICATION'}</div>
                    </div>
                    <div>
                      <span className="text-amber-500/70">REVIEW STATE:</span>
                      <div className="text-emerald-400 font-bold uppercase">{selectedNode.review_state || 'ACTIVE'}</div>
                    </div>
                    <div>
                      <span className="text-amber-500/70">CONFIDENCE:</span>
                      <div className="text-amber-300 font-bold">{Math.round((selectedNode.confidence || 0.85) * 100)}%</div>
                    </div>
                  </div>

                  <ConfidenceMeter value={selectedNode.confidence || 0.85} label="INTELLIGENCE CONFIDENCE" />

                  {/* CCTV observation details */}
                  {selectedNode.entity_type === 'cctv' && (
                    <div className="space-y-1.5 border-t border-amber-500/20 pt-2 text-[10px]">
                      <div className="flex justify-between">
                        <span className="text-amber-500/70">CAMERA ID:</span>
                        <span className="text-amber-300 font-bold">{selectedNode.camera_id || selectedNode.id}</span>
                      </div>
                      {selectedNode.location && (
                        <div>
                          <span className="text-amber-500/70">LOCATION:</span>
                          <div className="text-amber-300">{selectedNode.location}</div>
                        </div>
                      )}
                      {selectedNode.timestamp && (
                        <div className="flex justify-between">
                          <span className="text-amber-500/70">TIMESTAMP:</span>
                          <span className="text-amber-300">{selectedNode.timestamp}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Raw telemetry attributes if present */}
                  {selectedNode.raw?.properties && Object.keys(selectedNode.raw.properties).length > 0 && (
                    <div className="space-y-1 border-t border-amber-500/20 pt-2 text-[10px]">
                      <div className="text-[9px] text-amber-500/60 uppercase">TELEMETRY & ATTRIBUTES:</div>
                      {Object.entries(selectedNode.raw.properties)
                        .filter(([k]) => !['degree'].includes(k))
                        .slice(0, 6)
                        .map(([k, v]: [string, any]) => (
                          <div key={k} className="flex justify-between text-[10px]">
                            <span className="text-amber-500/70 uppercase">{k.replace(/_/g, ' ')}:</span>
                            <span className="text-amber-300 font-mono truncate max-w-[140px]">{String(v)}</span>
                          </div>
                        ))}
                    </div>
                  )}

                  {/* DIRECT CONNECTIONS */}
                  <div className="space-y-1.5 border-t border-amber-500/20 pt-2 text-[10px]">
                    <div className="text-amber-500/70 uppercase font-bold">DIRECT CONNECTIONS:</div>
                    <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                      {nodeDetail?.nodes?.length > 1 ? (
                        nodeDetail.nodes
                          .filter((n: any) => n.id !== selectedNode.id)
                          .slice(0, 10)
                          .map((r: any) => (
                            <div
                              key={r.id}
                              onClick={() => {
                                const target = cyInstance.current?.getElementById(r.id);
                                if (target && target.length > 0) {
                                  cyInstance.current?.elements().unselect();
                                  target.select();
                                  setSelectedNode(target.data());
                                  if (!r.id.startsWith('cctv-') && caseIdRef.current) {
                                    api.getNeighbourhood(caseIdRef.current, r.id, 1).then((d) => setNodeDetail(d)).catch(() => {});
                                  }
                                }
                              }}
                              className="p-1.5 bg-black/60 border border-amber-500/20 hover:border-amber-400 cursor-pointer flex justify-between items-center text-[10px] transition-colors"
                            >
                              <span className="text-amber-300 font-bold truncate max-w-[130px]">{r.label}</span>
                              <span className="text-amber-500/70 uppercase text-[9px]">{r.entity_type}</span>
                            </div>
                          ))
                      ) : (
                        <div className="p-1.5 bg-black/60 border border-amber-500/20 text-[10px] text-amber-500/60">
                          No adjacent connections recorded.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ACTION BUTTONS */}
                  <div className="space-y-1.5 pt-2 border-t border-amber-500/20">
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        onClick={() => navigate(`/cases/${caseId}/entities`)}
                        className="py-1.5 px-2 bg-black border border-amber-500/50 hover:bg-amber-500/20 text-amber-300 font-bold text-center text-[10px] flex items-center justify-center gap-1 uppercase"
                      >
                        <span>DOSSIER</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => navigate(`/cases/${caseId}/timeline?entity=${selectedNode.id}`)}
                        className="py-1.5 px-2 bg-black border border-amber-500/50 hover:bg-amber-500/20 text-amber-300 font-bold text-center text-[10px] flex items-center justify-center gap-1 uppercase"
                      >
                        <span>TIMELINE</span>
                        <Clock className="w-3 h-3" />
                      </button>
                    </div>
                    <button
                      onClick={() => navigate(`/cases/${caseId}/map`)}
                      className="w-full py-1.5 bg-amber-500 text-black font-bold hover:bg-amber-400 text-center text-[10px] uppercase flex items-center justify-center gap-1"
                    >
                      <MapPin className="w-3 h-3" />
                      <span>VIEW ON NETWORK MAP [→]</span>
                    </button>
                  </div>
                </div>
              </>
            )}

            {selectedEdge && (
              <>
                <div className="flex items-center justify-between border-b border-amber-500/30 pb-2">
                  <span className="font-bold text-amber-300 text-xs uppercase flex items-center gap-1.5">
                    <Link className="w-3.5 h-3.5 text-amber-400" />
                    <span>EDGE LINK DOSSIER</span>
                  </span>
                  <button
                    onClick={() => {
                      setShowSidePanel(false);
                      setSelectedEdge(null);
                      setSelectedNode(null);
                    }}
                    className="text-amber-500 hover:text-amber-300 text-xs font-bold px-1"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-2 text-[11px]">
                  <div>
                    <div className="text-[9px] text-amber-500/60 uppercase">RELATIONSHIP:</div>
                    <div className="font-bold text-amber-200 text-xs">{selectedEdge.label || selectedEdge.relationship_type || 'LINKED'}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 p-1.5 bg-black/60 border border-amber-500/20 text-[10px]">
                    <div>
                      <span className="text-amber-500/70">CLASS:</span>
                      <div className="text-amber-300 font-bold uppercase">{selectedEdge.classification || 'OBSERVED'}</div>
                    </div>
                    <div>
                      <span className="text-amber-500/70">EVIDENCE:</span>
                      <div className="text-emerald-400 font-bold">{selectedEdge.raw?.properties?.evidence_count || 1} hits</div>
                    </div>
                  </div>

                  <div className="p-1.5 bg-black/60 border border-amber-500/20 space-y-1 text-[10px]">
                    <div className="flex justify-between"><span className="text-amber-500/70">SOURCE:</span><span className="text-amber-300 font-mono truncate max-w-[140px]">{selectedEdge.source}</span></div>
                    <div className="flex justify-between"><span className="text-amber-500/70">TARGET:</span><span className="text-amber-300 font-mono truncate max-w-[140px]">{selectedEdge.target}</span></div>
                  </div>

                  <button
                    onClick={() => api.getRelEvidence(caseId!, selectedEdge.id).then((d) => console.log('Evidence:', d))}
                    className="w-full py-1.5 bg-black border border-amber-500/50 hover:bg-amber-500/20 text-amber-300 font-bold text-center text-xs flex items-center justify-center gap-1 uppercase"
                  >
                    <span>VIEW EVIDENCE CHAIN</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}