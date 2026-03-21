import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck, AlertTriangle, CheckCircle2, Clock,
  FileText, ChevronDown, ChevronUp, RefreshCw, ExternalLink
} from 'lucide-react';
import { getApiBaseUrl } from '../utils/network';

const API_URL = getApiBaseUrl();

const STAGE_LABELS = {
  new_lead: 'New Lead', contacted: 'Contacted', discovery_scheduled: 'Discovery Sched.',
  census_requested: 'Census Req.', census_received: 'Census Recv.',
  sent_to_warner: 'Sent to Warner', quotes_received: 'Quotes Recv.',
  proposal_presented: 'Proposal', closed_won: 'Won', closed_lost: 'Lost',
  renewal_followup: 'Renewal', new: 'New', appointment_booked: 'Appt Booked',
  quoted: 'Quoted', enrolled: 'Enrolled', lost: 'Lost',
};

function StatCard({ icon: Icon, label, value, color = 'blue' }) {
  const colorMap = {
    blue: 'bg-blue-500/10 text-blue-500',
    green: 'bg-emerald-500/10 text-emerald-500',
    amber: 'bg-amber-500/10 text-amber-500',
    red: 'bg-red-500/10 text-red-500',
  };
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-white/10 p-5">
      <div className="flex items-center gap-3">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        </div>
      </div>
    </div>
  );
}

function ComplianceRecord({ record, onNavigate }) {
  const [expanded, setExpanded] = useState(false);
  const flags = record.complianceFlags || {};
  const actions = record.actionItems || [];

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-2xl border ${record.hasWarnings ? 'border-amber-300 dark:border-amber-500/30' : 'border-gray-200 dark:border-white/10'} overflow-hidden`}>
      <button
        className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 min-w-0">
          {record.hasWarnings ? (
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
          )}
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 dark:text-white truncate">
              {record.leadName || 'Unknown Lead'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {record.leadType === 'group' ? 'Group' : 'Individual'} &middot; {STAGE_LABELS[record.pipelineStatus] || record.pipelineStatus} &middot; {record.disposition || record.status}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {record.createdAt && (
            <span className="text-xs text-gray-400">{new Date(record.createdAt).toLocaleDateString()}</span>
          )}
          {expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-gray-100 dark:border-white/5 pt-4">
          {record.callSummary && (
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Call Summary</p>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{record.callSummary}</p>
            </div>
          )}

          {Object.keys(flags).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Compliance Flags</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${flags.disclaimerRead ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'}`}>
                  {flags.disclaimerRead ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  Disclaimer {flags.disclaimerRead ? 'Read' : 'Not Read'}
                </div>
                {flags.forbiddenTopics && (
                  <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                    <AlertTriangle className="h-4 w-4" />
                    Forbidden Topics Detected
                  </div>
                )}
                {flags.notes && (
                  <div className="sm:col-span-2 rounded-lg bg-gray-50 dark:bg-white/5 px-3 py-2 text-sm text-gray-600 dark:text-gray-300">
                    {flags.notes}
                  </div>
                )}
              </div>
            </div>
          )}

          {actions.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Action Items</p>
              <ul className="space-y-1">
                {actions.map((item, i) => {
                  const text = typeof item === 'string' ? item : item.text || item.description || JSON.stringify(item);
                  const done = typeof item === 'object' && item.completed;
                  return (
                    <li key={i} className={`flex items-start gap-2 text-sm ${done ? 'text-gray-400 line-through' : 'text-gray-700 dark:text-gray-300'}`}>
                      <span className="mt-0.5">{done ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Clock className="h-4 w-4 text-amber-500" />}</span>
                      {text}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => onNavigate(`/admin/leads/${record.leadId}`)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View Client Profile
            </button>
            {record.recordingLink && (
              <a
                href={record.recordingLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400"
              >
                <FileText className="h-3.5 w-3.5" />
                Recording
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CompliancePage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // all, warnings, clean

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/compliance/overview`);
      if (!res.ok) throw new Error('Failed to load compliance data');
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const filteredRecords = (data?.records || []).filter((r) => {
    if (filter === 'warnings') return r.hasWarnings;
    if (filter === 'clean') return !r.hasWarnings;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
        <p className="text-red-700">{error}</p>
        <button onClick={fetchData} className="mt-3 text-sm font-medium text-red-600 hover:text-red-700">
          Try again
        </button>
      </div>
    );
  }

  const stats = data?.stats || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Compliance & Documentation</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Session compliance flags, action items, and pipeline audit trail
          </p>
        </div>
        <button
          onClick={fetchData}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={FileText} label="Total Sessions" value={stats.totalSessions || 0} color="blue" />
        <StatCard icon={ShieldCheck} label="With Compliance Data" value={stats.sessionsWithFlags || 0} color="green" />
        <StatCard icon={AlertTriangle} label="With Warnings" value={stats.sessionsWithWarnings || 0} color={stats.sessionsWithWarnings > 0 ? 'amber' : 'green'} />
        <StatCard icon={Clock} label="Pending Actions" value={stats.pendingActionItems || 0} color={stats.pendingActionItems > 0 ? 'red' : 'green'} />
      </div>

      {/* Filter + Records */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Filter:</span>
          {[
            { key: 'all', label: 'All' },
            { key: 'warnings', label: 'Warnings Only' },
            { key: 'clean', label: 'Clean Only' },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === f.key
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 dark:text-gray-400'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {filteredRecords.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-800 p-10 text-center">
            <ShieldCheck className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No compliance records found.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRecords.map((record) => (
              <ComplianceRecord key={record.sessionId} record={record} onNavigate={navigate} />
            ))}
          </div>
        )}
      </div>

      {/* Audit Trail */}
      {(data?.auditTrail || []).length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Pipeline Audit Trail</h2>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-white/5 text-left">
                    <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Date</th>
                    <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Lead</th>
                    <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">From</th>
                    <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">To</th>
                    <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {data.auditTrail.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-white/5">
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {entry.changedAt ? new Date(entry.changedAt).toLocaleString() : '-'}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                        <button
                          onClick={() => navigate(`/admin/leads/${entry.leadId}`)}
                          className="hover:text-blue-600 dark:hover:text-blue-400"
                        >
                          {entry.leadName || entry.leadId?.slice(0, 8)}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                        {STAGE_LABELS[entry.fromStage] || entry.fromStage || '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300 font-medium">
                        {STAGE_LABELS[entry.toStage] || entry.toStage}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-xs truncate">
                        {entry.notes || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
