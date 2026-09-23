import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState, useMemo } from 'react';
import { api } from '../lib/api';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  Play,
  Pause,
  ShieldAlert,
  Crosshair,
  User,
  Truck,
  AlertTriangle,
  Wifi,
  Zap,
  Target,
  Video,
} from 'lucide-react';
import { TerminalPanel } from '../components/common/TerminalPanel';
import { StatusBadge } from '../components/common/StatusBadge';
import { ConfidenceMeter } from '../components/common/ConfidenceMeter';

const ENTITY_MARKER_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  person: { color: '#06b6d4', icon: <User className="w-3.5 h-3.5" />, label: 'PERSON' },
  phone_sim: { color: '#3b82f6', icon: <Wifi className="w-3.5 h-3.5" />, label: 'PHONE' },
  sim: { color: '#6366f1', icon: <Wifi className="w-3.5 h-3.5" />, label: 'SIM' },
  device: { color: '#a855f7', icon: <Zap className="w-3.5 h-3.5" />, label: 'DEVICE' },
  account: { color: '#eab308', icon: <Target className="w-3.5 h-3.5" />, label: 'ACCOUNT' },
  location: { color: '#22c55e', icon: <MapPin className="w-3.5 h-3.5" />, label: 'LOCATION' },
  tower: { color: '#22c55e', icon: <Wifi className="w-3.5 h-3.5" />, label: 'TOWER' },
  vehicle: { color: '#f97316', icon: <Truck className="w-3.5 h-3.5" />, label: 'VEHICLE' },
  cctv: { color: '#9ca3af', icon: <Video className="w-3.5 h-3.5" />, label: 'CCTV' },
  event: { color: '#ef4444', icon: <AlertTriangle className="w-3.5 h-3.5" />, label: 'EVENT' },
};

const KNOWN_COORDINATES: Record<string, [number, number]> = {
  // Bangalore Towers & Cameras
  'TOWER-KA-BLR-BELLARY-01': [13.0358, 77.5970],
  'TOWER-KA-BLR-HEBBAL-01': [13.0358, 77.5970],
  'TOWER-KA-BLR-HEBBAL-02': [13.0358, 77.5970],
  'TOWER-KA-BLR-KOR-03': [12.9352, 77.6245],
  'TOWER-KA-BLR-WHITEFIELD-05': [12.9866, 77.7381],
  'TOWER-KA-BLR-INDIRANAGAR-06': [12.9719, 77.6412],
  'TOWER-KA-BLR-MAJESTIC-01': [12.9772, 77.5713],
  'TOWER-KA-BLR-YESHWANTHPUR-02': [13.0238, 77.5503],
  'TOWER-KA-BLR-GORAGUNTE-03': [13.0285, 77.5412],
  'TOWER-KA-BLR-TUMKUR-04': [13.0489, 77.5123],
  'TOWER-KA-BLR-NELAMANGALA-05': [13.0982, 77.3891],
  'TOWER-KA-BLR-PEENYA-01': [13.0315, 77.5188],
  'TOWER-KA-BLR-SILKBOARD-03': [12.9176, 77.6238],
  'TOWER-KA-BLR-ECITY-04': [12.8452, 77.6602],
  'TOWER-KA-BLR-ATTIBELE-05': [12.7825, 77.7812],
  'TOWER-KA-BLR-EAST-09': [12.9750, 77.6700],
  'TOWER-KA-BLR-AIRPORT-01': [13.1989, 77.7068],
  'CAM-BLR-AIRPORT-ROAD-01': [13.0358, 77.5970],
  'CAM-BLR-KOR-03': [12.9352, 77.6245],
  'CAM-BLR-WHITEFIELD-05': [12.9866, 77.7381],
  'CAM-BLR-INDIRANAGAR-06': [12.9719, 77.6412],
  'CAM-BLR-MAJESTIC-01': [12.9772, 77.5713],
  'CAM-BLR-YESHWANTHPUR-02': [13.0238, 77.5503],
  'CAM-BLR-GORAGUNTE-03': [13.0285, 77.5412],
  'CAM-BLR-TUMKUR-ROAD-04': [13.0489, 77.5123],
  'CAM-BLR-NELAMANGALA-05': [13.0982, 77.3891],
  'CAM-BLR-PEENYA-01': [13.0315, 77.5188],
  'CAM-BLR-HEBBAL-02': [13.0358, 77.5970],
  'CAM-BLR-SILKBOARD-03': [12.9176, 77.6238],
  'CAM-BLR-ECITY-04': [12.8452, 77.6602],
  'CAM-NH44-HOSUR-BORDER-05': [12.7825, 77.7812],
  'CAM-BLR-AIRPORT-TOLL-02': [13.1989, 77.7068],
  // Mumbai
  'TOWER-MH-MUMBAI-BKC-04': [19.0657, 72.8687],
  'TOWER-MH-MUMBAI-01': [18.9220, 72.8347],
  // Jamtara / Jharkhand
  'TOWER-JH-JAMTARA-KARM-01': [23.9625, 86.8014],
  // Pune
  'TOWER-MH-PUNE-01': [18.5204, 73.8567],
  'TW-01': [18.5314, 73.8446],
  'TW-02': [18.5173, 73.8418],
  'TW-03': [18.5018, 73.8585],
  'TW-04': [18.5132, 73.8789],
  'TW-05': [18.5362, 73.8938],
};

function getValidCoordinates(item: any, defaultBase: [number, number] = [12.9716, 77.5946]): [number, number] {
  const explicitLat = Number(item.lat ?? item.attributes?.lat ?? item.attributes?.latitude);
  const explicitLon = Number(item.lon ?? item.attributes?.lon ?? item.attributes?.longitude);
  if (!Number.isNaN(explicitLat) && !Number.isNaN(explicitLon) && explicitLat !== 0 && explicitLon !== 0) {
    return [explicitLat, explicitLon];
  }
  const label = (item.label || item.id || '').toUpperCase().trim();
  if (KNOWN_COORDINATES[label]) {
    return KNOWN_COORDINATES[label];
  }
  for (const [key, coords] of Object.entries(KNOWN_COORDINATES)) {
    if (label.includes(key) || key.includes(label)) {
      return coords;
    }
  }
  // Deterministic pseudo-offset
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = (hash << 5) - hash + label.charCodeAt(i);
    hash |= 0;
  }
  const dLat = ((Math.abs(hash) % 1000) / 1000 - 0.5) * 0.12;
  const dLon = ((Math.abs(hash >> 3) % 1000) / 1000 - 0.5) * 0.12;
  const baseLat = label.includes('MUMBAI') || label.includes('MH-') ? 19.0657 : defaultBase[0];
  const baseLon = label.includes('MUMBAI') || label.includes('MH-') ? 72.8687 : defaultBase[1];
  return [Number((baseLat + dLat).toFixed(4)), Number((baseLon + dLon).toFixed(4))];
}

