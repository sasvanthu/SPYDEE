import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Search, Plus, X, FolderLock, Shield, ArrowRight } from 'lucide-react';
import { TerminalPanel } from '../components/common/TerminalPanel';
import { StatusBadge } from '../components/common/StatusBadge';
import { useTerminalAlert } from '../context/TerminalAlertContext';

export default function CaseList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showAlert } = useTerminalAlert();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newCase, setNewCase] = useState({ title: '', case_code: '', description: '' });

  const { data: cases = [], isLoading } = useQuery({
    queryKey: ['cases', search],
    queryFn: () => api.getCases(search || undefined),
  });

  const createMutation = useMutation({
    mutationFn: api.createCase,
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      setShowCreate(false);
      setNewCase({ title: '', case_code: '', description: '' });
      showAlert('New investigation dossier initialized.', 'SUCCESS');
      if (data?.id) {
        navigate(`/cases/${data.id}`);
      }
    },
    onError: (err: any) => {
      showAlert(err?.response?.data?.detail || err?.message || 'Provisioning failed', 'CRITICAL');
    }
  });

  const activeCases = cases.filter((c: any) => (c.status || '').toLowerCase() === 'active').length;

  return (
    <div className="max-w-6xl mx-auto space-y-3 font-mono text-xs text-[#f59e0b]">
      {/* TOP HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-amber-500/40 gap-2">
        <div>
          <div className="text-[11px] text-amber-500/70 font-bold tracking-widest uppercase">
            // SPYDEE OS // CASE WORKSPACE SELECTOR
          </div>
          <div className="text-base md:text-lg font-black text-amber-300 tracking-wider">
            OPERATIONAL INVESTIGATION REGISTRY
          </div>
          <div className="text-[10px] text-amber-500/80">
            ACTIVE CRIMINAL NETWORK INVESTIGATIONS & INTELLIGENCE DOSSIER REPOSITORY
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* SEARCH INPUT */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-amber-500/70" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="FILTER BY CODE OR TITLE..."
              className="pl-8 pr-3 py-1.5 bg-black border border-amber-500/40 text-amber-300 placeholder-amber-500/40 text-xs w-48 sm:w-64 outline-none font-mono"
            />
          </div>

          <button
            onClick={() => setShowCreate(!showCreate)}
            className="px-3 py-1.5 bg-amber-500 text-black font-bold hover:bg-amber-400 transition-colors flex items-center gap-1.5 text-xs shadow-[0_0_10px_rgba(245,158,11,0.4)] uppercase"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{showCreate ? 'ABORT' : '+ NEW CASE DOSSIER'}</span>
          </button>
        </div>
      </div>

      {/* STATS RIBBON */}
      <div className="p-2 bg-[#0a0f0a] border border-amber-500/30 flex flex-wrap items-center justify-between text-xs text-amber-400">
        <div className="flex items-center gap-4">
          <span>TOTAL CASES: <strong className="text-amber-200">{cases.length}</strong></span>
          <span>ACTIVE SURVEILLANCE: <strong className="text-emerald-400">{activeCases}</strong></span>
        </div>
        <div className="text-[10px] text-amber-500/70">
          EVIDENTIARY REPOSITORIES: <strong className="text-emerald-400">ONLINE // TAMPER-SEALED</strong>
        </div>
      </div>

      {/* CREATE MODAL / PANEL */}
      {showCreate && (
        <TerminalPanel title="PROVISION NEW INVESTIGATION DOSSIER" subtitle="CASE MANDATE">
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-amber-500/80 uppercase mb-1">
                  CASE TITLE:
                </label>
                <input
                  placeholder="e.g. Operation Nightshade - Smuggling Network"
                  value={newCase.title}
                  onChange={(e) => setNewCase({ ...newCase, title: e.target.value })}
                  className="w-full p-2 bg-black border border-amber-500/40 text-amber-300 text-xs outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] text-amber-500/80 uppercase mb-1">
                  CASE CODE IDENTIFIER (FIR / REF):
                </label>
                <input
                  placeholder="e.g. MH-26189-042"
                  value={newCase.case_code}
                  onChange={(e) => setNewCase({ ...newCase, case_code: e.target.value })}
                  className="w-full p-2 bg-black border border-amber-500/40 text-amber-300 text-xs outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-amber-500/80 uppercase mb-1">
                INVESTIGATION SCOPE / MANDATE NOTES:
              </label>
              <textarea
                placeholder="Brief summary of target criminal syndicate, contraband vectors, or court reference..."
                value={newCase.description}
                onChange={(e) => setNewCase({ ...newCase, description: e.target.value })}
                className="w-full p-2 bg-black border border-amber-500/40 text-amber-300 text-xs outline-none h-16 resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setShowCreate(false)}
                className="px-3 py-1 bg-black border border-amber-500/30 text-amber-400 hover:bg-amber-950/30"
              >
                CANCEL
              </button>
              <button
                onClick={() => createMutation.mutate(newCase)}
                disabled={!newCase.title || !newCase.case_code || createMutation.isPending}
                className="px-3 py-1 bg-amber-500 text-black font-bold hover:bg-amber-400 shadow-[0_0_8px_#f59e0b] disabled:opacity-50 uppercase"
              >
                {createMutation.isPending ? 'PROVISIONING...' : '[ INITIALIZE CASE ]'}
              </button>
            </div>
          </div>
        </TerminalPanel>
      )}

      {/* CASES GRID */}
      {isLoading ? (
        <div className="p-16 text-center text-xs text-amber-500">
          [ FETCHING CLASSIFIED CASE INVENTORIES FROM DATABASE... ]
        </div>
      ) : cases && cases.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {cases.map((c: any) => (
            <div
              key={c.id}
              onClick={() => navigate(`/cases/${c.id}`)}
              className="p-3.5 bg-[#0b100b] border border-amber-500/35 hover:border-amber-400 hover:bg-[#0e160e] cursor-pointer transition-colors space-y-2 group relative"
            >
              <div className="flex items-center justify-between pb-1.5 border-b border-amber-500/20">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-amber-400 text-xs uppercase tracking-wider">
                    {c.case_code || 'CASE-REF'}
                  </span>
                  <StatusBadge status={c.status || 'ACTIVE'} size="sm" />
                </div>
                <span className="text-[10px] text-amber-500/70 font-mono">
                  {c.created_at ? new Date(c.created_at).toLocaleDateString() : 'ACTIVE'}
                </span>
              </div>

              <div>
                <div className="text-sm font-bold text-amber-300 group-hover:text-amber-200 transition-colors">
                  {c.title}
                </div>
                <p className="text-xs text-amber-200/80 line-clamp-2 mt-1 leading-relaxed">
                  {c.description || 'Criminal intelligence investigation into syndicated network and associated communication anomalies.'}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-amber-500/15 text-[11px]">
                <div className="flex items-center gap-3 text-amber-500/80">
                  <span>ENTITIES: <strong className="text-emerald-400">{c.entity_count || 0}</strong></span>
                  <span>EVIDENCE: <strong className="text-amber-300">{c.evidence_count || 0}</strong></span>
                  <span>HYPOTHESES: <strong className="text-amber-400">{c.hypothesis_count || 0}</strong></span>
                </div>
                <div className="text-amber-400 font-bold group-hover:translate-x-1 transition-transform flex items-center gap-1">
                  <span>OPEN CASE &rarr;</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-16 text-center text-xs text-amber-500/70 border border-dashed border-amber-500/30 bg-[#0a0f0a]">
          NO CASE DOSSIERS FOUND MATCHING QUERY. USE [+ NEW CASE DOSSIER] TO INITIALIZE AN INVESTIGATION.
        </div>
      )}
    </div>
  );
}
