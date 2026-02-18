import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, User, Mail, Phone, MapPin, Calendar, Clock,
  FileText, MessageSquare, Shield, CheckCircle, AlertCircle,
  Loader, Edit2, Save, X, Video, ChevronDown
} from 'lucide-react';
import bookingsService from '../services/bookingsService';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const PIPELINE_STAGES = ['new', 'appointment_booked', 'quoted', 'enrolled', 'lost'];
const PIPELINE_LABELS = {
  new: 'New Lead',
  appointment_booked: 'Appointment Booked',
  quoted: 'Quoted',
  enrolled: 'Enrolled',
  lost: 'Lost',
};
const PIPELINE_COLORS = {
  new: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  appointment_booked: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  quoted: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  enrolled: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  lost: 'bg-red-500/10 text-red-400 border-red-500/30',
};

export default function ClientProfilePage() {
  const { leadId } = useParams();
  const navigate = useNavigate();

  const [lead, setLead] = useState(null);
  const [session, setSession] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [transcripts, setTranscripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchClientData();
  }, [leadId]);

  const fetchClientData = async () => {
    setLoading(true);
    try {
      // Fetch lead
      const leadRes = await fetch(`${API_URL}/api/leads/${leadId}`);
      if (leadRes.ok) {
        const leadData = await leadRes.json();
        setLead(leadData);
        setNotes(leadData.session?.notes || '');
        setSession(leadData.session || null);
        setTranscripts(leadData.session?.transcripts || []);
      }

      // Fetch appointments for this lead
      try {
        const allApts = await bookingsService.getAppointments({});
        const leadApts = allApts.filter(a => a.leadId === leadId);
        setAppointments(leadApts);
      } catch { }

    } catch (err) {
      console.error('Error fetching client data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePipeline = async (newStatus) => {
    try {
      await fetch(`${API_URL}/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipelineStatus: newStatus }),
      });
      setLead(prev => ({ ...prev, pipelineStatus: newStatus }));
    } catch (err) {
      console.error('Failed to update pipeline status:', err);
    }
  };

  const handleSaveNotes = async () => {
    try {
      // Notes are on the session
      if (session) {
        await fetch(`${API_URL}/api/leads/${leadId}/session`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes }),
        });
      }
      setEditingNotes(false);
    } catch (err) {
      console.error('Failed to save notes:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <p className="text-gray-400 text-lg">Lead not found</p>
        <button onClick={() => navigate('/admin/leads')} className="text-blue-400 hover:text-blue-300 mt-2 text-sm">
          ← Back to Leads
        </button>
      </div>
    );
  }

  const name = `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Unknown';
  const initials = `${(lead.firstName || '?')[0]}${(lead.lastName || '?')[0]}`.toUpperCase();
  const currentStage = lead.pipelineStatus || 'new';
  const stageColor = PIPELINE_COLORS[currentStage] || PIPELINE_COLORS.new;

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'appointments', label: `Appointments (${appointments.length})` },
    { key: 'transcripts', label: `Transcripts (${transcripts.length})` },
    { key: 'notes', label: 'AI Notes' },
  ];

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate('/admin/leads')}
        className="flex items-center text-gray-400 hover:text-blue-400 transition-colors text-sm"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to Leads
      </button>

      {/* Profile Header */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-blue-600/20">
            {initials}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-white mb-1">{name}</h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
              {lead.email && (
                <div className="flex items-center gap-1.5">
                  <Mail className="w-4 h-4" />
                  <span>{lead.email}</span>
                </div>
              )}
              {lead.phone && (
                <div className="flex items-center gap-1.5">
                  <Phone className="w-4 h-4" />
                  <span>{lead.phone}</span>
                </div>
              )}
              {lead.state && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" />
                  <span>{lead.state}</span>
                </div>
              )}
            </div>
          </div>

          {/* Pipeline Status */}
          <div className="flex flex-col items-end gap-2">
            <span className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${stageColor}`}>
              {PIPELINE_LABELS[currentStage]}
            </span>
            {lead.productType && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                {lead.productType.toUpperCase()}
              </span>
            )}
          </div>
        </div>

        {/* Pipeline Progress Bar */}
        <div className="mt-6 flex items-center gap-1">
          {PIPELINE_STAGES.filter(s => s !== 'lost').map((stage, idx) => {
            const stageIdx = PIPELINE_STAGES.indexOf(currentStage);
            const thisIdx = PIPELINE_STAGES.indexOf(stage);
            const isActive = thisIdx <= stageIdx && currentStage !== 'lost';
            return (
              <button
                key={stage}
                onClick={() => handleUpdatePipeline(stage)}
                className={`flex-1 h-2 rounded-full transition-all cursor-pointer hover:opacity-80 ${
                  isActive ? 'bg-blue-500' : 'bg-white/10'
                }`}
                title={PIPELINE_LABELS[stage]}
              />
            );
          })}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Details Card */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Lead Details</h3>
            <div className="space-y-3">
              <InfoRow label="Created" value={lead.createdAt ? new Date(lead.createdAt).toLocaleString() : '—'} />
              <InfoRow label="Product" value={lead.productType?.toUpperCase() || 'N/A'} />
              <InfoRow label="State" value={lead.state || 'N/A'} />
              <InfoRow label="UTM Source" value={lead.utmSource || '—'} />
              <InfoRow label="UTM Campaign" value={lead.utmCampaign || '—'} />
              {lead.triggers && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Triggers</p>
                  <div className="flex flex-wrap gap-1">
                    {(Array.isArray(lead.triggers) ? lead.triggers : []).map((t, i) => (
                      <span key={i} className="px-2 py-0.5 text-xs bg-white/5 border border-white/10 rounded text-gray-300">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Session Card */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Session Info</h3>
            {session ? (
              <div className="space-y-3">
                <InfoRow label="Status" value={session.status} />
                <InfoRow label="Disposition" value={session.disposition || '—'} />
                <InfoRow label="Plan Name" value={session.planName || '—'} />
                <InfoRow label="Premium" value={session.premium || '—'} />
                <InfoRow label="Session Start" value={session.startTime ? new Date(session.startTime).toLocaleString() : '—'} />
              </div>
            ) : (
              <p className="text-sm text-gray-500">No session data yet.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'appointments' && (
        <div className="space-y-3">
          {appointments.length === 0 ? (
            <div className="text-center py-12 bg-white/5 border border-white/10 rounded-xl">
              <Calendar className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No appointments for this client.</p>
            </div>
          ) : (
            appointments.map(apt => (
              <div key={apt.id} className="bg-white/5 border border-white/10 rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium">{bookingsService.formatDate(apt.date)}</p>
                    <p className="text-gray-400 text-sm">
                      {bookingsService.formatTime(apt.startTime)} – {bookingsService.formatTime(apt.endTime)} ({apt.timezone})
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    apt.status === 'confirmed' ? 'bg-emerald-500/10 text-emerald-400' :
                    apt.status === 'cancelled' ? 'bg-red-500/10 text-red-400' :
                    'bg-blue-500/10 text-blue-400'
                  }`}>
                    {apt.status}
                  </span>
                  {apt.meetingLink && apt.status === 'confirmed' && (
                    <button
                      onClick={() => navigate(apt.meetingLink)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-white text-sm font-medium transition-all"
                    >
                      <Video className="w-3.5 h-3.5" />
                      Join
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'transcripts' && (
        <div className="space-y-3">
          {transcripts.length === 0 ? (
            <div className="text-center py-12 bg-white/5 border border-white/10 rounded-xl">
              <MessageSquare className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No transcripts for this client.</p>
            </div>
          ) : (
            transcripts.map(t => (
              <div key={t.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    t.role === 'agent' ? 'bg-blue-500/10 text-blue-400' :
                    t.role === 'ai' ? 'bg-purple-500/10 text-purple-400' :
                    'bg-gray-500/10 text-gray-400'
                  }`}>
                    {t.role}
                  </span>
                  <span className="text-xs text-gray-600">
                    {t.timestamp ? new Date(t.timestamp).toLocaleTimeString() : ''}
                  </span>
                </div>
                <p className="text-sm text-gray-300 whitespace-pre-wrap">{t.content}</p>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'notes' && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
              Session Notes / AI Notes
            </h3>
            {editingNotes ? (
              <div className="flex gap-2">
                <button
                  onClick={handleSaveNotes}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm transition-all"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save
                </button>
                <button
                  onClick={() => setEditingNotes(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 text-gray-300 rounded-lg text-sm hover:bg-white/20 transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditingNotes(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 text-gray-300 rounded-lg text-sm hover:bg-white/20 transition-all"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Edit
              </button>
            )}
          </div>

          {editingNotes ? (
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={10}
              className="w-full bg-white/5 border border-white/10 rounded-lg p-4 text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-y"
              placeholder="Add notes about this client..."
            />
          ) : (
            <div className="text-sm text-gray-300 whitespace-pre-wrap min-h-[100px]">
              {notes || 'No notes yet. Click Edit to add notes.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start justify-between">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm text-white text-right">{value}</span>
    </div>
  );
}