function createCustomIcon(html: string, size: [number, number] = [28, 28], anchor: [number, number] = [14, 14]) {
  return L.divIcon({
    className: '',
    html,
    iconSize: size,
    iconAnchor: anchor,
  });
}

function getActivityColor(count: number): string {
  if (count >= 50) return '#ef4444';
  if (count >= 30) return '#f97316';
  if (count >= 15) return '#f59e0b';
  if (count >= 5) return '#22c55e';
  return '#06b6d4';
}

export default function NetworkMap() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);

  // Layer toggles
  const [showTowers, setShowTowers] = useState(true);
  const [showPersons, setShowPersons] = useState(true);
  const [showCCTV, setShowCCTV] = useState(true);
  const [showEvents, setShowEvents] = useState(true);
  const [showColocations, setShowColocations] = useState(true);
  const [showTrajectories, setShowTrajectories] = useState(true);

  // Temporal Playback
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeIndex, setTimeIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [selectedMarker, setSelectedMarker] = useState<any>(null);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<[string, string]>(['', '']);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [showConnections, setShowConnections] = useState(true);
  const [showOnlyConnected, setShowOnlyConnected] = useState(true);

  const { data: entities = [] } = useQuery({
    queryKey: ['entities', caseId],
    queryFn: () => api.getEntities(caseId!).catch(() => []),
    enabled: !!caseId,
  });

  const { data: cctvData } = useQuery({
    queryKey: ['cctv-observations', caseId],
    queryFn: () => api.getCCTVObservations(caseId!).catch(() => []),
    enabled: !!caseId,
  });

  const { data: caseData } = useQuery({
    queryKey: ['case', caseId],
    queryFn: () => api.getCase(caseId!).catch(() => null),
    enabled: !!caseId,
  });

  // Fetch entity connections for map visualization
  const { data: entityConnections = [] } = useQuery({
    queryKey: ['entity-connections', caseId],
    queryFn: async () => {
      if (!caseId) return [];
      try {
        // Get all edges for this case to build connections
        const apiBase = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE) || '/api/v1';
        const res = await fetch(`${apiBase}/graph/${caseId}/edges?limit=500`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('spydee_token') || localStorage.getItem('access_token') || ''}` }
        });
        if (!res.ok) return [];
        const data = await res.json();
        return data.edges || data || [];
      } catch (e) {
        console.warn('Failed to fetch entity connections:', e);
        return [];
      }
    },
    enabled: !!caseId,
  });

  // Compute connected entity IDs from edges
  const connectedEntityIds = useMemo(() => {
    const ids = new Set<string>();
    entityConnections.forEach((edge: any) => {
      ids.add(edge.source);
      ids.add(edge.target);
    });
    return ids;
  }, [entityConnections]);

  // Filter entities to only those with connections when showOnlyConnected is true
  const displayEntities = useMemo(() => {
    if (!showOnlyConnected) return entities;
    return (entities || []).filter((e: any) => connectedEntityIds.has(e.id));
  }, [entities, connectedEntityIds, showOnlyConnected]);

  // Default coordinate center based on case title
  const defaultCenter = useMemo<[number, number]>(() => {
    const title = (caseData?.title || '').toLowerCase();
    if (title.includes('mumbai') || title.includes('bkc')) return [19.0760, 72.8777];
    if (title.includes('pune') || title.includes('darkescrow')) return [18.5204, 73.8567];
    if (title.includes('delhi')) return [28.6139, 77.2090];
    if (title.includes('jamtara')) return [23.9625, 86.8014];
    return [12.9716, 77.5946]; // Bangalore SafeCity default
  }, [caseData?.title]);

  // CCTV observations with fallback
  const cctvObservations = useMemo(() => {
    if (cctvData && cctvData.length > 0) {
      return cctvData.map((obs: any) => {
        const [lat, lon] = getValidCoordinates(obs, defaultCenter);
        return {
          id: obs.id,
          label: obs.label || obs.id,
          location: obs.location || 'SafeCity Chokepoint',
          lat,
          lon,
          timestamp: obs.timestamp || '2026-08-14T08:30:00Z',
          signals: obs.signals || ['ANPR_MATCH'],
          confidence: obs.confidence || 'HIGH',
        };
      });
    }
    return [
      { id: 'CCTV-BLR-01', label: 'CAM-HEBBAL-FLYOVER', location: 'Hebbal Airport Corridor', lat: 13.0358, lon: 77.5970, timestamp: '2026-08-14T08:30:00Z', signals: ['AIRPORT_TRANSIT', 'SUV_EXIT'], confidence: 'HIGH' },
      { id: 'CCTV-BLR-02', label: 'CAM-MAJESTIC-TERMINUS', location: 'Majestic Bus Platform 4', lat: 12.9772, lon: 77.5713, timestamp: '2026-08-14T09:15:00Z', signals: ['DISGUISE_MATCH', 'RED_NOTICE'], confidence: 'HIGH' },
      { id: 'CCTV-BLR-03', label: 'CAM-PEENYA-LOGISTICS', location: 'Peenya 2nd Stage Gate', lat: 13.0315, lon: 77.5188, timestamp: '2026-08-14T11:45:00Z', signals: ['TEMPO_OFFLOAD'], confidence: 'MEDIUM' },
    ];
  }, [cctvData, defaultCenter]);

  // Co-location events
  const colocationEvents = useMemo(() => [
    { id: 'COL-001', lat: defaultCenter[0] + 0.015, lon: defaultCenter[1] + 0.012, label: 'CO-LOCATED ×6', entities: ['SANJAY DESHMUKH', 'VIKRAM MALHOTRA'], timestamp: '2026-08-16T23:15:00Z', count: 6 },
    { id: 'COL-002', lat: defaultCenter[0] - 0.018, lon: defaultCenter[1] - 0.015, label: 'CO-LOCATED ×4', entities: ['RAJESH KUMAR', 'MAHESH GOWDA'], timestamp: '2026-08-17T01:30:00Z', count: 4 },
    { id: 'COL-003', lat: defaultCenter[0] + 0.025, lon: defaultCenter[1] - 0.020, label: 'CO-LOCATED ×3', entities: ['SIMBOX HARDWARE', 'BURNER SIM 01'], timestamp: '2026-08-18T02:20:00Z', count: 3 },
  ], [defaultCenter]);

  // Trajectory data
  const trajectories = useMemo(() => [
    { entityId: 'TARGET-01', label: 'SUV KA-04-ME-7788', color: '#f97316', path: [
      { lat: 12.9772, lon: 77.5713, time: 0, tower: 'MAJESTIC' },
      { lat: 13.0238, lon: 77.5503, time: 1, tower: 'YESHWANTHPUR' },
      { lat: 13.0285, lon: 77.5412, time: 2, tower: 'GORAGUNTE' },
      { lat: 13.0489, lon: 77.5123, time: 3, tower: 'TUMKUR RD' },
      { lat: 13.0982, lon: 77.3891, time: 4, tower: 'NELAMANGALA' },
    ]},
    { entityId: 'CONVOY-02', label: 'CONVOY TN-02-AK-9812', color: '#06b6d4', path: [
      { lat: 13.0315, lon: 77.5188, time: 1, tower: 'PEENYA' },
      { lat: 13.0358, lon: 77.5970, time: 2, tower: 'HEBBAL' },
      { lat: 12.9176, lon: 77.6238, time: 3, tower: 'SILKBOARD' },
      { lat: 12.7825, lon: 77.7812, time: 4, tower: 'ATTIBELE BORDER' },
    ]},
  ], []);

  const timeSteps = [0, 1, 2, 3, 4, 5];
  const timeLabels = ['T-30', 'T-7', 'T-1', 'INC', 'T+1', 'T+7'];

  // Initialize Map safely ONCE on component mount
  useEffect(() => {
    if (!mapRef.current) return;

    if (mapInstance.current) {
      mapInstance.current.remove();
      mapInstance.current = null;
    }
    if ((mapRef.current as any)._leaflet_id) {
      delete (mapRef.current as any)._leaflet_id;
    }

    const map = L.map(mapRef.current, {
      zoomControl: false,
    }).setView(defaultCenter, 12);

    // Free, open Stadia Maps Alidade Smooth Dark (requires no API key)
    L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png', {
      maxZoom: 20,
      attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    mapInstance.current = map;

    const timer1 = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    const timer2 = setTimeout(() => {
      map.invalidateSize();
    }, 600);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  // Update map view when defaultCenter updates from loaded case data
  useEffect(() => {
    if (mapInstance.current) {
      mapInstance.current.setView(defaultCenter, 12);
      setTimeout(() => {
        mapInstance.current?.invalidateSize();
      }, 100);
    }
  }, [defaultCenter[0], defaultCenter[1]]);

  // Render all markers and layers
  useEffect(() => {
    if (!mapInstance.current) return;
    const map = mapInstance.current;

    // Clear existing overlay layers (keep tile layer)
    map.eachLayer((layer: any) => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline || layer instanceof L.Circle || layer instanceof L.Polygon) {
        map.removeLayer(layer);
      }
    });

    const bounds: [number, number][] = [];

    // 1. CELL TOWER MARKERS
    if (showTowers) {
      const towerEntities = (displayEntities || []).filter((e: any) => {
        const type = (e.entity_type || '').toLowerCase();
        return type === 'tower' || type === 'location';
      });

      const displayTowers = towerEntities.length > 0 ? towerEntities : [
        { id: 'TW-01', label: 'TOWER BELLARY ROAD 01', carrier: 'AIRTEL 4G', calls: 38, active_devices: 12 },
        { id: 'TW-02', label: 'TOWER HEBBAL JUNCTION 02', carrier: 'JIO 5G', calls: 52, active_devices: 18 },
        { id: 'TW-03', label: 'TOWER MAJESTIC PLATFORM 01', carrier: 'VODAFONE 4G', calls: 64, active_devices: 22 },
        { id: 'TW-04', label: 'TOWER PEENYA HUB 01', carrier: 'AIRTEL 4G', calls: 29, active_devices: 8 },
      ];

      displayTowers.forEach((t: any) => {
        const [lat, lon] = getValidCoordinates(t, defaultCenter);
        if (Number.isNaN(lat) || Number.isNaN(lon)) return;
        bounds.push([lat, lon]);

        const activityColor = getActivityColor(t.calls || t.active_devices || 15);
        const icon = createCustomIcon(
          `<div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border:2px solid ${activityColor};background:#060a06;color:${activityColor};font-family:monospace;font-size:12px;font-weight:bold;box-shadow:0 0 12px ${activityColor}80;border-radius:2px;">▲</div>`,
          [28, 28],
          [14, 14]
        );

        const marker = L.marker([lat, lon], { icon }).addTo(map);

        marker.on('click', () => {
          setSelectedMarker({
            type: 'tower',
            id: t.id || 'TW-UNKNOWN',
            label: t.label || 'TOWER TELEMETRY NODE',
            lat,
            lon,
            azimuth: t.azimuth || 120,
            carrier: t.carrier || 'TELECOM 4G/5G',
            calls: t.calls || 38,
            active_devices: t.active_devices || 12,
            beamwidth: '65°',
            range: '2.4 KM',
            connected_entities: ['PRIMARY SUSPECT', 'MULE HANDSET'],
            timestamp_range: 'ACTIVE OBSERVATION WINDOW',
          });
          setShowSidePanel(true);
        });

        // Sector coverage cone
        L.circle([lat, lon], {
          radius: 800,
          color: activityColor,
          weight: 1,
          fillColor: activityColor,
          fillOpacity: 0.08,
          dashArray: '3, 6',
        }).addTo(map);
      });
    }

    // 2. CCTV OBSERVATION MARKERS
    if (showCCTV) {
      cctvObservations.forEach((cctv: any) => {
        if (Number.isNaN(cctv.lat) || Number.isNaN(cctv.lon)) return;
        bounds.push([cctv.lat, cctv.lon]);

        const confColor = cctv.confidence === 'HIGH' ? '#22c55e' : cctv.confidence === 'MEDIUM' ? '#f59e0b' : '#ef4444';
        const icon = createCustomIcon(
          `<div style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border:2px solid ${confColor};background:#060a06;color:${confColor};font-family:monospace;font-size:11px;font-weight:bold;box-shadow:0 0 10px ${confColor}80;border-radius:2px;">◈</div>`,
          [26, 26],
          [13, 13]
        );

        const marker = L.marker([cctv.lat, cctv.lon], { icon }).addTo(map);

        marker.on('click', () => {
          setSelectedMarker({
            type: 'cctv',
            ...cctv,
            status: 'inferred surveillance detection',
            contributing_signals: 3,
          });
          setShowSidePanel(true);
        });

        L.circle([cctv.lat, cctv.lon], {
          radius: 200,
          color: confColor,
          weight: 1.5,
          fillColor: confColor,
          fillOpacity: 0.1,
          dashArray: '5, 5',
        }).addTo(map);
      });
    }

    // 3. PERSON/SUSPECT LOCATION MARKERS
    if (showPersons) {
      const personEntities = (displayEntities || []).filter((e: any) => {
        const type = (e.entity_type || '').toLowerCase();
        return type === 'person' || type === 'alias';
      });

      personEntities.forEach((p: any) => {
        const [lat, lon] = getValidCoordinates(p, defaultCenter);
        if (Number.isNaN(lat) || Number.isNaN(lon)) return;
        bounds.push([lat, lon]);

        const config = ENTITY_MARKER_CONFIG.person;
        const icon = createCustomIcon(
          `<div style="display:flex;align-items:center;justify-content:center;width:24px;height:24px;border:2px solid ${config.color};background:#060a06;color:${config.color};font-family:monospace;font-size:10px;font-weight:bold;box-shadow:0 0 10px ${config.color}80;border-radius:50%;">●</div>`,
          [24, 24],
          [12, 12]
        );

        const marker = L.marker([lat, lon], { icon }).addTo(map);

        marker.on('click', () => {
          setSelectedMarker({
            type: 'person',
            id: p.id,
            label: p.label,
            lat,
            lon,
            entity_type: p.entity_type,
            review_state: p.review_state,
            confidence: p.confidence || 0.85,
            last_seen: 'ACTIVE INVESTIGATION HORIZON',
            evidence_type: 'CDR Cell Tower + CCTV Match',
          });
          setSelectedEntityId(p.id);
          setShowSidePanel(true);
        });
      });
    }

    // 3b. PHONE/SIM MARKERS
    if (showPersons) {
      const phoneEntities = (displayEntities || []).filter((e: any) => {
        const type = (e.entity_type || '').toLowerCase();
        return type === 'phone_sim' || type === 'sim';
      });

      phoneEntities.forEach((p: any) => {
        const [lat, lon] = getValidCoordinates(p, defaultCenter);
        if (Number.isNaN(lat) || Number.isNaN(lon)) return;
        bounds.push([lat, lon]);

        const config = ENTITY_MARKER_CONFIG.phone_sim;
        const icon = createCustomIcon(
          `<div style="display:flex;align-items:center;justify-content:center;width:22px;height:22px;border:2px solid ${config.color};background:#060a06;color:${config.color};font-family:monospace;font-size:9px;font-weight:bold;box-shadow:0 0 10px ${config.color}80;border-radius:3px;">◆</div>`,
          [22, 22],
          [11, 11]
        );

        const marker = L.marker([lat, lon], { icon }).addTo(map);

        marker.on('click', () => {
          setSelectedMarker({
            type: 'entity',
            id: p.id,
            label: p.label,
            lat,
            lon,
            entity_type: p.entity_type,
            review_state: p.review_state,
            confidence: p.confidence || 0.8,
            last_seen: 'ACTIVE CDR OBSERVATION',
            evidence_type: 'Telecom CDR + Tower Triangulation',
          });
          setSelectedEntityId(p.id);
          setShowSidePanel(true);
        });
      });
    }

    // 3c. DEVICE MARKERS
    if (showPersons) {
      const deviceEntities = (displayEntities || []).filter((e: any) => {
        const type = (e.entity_type || '').toLowerCase();
        return type === 'device';
      });

      deviceEntities.forEach((p: any) => {
        const [lat, lon] = getValidCoordinates(p, defaultCenter);
        if (Number.isNaN(lat) || Number.isNaN(lon)) return;
        bounds.push([lat, lon]);

        const config = ENTITY_MARKER_CONFIG.device;
        const icon = createCustomIcon(
          `<div style="display:flex;align-items:center;justify-content:center;width:22px;height:22px;border:2px solid ${config.color};background:#060a06;color:${config.color};font-family:monospace;font-size:9px;font-weight:bold;box-shadow:0 0 10px ${config.color}80;border-radius:3px;">▣</div>`,
          [22, 22],
          [11, 11]
        );

        const marker = L.marker([lat, lon], { icon }).addTo(map);

        marker.on('click', () => {
          setSelectedMarker({
            type: 'entity',
            id: p.id,
            label: p.label,
            lat,
            lon,
            entity_type: p.entity_type,
            review_state: p.review_state,
            confidence: p.confidence || 0.75,
            last_seen: 'DEVICE FORENSIC HORIZON',
            evidence_type: 'IMEI Registry + App Analysis',
          });
          setSelectedEntityId(p.id);
          setShowSidePanel(true);
        });
      });
    }

    // 3d. ACCOUNT MARKERS
    if (showPersons) {
      const accountEntities = (displayEntities || []).filter((e: any) => {
        const type = (e.entity_type || '').toLowerCase();
        return type === 'account';
      });

      accountEntities.forEach((p: any) => {
        const [lat, lon] = getValidCoordinates(p, defaultCenter);
        if (Number.isNaN(lat) || Number.isNaN(lon)) return;
        bounds.push([lat, lon]);

        const config = ENTITY_MARKER_CONFIG.account;
        const icon = createCustomIcon(
          `<div style="display:flex;align-items:center;justify-content:center;width:22px;height:22px;border:2px solid ${config.color};background:#060a06;color:${config.color};font-family:monospace;font-size:9px;font-weight:bold;box-shadow:0 0 10px ${config.color}80;border-radius:50%;">$</div>`,
          [22, 22],
          [11, 11]
        );

        const marker = L.marker([lat, lon], { icon }).addTo(map);

        marker.on('click', () => {
          setSelectedMarker({
            type: 'entity',
            id: p.id,
            label: p.label,
            lat,
            lon,
            entity_type: p.entity_type,
            review_state: p.review_state,
            confidence: p.confidence || 0.9,
            last_seen: 'FINANCIAL INTEL HORIZON',
            evidence_type: 'UPI Transaction Graph + Bank Records',
          });
          setSelectedEntityId(p.id);
          setShowSidePanel(true);
        });
      });
    }

    // 3e. VEHICLE MARKERS
    if (showPersons) {
      const vehicleEntities = (displayEntities || []).filter((e: any) => {
        const type = (e.entity_type || '').toLowerCase();
        return type === 'vehicle';
      });

      vehicleEntities.forEach((p: any) => {
        const [lat, lon] = getValidCoordinates(p, defaultCenter);
        if (Number.isNaN(lat) || Number.isNaN(lon)) return;
        bounds.push([lat, lon]);

        const config = ENTITY_MARKER_CONFIG.vehicle;
        const icon = createCustomIcon(
          `<div style="display:flex;align-items:center;justify-content:center;width:24px;height:24px;border:2px solid ${config.color};background:#060a06;color:${config.color};font-family:monospace;font-size:10px;font-weight:bold;box-shadow:0 0 10px ${config.color}80;border-radius:2px;">▲</div>`,
          [24, 24],
          [12, 12]
        );

        const marker = L.marker([lat, lon], { icon }).addTo(map);

        marker.on('click', () => {
          setSelectedMarker({
            type: 'entity',
            id: p.id,
            label: p.label,
            lat,
            lon,
            entity_type: p.entity_type,
            review_state: p.review_state,
            confidence: p.confidence || 0.85,
            last_seen: 'ANPR / TOLL OBSERVATION',
            evidence_type: 'ANPR Camera + Toll Plaza + Fastag',
          });
          setSelectedEntityId(p.id);
          setShowSidePanel(true);
        });
      });
    }

    // 4. EVENT MARKERS
    if (showEvents) {
      const eventEntities = (displayEntities || []).filter((e: any) => {
        const type = (e.entity_type || '').toLowerCase();
        return type === 'event';
      });

      const mockEvents = [
        { id: 'EVT-001', label: 'INCIDENT: CHEATING & FORGERY REPORTED', details: 'FIR registered at Cyber Crime PS', type: 'incident' },
        { id: 'EVT-002', label: 'TRANSACTION: MULE FAN-OUT EXFILTRATION', details: 'INR 1.85 Lakh rapid sweep', type: 'financial' },
        { id: 'EVT-003', label: 'CONVERGENCE: AIRPORT TOLL EXIT', details: 'Vehicle clocked at 76 km/h', type: 'meeting' },
      ];

      [...eventEntities, ...mockEvents].forEach((evt: any) => {
        const [lat, lon] = getValidCoordinates(evt, defaultCenter);
        if (Number.isNaN(lat) || Number.isNaN(lon)) return;
        bounds.push([lat, lon]);

        const isIncident = evt.type === 'incident' || evt.label?.includes('INCIDENT');
        const color = isIncident ? '#ef4444' : '#f59e0b';
        const iconChar = isIncident ? '⚡' : '◆';

        const icon = createCustomIcon(
          `<div style="display:flex;align-items:center;justify-content:center;width:24px;height:24px;border:2px solid ${color};background:#060a06;color:${color};font-family:monospace;font-size:12px;font-weight:bold;box-shadow:0 0 10px ${color}80;border-radius:2px;">${iconChar}</div>`,
          [24, 24],
          [12, 12]
        );

        const marker = L.marker([lat, lon], { icon }).addTo(map);

        marker.on('click', () => {
          setSelectedMarker({
            type: 'event',
            id: evt.id,
            label: evt.label,
            lat,
            lon,
            timestamp: evt.timestamp || '2026-08-16T11:30:00Z',
            details: evt.details || 'Operational investigation event node',
            event_type: evt.type || 'incident',
          });
          setShowSidePanel(true);
        });
      });
    }

    // 5. TRAJECTORY VISUALIZATION
    if (showTrajectories) {
      trajectories.forEach((traj) => {
        const coords: [number, number][] = traj.path.map((p) => [p.lat, p.lon]);
        if (coords.length < 2) return;

        L.polyline(coords, {
          color: traj.color,
          weight: 2,
          opacity: 0.75,
          dashArray: '8, 8',
        }).addTo(map);

        traj.path.forEach((p) => {
          bounds.push([p.lat, p.lon]);
          L.marker([p.lat, p.lon], {
            icon: createCustomIcon(
              `<div style="display:flex;align-items:center;justify-content:center;padding:2px 6px;background:#060a06;border:1px solid ${traj.color};color:${traj.color};font-family:monospace;font-size:8px;font-weight:bold;white-space:nowrap;border-radius:2px;">${p.tower}</div>`,
              [60, 18],
              [30, 9]
            ),
          }).addTo(map);
        });
      });
    }

    // 6. CO-LOCATION VISUALIZATION
    if (showColocations) {
      colocationEvents.forEach((col) => {
        bounds.push([col.lat, col.lon]);

        const circle = L.circle([col.lat, col.lon], {
          radius: 300,
          color: '#f59e0b',
          weight: 2,
          fillColor: '#f59e0b',
          fillOpacity: 0.15,
          dashArray: '5, 5',
        }).addTo(map);

        L.marker([col.lat, col.lon], {
          icon: createCustomIcon(
            `<div style="display:flex;align-items:center;justify-content:center;padding:2px 8px;background:#060a06;border:1px solid #f59e0b;color:#f59e0b;font-family:monospace;font-size:8px;font-weight:bold;white-space:nowrap;border-radius:2px;">${col.label}</div>`,
            [80, 20],
            [40, 10]
          ),
        }).addTo(map);

        circle.on('click', () => {
          setSelectedMarker({
            type: 'colocation',
            id: col.id,
            label: col.label,
            lat: col.lat,
            lon: col.lon,
            entities: col.entities,
            count: col.count,
            timestamp: col.timestamp,
          });
          setShowSidePanel(true);
        });
      });
    }

    // 7. ENTITY CONNECTIONS (Network Links)
    if (showConnections && entityConnections.length > 0) {
      // Build a map of entity ID to coordinates
      const entityCoords: Record<string, [number, number]> = {};
      
      // Add all rendered entities to coordinate map
      const allEntities = [
        ...(displayEntities || []),
        ...cctvObservations.map((c: any) => ({ id: c.id, lat: c.lat, lon: c.lon })),
        ...colocationEvents.map((c: any) => ({ id: c.id, lat: c.lat, lon: c.lon })),
      ];
      
      allEntities.forEach((e: any) => {
        const [lat, lon] = getValidCoordinates(e, defaultCenter);
        if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
          entityCoords[e.id] = [lat, lon];
        }
      });

      entityConnections.forEach((edge: any) => {
        const sourceCoords = entityCoords[edge.source];
        const targetCoords = entityCoords[edge.target];
        
        if (sourceCoords && targetCoords) {
          const color = edge.classification === 'hypothesis' ? '#f59e0b' : 
                       edge.classification === 'inferred' ? '#06b6d4' :
                       edge.classification === 'contradicted' ? '#ef4444' : '#22c55e';
          
          L.polyline([sourceCoords, targetCoords], {
            color,
            weight: 1.5,
            opacity: 0.6,
            dashArray: edge.classification === 'hypothesis' ? '5, 5' : undefined,
          }).addTo(map);
        }
      });
    }

    // Fit bounds safely
    if (bounds.length > 0) {
      try {
        map.fitBounds(L.latLngBounds(bounds), { padding: [50, 50], maxZoom: 14 });
      } catch (err) {
        console.warn('fitBounds error', err);
      }
    }
  }, [displayEntities, showTowers, showPersons, showCCTV, showEvents, showTrajectories, showColocations, showConnections, showOnlyConnected, cctvObservations, colocationEvents, trajectories, entityConnections, defaultCenter]);

  // Timeline playback loop
  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        setTimeIndex((prev) => (prev >= timeSteps.length - 1 ? 0 : prev + 1));
      }, 1500 / playbackSpeed);
    }
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed]);

  const activeEntities = useMemo(() => {
    if (!displayEntities) return [];
    return (displayEntities || []).filter((e: any) => {
      const type = (e.entity_type || '').toLowerCase();
      return ['person', 'phone_sim', 'sim', 'device', 'vehicle', 'location'].includes(type);
    }).slice(0, 12);
  }, [displayEntities]);

  const toggleLayer = (layer: string) => {
    switch (layer) {
      case 'towers': setShowTowers(!showTowers); break;
      case 'persons': setShowPersons(!showPersons); break;
      case 'cctv': setShowCCTV(!showCCTV); break;
      case 'events': setShowEvents(!showEvents); break;
      case 'colocations': setShowColocations(!showColocations); break;
      case 'trajectories': setShowTrajectories(!showTrajectories); break;
      case 'connections': setShowConnections(!showConnections); break;
      case 'onlyConnected': setShowOnlyConnected(!showOnlyConnected); break;
    }
  };

  return (
    <div className="space-y-3 font-mono text-xs text-[#f59e0b] h-screen flex flex-col min-h-[100vh]">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-amber-500/40 gap-2 shrink-0">
        <div>
          <div className="text-[11px] text-amber-500/70 font-bold tracking-widest uppercase">
            // CASE CONSOLE // GEOSPATIAL INTELLIGENCE
          </div>
          <div className="text-base md:text-lg font-black text-amber-300 tracking-wider">
            CELL TOWER, LOCATION & CDR MOVEMENT MAP
          </div>
          <div className="text-[10px] text-amber-500/80">
            TOWER NODES • SAFE-CITY CCTV • SUSPECT TRACKING • ANPR CORRIDORS • CO-LOCATIONS
          </div>
        </div>

        {/* LAYER TOGGLE BUTTONS */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { key: 'towers', label: 'TOWERS', active: showTowers, activeClass: 'bg-amber-500 text-black font-bold border-amber-400', inactiveClass: 'bg-amber-500/20 border-amber-500/40 text-amber-300 hover:bg-amber-500/30 hover:text-amber-200' },
            { key: 'persons', label: 'PERSONS', active: showPersons, activeClass: 'bg-cyan-500 text-black font-bold border-cyan-400', inactiveClass: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/30 hover:text-cyan-200' },
            { key: 'cctv', label: 'CCTV', active: showCCTV, activeClass: 'bg-slate-500 text-black font-bold border-slate-400', inactiveClass: 'bg-slate-500/20 border-slate-500/40 text-slate-300 hover:bg-slate-500/30 hover:text-slate-200' },
            { key: 'events', label: 'EVENTS', active: showEvents, activeClass: 'bg-red-500 text-black font-bold border-red-400', inactiveClass: 'bg-red-500/20 border-red-500/40 text-red-300 hover:bg-red-500/30 hover:text-red-200' },
            { key: 'colocations', label: 'CO-LOCATIONS', active: showColocations, activeClass: 'bg-amber-500 text-black font-bold border-amber-400', inactiveClass: 'bg-amber-500/20 border-amber-500/40 text-amber-300 hover:bg-amber-500/30 hover:text-amber-200' },
            { key: 'trajectories', label: 'CORRIDORS', active: showTrajectories, activeClass: 'bg-violet-500 text-black font-bold border-violet-400', inactiveClass: 'bg-violet-500/20 border-violet-500/40 text-violet-300 hover:bg-violet-500/30 hover:text-violet-200' },
            { key: 'connections', label: 'LINKS', active: showConnections, activeClass: 'bg-emerald-500 text-black font-bold border-emerald-400', inactiveClass: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 hover:text-emerald-200' },
            { key: 'onlyConnected', label: 'CONNECTED ONLY', active: showOnlyConnected, activeClass: 'bg-indigo-500 text-black font-bold border-indigo-400', inactiveClass: 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/30 hover:text-indigo-200' },
          ].map(({ key, label, active, activeClass, inactiveClass }) => (
            <button
              key={key}
              onClick={() => toggleLayer(key)}
              className={`px-2.5 py-1 text-[11px] border uppercase transition-colors ${active ? activeClass : inactiveClass}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* FILTER & TEMPORAL SCRUBBER BAR */}
      <div className="p-2 bg-[#0a0f0a] border border-amber-500/30 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-amber-500/70 uppercase">FILTER:</span>
          <select
            value={selectedEntityId || 'ALL'}
            onChange={(e) => {
              const val = e.target.value === 'ALL' ? null : e.target.value;
              setSelectedEntityId(val);
              if (val) {
                const ent = entities.find((x: any) => x.id === val);
                if (ent && mapInstance.current) {
                  const [lat, lon] = getValidCoordinates(ent, defaultCenter);
                  mapInstance.current.setView([lat, lon], 14);
                }
              }
              setShowSidePanel(true);
            }}
            className="bg-black border border-amber-500/40 text-amber-300 text-xs px-2 py-1 outline-none font-mono"
          >
            <option value="ALL">ALL CASE ENTITIES</option>
            {activeEntities.map((e: any) => (
              <option key={e.id} value={e.id}>
                {e.label} ({ENTITY_MARKER_CONFIG[e.entity_type?.toLowerCase()]?.label || e.entity_type})
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1.5 px-2 py-1 bg-black/60 border border-amber-500/30 text-[11px]">
            <span className="text-amber-500/70">DATE:</span>
            <input type="date" value={dateRange[0]} onChange={(e) => setDateRange([e.target.value, dateRange[1]])} className="bg-black border border-amber-500/40 text-amber-300 text-[10px] px-1 py-0.5 outline-none" />
            <span className="text-amber-500/70">TO</span>
            <input type="date" value={dateRange[1]} onChange={(e) => setDateRange([dateRange[0], e.target.value])} className="bg-black border border-amber-500/40 text-amber-300 text-[10px] px-1 py-0.5 outline-none" />
          </div>
        </div>

        {/* TEMPORAL SCRUBBER WITH PLAY/PAUSE */}
        <div className="flex items-center gap-2 bg-black/80 border border-amber-500/40 px-3 py-1">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-1 text-amber-400 hover:text-amber-200"
            title={isPlaying ? 'Pause' : 'Play Simulation'}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>

          <span className="text-[10px] text-amber-500/70">TIME:</span>
          <input
            type="range"
            min="0"
            max={timeSteps.length - 1}
            step="1"
            value={timeIndex}
            onChange={(e) => setTimeIndex(parseInt(e.target.value))}
            className="w-24 sm:w-32 accent-amber-500 cursor-pointer"
          />

          <span className="text-[11px] font-bold text-amber-300 w-16 text-center">
            {timeLabels[timeIndex]}
          </span>

          <div className="flex gap-1 ml-2 border-l border-amber-500/30 pl-2">
            {[1, 2, 5].map((spd) => (
              <button
                key={spd}
                onClick={() => setPlaybackSpeed(spd)}
                className={`px-1.5 py-0.2 text-[9px] ${
                  playbackSpeed === spd
                    ? 'bg-amber-500 text-black font-bold'
                    : 'text-amber-500 hover:text-amber-300 bg-black/60 border border-amber-500/40'
                }`}
              >
                {spd}X
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* MAIN MAP WORKSPACE */}
      <div className="flex-1 min-h-[520px] grid grid-cols-1 lg:grid-cols-12 gap-3 relative">
        {/* MAP SIDE PANEL - Active Entities */}
        <div className="lg:col-span-3 xl:col-span-2 space-y-3 overflow-y-auto">
          <TerminalPanel title="ACTIVE ENTITIES ON MAP" subtitle={`TIME: ${timeLabels[timeIndex]}`}>
            <div className="space-y-2 text-xs">
              <div className="max-h-64 overflow-y-auto space-y-1">
                {activeEntities.map((e: any) => {
                  const [lat, lon] = getValidCoordinates(e, defaultCenter);
                  return (
                    <div
                      key={e.id}
                      onClick={() => {
                        setSelectedEntityId(e.id);
                        setShowSidePanel(true);
                        if (mapInstance.current) {
                          mapInstance.current.setView([lat, lon], 14);
                        }
                        setSelectedMarker({
                          type: 'person',
                          id: e.id,
                          label: e.label,
                          lat,
                          lon,
                          entity_type: e.entity_type,
                          review_state: e.review_state,
                          confidence: 0.92,
                          last_seen: 'ACTIVE RECORD',
                          evidence_type: 'Cell Tower + CDR Mobility',
                        });
                      }}
                      className={`p-1.5 cursor-pointer flex flex-col gap-0.5 text-[10px] ${
                        selectedEntityId === e.id ? 'bg-amber-500/20 border border-amber-500/40' : 'bg-black/60 border border-amber-500/20 hover:border-amber-400'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-amber-300 font-bold truncate">{e.label}</span>
                        <span className="text-[9px] uppercase px-1 py-0.2 bg-amber-500/20 text-amber-400">
                          {ENTITY_MARKER_CONFIG[e.entity_type?.toLowerCase()]?.label || e.entity_type}
                        </span>
                      </div>
                      <div className="text-[9px] text-amber-500/60 flex items-center justify-between">
                        <span>{lat.toFixed(4)}° N, {lon.toFixed(4)}° E</span>
                        <span className="text-emerald-400">TRACKED</span>
                      </div>
                    </div>
                  );
                })}
                {activeEntities.length === 0 && (
                  <div className="p-2 text-amber-500/60 text-center text-[10px]">No active entities in current case</div>
                )}
              </div>
            </div>
          </TerminalPanel>

          {/* FILTER CONTROLS PANEL */}
          <TerminalPanel title="MAP FILTERS" subtitle="VISIBILITY CONTROLS">
            <div className="space-y-2 text-xs">
              {[
                { key: 'towers', label: 'CELL TOWERS', active: showTowers, color: '#22c55e' },
                { key: 'persons', label: 'PERSONS/SUSPECTS', active: showPersons, color: '#06b6d4' },
                { key: 'cctv', label: 'CCTV OBSERVATIONS', active: showCCTV, color: '#9ca3af' },
                { key: 'events', label: 'CASE EVENTS', active: showEvents, color: '#ef4444' },
                { key: 'colocations', label: 'CO-LOCATIONS', active: showColocations, color: '#f59e0b' },
                { key: 'trajectories', label: 'CORRIDORS', active: showTrajectories, color: '#a855f7' },
              ].map(({ key, label, active, color }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer p-1 hover:bg-amber-500/10">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggleLayer(key)}
                    className="accent-amber-500 w-3 h-3"
                  />
                  <span className="flex items-center gap-1.5" style={{ color }}>
                    <span className="w-2 h-2 rounded-none" style={{ backgroundColor: color }} />
                    <span className="text-amber-300">{label}</span>
                  </span>
                </label>
              ))}
            </div>
          </TerminalPanel>
        </div>

        {/* LEAFLET MAP CANVAS */}
        <div className={`${showSidePanel ? 'lg:col-span-6 xl:col-span-7' : 'lg:col-span-9 xl:col-span-10'} relative bg-[#060a06] border border-amber-500/35 overflow-hidden h-full min-h-[520px]`}>
          <div ref={mapRef} style={{ width: '100%', height: '100%', minHeight: '520px' }} className="w-full h-full min-h-[520px] select-none relative z-0" />

          {/* FLOATING TOP-LEFT TELEMETRY HUD */}
          <div className="absolute top-3 left-3 z-[400] p-2.5 bg-black/90 border border-amber-500/40 text-[10px] space-y-1 shadow-lg pointer-events-none">
            <div className="font-bold text-amber-300 uppercase flex items-center gap-1.5 border-b border-amber-500/30 pb-1">
              <Crosshair className="w-3.5 h-3.5 text-amber-400" />
              <span>ACTIVE CASE: {caseData?.case_code || caseId?.slice(0, 12)}</span>
            </div>
            <div className="flex justify-between gap-4 text-amber-400/90">
              <span>GRID CENTER:</span>
              <span className="font-mono text-amber-300">{defaultCenter[0].toFixed(4)}° N, {defaultCenter[1].toFixed(4)}° E</span>
            </div>
            <div className="flex justify-between gap-4 text-amber-400/90">
              <span>ACTIVE LAYERS:</span>
              <span className="text-amber-300">
                {showTowers ? 'TWR ' : ''}
                {showPersons ? 'PER ' : ''}
                {showCCTV ? 'CCTV ' : ''}
                {showEvents ? 'EVT ' : ''}
                {showColocations ? 'COL' : ''}
              </span>
            </div>
          </div>

          {/* FLOATING CO-LOCATION WARNING ALERT */}
          {showColocations && colocationEvents.length > 0 && (
            <div className="absolute bottom-3 left-3 right-3 z-[400] p-2 bg-red-950/80 border border-red-500 text-xs text-red-300 flex items-center justify-between gap-2 shadow-[0_0_12px_rgba(239,68,68,0.4)]">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-400 animate-pulse" />
                <span className="font-bold">CO-LOCATION CLUSTERS:</span>
                <span>{colocationEvents.length} multi-identity co-location cluster(s) detected near tower nodes</span>
              </div>
              <button
                onClick={() => {
                  const col = colocationEvents[0];
                  if (mapInstance.current) {
                    mapInstance.current.setView([col.lat, col.lon], 15);
                  }
                  setSelectedMarker({
                    type: 'colocation',
                    ...col,
                  });
                  setShowSidePanel(true);
                }}
                className="px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white font-bold text-[10px] uppercase"
              >
                INSPECT [→]
              </button>
            </div>
          )}
        </div>

        {/* SIDE DETAIL DRAWER */}
        {showSidePanel && selectedMarker && (
          <div className="lg:col-span-3 xl:col-span-3 bg-[#0a0f0a] border border-amber-500/40 p-3 space-y-3 overflow-y-auto max-h-[520px]">
            <div className="flex items-center justify-between border-b border-amber-500/30 pb-2">
              <span className="font-bold text-amber-300 text-xs uppercase flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                <span>LOCATION NODE DOSSIER</span>
              </span>
              <button
                onClick={() => setShowSidePanel(false)}
                className="text-amber-500 hover:text-amber-300 text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-[11px]">
              <div>
                <div className="text-[9px] text-amber-500/60 uppercase">LABEL / IDENTIFIER:</div>
                <div className="font-bold text-amber-200 text-xs">{selectedMarker.label || selectedMarker.id}</div>
              </div>

              <div className="grid grid-cols-2 gap-2 p-1.5 bg-black/60 border border-amber-500/20 text-[10px]">
                <div>
                  <span className="text-amber-500/70">LATITUDE:</span>
                  <div className="text-amber-300">{selectedMarker.lat?.toFixed(5)}° N</div>
                </div>
                <div>
                  <span className="text-amber-500/70">LONGITUDE:</span>
                  <div className="text-amber-300">{selectedMarker.lon?.toFixed(5)}° E</div>
                </div>
              </div>

              {selectedMarker.type === 'tower' && (
                <div className="space-y-1.5 border-t border-amber-500/20 pt-2 text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-amber-500/70">CARRIER:</span>
                    <span className="text-amber-300 font-bold">{selectedMarker.carrier}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-500/70">RANGE:</span>
                    <span className="text-amber-300">{selectedMarker.range}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-500/70">CALL TRAFFIC:</span>
                    <span className="text-emerald-400 font-bold">{selectedMarker.calls} events</span>
                  </div>
                </div>
              )}

              {selectedMarker.type === 'cctv' && (
                <div className="space-y-1.5 border-t border-amber-500/20 pt-2 text-[10px]">
                  <div>
                    <span className="text-amber-500/70">LOCATION:</span>
                    <div className="text-amber-300">{selectedMarker.location}</div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-500/70">CONFIDENCE:</span>
                    <span className="text-emerald-400 font-bold">{selectedMarker.confidence}</span>
                  </div>
                </div>
              )}

              {selectedMarker.type === 'colocation' && (
                <div className="space-y-1.5 border-t border-amber-500/20 pt-2 text-[10px]">
                  <div className="text-amber-500/70">CO-LOCATED IDENTITIES:</div>
                  {(selectedMarker.entities || []).map((ent: string, idx: number) => (
                    <div key={idx} className="p-1 bg-black/60 border border-amber-500/30 text-amber-300">
                      • {ent}
                    </div>
                  ))}
                  <div className="flex justify-between pt-1">
                    <span className="text-amber-500/70">OBSERVATIONS:</span>
                    <span className="text-red-400 font-bold">{selectedMarker.count} concurrent hits</span>
                  </div>
                </div>
              )}

              {selectedMarker.type === 'person' && (
                <div className="space-y-1.5 border-t border-amber-500/20 pt-2 text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-amber-500/70">ENTITY TYPE:</span>
                    <span className="text-amber-300 font-bold">{selectedMarker.entity_type?.toUpperCase() || 'PERSON'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-500/70">REVIEW STATE:</span>
                    <span className="text-emerald-400 font-bold">{selectedMarker.review_state?.toUpperCase() || 'NEW'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-500/70">CONFIDENCE:</span>
                    <span className="text-emerald-400 font-bold">{(selectedMarker.confidence * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-500/70">LAST SEEN:</span>
                    <span className="text-amber-300">{selectedMarker.last_seen}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-500/70">EVIDENCE TYPE:</span>
                    <span className="text-amber-300">{selectedMarker.evidence_type}</span>
                  </div>
                </div>
              )}

              {selectedMarker.type === 'entity' && (
                <div className="space-y-1.5 border-t border-amber-500/20 pt-2 text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-amber-500/70">ENTITY TYPE:</span>
                    <span className="text-amber-300 font-bold">{selectedMarker.entity_type?.toUpperCase() || 'ENTITY'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-500/70">REVIEW STATE:</span>
                    <span className="text-emerald-400 font-bold">{selectedMarker.review_state?.toUpperCase() || 'NEW'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-500/70">CONFIDENCE:</span>
                    <span className="text-emerald-400 font-bold">{(selectedMarker.confidence * 100).toFixed(0)}%</span>
                  </div>
                </div>
              )}

              {selectedMarker.type === 'event' && (
                <div className="space-y-1.5 border-t border-amber-500/20 pt-2 text-[10px]">
                  <div>
                    <span className="text-amber-500/70">TIMESTAMP:</span>
                    <div className="text-amber-300">{selectedMarker.timestamp}</div>
                  </div>
                  <div>
                    <span className="text-amber-500/70">DETAILS:</span>
                    <div className="text-amber-300">{selectedMarker.details}</div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-500/70">EVENT TYPE:</span>
                    <span className="text-emerald-400 font-bold">{selectedMarker.event_type?.toUpperCase() || 'INCIDENT'}</span>
                  </div>
                </div>
              )}

              <button
                onClick={() => navigate(`/cases/${caseId}/graph`)}
                className="w-full mt-2 py-1.5 bg-amber-500 text-black font-bold hover:bg-amber-400 text-center text-xs uppercase"
              >
                OPEN IN GRAPH EXPLORER [→]
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}