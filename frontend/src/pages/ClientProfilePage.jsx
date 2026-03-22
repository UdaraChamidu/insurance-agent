import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Mail, Phone, MapPin, Calendar,
  FileText, MessageSquare, AlertCircle,
  Loader, Edit2, Save, X, Video, Download, RefreshCw,
  Building2
} from 'lucide-react';
import bookingsService from '../services/bookingsService';
import clientDocsService from '../services/clientDocsService';
import { getApiBaseUrl } from '../utils/network';

const API_URL = getApiBaseUrl();

// Individual pipeline
const INDIVIDUAL_STAGES = ['new', 'appointment_booked', 'quoted', 'enrolled', 'lost'];
const INDIVIDUAL_LABELS = {
  new: 'New Lead',
  appointment_booked: 'Appointment Booked',
  quoted: 'Quoted',
  enrolled: 'Enrolled',
  lost: 'Lost',
};

// Group pipeline
const GROUP_STAGES = [
  'new_lead', 'contacted', 'discovery_scheduled', 'census_requested',
  'census_received', 'sent_to_warner', 'quotes_received',
  'proposal_presented', 'closed_won', 'closed_lost', 'renewal_followup',
];
const GROUP_LABELS = {
  new_lead: 'New Lead',
  contacted: 'Contacted',
  discovery_scheduled: 'Discovery Scheduled',
  census_requested: 'Census Requested',
  census_received: 'Census Received',
  sent_to_warner: 'Sent to Warner Pacific',
  quotes_received: 'Quotes Received',
  proposal_presented: 'Proposal Presented',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
  renewal_followup: 'Renewal Follow-up',
};

const ALL_LABELS = { ...INDIVIDUAL_LABELS, ...GROUP_LABELS };

const PIPELINE_COLORS = {
  // Individual
  new: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  appointment_booked: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  quoted: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  enrolled: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  lost: 'bg-red-500/10 text-red-400 border-red-500/30',
  // Group
  new_lead: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  contacted: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
  discovery_scheduled: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  census_requested: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  census_received: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  sent_to_warner: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
  quotes_received: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  proposal_presented: 'bg-violet-500/10 text-violet-400 border-violet-500/30',
  closed_won: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  closed_lost: 'bg-red-500/10 text-red-400 border-red-500/30',
  renewal_followup: 'bg-teal-500/10 text-teal-400 border-teal-500/30',
};

const DISPOSITION_LABELS = {
  booked: 'Application Submitted (Won)',
  quoted: 'Quoted (Pipeline)',
  'follow-up': 'Interested / Follow Up',
  ni: 'Not Interested',
};

