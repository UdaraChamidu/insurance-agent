import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (event) => {
    event.preventDefault();
    const storedPassword = localStorage.getItem('adminPassword') || 'admin123';

    if (password !== storedPassword) {
      setError('Invalid password');
      return;
    }

    sessionStorage.setItem('adminAuth', 'true');
    const fromPath = location.state?.from?.pathname;
    const nextPath = typeof fromPath === 'string' && fromPath.startsWith('/admin')
      ? fromPath
      : '/admin/bookings';
    navigate(nextPath, { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-8 max-w-md w-full shadow-2xl">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="bg-blue-600/20 p-3 rounded-full">
              <Lock className="h-10 w-10 text-blue-400" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white">Admin Login</h1>
          <p className="text-gray-400 mt-2">Enter password to access admin console</p>
        </div>

        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (error) setError('');
              }}
              className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="Enter admin password"
              required
            />
          </div>

          {error && (
            <p className="text-sm text-red-300 mb-4">{error}</p>
          )}

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-6 rounded-lg transition-all shadow-lg shadow-blue-600/20"
          >
            Login
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => navigate('/')}
            className="text-sm text-blue-300 hover:text-blue-200 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
