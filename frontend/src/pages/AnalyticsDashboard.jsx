import React, { useState, useEffect } from 'react';
import {
  Users, Building2, Calendar, FileText, TrendingUp,
  Award, XCircle, RefreshCw, AlertCircle, ArrowRight,
  BarChart3, Clock
} from 'lucide-react';
import { getApiBaseUrl } from '../utils/network';

const API_URL = getApiBaseUrl();

const PIPELINE_LABELS = {
  new: 'New', appointment_booked: 'Appt Booked', quoted: 'Quoted',
  enrolled: 'Enrolled', lost: 'Lost',
  new_lead: 'New Lead', contacted: 'Contacted',
  discovery_scheduled: 'Discovery Sched.', census_requested: 'Census Req.',
  census_received: 'Census Recv.', sent_to_warner: 'Sent to Warner',
  quotes_received: 'Quotes Recv.', proposal_presented: 'Proposal',
  closed_won: 'Won', closed_lost: 'Lost', renewal_followup: 'Renewal',
};

const PIPELINE_COLORS = {
  new: '#3b82f6', new_lead: '#3b82f6', contacted: '#0ea5e9',
  appointment_booked: '#f59e0b', discovery_scheduled: '#f59e0b',
  census_requested: '#f97316', census_received: '#eab308',
  sent_to_warner: '#6366f1', quotes_received: '#8b5cf6', quoted: '#8b5cf6',
  proposal_presented: '#a78bfa', enrolled: '#10b981', closed_won: '#10b981',
  closed_lost: '#ef4444', lost: '#ef4444', renewal_followup: '#14b8a6',
};

function StatCard({ icon: Icon, label, value, sub, color = 'blue' }) {
  const colorMap = {
    blue: 'bg-blue-500/10 text-blue-500',
    green: 'bg-emerald-500/10 text-emerald-500',
    amber: 'bg-amber-500/10 text-amber-500',
    purple: 'bg-purple-500/10 text-purple-500',
    red: 'bg-red-500/10 text-red-500',
    teal: 'bg-teal-500/10 text-teal-500',
  };
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-white/10 p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function PipelineBar({ distribution }) {
  const entries = Object.entries(distribution).filter(([, count]) => count > 0);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  if (total === 0) return <p className="text-sm text-gray-500 dark:text-gray-400">No pipeline data yet.</p>;

  return (
    <div className="space-y-2">
      {entries
        .sort((a, b) => b[1] - a[1])
        .map(([stage, count]) => {
          const pct = Math.round((count / total) * 100);
          return (
            <div key={stage} className="flex items-center gap-3">
              <span className="text-xs w-28 text-gray-600 dark:text-gray-400 truncate">
                {PIPELINE_LABELS[stage] || stage}
              </span>
              <div className="flex-1 h-5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, backgroundColor: PIPELINE_COLORS[stage] || '#6b7280' }}
                />
              </div>
              <span className="text-xs font-medium w-12 text-right text-gray-700 dark:text-gray-300">
                {count} ({pct}%)
              </span>
            </div>
          );
        })}
    </div>
  );
}

function MiniChart({ data }) {
  if (!data || Object.keys(data).length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">No recent lead data.</p>;
  }

  const entries = Object.entries(data).slice(-14);
  const max = Math.max(...entries.map(([, v]) => v), 1);

  return (
    <div className="flex items-end gap-1 h-24">
      {entries.map(([day, count]) => (
        <div key={day} className="flex-1 flex flex-col items-center gap-1" title={`${day}: ${count}`}>
          <div
            className="w-full bg-blue-500 dark:bg-blue-400 rounded-t transition-all min-h-[2px]"
            style={{ height: `${(count / max) * 100}%` }}
          />
          <span className="text-[8px] text-gray-400 rotate-[-45deg] origin-top-left whitespace-nowrap">
            {day.slice(5)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_URL}/api/analytics/overview`);
      if (!res.ok) throw new Error(`Failed to load analytics (${res.status})`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAnalytics(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
        <p className="text-gray-600 dark:text-gray-400">{error}</p>
        <button onClick={fetchAnalytics} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm">
          Retry
        </button>
      </div>
    );
  }

  const o = data?.overview || {};

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">CRM performance overview</p>
        </div>
        <button
          onClick={fetchAnalytics}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border border-gray-300 dark:border-white/10 text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard icon={Users} label="Total Leads" value={o.totalLeads} sub={`${o.individualLeads} individual, ${o.groupLeads} group`} color="blue" />
        <StatCard icon={Calendar} label="Appointments" value={o.totalAppointments} color="amber" />
        <StatCard icon={FileText} label="Documents" value={o.totalDocuments} color="purple" />
        <StatCard icon={Award} label="Won" value={o.closedWon} color="green" />
        <StatCard icon={XCircle} label="Lost" value={o.closedLost} color="red" />
        <StatCard icon={TrendingUp} label="Win Rate" value={`${o.winRate}%`} sub={`${o.upcomingRenewals} upcoming renewals`} color="teal" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline Distribution */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-white/10 p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-gray-400" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Pipeline Distribution</h2>
          </div>
          <PipelineBar distribution={data?.pipelineDistribution || {}} />
        </div>

        {/* Leads Over Time */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-white/10 p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-gray-400" />
            <h2 className="font-semibold text-gray-900 dark:text-white">New Leads (Last 14 Days)</h2>
          </div>
          <MiniChart data={data?.leadsByDay} />
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Appointment Status */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-white/10 p-6">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Appointment Status</h2>
          {Object.keys(data?.appointmentDistribution || {}).length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No appointment data yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(data.appointmentDistribution).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between bg-gray-50 dark:bg-slate-700/50 rounded-xl px-4 py-3">
                  <span className="text-sm text-gray-600 dark:text-gray-300 capitalize">{status.replace('_', ' ')}</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Pipeline Activity */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-white/10 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-gray-400" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Recent Activity</h2>
          </div>
          {(data?.recentActivity || []).length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No recent pipeline changes.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {data.recentActivity.slice(0, 10).map((a) => (
                <div key={a.id} className="flex items-center gap-3 text-sm py-1.5 border-b border-gray-100 dark:border-white/5 last:border-0">
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-gray-900 dark:text-white truncate">{a.leadName}</span>
                    <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      <span className="capitalize">{PIPELINE_LABELS[a.fromStage] || a.fromStage || '?'}</span>
                      <ArrowRight className="w-3 h-3" />
                      <span className="capitalize font-medium" style={{ color: PIPELINE_COLORS[a.toStage] || '#6b7280' }}>
                        {PIPELINE_LABELS[a.toStage] || a.toStage}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">
                    {a.changedAt ? new Date(a.changedAt).toLocaleDateString() : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top States */}
      {Object.keys(data?.topStates || {}).length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-white/10 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="h-5 w-5 text-gray-400" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Top States</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(data.topStates).map(([state, count]) => (
              <span key={state} className="px-3 py-1.5 bg-gray-100 dark:bg-slate-700 rounded-xl text-sm text-gray-700 dark:text-gray-300">
                {state} <span className="font-bold">{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
