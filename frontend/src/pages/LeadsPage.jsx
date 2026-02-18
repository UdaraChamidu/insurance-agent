import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, Filter, Plus, MoreVertical, Phone, Mail, Calendar,
  CheckCircle, Clock, AlertCircle, ChevronDown, User, ArrowRight,
  Loader, RefreshCw, LayoutGrid, List, Eye
} from 'lucide-react';
import leadsService from '../services/leadsService';

const PIPELINE_STAGES = [
  { key: 'new', label: 'New Leads', color: 'blue', icon: Plus },
  { key: 'appointment_booked', label: 'Appointment Booked', color: 'amber', icon: Calendar },
  { key: 'quoted', label: 'Quoted', color: 'purple', icon: CheckCircle },
  { key: 'enrolled', label: 'Enrolled', color: 'emerald', icon: CheckCircle },
  { key: 'lost', label: 'Lost', color: 'red', icon: AlertCircle },
];

const STAGE_COLORS = {
  new:          { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30', dot: 'bg-blue-500' },
  appointment_booked: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', dot: 'bg-amber-500' },
  quoted:       { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30', dot: 'bg-purple-500' },
  enrolled:     { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', dot: 'bg-emerald-500' },
  lost:         { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30', dot: 'bg-red-500' },
};

export default function LeadsPage() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('pipeline'); // 'pipeline' or 'table'

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const data = await leadsService.getLeads();
      setLeads(data);
    } catch (error) {
      console.error('Failed to fetch leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLeads = leads.filter(lead => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      lead.firstName?.toLowerCase().includes(q) ||
      lead.lastName?.toLowerCase().includes(q) ||
      lead.email?.toLowerCase().includes(q) ||
      lead.phone?.includes(q)
    );
  });

  const getLeadsByStage = (stage) => {
    return filteredLeads.filter(lead => (lead.pipelineStatus || 'new') === stage);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Lead Pipeline</h1>
          <p className="text-gray-400 text-sm mt-1">{leads.length} total leads</p>
        </div>
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex items-center bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <button
              onClick={() => setViewMode('pipeline')}
              className={`p-2.5 transition-all ${viewMode === 'pipeline' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2.5 transition-all ${viewMode === 'table' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={fetchLeads}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-gray-300 rounded-xl hover:bg-white/10 transition-all text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search leads..."
          className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      ) : viewMode === 'pipeline' ? (
        <PipelineView leads={filteredLeads} getLeadsByStage={getLeadsByStage} navigate={navigate} />
      ) : (
        <TableView leads={filteredLeads} navigate={navigate} />
      )}
    </div>
  );
}

/* ===== PIPELINE / KANBAN VIEW ===== */
function PipelineView({ leads, getLeadsByStage, navigate }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4 min-h-[500px]">
      {PIPELINE_STAGES.map(stage => {
        const stageLeads = getLeadsByStage(stage.key);
        const colors = STAGE_COLORS[stage.key];
        const StageIcon = stage.icon;

        return (
          <div key={stage.key} className="flex flex-col min-h-0">
            {/* Column Header */}
            <div className={`flex items-center justify-between px-3 py-2.5 rounded-xl ${colors.bg} border ${colors.border} mb-3`}>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
                <span className={`text-sm font-semibold ${colors.text}`}>{stage.label}</span>
              </div>
              <span className={`text-xs font-bold ${colors.text} bg-white/10 px-2 py-0.5 rounded-full`}>
                {stageLeads.length}
              </span>
            </div>

            {/* Cards */}
            <div className="space-y-2 overflow-y-auto custom-scrollbar flex-1 pr-1">
              {stageLeads.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-600 text-xs">No leads</p>
                </div>
              ) : (
                stageLeads.map(lead => (
                  <LeadCard key={lead.id} lead={lead} navigate={navigate} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LeadCard({ lead, navigate }) {
  const name = `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Unknown';
  const initials = `${(lead.firstName || '?')[0]}${(lead.lastName || '?')[0]}`.toUpperCase();

  return (
    <div
      onClick={() => navigate(`/admin/leads/${lead.id}`)}
      className="bg-white/5 border border-white/10 rounded-xl p-3.5 cursor-pointer hover:border-blue-500/30 hover:bg-white/[0.07] transition-all group"
    >
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 rounded-lg bg-blue-600/20 flex items-center justify-center text-blue-400 text-xs font-bold flex-shrink-0">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white truncate">{name}</p>
          {lead.productType && (
            <p className="text-xs text-gray-500 truncate">{lead.productType.toUpperCase()}</p>
          )}
        </div>
        <Eye className="w-3.5 h-3.5 text-gray-600 group-hover:text-blue-400 transition-colors" />
      </div>

      <div className="space-y-1">
        {lead.email && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Mail className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{lead.email}</span>
          </div>
        )}
        {lead.phone && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Phone className="w-3 h-3 flex-shrink-0" />
            <span>{lead.phone}</span>
          </div>
        )}
      </div>

      {lead.createdAt && (
        <div className="flex items-center gap-1 mt-2 text-xs text-gray-600">
          <Clock className="w-3 h-3" />
          <span>{new Date(lead.createdAt).toLocaleDateString()}</span>
        </div>
      )}
    </div>
  );
}

/* ===== TABLE VIEW ===== */
function TableView({ leads, navigate }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-white/[0.03] border-b border-white/10">
            <tr>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Product</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Pipeline</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {leads.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                  No leads found.
                </td>
              </tr>
            ) : (
              leads.map(lead => {
                const stage = STAGE_COLORS[lead.pipelineStatus || 'new'] || STAGE_COLORS.new;
                return (
                  <tr
                    key={lead.id}
                    onClick={() => navigate(`/admin/leads/${lead.id}`)}
                    className="hover:bg-white/5 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-blue-600/20 flex items-center justify-center text-blue-400 text-xs font-bold">
                          {(lead.firstName || '?')[0]}{(lead.lastName || '?')[0]}
                        </div>
                        <div>
                          <p className="font-medium text-white">{lead.firstName} {lead.lastName}</p>
                          {lead.state && <p className="text-xs text-gray-500">{lead.state}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {lead.email && (
                          <div className="flex items-center gap-2 text-sm text-gray-400">
                            <Mail className="h-3.5 w-3.5" />
                            <span>{lead.email}</span>
                          </div>
                        )}
                        {lead.phone && (
                          <div className="flex items-center gap-2 text-sm text-gray-400">
                            <Phone className="h-3.5 w-3.5" />
                            <span>{lead.phone}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        {lead.productType?.toUpperCase() || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-400">
                      {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${stage.bg} ${stage.text} border ${stage.border}`}>
                        {(lead.pipelineStatus || 'new').replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button className="p-1 text-gray-500 hover:text-white rounded-lg hover:bg-white/10 transition-colors">
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between text-sm text-gray-500">
        <span>Showing {leads.length} leads</span>
      </div>
    </div>
  );
}
