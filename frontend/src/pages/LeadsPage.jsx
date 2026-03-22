import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Phone, Mail, ArrowRight,
  Loader, RefreshCw, Trash2, Building2, User
} from 'lucide-react';
import leadsService from '../services/leadsService';
import DeleteConfirmModal from '../components/DeleteConfirmModal';

// In-memory cache to keep list between page navigations
let leadsCache = null;

// Individual pipeline stages (original)
const INDIVIDUAL_PIPELINE_STAGES = [
  { key: 'new', label: 'New', color: 'blue' },
  { key: 'appointment_booked', label: 'Appt Booked', color: 'amber' },
  { key: 'quoted', label: 'Quoted', color: 'purple' },
  { key: 'enrolled', label: 'Enrolled', color: 'emerald' },
  { key: 'lost', label: 'Lost', color: 'red' },
];

// Group/employer pipeline stages (new)
const GROUP_PIPELINE_STAGES = [
  { key: 'new_lead', label: 'New Lead', color: 'blue' },
  { key: 'contacted', label: 'Contacted', color: 'sky' },
  { key: 'discovery_scheduled', label: 'Discovery', color: 'amber' },
  { key: 'census_requested', label: 'Census Req.', color: 'orange' },
  { key: 'census_received', label: 'Census Rcvd', color: 'yellow' },
  { key: 'sent_to_warner', label: 'Sent to Warner', color: 'indigo' },
  { key: 'quotes_received', label: 'Quotes Rcvd', color: 'purple' },
  { key: 'proposal_presented', label: 'Proposal', color: 'violet' },
  { key: 'closed_won', label: 'Closed Won', color: 'emerald' },
  { key: 'closed_lost', label: 'Closed Lost', color: 'red' },
  { key: 'renewal_followup', label: 'Renewal', color: 'teal' },
];

