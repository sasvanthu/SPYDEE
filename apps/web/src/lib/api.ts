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

  uploadEvidence: (caseId: string, file: File, sourceType: string) => {
    const form = new FormData();
    form.append('file', file);
    form.append('source_type', sourceType);
    return request<any>(`/evidence/${caseId}/upload`, { method: 'POST', body: form, headers: {} });
  },
  importEvidence: (caseId: string, fileId: string) =>
    request<any>(`/evidence/${caseId}/upload/${fileId}/import`, { method: 'POST' }),
  getFiles: (caseId: string) => request<any[]>(`/evidence/${caseId}/files`),
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
    const p = new URLSearchParams();
    if (params?.event_type) p.set('event_type', params.event_type);
    if (params?.date_from) p.set('date_from', params.date_from);
    if (params?.date_to) p.set('date_to', params.date_to);
    return request<any[]>(`/timeline/${caseId}?${p}`);
  },

  runAnalysis: (caseId: string) =>
    request<any>(`/analysis/${caseId}/run`, { method: 'POST' }),
  getAnalysisRuns: (caseId: string) => request<any[]>(`/analysis/${caseId}`),

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
};
