import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api';
import {
  Search,
  Plus,
  X,
  Share2,
  MapPin,
  GitMerge,
  FileEdit,
  User,
  Building2,
  Phone,
  Radio,
  Clock,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import { StatusBadge } from '../components/TerminalComponents';

export default function EntityRegistry() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'relations' | 'events'>('overview');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEntity, setNewEntity] = useState({ label: '', entity_type: 'person', id_type: 'PHONE', id_value: '' });

  // Fetch real entities from backend
  const { data: rawEntities, isLoading } = useQuery({
    queryKey: ['entities', caseId, typeFilter, search],
    queryFn: () => api.getEntities(caseId!, typeFilter || undefined, search || undefined),
    enabled: !!caseId,
  });

  const entities = rawEntities || [];

  // Currently selected entity
  const currentSelection = entities.find((e: any) => e.id === selectedEntityId) || entities[0] || null;

  // Fetch connected neighborhood for selected entity if on relations tab
  const { data: neighborhoodData } = useQuery({
    queryKey: ['neighbourhood', caseId, currentSelection?.id],
    queryFn: () => api.getNeighbourhood(caseId!, currentSelection!.id, 1),
    enabled: !!caseId && !!currentSelection?.id && activeTab === 'relations',
  });

  // Fetch timeline events for selected entity if on events tab
  const { data: entityEvents } = useQuery({
    queryKey: ['timeline', caseId, currentSelection?.id],
    queryFn: () => api.getTimeline(caseId!, { entity_id: currentSelection!.id }),
    enabled: !!caseId && !!currentSelection?.id && activeTab === 'events',
  });

  // Create entity mutation with real backend API
  const addEntityMutation = useMutation({
    mutationFn: (data: any) =>
      api.createEntity(caseId!, {
        label: data.label,
        entity_type: data.entity_type,
        identifiers: data.id_value ? [{ id_type: data.id_type, id_value: data.id_value }] : [],
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['entities', caseId] });
      queryClient.invalidateQueries({ queryKey: ['workspace-summary', caseId] });
      setShowAddModal(false);
      setNewEntity({ label: '', entity_type: 'person', id_type: 'PHONE', id_value: '' });
      if (created?.id) setSelectedEntityId(created.id);
    },
  });

  // Review status mutation
  const reviewMutation = useMutation({
    mutationFn: ({ entityId, review_state }: { entityId: string; review_state: string }) =>
      api.reviewEntity(caseId!, entityId, { review_state }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entities', caseId] });
    },
  });

  const typeLabels: Record<string, string> = {
    person: 'PERSON',
    organization: 'ORGANIZATION',
    phone_sim: 'PHONE/SIM',
    location: 'LOCATION',
    device: 'DEVICE',
    account: 'ACCOUNT',
    domain_ip: 'DOMAIN/IP',
    alias: 'ALIAS',
  };

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'person': return <User className="w-3.5 h-3.5 text-[#FF9E1B]" />;
      case 'organization': return <Building2 className="w-3.5 h-3.5 text-[#FF9E1B]" />;
      case 'phone_sim': return <Phone className="w-3.5 h-3.5 text-[#FF9E1B]" />;
      case 'location': return <MapPin className="w-3.5 h-3.5 text-[#FF9E1B]" />;
      default: return <Radio className="w-3.5 h-3.5 text-[#FF9E1B]" />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4 font-mono text-[#FFBA42]">
      {/* ============================================================== */}
      {/* TOP WORKSPACE BAR                                              */}
      {/* ============================================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#3D2A12]">
        <div>
          <div className="text-[10px] text-[#A6732E] uppercase tracking-widest mb-1 flex items-center gap-2">
            <span>REGISTRY // 03</span>
            <span className="text-[#3D2A12]">//</span>
            <span className="text-[#FF9E1B]">TARGET & SUBJECT REPOSITORY</span>
          </div>
          <h1 className="text-xl font-bold uppercase tracking-wide text-[#FFBA42] flex items-center gap-2">
            <span className="text-[#FF9E1B]">//</span>
            ENTITIES
          </h1>
        </div>

        {/* Filter Controls & Add Button */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#A6732E]" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search entities by name, alias, ID..."
              className="pl-8 pr-3 py-1.5 bg-[#0D0B08] border border-[#3D2A12] rounded-xs text-xs text-[#FFE7B8] focus:border-[#FF9E1B] focus:outline-none placeholder:text-[#6E491A] w-64"
            />
          </div>

          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 bg-[#0D0B08] border border-[#3D2A12] rounded-xs text-xs text-[#FFBA42] focus:border-[#FF9E1B] focus:outline-none"
          >
            <option value="">All types ∨</option>
            <option value="person">Person</option>
            <option value="organization">Organization</option>
            <option value="phone_sim">Phone/SIM</option>
            <option value="location">Location</option>
            <option value="account">Account</option>
            <option value="device">Device</option>
          </select>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-1.5 bg-[#FF9E1B] text-[#080705] font-bold rounded-xs text-xs uppercase tracking-wider hover:bg-[#FFAE3B] transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ ADD ENTITY</span>
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* MAIN TWO-COLUMN SPLIT (TABLE + DETAIL SIDECAR)                 */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* LEFT: ENTITY TABLE (8 COLUMNS) */}
        <div className="lg:col-span-8 border border-[#3D2A12] bg-[#0D0B08] rounded-xs relative">
          <span className="absolute -top-[1px] -left-[1px] w-1.5 h-1.5 border-t-2 border-l-2 border-[#FF9E1B] pointer-events-none" />
          <span className="absolute -top-[1px] -right-[1px] w-1.5 h-1.5 border-t-2 border-r-2 border-[#FF9E1B] pointer-events-none" />
          <span className="absolute -bottom-[1px] -left-[1px] w-1.5 h-1.5 border-b-2 border-l-2 border-[#FF9E1B] pointer-events-none" />
          <span className="absolute -bottom-[1px] -right-[1px] w-1.5 h-1.5 border-b-2 border-r-2 border-[#FF9E1B] pointer-events-none" />

          <div className="p-3 border-b border-[#3D2A12] flex items-center justify-between text-xs">
            <span className="font-bold text-[#FFBA42] uppercase tracking-wider flex items-center gap-2">
              <span className="text-[#FF9E1B]">▶</span>
              INDEXED ENTITIES ({entities.length})
            </span>
            <span className="text-[10px] text-[#A6732E]">DATABASE STORED</span>
          </div>

          {isLoading ? (
            <div className="py-16 text-center text-xs text-[#A6732E]">
              INDEXING TECHNICAL ENTITY RECORDS FROM DATABASE...
            </div>
          ) : entities.length === 0 ? (
            <div className="py-16 text-center text-xs text-[#A6732E] space-y-2">
              <div>NO ENTITIES RECORDED FOR THIS INVESTIGATION YET.</div>
              <div className="text-[11px] text-[#6E491A]">
                Ingest forensic files via Evidence Room or use [ + ADD ENTITY ] to register a target.
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#3D2A12] text-[#A6732E] uppercase text-[10px] tracking-wider bg-[#14110C]">
                    <th className="py-2.5 px-3">ID</th>
                    <th className="py-2.5 px-3">LABEL / ALIAS</th>
                    <th className="py-2.5 px-3">TYPE</th>
                    <th className="py-2.5 px-3">IDENTIFIERS</th>
                    <th className="py-2.5 px-3">STATE</th>
                    <th className="py-2.5 px-3 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3D2A12]/40">
                  {entities.map((e: any, idx: number) => {
                    const isSelected = currentSelection?.id === e.id;
                    const displayId = e.display_id || `E-${String(idx + 1).padStart(3, '0')}`;
                    return (
                      <tr
                        key={e.id}
                        onClick={() => setSelectedEntityId(e.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-[#14110C] border-l-2 border-[#FF9E1B]'
                            : 'hover:bg-[#14110C]/60'
                        }`}
                      >
                        <td className="py-2.5 px-3 font-bold text-[#FF9E1B] whitespace-nowrap">
                          {displayId}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-[#FFE7B8] flex items-center gap-1.5">
                            {getEntityIcon(e.entity_type)}
                            <span>{e.label}</span>
                          </div>
                          {e.aliases && (
                            <div className="text-[10px] text-[#A6732E] mt-0.5 truncate max-w-[200px]">
                              {Array.isArray(e.aliases) ? e.aliases.join(', ') : e.aliases}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="text-[10px] px-1.5 py-0.5 rounded-xs border border-[#3D2A12] text-[#FFBA42] uppercase bg-[#0D0B08]">
                            {typeLabels[e.entity_type] || e.entity_type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-[#A6732E] max-w-[180px] truncate">
                          {e.identifiers && e.identifiers.length > 0
                            ? `${e.identifiers[0].id_type || 'ID'}: ${e.identifiers[0].id_value}`
                            : 'NO DATA'}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <StatusBadge status={e.review_state || 'linked'} />
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <button
                            onClick={(ev) => {
                              ev.stopPropagation();
                              setSelectedEntityId(e.id);
                            }}
                            className="text-[10px] text-[#FF9E1B] hover:underline"
                          >
                            [ DETAILS ]
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* RIGHT: ENTITY DETAIL SIDECAR (4 COLUMNS) */}
        <div className="lg:col-span-4 border border-[#3D2A12] bg-[#0D0B08] rounded-xs relative p-4 space-y-4">
          <span className="absolute -top-[1px] -left-[1px] w-1.5 h-1.5 border-t-2 border-l-2 border-[#FF9E1B] pointer-events-none" />
          <span className="absolute -top-[1px] -right-[1px] w-1.5 h-1.5 border-t-2 border-r-2 border-[#FF9E1B] pointer-events-none" />
          <span className="absolute -bottom-[1px] -left-[1px] w-1.5 h-1.5 border-b-2 border-l-2 border-[#FF9E1B] pointer-events-none" />
          <span className="absolute -bottom-[1px] -right-[1px] w-1.5 h-1.5 border-b-2 border-r-2 border-[#FF9E1B] pointer-events-none" />

          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[#3D2A12]">
            <span className="text-xs font-bold text-[#FFBA42] uppercase tracking-wider flex items-center gap-2">
              <span className="text-[#FF9E1B]">//</span>
              ENTITY DOSSIER
            </span>
            <span className="text-[10px] text-[#A6732E]">DOSSIER-V1</span>
          </div>

          {currentSelection ? (
            <div className="space-y-4">
              {/* Profile Card with Avatar */}
              <div className="flex items-start gap-3 p-3 border border-[#3D2A12] bg-[#14110C] rounded-xs">
                {/* Silhouette Portrait */}
                <div className="w-16 h-16 bg-[#080705] border border-[#3D2A12] flex items-center justify-center flex-shrink-0 relative overflow-hidden">
                  <User className="w-10 h-10 text-[#6E491A]" />
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#FF9E1B]/10 to-transparent pointer-events-none" />
                </div>

                {/* Identity Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-[#FF9E1B]">
                      {currentSelection.display_id || currentSelection.id?.slice(0, 8)}
                    </span>
                    <StatusBadge status={currentSelection.review_state || 'linked'} />
                  </div>
                  <div className="text-sm font-bold text-[#FFE7B8] leading-tight truncate">
                    {currentSelection.label}
                  </div>
                  <div className="text-[10px] text-[#A6732E] mt-1 truncate">
                    Aliases: {Array.isArray(currentSelection.aliases) ? currentSelection.aliases.join(', ') : (currentSelection.aliases || 'None recorded')}
                  </div>
                </div>
              </div>

              {/* Review State Quick Actions */}
              <div className="flex items-center justify-between gap-1 p-1.5 border border-[#3D2A12] bg-[#14110C] rounded-xs text-[10px]">
                <span className="text-[#A6732E] uppercase pl-1">STATE:</span>
                <div className="flex items-center gap-1">
                  {['linked', 'verified', 'flagged', 'observed'].map((st) => (
                    <button
                      key={st}
                      onClick={() => reviewMutation.mutate({ entityId: currentSelection.id, review_state: st })}
                      className={`px-1.5 py-0.5 rounded-xs uppercase tracking-wider transition-colors ${
                        (currentSelection.review_state || 'linked').toLowerCase() === st
                          ? 'bg-[#FF9E1B] text-[#080705] font-bold'
                          : 'text-[#A6732E] hover:text-[#FFBA42]'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Detail Tabs */}
              <div className="grid grid-cols-3 gap-1 border-b border-[#3D2A12] pb-2 text-[10px] uppercase font-bold tracking-wider">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`py-1 text-center transition-colors rounded-xs ${
                    activeTab === 'overview'
                      ? 'bg-[#FF9E1B] text-[#080705]'
                      : 'text-[#A6732E] hover:text-[#FFBA42] border border-[#3D2A12]'
                  }`}
                >
                  [ OVERVIEW ]
                </button>
                <button
                  onClick={() => setActiveTab('relations')}
                  className={`py-1 text-center transition-colors rounded-xs ${
                    activeTab === 'relations'
                      ? 'bg-[#FF9E1B] text-[#080705]'
                      : 'text-[#A6732E] hover:text-[#FFBA42] border border-[#3D2A12]'
                  }`}
                >
                  RELATIONS
                </button>
                <button
                  onClick={() => setActiveTab('events')}
                  className={`py-1 text-center transition-colors rounded-xs ${
                    activeTab === 'events'
                      ? 'bg-[#FF9E1B] text-[#080705]'
                      : 'text-[#A6732E] hover:text-[#FFBA42] border border-[#3D2A12]'
                  }`}
                >
                  EVENTS
                </button>
              </div>

              {/* Tab Content: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-3 text-xs">
                  {/* Two-column colon aligned metadata */}
                  <div className="space-y-1.5 p-3 border border-[#3D2A12] bg-[#14110C] rounded-xs text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-[#A6732E]">Type :</span>
                      <span className="text-[#FFBA42] font-semibold uppercase">
                        {typeLabels[currentSelection.entity_type] || currentSelection.entity_type}
                      </span>
                    </div>
                    {currentSelection.confidence !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-[#A6732E]">Confidence :</span>
                        <span className="text-[#34D399] font-semibold">
                          {Math.round(currentSelection.confidence * 100)}%
                        </span>
                      </div>
                    )}
                    {currentSelection.created_at && (
                      <div className="flex justify-between">
                        <span className="text-[#A6732E]">First Ingested :</span>
                        <span className="text-[#FFE7B8]">
                          {new Date(currentSelection.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    {currentSelection.updated_at && (
                      <div className="flex justify-between">
                        <span className="text-[#A6732E]">Last Active :</span>
                        <span className="text-[#FFE7B8]">
                          {new Date(currentSelection.updated_at).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-[#A6732E]">Source Records :</span>
                      <span className="text-[#FF9E1B] font-semibold">
                        {currentSelection.source_record_ids?.length || 0} Evidence Marks
                      </span>
                    </div>
                  </div>

                  {/* Identifiers List */}
                  <div>
                    <div className="text-[10px] text-[#A6732E] uppercase tracking-wider mb-1.5">
                      IDENTIFIERS & TRAIL MARKS
                    </div>
                    <div className="space-y-1">
                      {currentSelection.identifiers && currentSelection.identifiers.length > 0 ? (
                        currentSelection.identifiers.map((id: any, i: number) => (
                          <div
                            key={i}
                            className="flex items-center justify-between p-2 border border-[#3D2A12] bg-[#14110C] rounded-xs text-[11px]"
                          >
                            <span className="text-[#A6732E] font-semibold">{id.id_type}:</span>
                            <span className="text-[#FFBA42] font-mono">{id.id_value}</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-[10px] text-[#A6732E] p-2 border border-[#3D2A12] bg-[#14110C]">
                          No technical identifiers linked yet.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Forensic Notes */}
                  {currentSelection.notes && (
                    <div className="p-2.5 border border-[#3D2A12] bg-[#080705] rounded-xs text-[11px] text-[#A6732E] leading-relaxed">
                      <span className="text-[#FF9E1B] font-bold">NOTE: </span>
                      {currentSelection.notes}
                    </div>
                  )}
                </div>
              )}

              {/* Tab Content: RELATIONS */}
              {activeTab === 'relations' && (
                <div className="space-y-2 text-xs">
                  <div className="text-[10px] text-[#A6732E] uppercase tracking-wider">
                    DIRECT NETWORK CONNECTIONS
                  </div>
                  {neighborhoodData?.nodes && neighborhoodData.nodes.length > 1 ? (
                    <div className="space-y-1.5 max-h-52 overflow-y-auto">
                      {neighborhoodData.nodes
                        .filter((n: any) => n.id !== currentSelection.id)
                        .map((conn: any) => (
                          <div
                            key={conn.id}
                            onClick={() => setSelectedEntityId(conn.id)}
                            className="p-2 border border-[#3D2A12] bg-[#14110C] rounded-xs flex items-center justify-between text-[11px] cursor-pointer hover:border-[#FF9E1B]"
                          >
                            <div>
                              <span className="text-[#FFE7B8] font-bold">{conn.label}</span>
                              <div className="text-[9px] text-[#A6732E] uppercase">
                                {conn.entity_type}
                              </div>
                            </div>
                            <StatusBadge status={conn.review_state || 'linked'} />
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="p-3 border border-[#3D2A12] bg-[#14110C] rounded-xs text-center text-xs text-[#A6732E]">
                      No network relationships detected yet.
                    </div>
                  )}
                </div>
              )}

              {/* Tab Content: EVENTS */}
              {activeTab === 'events' && (
                <div className="space-y-2 text-xs">
                  <div className="text-[10px] text-[#A6732E] uppercase tracking-wider">
                    CHRONOLOGICAL TRAIL
                  </div>
                  {entityEvents?.items && entityEvents.items.length > 0 ? (
                    <div className="space-y-1.5 max-h-52 overflow-y-auto">
                      {entityEvents.items.map((ev: any) => (
                        <div key={ev.id} className="p-2 border border-[#3D2A12] bg-[#14110C] rounded-xs text-[11px]">
                          <div className="flex items-center justify-between text-[#A6732E] text-[10px]">
                            <span>{new Date(ev.timestamp).toLocaleString()}</span>
                            <span className="text-[#FF9E1B] uppercase">{ev.event_type}</span>
                          </div>
                          <div className="text-[#FFE7B8] mt-0.5">{ev.description}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 border border-[#3D2A12] bg-[#14110C] rounded-xs text-center text-xs text-[#A6732E]">
                      No events associated with this entity.
                    </div>
                  )}
                </div>
              )}

              {/* Bottom Quick Action Buttons (4 grid) */}
              <div className="pt-3 border-t border-[#3D2A12] grid grid-cols-2 gap-2">
                <button
                  onClick={() => navigate(`/cases/${caseId}/graph`)}
                  className="px-2.5 py-1.5 border border-[#3D2A12] hover:border-[#FF9E1B] text-[#FFBA42] text-[10px] font-bold uppercase rounded-xs transition-colors flex items-center justify-center gap-1 bg-[#14110C]"
                >
                  <Share2 className="w-3 h-3 text-[#FF9E1B]" />
                  <span>View in Graph</span>
                </button>
                <button
                  onClick={() => navigate(`/cases/${caseId}/map`)}
                  className="px-2.5 py-1.5 border border-[#3D2A12] hover:border-[#FF9E1B] text-[#FFBA42] text-[10px] font-bold uppercase rounded-xs transition-colors flex items-center justify-center gap-1 bg-[#14110C]"
                >
                  <MapPin className="w-3 h-3 text-[#FF9E1B]" />
                  <span>View on Map</span>
                </button>
                <button
                  onClick={() => navigate(`/cases/${caseId}/contradictions`)}
                  className="px-2.5 py-1.5 border border-[#3D2A12] hover:border-[#FF9E1B] text-[#FFBA42] text-[10px] font-bold uppercase rounded-xs transition-colors flex items-center justify-center gap-1 bg-[#14110C]"
                >
                  <GitMerge className="w-3 h-3 text-[#FF9E1B]" />
                  <span>Merge Candidates</span>
                </button>
                <button
                  onClick={() => navigate(`/cases/${caseId}/timeline`)}
                  className="px-2.5 py-1.5 border border-[#3D2A12] hover:border-[#FF9E1B] text-[#FFBA42] text-[10px] font-bold uppercase rounded-xs transition-colors flex items-center justify-center gap-1 bg-[#14110C]"
                >
                  <Clock className="w-3 h-3 text-[#FF9E1B]" />
                  <span>View Timeline</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-[#A6732E]">
              SELECT AN ENTITY RECORD TO LOAD DOSSIER
            </div>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* ADD ENTITY MODAL                                               */}
      {/* ============================================================== */}
      {showAddModal && (
        <div className="fixed inset-0 bg-[#080705]/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md border border-[#FF9E1B] bg-[#0D0B08] p-5 rounded-xs space-y-4 relative amber-box-glow">
            <div className="flex items-center justify-between pb-3 border-b border-[#3D2A12]">
              <span className="text-xs font-bold text-[#FF9E1B] uppercase tracking-wider">
                ▶ NEW ENTITY REGISTRATION
              </span>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-[#A6732E] hover:text-[#EF4444]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] text-[#A6732E] uppercase mb-1">
                  Entity Label / Name
                </label>
                <input
                  type="text"
                  value={newEntity.label}
                  onChange={e => setNewEntity({ ...newEntity, label: e.target.value })}
                  placeholder="e.g. Target Subject or Suspect Phone"
                  className="w-full px-3 py-1.5 bg-[#14110C] border border-[#3D2A12] rounded-xs text-xs text-[#FFE7B8]"
                />
              </div>

              <div>
                <label className="block text-[10px] text-[#A6732E] uppercase mb-1">
                  Classification Type
                </label>
                <select
                  value={newEntity.entity_type}
                  onChange={e => setNewEntity({ ...newEntity, entity_type: e.target.value })}
                  className="w-full px-3 py-1.5 bg-[#14110C] border border-[#3D2A12] rounded-xs text-xs text-[#FFE7B8]"
                >
                  <option value="person">Person</option>
                  <option value="organization">Organization</option>
                  <option value="phone_sim">Phone / SIM Card</option>
                  <option value="location">Location / Geo Point</option>
                  <option value="account">Bank / Financial Account</option>
                  <option value="device">Digital Device / IMEI</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] text-[#A6732E] uppercase mb-1">
                    ID Type
                  </label>
                  <select
                    value={newEntity.id_type}
                    onChange={e => setNewEntity({ ...newEntity, id_type: e.target.value })}
                    className="w-full px-2 py-1.5 bg-[#14110C] border border-[#3D2A12] rounded-xs text-xs text-[#FFE7B8]"
                  >
                    <option value="PHONE">PHONE</option>
                    <option value="IMEI">IMEI</option>
                    <option value="IMSI">IMSI</option>
                    <option value="PAN">PAN</option>
                    <option value="PASSPORT">PASSPORT</option>
                    <option value="BANK">BANK</option>
                    <option value="COORDINATES">COORDS</option>
                    <option value="CUSTOM">CUSTOM</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] text-[#A6732E] uppercase mb-1">
                    Identifier Value
                  </label>
                  <input
                    type="text"
                    value={newEntity.id_value}
                    onChange={e => setNewEntity({ ...newEntity, id_value: e.target.value })}
                    placeholder="e.g. +91 98201 12345"
                    className="w-full px-3 py-1.5 bg-[#14110C] border border-[#3D2A12] rounded-xs text-xs text-[#FFE7B8]"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#3D2A12]">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-3 py-1.5 border border-[#3D2A12] text-[#A6732E] text-xs font-mono uppercase rounded-xs"
              >
                CANCEL
              </button>
              <button
                onClick={() => addEntityMutation.mutate(newEntity)}
                disabled={!newEntity.label || addEntityMutation.isPending}
                className="px-4 py-1.5 bg-[#FF9E1B] text-[#080705] font-bold text-xs font-mono uppercase rounded-xs hover:bg-[#FFAE3B] disabled:opacity-50"
              >
                {addEntityMutation.isPending ? 'REGISTERING...' : '[ COMMIT RECORD ]'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
