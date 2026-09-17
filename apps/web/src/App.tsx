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
import Contradictions from './pages/Contradictions';
import LeadsPage from './pages/LeadsPage';
import Copilot from './pages/Copilot';
import Reports from './pages/Reports';
import Layout from './components/Layout';

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('spydee_token');
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function NotFound() {
  return (
    <div className="min-h-screen bg-[#080705] text-[#FFBA42] font-mono flex flex-col items-center justify-center gap-4 text-center p-6 crt-screen">
      <div className="text-6xl font-bold text-[#FF9E1B] tracking-widest [text-shadow:0_0_12px_rgba(255,158,27,0.4)]">
        404 // NOT FOUND
      </div>
      <p className="text-xs text-[#A6732E] tracking-wider uppercase">
        SPECIFIED CLASSIFIED NODE OR JURISDICTIONAL ROUTE DOES NOT EXIST.
      </p>
      <a
        href="/"
        className="px-4 py-2 bg-[#14110C] hover:bg-[#1A140B] text-[#FF9E1B] border border-[#3D2A12] hover:border-[#FF9E1B] rounded-xs text-xs tracking-wider transition-colors"
      >
        [ RETURN TO ACTIVE CASES CONSOLE ]
      </a>
    </div>
  );
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
            <Route path="cases/:caseId/contradictions" element={<Contradictions />} />
            <Route path="cases/:caseId/hypotheses" element={<HypothesisList />} />
            <Route path="cases/:caseId/leads" element={<LeadsPage />} />
            <Route path="cases/:caseId/copilot" element={<Copilot />} />
            <Route path="cases/:caseId/reports" element={<Reports />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
