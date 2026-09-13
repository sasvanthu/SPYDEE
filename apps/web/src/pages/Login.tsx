import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.login(username, password);
      localStorage.setItem('spydee_token', res.access_token);
      localStorage.setItem('spydee_user', JSON.stringify(res.user));
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <circle cx="16" cy="24" r="6" stroke="#0f3460" strokeWidth="2.5" fill="none" />
              <circle cx="32" cy="16" r="5" stroke="#007bff" strokeWidth="2.5" fill="none" />
              <circle cx="34" cy="32" r="5" stroke="#06b6d4" strokeWidth="2.5" fill="none" />
              <line x1="21" y1="21" x2="28" y2="17" stroke="#0f3460" strokeWidth="2" />
              <line x1="21" y1="27" x2="29" y2="31" stroke="#0f3460" strokeWidth="2" />
              <line x1="32" y1="21" x2="33" y2="27" stroke="#007bff" strokeWidth="2" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-navy-700">SPYDEE</h1>
          <p className="text-navy-400 text-sm mt-1">Investigative Intelligence Workspace</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-navy-600 mb-1">Username</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-azure-500 focus:border-azure-500 outline-none"
              placeholder="Enter username" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-navy-600 mb-1">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-azure-500 focus:border-azure-500 outline-none"
              placeholder="Enter password" required />
          </div>
          {error && <p className="text-danger-500 text-sm">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-azure-500 text-white py-2.5 rounded-md font-medium hover:bg-azure-600 disabled:opacity-50 transition">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <div className="mt-6 p-3 bg-gray-50 rounded-md text-xs text-navy-400">
          <p className="font-medium mb-1">Demo Accounts:</p>
          <p>admin / admin123</p>
          <p>investigator / invest123</p>
          <p>supervisor / super123</p>
        </div>
      </div>
    </div>
  );
}
