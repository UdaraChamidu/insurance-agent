import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, AlertCircle, Users, Building2, GripVertical, Filter } from 'lucide-react';
import { getApiBaseUrl } from '../utils/network';

const API_URL = getApiBaseUrl();

const GROUP_STAGES = [
  'new_lead', 'contacted', 'discovery_scheduled', 'census_requested',
  'census_received', 'sent_to_warner', 'quotes_received',
  'proposal_presented', 'closed_won', 'closed_lost', 'renewal_followup',
];

const INDIVIDUAL_STAGES = ['new', 'appointment_booked', 'quoted', 'enrolled', 'lost'];

const STAGE_LABELS = {
  new: 'New', appointment_booked: 'Appt Booked', quoted: 'Quoted',
  enrolled: 'Enrolled', lost: 'Lost',
  new_lead: 'New Lead', contacted: 'Contacted',
  discovery_scheduled: 'Discovery Sched.', census_requested: 'Census Req.',
  census_received: 'Census Recv.', sent_to_warner: 'Sent to Warner',
  quotes_received: 'Quotes Recv.', proposal_presented: 'Proposal',
  closed_won: 'Won', closed_lost: 'Lost', renewal_followup: 'Renewal',
};

const STAGE_COLORS = {
  new: 'border-t-blue-500', new_lead: 'border-t-blue-500',
  contacted: 'border-t-sky-500', appointment_booked: 'border-t-amber-500',
  discovery_scheduled: 'border-t-amber-500', census_requested: 'border-t-orange-500',
  census_received: 'border-t-yellow-500', sent_to_warner: 'border-t-indigo-500',
  quotes_received: 'border-t-purple-500', quoted: 'border-t-purple-500',
  proposal_presented: 'border-t-violet-500',
  enrolled: 'border-t-emerald-500', closed_won: 'border-t-emerald-500',
  closed_lost: 'border-t-red-500', lost: 'border-t-red-500',
  renewal_followup: 'border-t-teal-500',
};

const STAGE_DOT_COLORS = {
  new: 'bg-blue-500', new_lead: 'bg-blue-500',
  contacted: 'bg-sky-500', appointment_booked: 'bg-amber-500',
  discovery_scheduled: 'bg-amber-500', census_requested: 'bg-orange-500',
  census_received: 'bg-yellow-500', sent_to_warner: 'bg-indigo-500',
  quotes_received: 'bg-purple-500', quoted: 'bg-purple-500',
  proposal_presented: 'bg-violet-500',
  enrolled: 'bg-emerald-500', closed_won: 'bg-emerald-500',
  closed_lost: 'bg-red-500', lost: 'bg-red-500',
  renewal_followup: 'bg-teal-500',
};

export default function PipelineBoardPage() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('group'); // 'all', 'individual', 'group'
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);
  const boardRef = useRef(null);

  const stages = filter === 'individual' ? INDIVIDUAL_STAGES : filter === 'group' ? GROUP_STAGES : [...new Set([...GROUP_STAGES, ...INDIVIDUAL_STAGES])];

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_URL}/api/leads/`);
      if (!res.ok) throw new Error(`Failed to fetch leads (${res.status})`);
      const json = await res.json();
      setLeads(Array.isArray(json) ? json : json.leads || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const filteredLeads = leads.filter((l) => {
    if (filter === 'individual') return (l.leadType || 'individual') === 'individual';
    if (filter === 'group') return l.leadType === 'group';
    return true;
  });

  const leadsByStage = {};
  for (const stage of stages) {
    leadsByStage[stage] = filteredLeads.filter((l) => (l.pipelineStatus || 'new') === stage);
  }

  const handleDragStart = (e, leadId) => {
    setDraggingId(leadId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', leadId);
  };

  const handleDragOver = (e, stage) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStage(stage);
  };

  const handleDragLeave = () => {
    setDragOverStage(null);
  };

  const handleDrop = async (e, targetStage) => {
    e.preventDefault();
    setDragOverStage(null);
    const leadId = e.dataTransfer.getData('text/plain') || draggingId;
    setDraggingId(null);

    if (!leadId) return;

    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.pipelineStatus === targetStage) return;

    // Optimistic update
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, pipelineStatus: targetStage } : l))
    );

    try {
      const res = await fetch(`${API_URL}/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipelineStatus: targetStage }),
      });
      if (!res.ok) throw new Error('Failed to update pipeline');
    } catch (err) {
      // Revert on failure
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, pipelineStatus: lead.pipelineStatus } : l))
      );
      setError(`Failed to move lead: ${err.message}`);
    }
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverStage(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pipeline Board</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Drag leads between stages to update their pipeline status
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl border border-gray-300 dark:border-white/10 overflow-hidden">
            {[
              { key: 'group', label: 'Group', icon: Building2 },
              { key: 'individual', label: 'Individual', icon: Users },
              { key: 'all', label: 'All', icon: Filter },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                  filter === key
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={fetchLeads}
            className="p-2 rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 mb-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm border border-red-200 dark:border-red-800 shrink-0">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">x</button>
        </div>
      )}

      {/* Board */}
      <div ref={boardRef} className="flex-1 overflow-x-auto min-h-0">
        <div className="flex gap-3 h-full min-w-max pb-4">
          {stages.map((stage) => {
            const stageLeads = leadsByStage[stage] || [];
            const isOver = dragOverStage === stage;
            return (
              <div
                key={stage}
                className={`w-64 shrink-0 flex flex-col rounded-2xl border-t-4 ${STAGE_COLORS[stage] || 'border-t-gray-400'} bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-white/10 transition-all ${
                  isOver ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/10' : ''
                }`}
                onDragOver={(e) => handleDragOver(e, stage)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, stage)}
              >
                {/* Column Header */}
                <div className="px-3 py-3 border-b border-gray-200 dark:border-white/10 shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${STAGE_DOT_COLORS[stage] || 'bg-gray-400'}`} />
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {STAGE_LABELS[stage] || stage}
                      </span>
                    </div>
                    <span className="text-xs bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full font-medium">
                      {stageLeads.length}
                    </span>
                  </div>
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[60px]">
                  {stageLeads.length === 0 && (
                    <div className="text-center py-4 text-xs text-gray-400">No leads</div>
                  )}
                  {stageLeads.map((lead) => (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, lead.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => navigate(`/admin/leads/${lead.id}`)}
                      className={`bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-white/10 p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-all group ${
                        draggingId === lead.id ? 'opacity-50 scale-95' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <GripVertical className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {lead.leadType === 'group'
                              ? lead.companyName || 'Unnamed Company'
                              : `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Unknown'}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                            {lead.leadType === 'group'
                              ? lead.contactPerson || lead.email || ''
                              : lead.email || lead.phone || ''}
                          </p>
                          {lead.leadType === 'group' && lead.numEmployees && (
                            <p className="text-[10px] text-gray-400 mt-1">
                              {lead.numEmployees} employees {lead.state ? `• ${lead.state}` : ''}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