const STAGE_COLORS = {
  // Individual
  new:                { bg: 'bg-blue-500/10', text: 'text-blue-700 dark:text-blue-400', border: 'border-blue-500/30', dot: 'bg-blue-500' },
  appointment_booked: { bg: 'bg-amber-500/10', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-500/30', dot: 'bg-amber-500' },
  quoted:             { bg: 'bg-purple-500/10', text: 'text-purple-700 dark:text-purple-400', border: 'border-purple-500/30', dot: 'bg-purple-500' },
  enrolled:           { bg: 'bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-500/30', dot: 'bg-emerald-500' },
  lost:               { bg: 'bg-red-500/10', text: 'text-red-700 dark:text-red-400', border: 'border-red-500/30', dot: 'bg-red-500' },
  // Group
  new_lead:           { bg: 'bg-blue-500/10', text: 'text-blue-700 dark:text-blue-400', border: 'border-blue-500/30', dot: 'bg-blue-500' },
  contacted:          { bg: 'bg-sky-500/10', text: 'text-sky-700 dark:text-sky-400', border: 'border-sky-500/30', dot: 'bg-sky-500' },
  discovery_scheduled:{ bg: 'bg-amber-500/10', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-500/30', dot: 'bg-amber-500' },
  census_requested:   { bg: 'bg-orange-500/10', text: 'text-orange-700 dark:text-orange-400', border: 'border-orange-500/30', dot: 'bg-orange-500' },
  census_received:    { bg: 'bg-yellow-500/10', text: 'text-yellow-700 dark:text-yellow-400', border: 'border-yellow-500/30', dot: 'bg-yellow-500' },
  sent_to_warner:     { bg: 'bg-indigo-500/10', text: 'text-indigo-700 dark:text-indigo-400', border: 'border-indigo-500/30', dot: 'bg-indigo-500' },
  quotes_received:    { bg: 'bg-purple-500/10', text: 'text-purple-700 dark:text-purple-400', border: 'border-purple-500/30', dot: 'bg-purple-500' },
  proposal_presented: { bg: 'bg-violet-500/10', text: 'text-violet-700 dark:text-violet-400', border: 'border-violet-500/30', dot: 'bg-violet-500' },
  closed_won:         { bg: 'bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-500/30', dot: 'bg-emerald-500' },
  closed_lost:        { bg: 'bg-red-500/10', text: 'text-red-700 dark:text-red-400', border: 'border-red-500/30', dot: 'bg-red-500' },
  renewal_followup:   { bg: 'bg-teal-500/10', text: 'text-teal-700 dark:text-teal-400', border: 'border-teal-500/30', dot: 'bg-teal-500' },
};

export default function LeadsPage() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletingLeadId, setDeletingLeadId] = useState(null);
  const [typeFilter, setTypeFilter] = useState('all'); // 'all', 'individual', 'group'

  useEffect(() => {
    if (Array.isArray(leadsCache)) {
      setLeads(leadsCache);
      setLoading(false);
    }
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    try {
      if (!leadsCache || leadsCache.length === 0) {
        setLoading(true);
      }
      setError('');
      const data = await leadsService.getLeads();
      setLeads(data);
      leadsCache = data;
    } catch (error) {
      console.error('Failed to fetch leads:', error);
      setError(error.message || 'Failed to fetch leads');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLead = (lead) => {
    if (!lead?.id) return;
    setDeleteTarget(lead);
  };

  const handleConfirmDeleteLead = async () => {
    if (!deleteTarget?.id) return;
    try {
      setDeletingLeadId(deleteTarget.id);
      setError('');
      await leadsService.deleteLead(deleteTarget.id);
      setLeads((prev) => prev.filter((row) => row.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (deleteError) {
      console.error('Failed to delete lead:', deleteError);
      setError(deleteError.message || 'Failed to delete lead');
    } finally {
      setDeletingLeadId(null);
    }
  };

  // Determine which pipeline stages to show based on type filter
  const visibleStages = typeFilter === 'group'
    ? GROUP_PIPELINE_STAGES
    : typeFilter === 'individual'
      ? INDIVIDUAL_PIPELINE_STAGES
      : [...INDIVIDUAL_PIPELINE_STAGES, ...GROUP_PIPELINE_STAGES];

  const filteredLeads = leads
    .filter(lead => {
      if (typeFilter === 'group') return (lead.leadType || 'individual') === 'group';
      if (typeFilter === 'individual') return (lead.leadType || 'individual') === 'individual';
      return true;
    })
    .filter(lead => {
      if (!searchTerm) return true;
      const q = searchTerm.toLowerCase();
      return (
        lead.firstName?.toLowerCase().includes(q) ||
        lead.lastName?.toLowerCase().includes(q) ||
        lead.email?.toLowerCase().includes(q) ||
        lead.phone?.includes(q) ||
        lead.companyName?.toLowerCase().includes(q)
      );
    })
    .filter(lead => (stageFilter === 'all' ? true : (lead.pipelineStatus || 'new') === stageFilter));

  const stageCounts = visibleStages.reduce((acc, stage) => {
    acc[stage.key] = leads.filter(lead => (lead.pipelineStatus || 'new') === stage.key).length;
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center p-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">Loading clients...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header / Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Clients</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{leads.length} total clients</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="relative sm:w-80 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, email, phone..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-100 dark:bg-slate-900/40 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
            />
          </div>
          <button
            onClick={fetchLeads}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Lead Type Filter */}
      <div className="flex gap-2 items-center">
        {[
          { key: 'all', label: 'All Leads', icon: null },
          { key: 'individual', label: 'Individual', icon: User },
          { key: 'group', label: 'Group / Employer', icon: Building2 },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => { setTypeFilter(key); setStageFilter('all'); }}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
              typeFilter === key
                ? 'bg-blue-600 text-white border-blue-500'
                : 'border-gray-300 dark:border-white/20 text-gray-600 dark:text-gray-300 hover:border-gray-400 dark:hover:border-white/40 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {Icon && <Icon className="w-4 h-4" />}
            {label}
          </button>
        ))}
      </div>

      {/* Stage Filter */}
      <div className="flex items-center gap-3">
        <label htmlFor="stage-filter" className="text-sm font-medium text-gray-500 dark:text-gray-400">Pipeline Stage:</label>
        <select
          id="stage-filter"
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="px-4 py-2 bg-gray-100 dark:bg-slate-900/40 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none min-w-[200px]"
        >
          <option value="all">All Stages ({filteredLeads.length})</option>
          {visibleStages.map((stage) => {
            const count = stageCounts[stage.key] || 0;
            return (
              <option key={stage.key} value={stage.key}>
                {stage.label} ({count})
              </option>
            );
          })}
        </select>
        {stageFilter !== 'all' && (
          <button
            onClick={() => setStageFilter('all')}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            Clear filter
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-600 dark:text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      ) : (
        <TableView
          leads={filteredLeads}
          navigate={navigate}
          onDelete={handleDeleteLead}
          deletingLeadId={deletingLeadId}
        />
      )}

      <DeleteConfirmModal
        open={!!deleteTarget}
        title="Delete Client"
        message={
          deleteTarget
            ? `Delete ${(deleteTarget.firstName || '')} ${(deleteTarget.lastName || '')}`.trim() +
              '?\n\nThis permanently removes the client and related records.'
            : ''
        }
        confirmLabel="Delete Client"
        loading={deletingLeadId === deleteTarget?.id}
        onCancel={() => {
          if (deletingLeadId !== deleteTarget?.id) setDeleteTarget(null);
        }}
        onConfirm={handleConfirmDeleteLead}
      />
    </div>
  );
}

/* ===== TABLE VIEW ===== */
function TableView({ leads, navigate, onDelete, deletingLeadId }) {
  return (
    <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-50 dark:bg-white/[0.03] border-b border-gray-200 dark:border-white/10">
            <tr>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Product</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Pipeline</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
            {leads.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                  No clients found.
                </td>
              </tr>
            ) : (
              leads.map(lead => {
                const stage = STAGE_COLORS[lead.pipelineStatus || 'new'] || STAGE_COLORS.new;
                return (
                  <tr
                    key={lead.id}
                    onClick={() => navigate(`/admin/leads/${lead.id}`)}
                    className="hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`h-9 w-9 rounded-lg flex items-center justify-center text-xs font-bold ${
                          lead.leadType === 'group' ? 'bg-teal-100 dark:bg-teal-600/20 text-teal-700 dark:text-teal-400' : 'bg-blue-100 dark:bg-blue-600/20 text-blue-700 dark:text-blue-400'
                        }`}>
                          {lead.leadType === 'group'
                            ? <Building2 className="w-4 h-4" />
                            : <>{(lead.firstName || '?')[0]}{(lead.lastName || '?')[0]}</>
                          }
                        </div>
                        <div>
                          {lead.leadType === 'group' && lead.companyName ? (
                            <>
                              <p className="font-medium text-gray-900 dark:text-white">{lead.companyName}</p>
                              <p className="text-xs text-gray-500">{lead.firstName} {lead.lastName}{lead.state ? ` · ${lead.state}` : ''}</p>
                            </>
                          ) : (
                            <>
                              <p className="font-medium text-gray-900 dark:text-white">{lead.firstName} {lead.lastName}</p>
                              {lead.state && <p className="text-xs text-gray-500">{lead.state}</p>}
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {lead.email && (
                          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                            <Mail className="h-3.5 w-3.5" />
                            <span>{lead.email}</span>
                          </div>
                        )}
                        {lead.phone && (
                          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                            <Phone className="h-3.5 w-3.5" />
                            <span>{lead.phone}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20">
                        {lead.productType?.toUpperCase() || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${stage.bg} ${stage.text} border ${stage.border}`}>
                        {(lead.pipelineStatus || 'new').replaceAll('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/admin/leads/${lead.id}`);
                          }}
                          className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                          title="Open client"
                        >
                          <ArrowRight className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete?.(lead);
                          }}
                          disabled={deletingLeadId === lead.id}
                          className="p-1 text-red-400/80 hover:text-red-500 dark:hover:text-red-300 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                          title="Delete client"
                        >
                          {deletingLeadId === lead.id ? (
                            <Loader className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="px-6 py-4 border-t border-gray-100 dark:border-white/5 flex items-center justify-between text-sm text-gray-500">
        <span>Showing {leads.length} clients</span>
      </div>
    </div>
  );
}
