import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Database, FileText, Activity, RefreshCw, ArrowLeft, 
  CheckCircle, AlertCircle, Clock, Zap, HardDrive,
  RotateCcw, XCircle, ChevronDown, ChevronUp, Bell
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const REFRESH_INTERVAL = 30000; // 30 seconds

export default function DocumentsPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [expandedErrors, setExpandedErrors] = useState(false);
  const [reprocessingKeys, setReprocessingKeys] = useState(new Set());
  const prevFileCountRef = useRef(null);

  // Fetch stats and files
  const fetchData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
      const [statsRes, filesRes] = await Promise.all([
        fetch(`${API_URL}/api/documents/stats`, { signal: controller.signal }),
        fetch(`${API_URL}/api/documents/files`, { signal: controller.signal })
      ]);

      if (!statsRes.ok || !filesRes.ok) throw new Error('Failed to fetch data');

      const statsData = await statsRes.json();
      const filesData = await filesRes.json();

      // Detect new files for notification
      const newCount = filesData.files?.length || 0;
      if (prevFileCountRef.current !== null && newCount > prevFileCountRef.current) {
        showToast(`🆕 ${newCount - prevFileCountRef.current} new file(s) detected!`, 'success');
      } else if (prevFileCountRef.current !== null && newCount < prevFileCountRef.current) {
        showToast('🔄 File queued for re-processing', 'info');
      }
      prevFileCountRef.current = newCount;

      setStats(statsData);
      setFiles(filesData.files || []);
      setError(null);
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('Request timed out. Backend might be down.');
      } else {
        setError(err.message);
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Auto-refresh
  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(), REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Toast notification
  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  // Reprocess a file
  const handleReprocess = async (fileKey, fileName) => {
    if (!confirm(`Are you sure you want to re-process "${fileName}"?\n\nThis will remove the old vectors and re-ingest the file on the next poll cycle (~5 min).`)) {
      return;
    }

    setReprocessingKeys(prev => new Set([...prev, fileKey]));

    try {
      const res = await fetch(`${API_URL}/api/documents/reprocess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileKey })
      });

      if (!res.ok) throw new Error('Failed to schedule reprocess');

      const data = await res.json();
      showToast(`🔄 "${data.fileName}" queued for re-processing`, 'success');
      
      // Refresh data
      await fetchData();
    } catch (err) {
      showToast(`❌ Error: ${err.message}`, 'error');
    } finally {
      setReprocessingKeys(prev => {
        const next = new Set(prev);
        next.delete(fileKey);
        return next;
      });
    }
  };

  // Status badge component
  const StatusBadge = ({ status }) => {
    const config = {
      processing: { bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/30', icon: RefreshCw, label: 'Processing' },
      success: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30', icon: CheckCircle, label: 'Ingested' },
      no_vectors: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30', icon: AlertCircle, label: 'No Vectors' },
      error: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', icon: XCircle, label: 'Error' }
    };
    const c = config[status] || config.error;
    const Icon = c.icon;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text} border ${c.border}`}>
        <Icon className={`h-3 w-3 ${status === 'processing' ? 'animate-spin' : ''}`} />
        {c.label}
      </span>
    );
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center p-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading knowledge base...</p>
        </div>
      </div>
    );
  }

  const ingestion = stats?.ingestion || {};
  const pinecone = stats?.pinecone || {};
  const errors = ingestion.errors || [];
  const processingFiles = ingestion.processingFiles || [];

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-2xl border backdrop-blur-md animate-slide-in
          ${toast.type === 'success' ? 'bg-emerald-900/80 border-emerald-500/40 text-emerald-200' :
            toast.type === 'error' ? 'bg-red-900/80 border-red-500/40 text-red-200' :
              'bg-blue-900/80 border-blue-500/40 text-blue-200'}`}>
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span className="text-sm font-medium">{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-2 opacity-60 hover:opacity-100">×</button>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Database className="h-6 w-6 text-blue-500" />
            Knowledge Base
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage document ingestion & vector search status</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">
            Auto-refreshes every 30s
          </span>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-white rounded-lg transition-all text-sm"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="max-w-7xl mx-auto px-6 mt-4">
          <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
            <p className="text-red-200 text-sm">Failed to connect to backend: {error}</p>
          </div>
        </div>
      )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {/* Ingestion Status */}
          <div className="bg-white/5 backdrop-blur-md rounded-xl border border-white/10 p-5 hover:bg-white/10 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-400">Ingestion Status</p>
              <div className={`p-2 rounded-lg ${ingestion.isRunning ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                <Activity className={`h-5 w-5 ${ingestion.isRunning ? 'text-emerald-400' : 'text-red-400'}`} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={`h-2.5 w-2.5 rounded-full ${ingestion.isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
              <span className={`text-lg font-bold ${ingestion.isRunning ? 'text-emerald-400' : 'text-red-400'}`}>
                {ingestion.isRunning ? 'Running' : 'Stopped'}
              </span>
            </div>
            {ingestion.lastCheck && (
              <p className="text-xs text-gray-500 mt-2">Last check: {formatDate(ingestion.lastCheck)}</p>
            )}
          </div>

          {/* Processed Files */}
          <div className="bg-white/5 backdrop-blur-md rounded-xl border border-white/10 p-5 hover:bg-white/10 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-400">Processed Files</p>
              <div className="bg-blue-500/20 p-2 rounded-lg">
                <FileText className="h-5 w-5 text-blue-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-white">{ingestion.processedFileCount || 0}</p>
            <p className="text-xs text-gray-500 mt-2">
              Active now: {ingestion.processingFileCount || 0} • Polls: {ingestion.totalChecks || 0}
            </p>
          </div>

          {/* Total Vectors */}
          <div className="bg-white/5 backdrop-blur-md rounded-xl border border-white/10 p-5 hover:bg-white/10 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-400">Total Vectors</p>
              <div className="bg-purple-500/20 p-2 rounded-lg">
                <HardDrive className="h-5 w-5 text-purple-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-white">{pinecone.totalVectors?.toLocaleString() || 0}</p>
            <p className="text-xs text-gray-500 mt-2">
              {Object.keys(pinecone.namespaces || {}).length} namespace(s)
            </p>
          </div>

          {/* Errors */}
          <div className="bg-white/5 backdrop-blur-md rounded-xl border border-white/10 p-5 hover:bg-white/10 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-400">Recent Errors</p>
              <div className={`p-2 rounded-lg ${errors.length > 0 ? 'bg-red-500/20' : 'bg-gray-500/20'}`}>
                <AlertCircle className={`h-5 w-5 ${errors.length > 0 ? 'text-red-400' : 'text-gray-500'}`} />
              </div>
            </div>
            <p className={`text-3xl font-bold ${errors.length > 0 ? 'text-red-400' : 'text-white'}`}>
              {errors.length}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              {errors.length > 0 ? 'See activity log below' : 'No errors'}
            </p>
          </div>
        </div>

        {/* Active Processing List */}
        {processingFiles.length > 0 && (
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-5 mb-8">
            <h3 className="text-sm font-semibold text-blue-200 mb-3 flex items-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Processing Files ({processingFiles.length})
            </h3>
            <div className="space-y-2">
              {processingFiles.map((file) => (
                <div
                  key={file.key}
                  className="flex items-center justify-between gap-3 rounded-lg bg-black/20 border border-blue-500/20 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{file.fileName}</p>
                    <p className="text-xs text-blue-200/70">
                      Namespace: {file.namespace || 'N/A'}
                    </p>
                  </div>
                  <div className="text-xs text-blue-200/70 whitespace-nowrap">
                    Started: {formatDate(file.startedAt)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Namespace Breakdown */}
        {Object.keys(pinecone.namespaces || {}).length > 0 && (
          <div className="bg-white/5 backdrop-blur-md rounded-xl border border-white/10 p-5 mb-8">
            <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-400" />
              Pinecone Namespaces
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {Object.entries(pinecone.namespaces).map(([ns, data]) => (
                <div key={ns} className="bg-black/20 rounded-lg px-3 py-2 border border-white/5">
                  {/*
                    Backend normalizes to recordCount, but keep compatibility with
                    old/new payloads that may use vector_count or vectorCount.
                  */}
                  {(() => {
                    const namespaceVectors = data?.recordCount ?? data?.vector_count ?? data?.vectorCount ?? 0;
                    return (
                      <>
                        <p className="text-xs text-gray-400 truncate">{ns || '(default)'}</p>
                        <p className="text-sm font-bold text-white">{namespaceVectors.toLocaleString()} vectors</p>
                      </>
                    );
                  })()}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Files Table */}
        <div className="bg-white/5 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-400" />
              Processed Documents
            </h2>
            <span className="text-xs text-gray-500">{files.length} file(s)</span>
          </div>

          {files.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <FileText className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium">No documents processed yet</p>
              <p className="text-sm mt-1">Files will appear here once SharePoint sync completes</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">File Name</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Namespace</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Chunks</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Vectors</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Processed At</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {files.map((file) => (
                    <tr key={file.key} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="bg-blue-500/10 p-2 rounded-lg flex-shrink-0">
                            <FileText className="h-4 w-4 text-blue-400" />
                          </div>
                          <span className="text-sm font-medium text-white truncate max-w-[200px]" title={file.fileName}>
                            {file.fileName}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-xs text-gray-400 bg-white/5 px-2 py-1 rounded-md">
                          {file.namespace || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <StatusBadge status={file.status} />
                      </td>
                      <td className="px-4 py-4 text-center text-sm text-gray-300">{file.chunks || 0}</td>
                      <td className="px-4 py-4 text-center text-sm text-gray-300">{file.vectors || 0}</td>
                      <td className="px-4 py-4 text-sm text-gray-400">{formatDate(file.processedAt)}</td>
                      <td className="px-4 py-4 text-center">
                        <button
                          onClick={() => handleReprocess(file.key, file.fileName)}
                          disabled={reprocessingKeys.has(file.key)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-lg text-xs font-medium transition-all disabled:opacity-40"
                          title="Remove from tracking and re-process on next sync"
                        >
                          <RotateCcw className={`h-3 w-3 ${reprocessingKeys.has(file.key) ? 'animate-spin' : ''}`} />
                          Re-process
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Activity Log */}
        <div className="bg-white/5 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden">
          <button
            onClick={() => setExpandedErrors(!expandedErrors)}
            className="w-full px-6 py-4 border-b border-white/10 flex items-center justify-between hover:bg-white/5 transition-colors"
          >
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Clock className="h-5 w-5 text-gray-400" />
              Activity Log
              {errors.length > 0 && (
                <span className="bg-red-500/20 text-red-400 text-xs px-2 py-0.5 rounded-full border border-red-500/30">
                  {errors.length}
                </span>
              )}
            </h2>
            {expandedErrors ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
          </button>

          {expandedErrors && (
            <div className="p-4">
              {errors.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No errors — everything is running smoothly</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {[...errors].reverse().map((err, i) => (
                    <div key={i} className="bg-red-900/20 border border-red-500/10 rounded-lg px-4 py-3 flex items-start gap-3">
                      <XCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-red-200 break-all">{err.error}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {err.file && <span className="text-xs text-red-400/60">{err.file}</span>}
                          <span className="text-xs text-red-400/40">{formatDate(err.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="mt-6 text-center text-xs text-gray-600">
          Polling interval: {ingestion.pollingIntervalMinutes || 5} min • 
          Next check in ~{Math.max(1, Math.round((ingestion.pollingIntervalMinutes || 5) - ((Date.now() - new Date(ingestion.lastCheck).getTime()) / 60000)))} min
        </div>

      {/* Custom animation */}
      <style>{`
        @keyframes slide-in {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
