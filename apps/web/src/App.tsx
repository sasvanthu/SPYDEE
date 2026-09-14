import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Login from './pages/Login';
import CaseList from './pages/CaseList';
import CaseOverview from './pages/CaseOverview';
import EvidenceRoom from './pages/EvidenceRoom';
import EntityRegistry from './pages/EntityRegistry';
import InvestigationGraph from './pages/InvestigationGraph';
import NetworkMap from './pages/NetworkMap';
import Timeline from './pages/Timeline';
import IntelligenceWorkbench from './pages/IntelligenceWorkbench';
import HypothesisList from './pages/HypothesisList';
import Copilot from './pages/Copilot';
import Reports from './pages/Reports';
import Layout from './components/Layout';

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('spydee_token');
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<CaseList />} />
            <Route path="cases" element={<CaseList />} />
            <Route path="cases/:caseId" element={<CaseOverview />} />
            <Route path="cases/:caseId/evidence" element={<EvidenceRoom />} />
            <Route path="cases/:caseId/entities" element={<EntityRegistry />} />
            <Route path="cases/:caseId/graph" element={<InvestigationGraph />} />
            <Route path="cases/:caseId/map" element={<NetworkMap />} />
            <Route path="cases/:caseId/timeline" element={<Timeline />} />
            <Route path="cases/:caseId/workbench" element={<IntelligenceWorkbench />} />
            <Route path="cases/:caseId/hypotheses" element={<HypothesisList />} />
            <Route path="cases/:caseId/copilot" element={<Copilot />} />
            <Route path="cases/:caseId/reports" element={<Reports />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
