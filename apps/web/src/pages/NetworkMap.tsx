import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import {
  MapPin,
  Layers,
  Radio,
  Clock,
  Play,
  Pause,
  RotateCcw,
  ShieldAlert,
  X,
  Crosshair,
  Sliders,
  ChevronRight,
  Eye,
  Activity
} from 'lucide-react';
import { TerminalPanel } from '../components/common/TerminalPanel';
import { StatusBadge } from '../components/common/StatusBadge';
import { ConfidenceMeter } from '../components/common/ConfidenceMeter';

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

export default function NetworkMap() {
  const { caseId } = useParams<{ caseId: string }>();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const [leafletReady, setLeafletReady] = useState(false);

  // Layer toggles
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showVectors, setShowVectors] = useState(true);
  const [showColocations, setShowColocations] = useState(true);

  // Temporal Playback
  const [isPlaying, setIsPlaying] = useState(false);
  const [timelineIndex, setTimelineIndex] = useState(5);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [selectedTower, setSelectedTower] = useState<any>(null);
  const [subjectFilter, setSubjectFilter] = useState('ALL');

  const { data: entities, isLoading, refetch } = useQuery({
    queryKey: ['entities', caseId, 'location'],
    queryFn: () => api.getEntities(caseId!, 'location'),
    enabled: !!caseId,
  });

  const { data: allEntities } = useQuery({
    queryKey: ['entities', caseId],
    queryFn: () => api.getEntities(caseId!),
    enabled: !!caseId,
  });

  const { data: caseData } = useQuery({
    queryKey: ['case', caseId],
    queryFn: () => api.getCase(caseId!),
    enabled: !!caseId,
  });

  useEffect(() => {
    if ((window as any).L) { setLeafletReady(true); return; }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = LEAFLET_CSS;
    document.head.appendChild(link);
    const script = document.createElement('script');
    script.src = LEAFLET_JS;
    script.onload = () => setLeafletReady(true);
    document.head.appendChild(script);
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!leafletReady || !mapRef.current || mapInstance.current) return;
    const L = (window as any).L;
    const map = L.map(mapRef.current, { zoomControl: false }).setView([18.5204, 73.8567], 13);
    
    // Dark matter tiles for covert intelligence terminal
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
      attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
    }).addTo(map);

    mapInstance.current = map;
    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [leafletReady]);

  // Render markers and vector lines
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapInstance.current) return;
    const map = mapInstance.current;

    // Remove existing markers & polylines
    map.eachLayer((layer: any) => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline || layer instanceof L.Circle || layer instanceof L.Polygon) {
        map.removeLayer(layer);
      }
    });

    const realTowers = (entities || []).filter((e: any) => {
      const lat = e.attributes?.lat ?? e.attributes?.latitude;
      const lon = e.attributes?.lon ?? e.attributes?.longitude;
      return lat != null && lon != null && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lon));
    });

    const displayTowers = realTowers;

    const bounds: number[][] = [];

    // Draw Towers with Sector Cones
    displayTowers.forEach((t: any) => {
      const lat = Number(t.lat ?? t.attributes?.lat ?? t.attributes?.latitude);
      const lon = Number(t.lon ?? t.attributes?.lon ?? t.attributes?.longitude);
      bounds.push([lat, lon]);

      const icon = L.divIcon({
        className: '',
        html: `<div style="display:flex;align-items:center;justify-content:center;width:24px;height:24px;border:1.5px solid #f59e0b;background:#060a06;color:#f59e0b;font-family:monospace;font-size:10px;font-weight:bold;box-shadow:0 0 10px rgba(245,158,11,0.5);">⬡</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const marker = L.marker([lat, lon], { icon }).addTo(map);
      marker.on('click', () => {
        setSelectedTower({
          id: t.id || 'TW-PUNE-CENTRAL-04',
          label: t.label || 'TOWER SECTOR 04',
          lat,
          lon,
          azimuth: t.azimuth || 120,
          carrier: t.carrier || 'AIRTEL 4G LTE',
          calls: t.calls || 24,
          beamwidth: '65°',
          range: '2.4 KM'
        });
      });

      // Azimuth coverage sector cone simulation
      if (showHeatmap) {
        L.circle([lat, lon], {
          radius: 900,
          color: '#f59e0b',
          weight: 1,
          fillColor: '#f59e0b',
          fillOpacity: 0.12,
          dashArray: '3, 6'
        }).addTo(map);
      }
    });

    // Draw Movement Vectors / Trail
    if (showVectors && displayTowers.length >= 2) {
      const trailCoords = displayTowers.slice(0, timelineIndex + 1).map((t: any) => [
        Number(t.lat ?? t.attributes?.lat ?? t.attributes?.latitude),
        Number(t.lon ?? t.attributes?.lon ?? t.attributes?.longitude)
      ]);

      if (trailCoords.length >= 2) {
        L.polyline(trailCoords, {
          color: '#fbbf24',
          weight: 2.5,
          opacity: 0.85,
          dashArray: '6, 6'
        }).addTo(map);
      }
    }

    // Co-location Cluster Alert
    if (showColocations) {
      const coLoc = [18.5173, 73.8418];
      L.circle(coLoc, {
        radius: 400,
        color: '#ef4444',
        weight: 2,
        fillColor: '#ef4444',
        fillOpacity: 0.25,
      }).addTo(map);
    }

    if (bounds.length > 0) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [50, 50] });
    }
  }, [entities, leafletReady, showHeatmap, showVectors, showColocations, timelineIndex]);

  // Timeline Auto-play Loop
  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        setTimelineIndex((prev) => (prev >= 5 ? 1 : prev + 1));
      }, 1400 / playbackSpeed);
    }
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed]);

  return (
    <div className="space-y-3 font-mono text-xs text-[#f59e0b] h-full flex flex-col">
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
            SECTOR COVERAGE // AZIMUTH CONES // MOVEMENT TRAILS // CO-LOCATION CLUSTERS
          </div>
        </div>

        {/* LAYER TOGGLE BUTTONS */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setShowHeatmap(!showHeatmap)}
            className={`px-2.5 py-1 text-[11px] border uppercase transition-colors ${
              showHeatmap
                ? 'bg-amber-500 text-black font-bold border-amber-400'
                : 'bg-black/80 border-amber-500/40 text-amber-400 hover:bg-amber-500/20'
            }`}
          >
            HEATMAP
          </button>
          <button
            onClick={() => setShowVectors(!showVectors)}
            className={`px-2.5 py-1 text-[11px] border uppercase transition-colors ${
              showVectors
                ? 'bg-amber-500 text-black font-bold border-amber-400'
                : 'bg-black/80 border-amber-500/40 text-amber-400 hover:bg-amber-500/20'
            }`}
          >
            MOVEMENT VECTORS
          </button>
          <button
            onClick={() => setShowColocations(!showColocations)}
            className={`px-2.5 py-1 text-[11px] border uppercase transition-colors ${
              showColocations
                ? 'bg-red-500 text-black font-bold border-red-400'
                : 'bg-black/80 border-red-500/40 text-red-400 hover:bg-red-500/20'
            }`}
          >
            CO-LOCATIONS
          </button>
        </div>
      </div>

      {/* FILTER & TEMPORAL SCRUBBER BAR */}
      <div className="p-2 bg-[#0a0f0a] border border-amber-500/30 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-amber-500/70 uppercase">SUBJECT:</span>
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="bg-black border border-amber-500/40 text-amber-300 text-xs px-2 py-1 outline-none font-mono"
          >
            <option value="ALL">ALL SUBJECTS (SIMULATED CONVERGENCE)</option>
            <option value="RAVI">RAVI KUMAR (TARGET T-01)</option>
            <option value="SURESH">SURESH PATIL (TARGET T-02)</option>
            <option value="VIKRAM">VIKRAM JADHAV (ASSOCIATE T-03)</option>
          </select>
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

          <span className="text-[10px] text-amber-500/70">TIMELINE:</span>
          <input
            type="range"
            min="1"
            max="5"
            step="1"
            value={timelineIndex}
            onChange={(e) => setTimelineIndex(parseInt(e.target.value))}
            className="w-24 sm:w-32 accent-amber-500 cursor-pointer"
          />

          <span className="text-[11px] font-bold text-amber-300">
            DAY {timelineIndex} / 5
          </span>

          <div className="flex gap-1 ml-2 border-l border-amber-500/30 pl-2">
            {[1, 2, 5].map((spd) => (
              <button
                key={spd}
                onClick={() => setPlaybackSpeed(spd)}
                className={`px-1.5 py-0.2 text-[9px] rounded-xs ${
                  playbackSpeed === spd
                    ? 'bg-amber-500 text-black font-bold'
                    : 'text-amber-500 hover:text-amber-300'
                }`}
              >
                {spd}X
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* MAIN MAP WORKSPACE */}
      <div className="flex-1 min-h-[500px] grid grid-cols-1 lg:grid-cols-12 gap-3 relative">
        {/* LEAFLET SATELLITE CANVAS */}
        <div className={`${selectedTower ? 'lg:col-span-8 xl:col-span-9' : 'lg:col-span-12'} relative bg-[#060a06] border border-amber-500/35 overflow-hidden flex flex-col`}>
          {!leafletReady && (
            <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-20 text-xs text-amber-400">
              [ INITIALIZING SATELLITE TILES & TOPOGRAPHIC OVERLAYS... ]
            </div>
          )}

          <div ref={mapRef} className="w-full h-full min-h-[460px] select-none" />

          {/* FLOATING TOP-LEFT TELEMETRY HUD */}
          <div className="absolute top-3 left-3 z-[1000] p-2.5 bg-black/90 border border-amber-500/40 text-[10px] space-y-1 shadow-lg pointer-events-none">
            <div className="font-bold text-amber-300 uppercase flex items-center gap-1.5 border-b border-amber-500/30 pb-1">
              <Crosshair className="w-3.5 h-3.5 text-amber-400" />
              <span>ACTIVE TARGET: RAVI KUMAR (T-01)</span>
            </div>
            <div className="flex justify-between gap-4 text-amber-400/90">
              <span>COORDINATES:</span>
              <span className="font-mono text-amber-300">18.5204° N, 73.8567° E</span>
            </div>
            <div className="flex justify-between gap-4 text-amber-400/90">
              <span>CELL SECTOR:</span>
              <span className="font-mono text-amber-300">SHIVAJINAGAR-04 // AZ 120°</span>
            </div>
            <div className="flex justify-between gap-4 text-amber-400/90">
              <span>TIME WINDOW:</span>
              <span className="text-amber-300">14 SEP 2026 // 21:40:12 IST</span>
            </div>
          </div>

          {/* FLOATING CO-LOCATION WARNING ALERT */}
          {showColocations && (
            <div className="absolute bottom-3 left-3 right-3 z-[1000] p-2 bg-red-950/80 border border-red-500 text-xs text-red-300 flex items-center justify-between gap-2 shadow-[0_0_12px_rgba(239,68,68,0.4)]">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-400 animate-pulse" />
                <span className="font-bold">CRITICAL CO-LOCATION DETECTED:</span>
                <span>14 SEP 21:40 HRS - 3 TARGETS IN SAME AZIMUTH CONE (DECCAN GYMKHANA 09)</span>
              </div>
              <button
                onClick={() => setSelectedTower({
                  id: 'TW-02',
                  label: 'TOWER DECCAN GYMKHANA 09',
                  lat: 18.5173,
                  lon: 73.8418,
                  azimuth: 45,
                  carrier: 'JIO 5G',
                  calls: 24,
                  beamwidth: '60°',
                  range: '1.8 KM'
                })}
                className="px-2 py-0.5 bg-red-500 text-black font-bold text-[10px] uppercase hover:bg-red-400"
              >
                INSPECT
              </button>
            </div>
          )}
        </div>

        {/* RIGHT TOWER / LOCATION DETAIL DRAWER */}
        {selectedTower && (
          <div className="lg:col-span-4 xl:col-span-3 space-y-3 overflow-y-auto">
            <TerminalPanel
              title={`TOWER INTEL // ${selectedTower.id}`}
              subtitle={selectedTower.label}
              headerRight={
                <button onClick={() => setSelectedTower(null)} className="text-amber-500 hover:text-amber-300">
                  <X className="w-3.5 h-3.5" />
                </button>
              }
            >
              <div className="space-y-3 text-xs">
                <div className="p-2.5 bg-black/60 border border-amber-500/20 space-y-1.5 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-amber-500/70">CELL ID:</span>
                    <span className="font-mono text-amber-300">404-45-1029-48201</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-500/70">CARRIER:</span>
                    <span className="text-amber-300 font-bold">{selectedTower.carrier}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-500/70">AZIMUTH / BEAM:</span>
                    <span className="text-amber-300">{selectedTower.azimuth}° / {selectedTower.beamwidth}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-500/70">EST. RADIUS:</span>
                    <span className="text-amber-300">{selectedTower.range}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-500/70">CDR HITS:</span>
                    <span className="text-amber-300 font-bold">{selectedTower.calls} records</span>
                  </div>
                </div>

                {/* Subpoena & Legal Notice */}
                <div className="p-2 bg-black/40 border border-amber-500/20 text-[10px] text-amber-500/80 leading-relaxed">
                  Notice: Tower dumps authenticated via Section 91 CrPC / Section 94 BNSS. Admissible in judicial proceedings.
                </div>

                <div className="space-y-1">
                  <div className="text-[10px] text-amber-500/80 font-bold uppercase mb-1">
                    CORRELATED TARGET TRAFFIC:
                  </div>
                  <div className="p-2 bg-black/60 border border-amber-500/20 text-[11px] space-y-1">
                    <div className="flex justify-between text-amber-300">
                      <span>RAVI KUMAR (IMEI ..4920)</span>
                      <span className="text-amber-500">21:38 IST</span>
                    </div>
                    <div className="flex justify-between text-amber-300">
                      <span>SURESH PATIL (IMEI ..8112)</span>
                      <span className="text-amber-500">21:40 IST</span>
                    </div>
                  </div>
                </div>
              </div>
            </TerminalPanel>
          </div>
        )}
      </div>
    </div>
  );
}
