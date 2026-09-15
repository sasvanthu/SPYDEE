const API_BASE = '/api/v1';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('spydee_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 401) {
    localStorage.removeItem('spydee_token');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Request failed');
  }
  return res.json();
}

function q(params?: Record<string, string | undefined | null | number>) {
  const p = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const api = {
  login: (username: string, password: string) =>
    request<{ access_token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  getMe: () => request<any>('/auth/me'),

  getCases: (search?: string, status?: string) => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    return request<any[]>(`/cases?${params}`);
  },

  getCase: (id: string) => request<any>(`/cases/${id}`),
  createCase: (data: any) => request<any>('/cases', { method: 'POST', body: JSON.stringify(data) }),
  updateCase: (id: string, data: any) => request<any>(`/cases/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  getEntities: (caseId: string, type?: string, search?: string) => {
    const params = new URLSearchParams();
    if (type) params.set('entity_type', type);
    if (search) params.set('search', search);
    return request<any[]>(`/entities/${caseId}?${params}`);
  },
  getEntity: (caseId: string, entityId: string) => request<any>(`/entities/${caseId}/${entityId}`),
  reviewEntity: (caseId: string, entityId: string, data: any) =>
    request<any>(`/entities/${caseId}/${entityId}/review`, { method: 'POST', body: JSON.stringify(data) }),
  getMergeSuggestions: (caseId: string) => request<any[]>(`/entities/${caseId}/merge-suggestions`),
  generateMergeCandidates: (caseId: string) =>
    request<any>(`/entities/${caseId}/merge/candidates`, { method: 'POST' }),
  applyMergeSuggestion: (caseId: string, suggestionId: string) =>
    request<any>(`/entities/${caseId}/merge-suggestions/${suggestionId}/apply`, { method: 'POST' }),
  dismissMergeSuggestion: (caseId: string, suggestionId: string) =>
    request<any>(`/entities/${caseId}/merge-suggestions/${suggestionId}/dismiss`, { method: 'POST' }),

  uploadEvidence: (caseId: string, file: File, sourceType: string) => {
    const form = new FormData();
    form.append('file', file);
    form.append('source_type', sourceType);
    return request<any>(`/evidence/${caseId}/upload`, { method: 'POST', body: form, headers: {} });
  },
  importEvidence: (caseId: string, fileId: string) =>
    request<any>(`/evidence/${caseId}/upload/${fileId}/import`, { method: 'POST' }),
  getFiles: (caseId: string) => request<any[]>(`/evidence/${caseId}/files`),
  getEvidenceDetail: (caseId: string, fileId: string) => request<any>(`/evidence/${caseId}/files/${fileId}`),
  retryExtract: (caseId: string, fileId: string) =>
    request<any>(`/evidence/${caseId}/files/${fileId}/retry-extract`, { method: 'POST' }),
  getImports: (caseId: string) => request<any[]>(`/evidence/${caseId}/imports`),
  getRecords: (caseId: string, importId?: string) => {
    const params = importId ? `?import_id=${importId}` : '';
    return request<any[]>(`/evidence/${caseId}/records${params}`);
  },

  getGraph: (caseId: string, filters?: any) =>
    request<any>(`/graph/${caseId}`, { method: 'POST', body: JSON.stringify(filters || {}) }),
  getNeighbourhood: (caseId: string, entityId: string, hops = 1) =>
    request<any>(`/graph/${caseId}/neighbourhood/${entityId}?hops=${hops}`),
  getPath: (caseId: string, sourceId: string, targetId: string) =>
    request<any>(`/graph/${caseId}/path?source_id=${sourceId}&target_id=${targetId}`),
  getRelEvidence: (caseId: string, relId: string) =>
    request<any>(`/graph/${caseId}/relationship/${relId}/evidence`),

  getTimeline: (caseId: string, params?: any) => {
    const url = `/timeline/${caseId}${q({
      event_type: params?.event_type,
      date_from: params?.date_from,
      date_to: params?.date_to,
      entity_id: params?.entity_id,
      entity_label: params?.entity_label,
      source: params?.source,
      page: params?.page,
      page_size: params?.page_size,
    })}`;
    return request<{ items: any[]; total: number; page: number; page_size: number }>(url);
  },
  createManualEvent: (caseId: string, data: any) =>
    request<any>(`/timeline/${caseId}/events`, { method: 'POST', body: JSON.stringify(data) }),

  runAnalysis: (caseId: string) =>
    request<any>(`/analysis/${caseId}/run`, { method: 'POST' }),
  getAnalysisRuns: (caseId: string) => request<any[]>(`/analysis/${caseId}`),
  getSignals: (caseId: string, family?: string) => {
    const params = family ? `?family=${family}` : '';
    return request<any>(`/analysis/${caseId}/signals${params}`);
  },

  getHypotheses: (caseId: string, state?: string) => {
    const params = state ? `?review_state=${state}` : '';
    return request<any[]>(`/hypotheses/${caseId}${params}`);
  },
  getHypothesis: (caseId: string, hypId: string) => request<any>(`/hypotheses/${caseId}/${hypId}`),
  reviewHypothesis: (caseId: string, hypId: string, data: any) =>
    request<any>(`/hypotheses/${caseId}/${hypId}/review`, { method: 'POST', body: JSON.stringify(data) }),

  askCopilot: (caseId: string, query: string) =>
    request<any>(`/copilot/${caseId}/query`, { method: 'POST', body: JSON.stringify({ query }) }),
  getCopilotHistory: (caseId: string) => request<any[]>(`/copilot/${caseId}/history`),

  createReport: (caseId: string, data: any) =>
    request<any>(`/reports/${caseId}`, { method: 'POST', body: JSON.stringify(data) }),
  getReports: (caseId: string) => request<any[]>(`/reports/${caseId}`),

  getAuditLog: (caseId: string) => request<any[]>(`/audit/${caseId}`),
  getJobs: (caseId: string) => request<any[]>(`/jobs/${caseId}`),

  // ── Investigation workspace ──────────────────────────────────────────
  getWorkspaceSummary: (caseId: string) => request<any>(`/workspace/${caseId}/summary`),

  getContradictions: (caseId: string, status?: string) =>
    request<any[]>(`/workspace/${caseId}/contradictions${q({ status })}`),
  getContradiction: (caseId: string, id: string) => request<any>(`/workspace/${caseId}/contradictions/${id}`),
  createContradiction: (caseId: string, data: any) =>
    request<any>(`/workspace/${caseId}/contradictions`, { method: 'POST', body: JSON.stringify(data) }),
  reviewContradiction: (caseId: string, id: string, data: any) =>
    request<any>(`/workspace/${caseId}/contradictions/${id}/review`, { method: 'POST', body: JSON.stringify(data) }),

  getLeads: (caseId: string, status?: string) =>
    request<any[]>(`/workspace/${caseId}/leads${q({ status })}`),
  getLead: (caseId: string, id: string) => request<any>(`/workspace/${caseId}/leads/${id}`),
  createLead: (caseId: string, data: any) =>
    request<any>(`/workspace/${caseId}/leads`, { method: 'POST', body: JSON.stringify(data) }),
  updateLead: (caseId: string, id: string, data: any) =>
    request<any>(`/workspace/${caseId}/leads/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  reviewLead: (caseId: string, id: string, data: any) =>
    request<any>(`/workspace/${caseId}/leads/${id}/review`, { method: 'POST', body: JSON.stringify(data) }),

  getGaps: (caseId: string, status?: string, leadId?: string) =>
    request<any[]>(`/workspace/${caseId}/gaps${q({ status, lead_id: leadId })}`),
  getGap: (caseId: string, id: string) => request<any>(`/workspace/${caseId}/gaps/${id}`),
  createGap: (caseId: string, data: any) =>
    request<any>(`/workspace/${caseId}/gaps`, { method: 'POST', body: JSON.stringify(data) }),
  updateGap: (caseId: string, id: string, data: any) =>
    request<any>(`/workspace/${caseId}/gaps/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  getActions: (caseId: string, status?: string) =>
    request<any[]>(`/workspace/${caseId}/actions${q({ status })}`),
  createAction: (caseId: string, data: any) =>
    request<any>(`/workspace/${caseId}/actions`, { method: 'POST', body: JSON.stringify(data) }),
  updateAction: (caseId: string, id: string, data: any) =>
    request<any>(`/workspace/${caseId}/actions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
};