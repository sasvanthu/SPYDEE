import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

export default function NetworkMap() {
  const { caseId } = useParams<{ caseId: string }>();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const [leafletReady, setLeafletReady] = useState(false);

  const { data: entities, isLoading } = useQuery({
    queryKey: ['entities', caseId, 'location'],
    queryFn: () => api.getEntities(caseId!, 'location'),
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

  useEffect(() => {
    if (!leafletReady || !mapRef.current || mapInstance.current) return;
    const L = (window as any).L;
    const map = L.map(mapRef.current, { zoomControl: true }).setView([28.6, 77.2], 8);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    mapInstance.current = map;
    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [leafletReady]);

  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapInstance.current) return;
    const map = mapInstance.current;
    map.eachLayer((layer: any) => {
      if (layer instanceof L.Marker) map.removeLayer(layer);
    });

    const towers = (entities || []).filter((e: any) => {
      const lat = e.attributes?.lat ?? e.attributes?.latitude;
      const lon = e.attributes?.lon ?? e.attributes?.longitude;
      return lat != null && lon != null && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lon));
    });

    if (towers.length > 0) {
      const bounds: number[][] = [];
      towers.forEach((e: any) => {
        const lat = Number(e.attributes.lat ?? e.attributes.latitude);
        const lon = Number(e.attributes.lon ?? e.attributes.longitude);
        bounds.push([lat, lon]);
        const color = reviewColor(e.review_state);
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 4px rgba(0,0,0,.4)"></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });
        L.marker([lat, lon], { icon, title: e.label })
          .addTo(map)
          .bindPopup(
            `<strong>${e.label}</strong><br>Type: ${e.entity_type}<br>Lat: ${lat.toFixed(5)}<br>Lon: ${lon.toFixed(5)}<br>Review: ${e.review_state}`,
          );
      });
      map.fitBounds(L.latLngBounds(bounds), { padding: [30, 30] });
    }
  }, [entities, leafletReady]);

  const towers = (entities || []).filter((e: any) => {
    const lat = e.attributes?.lat ?? e.attributes?.latitude;
    const lon = e.attributes?.lon ?? e.attributes?.longitude;
    return lat != null && lon != null;
  });

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-bold text-navy-700">Network Map</h1>
        <div className="text-xs text-navy-400">
          {isLoading ? 'Loading locations...' : `${towers.length} positioned location(s) of ${entities?.length || 0} total`}
        </div>
      </div>
      <div className="relative bg-white border rounded-lg overflow-hidden h-[calc(100vh-12rem)]">
        {!leafletReady && (
          <div className="absolute inset-0 flex items-center justify-center z-10">Loading map tiles...</div>
        )}
        <div ref={mapRef} className="w-full h-full" />
        {towers.length === 0 && !isLoading && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-white/90 border rounded px-4 py-2 text-xs text-navy-400">
            No location entities carry coordinates yet.
          </div>
        )}
        <div className="absolute top-3 right-3 bg-white/95 border rounded px-3 py-2 text-xs shadow space-y-1">
          <div className="font-semibold text-navy-700 mb-1">Review state</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-500 inline-block"></span> Accepted</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span> Rejected</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-amber-500 inline-block"></span> Flagged</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-navy-300 inline-block"></span> New / Pending</div>
        </div>
      </div>
    </div>
  );
}

function reviewColor(state?: string): string {
  const s = (state || '').toLowerCase();
  if (s.includes('accept')) return '#22c55e';
  if (s.includes('reject')) return '#ef4444';
  if (s.includes('flag')) return '#f59e0b';
  return '#6b7a99';
}