export default function ClientProfilePage() {
  const { leadId } = useParams();
  const navigate = useNavigate();

  const [lead, setLead] = useState(null);
  const [session, setSession] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [docFolders, setDocFolders] = useState(null);
  const [uploadToken, setUploadToken] = useState('');
  const [tokenCopied, setTokenCopied] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState('');
  const [recordingPath, setRecordingPath] = useState('');
  const [recordingLoading, setRecordingLoading] = useState(false);
  const [recordingError, setRecordingError] = useState('');
  const [meetingArtifacts, setMeetingArtifacts] = useState({
    transcriptions: [],
    aiResponses: [],
    fullChat: [],
    summary: null,
  });
  const [artifactsLoading, setArtifactsLoading] = useState(false);
  const [artifactsError, setArtifactsError] = useState('');

  useEffect(() => {
    fetchClientData();
  }, [leadId]);

  const fetchMeetingRecording = async (showLoader = false) => {
    if (!leadId) return;
    if (showLoader) setRecordingLoading(true);
    setRecordingError('');
    try {
      const res = await fetch(`${API_URL}/api/leads/${leadId}/recording`);
      if (!res.ok) {
        throw new Error(`Failed to fetch recording (${res.status})`);
      }
      const payload = await res.json();
      const signedUrl = payload?.recording?.url || '';
      const persistedPath = payload?.recording?.path || '';
      setRecordingUrl(signedUrl);
      setRecordingPath(persistedPath);
      if (persistedPath) {
        setSession((prev) => {
          if (prev?.recordingLink === persistedPath) return prev;
          return { ...(prev || {}), recordingLink: persistedPath };
        });
      }
    } catch (err) {
      console.error('Error fetching meeting recording:', err);
      setRecordingUrl('');
      setRecordingError('Unable to load recording link right now.');
    } finally {
      if (showLoader) setRecordingLoading(false);
    }
  };

  const normalizeArtifacts = (payload) => ({
    transcriptions: Array.isArray(payload?.transcriptions) ? payload.transcriptions : [],
    aiResponses: Array.isArray(payload?.aiResponses) ? payload.aiResponses : [],
    fullChat: Array.isArray(payload?.fullChat) ? payload.fullChat : [],
    summary: payload?.summary && typeof payload.summary === 'object' ? payload.summary : null,
  });

  const fetchMeetingArtifacts = async (showLoader = false, fallbackPayload = null) => {
    if (!leadId) return;
    if (showLoader) setArtifactsLoading(true);
    setArtifactsError('');
    try {
      const res = await fetch(`${API_URL}/api/leads/${leadId}/meeting-artifacts`);
      if (!res.ok) {
        throw new Error(`Failed to fetch meeting artifacts (${res.status})`);
      }
      const payload = await res.json();
      if (!payload?.success) {
        throw new Error('Meeting artifacts response was not successful');
      }
      setMeetingArtifacts(normalizeArtifacts(payload));
    } catch (err) {
      console.error('Error fetching meeting artifacts:', err);
      if (fallbackPayload) {
        setMeetingArtifacts(normalizeArtifacts(fallbackPayload));
      }
      setArtifactsError('Unable to load latest meeting artifacts right now.');
    } finally {
      if (showLoader) setArtifactsLoading(false);
    }
  };

  const fetchClientData = async () => {
    setLoading(true);
    setRecordingUrl('');
    setRecordingPath('');
    setRecordingError('');
    setRecordingLoading(false);
    setMeetingArtifacts({
      transcriptions: [],
      aiResponses: [],
      fullChat: [],
      summary: null,
    });
    setArtifactsError('');
    setArtifactsLoading(false);
    try {
      // Fetch lead
      const leadRes = await fetch(`${API_URL}/api/leads/${leadId}`);
      if (leadRes.ok) {
        const leadData = await leadRes.json();
        const sessionData = leadData.session || null;
        setLead(leadData);
        setNotes(sessionData?.notes || '');
        setSession(sessionData);
        const leadArtifacts = leadData?.meetingArtifacts || null;
        setMeetingArtifacts(normalizeArtifacts(leadArtifacts));
        await fetchMeetingArtifacts(false, leadArtifacts);
        await fetchMeetingRecording(Boolean(sessionData?.recordingLink));
      }

      // Fetch appointments for this lead
      try {
        const allApts = await bookingsService.getAppointments({});
        const leadApts = allApts.filter(a => a.leadId === leadId);
        setAppointments(leadApts);
      } catch { }
      
      // Fetch documents
      try {
        const docRes = await fetch(`${API_URL}/api/client-docs/lead/${leadId}`);
        const docData = await docRes.json();
        if (docData.success) {
            setDocuments(docData.documents);
        }
      } catch (err) {
         console.error('Error fetching docs:', err);
      }

      // Fetch document folders
      try {
        const folderData = await clientDocsService.getLeadFolders(leadId);
        if (folderData.success) setDocFolders(folderData.folders);
      } catch (err) {
        console.error('Error fetching doc folders:', err);
      }

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

  const handleDownload = async (docId) => {
    try {
      const res = await fetch(`${API_URL}/api/client-docs/download/${docId}`);
      if (!res.ok) throw new Error('Failed to get download link');
      const data = await res.json();
      const url = data.url || data.signedURL;
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        alert('Could not generate download link.');
      }
    } catch (err) {
      console.error('Download error:', err);
      alert('Failed to download file.');
    }
  };

  const handleDownloadArtifactsJson = () => {
    const report = {
      leadId,
      generatedAt: new Date().toISOString(),
      summary: meetingArtifacts.summary || null,
      transcriptions: meetingArtifacts.transcriptions || [],
      aiResponses: meetingArtifacts.aiResponses || [],
      fullChat: meetingArtifacts.fullChat || [],
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meeting-artifacts-${leadId}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadArtifactsCsv = async () => {
    try {
      const res = await fetch(`${API_URL}/api/leads/${leadId}/meeting-artifacts.csv`);
      if (!res.ok) {
        throw new Error(`Failed to download CSV (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `meeting-artifacts-${leadId}-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading artifacts CSV:', err);
      alert('Failed to download meeting artifacts CSV.');
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
          ← Back to Clients
        </button>
      </div>
    );
  }

  const isGroup = (lead.leadType || 'individual') === 'group';
  const name = isGroup && lead.companyName
    ? lead.companyName
    : `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Unknown';
  const initials = isGroup
    ? (lead.companyName || 'G')[0].toUpperCase()
    : `${(lead.firstName || '?')[0]}${(lead.lastName || '?')[0]}`.toUpperCase();
  const currentStage = lead.pipelineStatus || (isGroup ? 'new_lead' : 'new');
  const stageColor = PIPELINE_COLORS[currentStage] || PIPELINE_COLORS.new;
  const pipelineStages = isGroup ? GROUP_STAGES : INDIVIDUAL_STAGES;
  const lostStages = isGroup ? ['closed_lost'] : ['lost'];
  const artifactTranscriptions = Array.isArray(meetingArtifacts?.transcriptions) ? meetingArtifacts.transcriptions : [];
  const artifactAiResponses = Array.isArray(meetingArtifacts?.aiResponses) ? meetingArtifacts.aiResponses : [];
  const artifactFullChat = Array.isArray(meetingArtifacts?.fullChat) ? meetingArtifacts.fullChat : [];
  const effectiveRecordingPath = session?.recordingLink || recordingPath;
  const hasRecording = Boolean(effectiveRecordingPath);

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'summary', label: 'Summary' },
    { key: 'recording', label: 'Recording' },
    { key: 'appointments', label: `Appointments (${appointments.length})` },
    { key: 'documents', label: `Documents (${documents.length})` },
    { key: 'transcripts', label: `Meeting Artifacts (${artifactFullChat.length})` },
    { key: 'notes', label: 'AI Notes' },
  ];

  const actionItems = Array.isArray(session?.actionItems) ? session.actionItems : [];
  const compliance = session?.complianceFlags && typeof session.complianceFlags === 'object'
    ? session.complianceFlags
    : null;
  const hasWrapUpDetails = Boolean(session?.callSummary || actionItems.length || compliance);
  const dispositionLabel = session?.disposition
    ? (DISPOSITION_LABELS[session.disposition] || session.disposition)
    : '—';

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate('/admin/leads')}
        className="flex items-center text-gray-400 hover:text-blue-400 transition-colors text-sm"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to Clients
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
              {ALL_LABELS[currentStage] || currentStage.replaceAll('_', ' ')}
            </span>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              isGroup ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
            }`}>
              {isGroup ? 'GROUP' : (lead.productType?.toUpperCase() || 'INDIVIDUAL')}
            </span>
          </div>
        </div>

        {/* Pipeline Progress Bar */}
        <div className="mt-6 flex items-center gap-1">
          {pipelineStages.filter(s => !lostStages.includes(s)).map((stage) => {
            const stageIdx = pipelineStages.indexOf(currentStage);
            const thisIdx = pipelineStages.indexOf(stage);
            const isActive = thisIdx <= stageIdx && !lostStages.includes(currentStage);
            return (
              <button
                key={stage}
                onClick={() => handleUpdatePipeline(stage)}
                className={`flex-1 h-2 rounded-full transition-all cursor-pointer hover:opacity-80 ${
                  isActive ? 'bg-blue-500' : 'bg-white/10'
                }`}
                title={ALL_LABELS[stage] || stage}
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
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
              {isGroup ? 'Employer / Group Details' : 'Lead Details'}
            </h3>
            <div className="space-y-3">
              <InfoRow label="Created" value={lead.createdAt ? new Date(lead.createdAt).toLocaleString() : '-'} />
              <InfoRow label="Type" value={isGroup ? 'Group / Employer' : 'Individual'} />
              {isGroup ? (
                <>
                  <InfoRow label="Company" value={lead.companyName || '-'} />
                  <InfoRow label="Contact Person" value={lead.contactPerson || `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || '-'} />
                  <InfoRow label="State" value={lead.state || '-'} />
                  <InfoRow label="Industry" value={lead.industry || '-'} />
                  <InfoRow label="Total Employees" value={lead.numEmployees ?? '-'} />
                  <InfoRow label="Eligible Employees" value={lead.numEligible ?? '-'} />
                  <InfoRow label="Current Carrier" value={lead.currentCarrier || '-'} />
                  <InfoRow label="Current Plan" value={lead.currentPlan || '-'} />
                  <InfoRow label="Renewal Date" value={lead.renewalDate || '-'} />
                  <InfoRow label="Contribution" value={lead.contributionStrategy || '-'} />
                  {lead.benefitsNeeded && Array.isArray(lead.benefitsNeeded) && lead.benefitsNeeded.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Benefits Needed</p>
                      <div className="flex flex-wrap gap-1">
                        {lead.benefitsNeeded.map((b, i) => (
                          <span key={i} className="px-2 py-0.5 text-xs bg-teal-500/10 border border-teal-500/20 rounded text-teal-300">
                            {b}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {lead.groupNotes && <InfoRow label="Notes" value={lead.groupNotes} />}
                </>
              ) : (
                <>
                  <InfoRow label="Product" value={lead.productType?.toUpperCase() || 'N/A'} />
                  <InfoRow label="State" value={lead.state || 'N/A'} />
                  <InfoRow label="UTM Source" value={lead.utmSource || '-'} />
                  <InfoRow label="UTM Campaign" value={lead.utmCampaign || '-'} />
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
                </>
              )}
            </div>
          </div>

          {/* Session Card */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Session Info</h3>
            {session ? (
              <div className="space-y-3">
                <InfoRow label="Status" value={session.status} />
                <InfoRow label="Disposition" value={dispositionLabel} />
                <InfoRow label="Plan Name" value={session.planName || '—'} />
                <InfoRow label="Premium" value={session.premium || '—'} />
                <InfoRow label="Session Start" value={session.startTime ? new Date(session.startTime).toLocaleString() : '—'} />

                <div className="pt-3 mt-3 border-t border-white/10 space-y-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Wrap-Up Details</p>
                  {hasWrapUpDetails ? (
                    <>
                      {session.callSummary ? (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Call Summary</p>
                          <p className="text-sm text-gray-200 whitespace-pre-wrap">{session.callSummary}</p>
                        </div>
                      ) : null}

                      {actionItems.length > 0 ? (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Action Items</p>
                          <div className="space-y-1">
                            {actionItems.map((item, idx) => (
                              <p key={`${idx}-${item}`} className="text-sm text-gray-200">
                                - {item}
                              </p>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {compliance ? (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Compliance Flags</p>
                          <div className="space-y-1 text-sm">
                            <p className={compliance.disclaimerRead ? 'text-emerald-300' : 'text-red-300'}>
                              Disclaimer: {compliance.disclaimerRead ? 'Read' : 'Missed'}
                            </p>
                            <p className={!compliance.forbiddenTopics ? 'text-emerald-300' : 'text-red-300'}>
                              Forbidden Topics: {!compliance.forbiddenTopics ? 'None detected' : 'Detected'}
                            </p>
                            {compliance.notes ? (
                              <p className="text-gray-300 whitespace-pre-wrap">{compliance.notes}</p>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-sm text-gray-500">No wrap-up details saved yet.</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No session data yet.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'summary' && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Saved Meeting Summary</h3>

          {session?.callSummary ? (
            <>
              <div>
                <p className="text-xs text-gray-500 mb-1">Call Summary</p>
                <p className="text-sm text-gray-200 whitespace-pre-wrap">{session.callSummary}</p>
              </div>

              {actionItems.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Action Items</p>
                  <div className="space-y-1">
                    {actionItems.map((item, idx) => (
                      <p key={`${idx}-${item}`} className="text-sm text-gray-200">
                        - {item}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {compliance && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Compliance Flags</p>
                  <div className="space-y-1 text-sm">
                    <p className={compliance.disclaimerRead ? 'text-emerald-300' : 'text-red-300'}>
                      Disclaimer: {compliance.disclaimerRead ? 'Read' : 'Missed'}
                    </p>
                    <p className={!compliance.forbiddenTopics ? 'text-emerald-300' : 'text-red-300'}>
                      Forbidden Topics: {!compliance.forbiddenTopics ? 'None detected' : 'Detected'}
                    </p>
                    {compliance.notes ? (
                      <p className="text-gray-300 whitespace-pre-wrap">{compliance.notes}</p>
                    ) : null}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-500">
              No saved summary yet. Generate summary in Meeting page, then click Save to Supabase.
            </p>
          )}
        </div>
      )}

      {activeTab === 'recording' && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Meeting Audio Recording</h3>
            <button
              onClick={() => fetchMeetingRecording(true)}
              disabled={!hasRecording || recordingLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 text-gray-200 rounded-lg text-xs hover:bg-white/20 transition-all disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${recordingLoading ? 'animate-spin' : ''}`} />
              {recordingLoading ? 'Refreshing...' : 'Refresh Link'}
            </button>
          </div>

          {!hasRecording ? (
            <p className="text-sm text-gray-500">No recording saved for this client yet.</p>
          ) : recordingLoading && !recordingUrl ? (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Loader className="w-4 h-4 animate-spin" />
              Loading recording...
            </div>
          ) : recordingUrl ? (
            <div className="space-y-3">
              <audio controls preload="metadata" className="w-full" src={recordingUrl}>
                Your browser does not support audio playback.
              </audio>
              <p className="text-xs text-gray-400">
                If playback fails, click <span className="text-gray-200">Refresh Link</span> to generate a new secure URL.
              </p>
              <a
                href={recordingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
              >
                Open recording in new tab
              </a>
            </div>
          ) : (
            <p className="text-sm text-red-300">
              {recordingError || 'Recording exists but no playback URL is currently available.'}
            </p>
          )}

          {effectiveRecordingPath && (
            <p className="text-xs text-gray-500 break-all">
              Stored path: {effectiveRecordingPath}
            </p>
          )}
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
                      {bookingsService.formatTime(apt.startTime)} — {bookingsService.formatTime(apt.endTime)} ({apt.timezone})
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

      {activeTab === 'documents' && (
        <div className="space-y-4">
          {/* Upload Token Section */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">Secure Upload Portal</p>
                <p className="text-xs text-gray-400 mt-0.5">Generate a link for the client to upload documents securely.</p>
              </div>
              {uploadToken ? (
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-white/10 px-2 py-1 rounded text-blue-300 truncate max-w-[200px]">
                    /upload/{uploadToken.slice(0, 12)}...
                  </code>
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}/upload/${uploadToken}`;
                      navigator.clipboard.writeText(url);
                      setTokenCopied(true);
                      setTimeout(() => setTokenCopied(false), 2000);
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-all"
                  >
                    {tokenCopied ? 'Copied!' : 'Copy Link'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={async () => {
                    try {
                      const result = await clientDocsService.generateUploadToken(leadId);
                      setUploadToken(result.uploadToken);
                    } catch (err) {
                      console.error('Error generating token:', err);
                    }
                  }}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition-all"
                >
                  Generate Upload Link
                </button>
              )}
            </div>
          </div>

          {/* Folder-organized documents — folders with docs first, sorted by newest document */}
          {docFolders ? (
            Object.entries(docFolders)
              .sort(([, a], [, b]) => {
                if (a.length && !b.length) return -1;
                if (!a.length && b.length) return 1;
                if (!a.length && !b.length) return 0;
                const latestA = Math.max(...a.map(d => d.createdAt ? new Date(d.createdAt).getTime() : 0));
                const latestB = Math.max(...b.map(d => d.createdAt ? new Date(d.createdAt).getTime() : 0));
                return latestB - latestA;
              })
              .map(([folderName, docs]) => (
              <div key={folderName} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-white/5 border-b border-white/10 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-medium text-white">{folderName}</span>
                  <span className="text-xs text-gray-500 ml-1">({docs.length})</span>
                </div>
                {docs.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-gray-500">No documents in this folder.</div>
                ) : (
                  docs.map((doc) => (
                    <div key={doc.id} className="px-4 py-3 flex items-center justify-between border-b border-white/5 last:border-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4 text-blue-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm text-white font-medium truncate">{doc.filename}</p>
                          <p className="text-xs text-gray-400">
                            {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : ''} {doc.fileSize ? `• ${(doc.fileSize / 1024).toFixed(0)} KB` : ''}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDownload(doc.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-xs transition-all border border-white/10 shrink-0"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </button>
                    </div>
                  ))
                )}
              </div>
            ))
          ) : documents.length === 0 ? (
            <div className="text-center py-12 bg-white/5 border border-white/10 rounded-xl">
              <FileText className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No documents uploaded.</p>
            </div>
          ) : (
            documents.map(doc => (
              <div key={doc.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                     <p className="text-white font-medium">{doc.filename}</p>
                     <p className="text-xs text-gray-400">
                        {new Date(doc.createdAt).toLocaleDateString()} • {(doc.fileSize / 1024).toFixed(0)} KB
                     </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDownload(doc.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-sm transition-all border border-white/10"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'transcripts' && (
        <div className="space-y-4">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-white">Meeting Artifacts</p>
              <p className="text-xs text-gray-400">
                Transcriptions ({artifactTranscriptions.length}) • AI Responses ({artifactAiResponses.length}) • Full Chat ({artifactFullChat.length})
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchMeetingArtifacts(true)}
                disabled={artifactsLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 text-gray-200 rounded-lg text-xs hover:bg-white/20 transition-all disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${artifactsLoading ? 'animate-spin' : ''}`} />
                {artifactsLoading ? 'Refreshing...' : 'Refresh'}
              </button>
              <button
                onClick={handleDownloadArtifactsCsv}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-xs transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                CSV
              </button>
              <button
                onClick={handleDownloadArtifactsJson}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                JSON
              </button>
            </div>
          </div>

          {artifactsError && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-300">
              {artifactsError}
            </div>
          )}

          {artifactFullChat.length === 0 ? (
            <div className="text-center py-12 bg-white/5 border border-white/10 rounded-xl">
              <MessageSquare className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No meeting artifacts for this client yet.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              <ArtifactColumn
                title="Transcriptions"
                items={artifactTranscriptions}
                emptyText="No transcriptions"
                badgeClass="bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
              />
              <ArtifactColumn
                title="AI Responses"
                items={artifactAiResponses}
                emptyText="No AI responses"
                badgeClass="bg-blue-500/10 text-blue-300 border border-blue-500/20"
              />
              <ArtifactColumn
                title="Full Chat"
                items={artifactFullChat}
                emptyText="No chat timeline"
                badgeClass="bg-purple-500/10 text-purple-300 border border-purple-500/20"
              />
            </div>
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

function ArtifactColumn({ title, items, emptyText, badgeClass }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-3 min-h-[220px]">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wide">{title}</h4>
        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${badgeClass || ''}`}>
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-gray-500">{emptyText}</p>
      ) : (
        <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
          {items.map((entry, idx) => (
            <div key={`${entry.id || 'artifact'}-${idx}`} className="bg-black/20 border border-white/10 rounded-lg p-2">
              <div className="text-[11px] text-gray-500 mb-1">
                {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : 'No timestamp'}
              </div>
              <div className="text-xs text-gray-200 whitespace-pre-wrap">{entry.content || '—'}</div>
            </div>
          ))}
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

