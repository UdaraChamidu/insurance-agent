import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Video, Mic, MicOff, VideoOff, Phone, Download, Sparkles, MonitorUp, CheckSquare, Save } from 'lucide-react';
import meetingService from '../services/meetingService';
import ScriptPanel from '../components/ScriptPanel';
import WrapUpModal from '../components/WrapUpModal';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const WS_BASE_URL = import.meta.env.VITE_WS_URL || API_URL.replace(/^http/i, 'ws');
const WS_URL = `${WS_BASE_URL.replace(/\/$/, '')}/api/meetings/ws`;
const AI_DRAFT_REQUEST_COOLDOWN_MS = 1200;
const AI_MANUAL_REQUEST_TIMEOUT_MS = 12000;
const LATENCY_SAMPLE_WINDOW = 60;
const LATENCY_LOG_INTERVAL = 5;
const MIN_PANEL_WIDTH_PERCENT = 18;
const DEFAULT_PANEL_WIDTHS = [34, 33, 33];
const DEFAULT_VIDEO_WIDTH_PERCENT = 58;
const MIN_VIDEO_WIDTH_PERCENT = 35;
const MIN_ADMIN_WIDTH_PERCENT = 25;

export default function MeetingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Support both 'meetingId' and 'id' (legacy/backend generated)
  const meetingId = searchParams.get('meetingId') || searchParams.get('id');
  const role = searchParams.get('role') || 'client';
  const leadIdFromQuery = searchParams.get('leadId');
  
  const [error, setError] = useState(null); // Add error state
  const [logs, setLogs] = useState([]); // Visual logs
  const latencyMetricsRef = useRef({
    audioToTranscriptMs: [],
    requestToAiMs: [],
    audioToAiMs: []
  });

  // Helper to add logs
  const addLog = (msg) => {
    console.log(msg);
    setLogs(prev => [...prev.slice(-10), `${new Date().toLocaleTimeString()} - ${msg}`]);
  };

  const toPositiveNumber = (value) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const percentile = (values, p) => {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
    return Math.round(sorted[idx]);
  };

  const recordLatencyMetric = (metricKey, metricLabel, valueMs) => {
    const numericValue = toPositiveNumber(valueMs);
    if (!numericValue) return;

    const store = latencyMetricsRef.current[metricKey];
    if (!store) return;

    store.push(numericValue);
    if (store.length > LATENCY_SAMPLE_WINDOW) {
      store.splice(0, store.length - LATENCY_SAMPLE_WINDOW);
    }

    const sampleCount = store.length;
    if (sampleCount === 1 || sampleCount % LATENCY_LOG_INTERVAL === 0) {
      const p50 = percentile(store, 50);
      const p95 = percentile(store, 95);
      addLog(`[Latency] ${metricLabel}: last=${Math.round(numericValue)}ms p50=${p50}ms p95=${p95}ms n=${sampleCount}`);
    }
  };

  const registerAIRequest = (requestId, requestedAtMs) => {
    const normalizedRequestedAt = toPositiveNumber(requestedAtMs) || Date.now();
    if (requestId) {
      latestAIRequestRef.current.requestId = requestId;
    }
    latestAIRequestRef.current.requestedAtMs = normalizedRequestedAt;
  };

  const shouldDropAIResponse = (payload) => {
    const responseRequestId = typeof payload?.requestId === 'string' ? payload.requestId : '';
    const responseRequestedAtMs = toPositiveNumber(payload?.requestedAtMs);
    const responseStage = payload?.transcriptStage === 'draft' || payload?.requestOrigin === 'auto-draft-transcription'
      ? 'draft'
      : 'final';
    const latest = latestAIRequestRef.current;

    if (responseRequestId) {
      const seen = seenAIResponseIdsRef.current;
      if (seen.includes(responseRequestId)) {
        return true;
      }
      seen.push(responseRequestId);
      if (seen.length > 120) {
        seen.splice(0, seen.length - 120);
      }
    }

    if (responseStage === 'draft') {
      return false;
    }

    if (responseRequestedAtMs && latest.requestedAtMs && responseRequestedAtMs < latest.requestedAtMs) {
      return true;
    }

    if (
      responseRequestId &&
      latest.requestId &&
      responseRequestedAtMs &&
      latest.requestedAtMs &&
      responseRequestedAtMs === latest.requestedAtMs &&
      responseRequestId !== latest.requestId
    ) {
      return true;
    }

    return false;
  };

  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [userName, setUserName] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [transcriptions, setTranscriptions] = useState([]);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [isAIMonitoring, setIsAIMonitoring] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [meetingNotices, setMeetingNotices] = useState([]);
  const [localDisplayStream, setLocalDisplayStream] = useState(null);
  const [remoteDisplayStream, setRemoteDisplayStream] = useState(null);
  const [isManualAIRequestPending, setIsManualAIRequestPending] = useState(false);
  const isMonitoringRef = useRef(false);
  const lastAIRequestAtRef = useRef(0);
  const lastAIRequestTextRef = useRef('');
  const lastDraftAIByTurnRef = useRef({});
  const finalAIRequestedTurnRef = useRef({});
  const latestAIRequestRef = useRef({ requestId: '', requestedAtMs: 0 });
  const seenAIResponseIdsRef = useRef([]);
  const pendingManualAIRequestRef = useRef({ requestId: '', timeoutId: null });
  
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  // Phase 2: Agent Dashboard State
  const [activeTab, setActiveTab] = useState('ai'); // 'ai' or 'scripts'
  const [showWrapUp, setShowWrapUp] = useState(false);
  const [leadContext, setLeadContext] = useState(null);
  const [summaryData, setSummaryData] = useState(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [isSavingArtifacts, setIsSavingArtifacts] = useState(false);
  const [isInlineSummaryVisible, setIsInlineSummaryVisible] = useState(true);
  const [panelWidths, setPanelWidths] = useState(DEFAULT_PANEL_WIDTHS);
  const [isPanelResizing, setIsPanelResizing] = useState(false);
  const [videoPanelWidth, setVideoPanelWidth] = useState(DEFAULT_VIDEO_WIDTH_PERCENT);
  const [isMainLayoutResizing, setIsMainLayoutResizing] = useState(false);
  const [isDesktopLayout, setIsDesktopLayout] = useState(() => (
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  ));
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leaveFlowStep, setLeaveFlowStep] = useState('choice');
  const [isLeaveActionRunning, setIsLeaveActionRunning] = useState(false);
  const [isLeaveSummarySaved, setIsLeaveSummarySaved] = useState(false);
  const [isLeaveSummaryGenerated, setIsLeaveSummaryGenerated] = useState(false);
  const panelContainerRef = useRef(null);
  const mainLayoutContainerRef = useRef(null);
  const panelResizeRef = useRef({
    dividerIndex: -1,
    startX: 0,
    startWidths: DEFAULT_PANEL_WIDTHS
  });
  const mainLayoutResizeRef = useRef({
    startX: 0,
    startWidth: DEFAULT_VIDEO_WIDTH_PERCENT
  });

  const pushMeetingNotice = (message, level = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setMeetingNotices(prev => [...prev, { id, message, level }]);
    setTimeout(() => {
      setMeetingNotices(prev => prev.filter(item => item.id !== id));
    }, 4500);
  };

  const clearManualAIRequestTimer = () => {
    const timeoutId = pendingManualAIRequestRef.current.timeoutId;
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    pendingManualAIRequestRef.current.timeoutId = null;
  };

  const settleManualAIRequest = (requestId = '') => {
    const activeRequestId = pendingManualAIRequestRef.current.requestId;
    if (!activeRequestId) {
      return;
    }
    if (requestId && requestId !== activeRequestId) {
      return;
    }
    clearManualAIRequestTimer();
    pendingManualAIRequestRef.current.requestId = '';
    setIsManualAIRequestPending(false);
  };

  const beginManualAIRequest = (requestId) => {
    clearManualAIRequestTimer();
    pendingManualAIRequestRef.current.requestId = requestId;
    setIsManualAIRequestPending(true);
    pendingManualAIRequestRef.current.timeoutId = setTimeout(() => {
      if (pendingManualAIRequestRef.current.requestId !== requestId) {
        return;
      }
      settleManualAIRequest(requestId);
      addLog('AI request timeout. Retry Ask AI.');
      pushMeetingNotice('AI response delayed. You can retry now.', 'warning');
    }, AI_MANUAL_REQUEST_TIMEOUT_MS);
  };

  const getEffectiveLeadId = () => (
    leadContext?.id || leadIdFromQuery || null
  );

  const mapServerTimestamp = (rawTimestamp) => {
    if (!rawTimestamp) return new Date().toLocaleTimeString();
    const dt = new Date(rawTimestamp);
    return Number.isNaN(dt.getTime()) ? new Date().toLocaleTimeString() : dt.toLocaleTimeString();
  };

  const normalizeTurnId = (value, fallback) => {
    return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
  };

  const normalizeTranscriptStage = (value) => (value === 'draft' ? 'draft' : 'final');

  const hydratePersistedArtifacts = (payload) => {
    if (!payload || !payload.success) return;

    if (payload.summary) {
      setSummaryData({
        callSummary: payload.summary.callSummary || '',
        complianceFlags: payload.summary.complianceFlags || null,
        actionItems: payload.summary.actionItems || null
      });
      setIsInlineSummaryVisible(true);
    }

    const persistedTranscriptions = Array.isArray(payload.transcriptions)
      ? payload.transcriptions.map((item, index) => ({
          text: item.content || '',
          timestamp: mapServerTimestamp(item.timestamp),
          receivedAtMs: item.timestamp ? new Date(item.timestamp).getTime() : Date.now(),
          clientAudioStartMs: null,
          audioToTranscriptMs: null,
          transcriptStage: 'final',
          turnId: `persisted-transcript-${item.id || item.timestamp || index}`
        }))
      : [];

    const persistedAISuggestions = Array.isArray(payload.aiResponses)
      ? payload.aiResponses.map((item, index) => ({
          suggestion: item.content || '',
          citations: [],
          timestamp: mapServerTimestamp(item.timestamp),
          requestToAiMs: null,
          audioToAiMs: null,
          transcriptStage: 'final',
          turnId: `persisted-ai-${item.id || item.timestamp || index}`,
          suggestionKey: `persisted-ai-${item.id || item.timestamp || index}:final`
        }))
      : [];

    const persistedFullChat = Array.isArray(payload.fullChat)
      ? payload.fullChat.map((item) => ({
          type: item.role === 'ai' ? 'ai' : 'customer',
          text: item.content || '',
          timestamp: mapServerTimestamp(item.timestamp)
        }))
      : [];

    setTranscriptions((prev) => (prev.length > 0 ? prev : persistedTranscriptions));
    setAiSuggestions((prev) => (prev.length > 0 ? prev : persistedAISuggestions));
    setConversationHistory((prev) => (prev.length > 0 ? prev : persistedFullChat));
  };

  const loadMeetingArtifacts = async () => {
    const effectiveLeadId = getEffectiveLeadId();
    if (!effectiveLeadId) return null;

    try {
      const res = await fetch(`${API_URL}/api/leads/${effectiveLeadId}/meeting-artifacts`);
      if (!res.ok) {
        return null;
      }

      const payload = await res.json();
      hydratePersistedArtifacts(payload);
      return payload;
    } catch (err) {
      console.error('Error loading meeting artifacts:', err);
      return null;
    }
  };

  const generateFinalSummary = async () => {
    const effectiveLeadId = getEffectiveLeadId();
    if (!effectiveLeadId) {
      pushMeetingNotice('Lead context missing. Cannot generate summary.', 'warning');
      return null;
    }

    setIsSummaryLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/leads/${effectiveLeadId}/generate-summary`, {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok || !data?.success || !data?.data) {
        pushMeetingNotice('Summary generation failed.', 'warning');
        return null;
      }

      const nextSummary = {
        callSummary: data.data.callSummary || '',
        complianceFlags: data.data.complianceFlags || null,
        actionItems: data.data.actionItems || null
      };
      setSummaryData(nextSummary);
      setIsInlineSummaryVisible(true);
      addLog('Summary generated and saved to Supabase');
      pushMeetingNotice('Final summary generated.', 'success');
      return nextSummary;
    } catch (err) {
      console.error('Summary generation failed:', err);
      pushMeetingNotice('Summary generation failed.', 'warning');
      return null;
    } finally {
      setIsSummaryLoading(false);
    }
  };

  const saveSummaryToSupabase = async () => {
    const effectiveLeadId = getEffectiveLeadId();
    if (!effectiveLeadId) {
      pushMeetingNotice('Lead context missing. Cannot save summary.', 'warning');
      return false;
    }
    if (!summaryData?.callSummary) {
      pushMeetingNotice('Generate summary first.', 'warning');
      return false;
    }

    setIsSavingArtifacts(true);
    try {
      const res = await fetch(`${API_URL}/api/leads/${effectiveLeadId}/wrapup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callSummary: summaryData.callSummary,
          complianceFlags: summaryData.complianceFlags || null,
          actionItems: summaryData.actionItems || null
        })
      });
      if (!res.ok) {
        pushMeetingNotice('Failed to save summary.', 'warning');
        return false;
      }
      await loadMeetingArtifacts();
      addLog('Summary saved to Supabase session record');
      pushMeetingNotice('Summary saved to Supabase.', 'success');
      return true;
    } catch (err) {
      console.error('Error saving summary:', err);
      pushMeetingNotice('Failed to save summary.', 'warning');
      return false;
    } finally {
      setIsSavingArtifacts(false);
    }
  };

  const bindStreamToVideo = async (videoEl, stream, muted = false) => {
    if (!videoEl) return;

    if (!stream) {
      videoEl.srcObject = null;
      return;
    }

    if (videoEl.srcObject !== stream) {
      videoEl.srcObject = stream;
    }

    videoEl.muted = muted;
    videoEl.playsInline = true;

    try {
      await videoEl.play();
    } catch (err) {
      // Some browsers require metadata readiness before play resolves
      videoEl.onloadedmetadata = async () => {
        try {
          await videoEl.play();
        } catch (playErr) {
          console.warn('Video play retry failed:', playErr);
        }
      };
    }
  };

  // Fetch Lead Context (Phase 2)
  useEffect(() => {
    const fetchLead = async () => {
      const effectiveLeadId = leadIdFromQuery;

      if (effectiveLeadId) {
        try {
          const res = await fetch(`${API_URL}/api/leads/${effectiveLeadId}`);
          if (res.ok) {
            const data = await res.json();
            setLeadContext(data);
            const firstName = data.contactInfo?.firstName || data.firstName;
            if (firstName) {
               // Update username if generic
               setUserName(prev => prev || `${firstName} (Host)`);
            }
          }
        } catch (err) {
          console.error('Error fetching lead context:', err);
        }
      } else {
        setLeadContext(null);
      }
    };
    if (role === 'admin') fetchLead();
  }, [role, leadIdFromQuery]);

  useEffect(() => {
    if (!meetingId) {
      // If still missing after checking both params, redirect
      console.warn('❌ Missing meeting ID, redirecting to home.');
      navigate('/');
      return;
    }

    return () => {
      settleManualAIRequest();
      if (meetingService) {
        meetingService.leaveMeeting();
      }
    };
  }, [meetingId]);

  // Reset meeting-scoped UI state when meeting ID changes, so data never leaks between meetings.
  useEffect(() => {
    setTranscriptions([]);
    setAiSuggestions([]);
    setConversationHistory([]);
    setSummaryData(null);
    setIsInlineSummaryVisible(true);
    setShowWrapUp(false);
    setShowLeaveConfirm(false);
    setLeaveFlowStep('choice');
    setIsLeaveSummaryGenerated(false);
    setIsLeaveSummarySaved(false);
    setMeetingNotices([]);
    setLogs([]);
    setError(null);
    setIsJoined(false);
    setIsConnected(false);
    setLocalDisplayStream(null);
    setRemoteDisplayStream(null);
    setIsAIMonitoring(false);
    setIsManualAIRequestPending(false);
    isMonitoringRef.current = false;
    lastDraftAIByTurnRef.current = {};
    finalAIRequestedTurnRef.current = {};
    latestAIRequestRef.current = { requestId: '', requestedAtMs: 0 };
    seenAIResponseIdsRef.current = [];
    pendingManualAIRequestRef.current = { requestId: '', timeoutId: null };
  }, [meetingId]);

  useEffect(() => {
    bindStreamToVideo(localVideoRef.current, localDisplayStream, true);
  }, [localDisplayStream, isJoined, isScreenSharing]);

  useEffect(() => {
    bindStreamToVideo(remoteVideoRef.current, remoteDisplayStream, false);
  }, [remoteDisplayStream, isJoined]);

  useEffect(() => {
    if (role !== 'admin' || !isJoined) return;
    loadMeetingArtifacts();
  }, [role, isJoined, leadContext?.id, leadIdFromQuery]);

  useEffect(() => {
    const onResize = () => {
      setIsDesktopLayout(window.innerWidth >= 768);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, []);

  useEffect(() => {
    if (!showLeaveConfirm) return undefined;
    const onEsc = (event) => {
      if (event.key === 'Escape' && !isLeaveActionRunning) {
        if (leaveFlowStep === 'summary') {
          setLeaveFlowStep('choice');
          return;
        }
        setShowLeaveConfirm(false);
      }
    };
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('keydown', onEsc);
    };
  }, [showLeaveConfirm, isLeaveActionRunning, leaveFlowStep]);

  const handleJoinMeeting = async () => {
    if (!userName.trim()) {
      alert('Please enter your name');
      return;
    }

    try {
      // Connect to WebSocket
      addLog(`Connecting to WS: ${WS_URL}`);
      await meetingService.connect(WS_URL);
      addLog('WS Connected');
      
      // Set up callback for remote stream
      meetingService.onRemoteStream = (stream) => {
        addLog('📹 Remote stream received');
        setRemoteDisplayStream(stream);
        setIsConnected(true);
      };

      meetingService.onParticipantJoined = (data) => {
        if (data?.userId && data.userId !== meetingService.userId) {
          addLog(`Participant ${data.userId} joined`);
          pushMeetingNotice(`Participant joined: ${data.userId}`, 'success');
        }
      };
      
      // Set up callbacks for transcriptions and AI suggestions (admin only)
      if (role === 'admin') {
        meetingService.onTranscription = (data) => {
          const receivedAtMs = Date.now();
          const clientAudioStartMs = toPositiveNumber(data?.clientAudioStartMs);
          const audioToTranscriptMs = clientAudioStartMs ? receivedAtMs - clientAudioStartMs : null;
          const transcriptStage = normalizeTranscriptStage(data?.transcriptStage);
          const turnId = normalizeTurnId(data?.turnId, `turn-${receivedAtMs}`);
          recordLatencyMetric('audioToTranscriptMs', 'Audio -> Transcription', audioToTranscriptMs);
          addLog(`📝 ${transcriptStage === 'draft' ? 'Draft' : 'Final'} transcription received`);
          const entry = {
            text: data.text,
            timestamp: new Date().toLocaleTimeString(),
            receivedAtMs,
            clientAudioStartMs,
            audioToTranscriptMs,
            transcriptStage,
            turnId
          };

          setTranscriptions(prev => {
            const idx = prev.findIndex(item => item.turnId === turnId);
            if (idx === -1) {
              return [...prev, entry];
            }
            const next = [...prev];
            next[idx] = { ...next[idx], ...entry };
            return next;
          });

          if (transcriptStage === 'final') {
            setConversationHistory(prev => {
              const idx = prev.findIndex(item => item.type === 'customer' && item.turnId === turnId);
              const next = [...prev];
              const historyEntry = {
                type: 'customer',
                text: data.text,
                timestamp: entry.timestamp,
                turnId
              };
              if (idx === -1) {
                next.push(historyEntry);
              } else {
                next[idx] = historyEntry;
              }
              return next;
            });
          }

          // Option B: Fast draft assist + canonical final assist
          if (isMonitoringRef.current && data.text && data.text.trim().length > 5) {
            const normalizedText = data.text.trim().toLowerCase();
            const now = Date.now();

            if (transcriptStage === 'draft') {
              const draftState = lastDraftAIByTurnRef.current[turnId] || { text: '', requestedAtMs: 0 };
              const textGrowth = normalizedText.length - draftState.text.length;
              const punctuationBoundary = /[?.!]$/.test(data.text.trim());
              const meetsGrowthGate = textGrowth >= 10 || punctuationBoundary;
              const coolingDown = (now - draftState.requestedAtMs) < AI_DRAFT_REQUEST_COOLDOWN_MS;

              if (!coolingDown && normalizedText !== draftState.text && meetsGrowthGate) {
                addLog('Auto-requesting AI draft assist...');
                const requestId = `auto-draft-${turnId}-${now}`;
                registerAIRequest(requestId, now);
                meetingService.requestAISuggestion(
                  meetingId,
                  data.text,
                  'customer',
                  {
                    requestId,
                    requestOrigin: 'auto-draft-transcription',
                    transcriptStage: 'draft',
                    turnId,
                    requestedAtMs: now,
                    sourceAudioStartMs: clientAudioStartMs,
                    sourceTranscriptionAtMs: receivedAtMs
                  }
                );
                lastDraftAIByTurnRef.current[turnId] = {
                  text: normalizedText,
                  requestedAtMs: now
                };
              }
              return;
            }

            if (!finalAIRequestedTurnRef.current[turnId]) {
              addLog('Auto-requesting AI final assist...');
              const requestId = `auto-final-${turnId}-${now}`;
              registerAIRequest(requestId, now);
              meetingService.requestAISuggestion(
                meetingId,
                data.text,
                'customer',
                {
                  requestId,
                  requestOrigin: 'auto-final-transcription',
                  transcriptStage: 'final',
                  turnId,
                  requestedAtMs: now,
                  sourceAudioStartMs: clientAudioStartMs,
                  sourceTranscriptionAtMs: receivedAtMs
                }
              );
              finalAIRequestedTurnRef.current[turnId] = true;
              lastAIRequestAtRef.current = now;
              lastAIRequestTextRef.current = normalizedText;
            }
          }
        };
        
        meetingService.onAISuggestion = (data) => {
          const responseRequestId = typeof data?.requestId === 'string' ? data.requestId : '';
          if (responseRequestId) {
            settleManualAIRequest(responseRequestId);
          }
          if (shouldDropAIResponse(data)) {
            addLog('Dropped stale AI suggestion response');
            return;
          }
          const suggestionStage = normalizeTranscriptStage(
            data?.transcriptStage || (
              data?.requestOrigin === 'auto-draft-transcription' ? 'draft' : 'final'
            )
          );
          const suggestionTurnId = normalizeTurnId(data?.turnId, `ai-${suggestionStage}-${Date.now()}`);
          const suggestionKey = `${suggestionTurnId}:${suggestionStage}`;
          addLog(`💡 ${suggestionStage === 'draft' ? 'Draft' : 'Final'} AI suggestion received`);
          // Format citations if present
          let suggestionText = data.suggestion;
          let citations = data.citations || [];
          const receivedAtMs = Date.now();
          const requestedAtMs = toPositiveNumber(data?.requestedAtMs);
          const sourceAudioStartMs = toPositiveNumber(data?.sourceAudioStartMs);
          const requestToAiMs = requestedAtMs ? (receivedAtMs - requestedAtMs) : toPositiveNumber(data?.requestToAiLatencyMs);
          const audioToAiMs = sourceAudioStartMs ? (receivedAtMs - sourceAudioStartMs) : toPositiveNumber(data?.audioToAiLatencyMs);

          recordLatencyMetric('requestToAiMs', 'AI Request -> AI Response', requestToAiMs);
          recordLatencyMetric('audioToAiMs', 'Audio -> AI Response', audioToAiMs);
          
          const entry = {
            suggestion: suggestionText,
            citations: citations,
            timestamp: new Date().toLocaleTimeString(),
            requestToAiMs,
            audioToAiMs,
            transcriptStage: suggestionStage,
            turnId: suggestionTurnId,
            suggestionKey
          };
          setAiSuggestions(prev => {
            const idx = prev.findIndex(item => item.suggestionKey === suggestionKey);
            if (idx === -1) {
              return [...prev, entry];
            }
            const next = [...prev];
            next[idx] = { ...next[idx], ...entry };
            return next;
          });
          
          // Keep canonical full-chat tied to final assist only.
          if (suggestionStage === 'final') {
            let historyText = suggestionText;
            if (citations.length > 0) {
                historyText += `\n[Sources: ${citations.map(c => c.source).join(', ')}]`;
            }
            
            setConversationHistory(prev => {
              const idx = prev.findIndex(item => item.type === 'ai' && item.turnId === suggestionTurnId);
              const next = [...prev];
              const historyEntry = {
                type: 'ai',
                text: historyText,
                timestamp: entry.timestamp,
                turnId: suggestionTurnId
              };
              if (idx === -1) {
                next.push(historyEntry);
              } else {
                next[idx] = historyEntry;
              }
              return next;
            });
          }
        };
      }

      // Handle Participant Left
      meetingService.onParticipantLeft = (data) => {
          addLog(`👋 Participant ${data.userId} left`);
          setRemoteDisplayStream(null);
          if (data?.userId && data.userId !== meetingService.userId) {
            pushMeetingNotice(`Participant left: ${data.userId}`, 'warning');
          }
      };
      
      // Join meeting (peer connections handled automatically)
      addLog(`Joining meeting: ${meetingId}`);
      const stream = await meetingService.joinMeeting(
        meetingId,
        `${role}-${userName.replace(/\s+/g, '-')}-${Date.now()}`,
        role
      );
      addLog('✅ Local stream acquired');

      const localVideoTrack = stream.getVideoTracks()[0];
      if (!localVideoTrack) {
        throw new Error('Camera stream missing. Please verify camera access and retry.');
      }
      localVideoTrack.onended = () => {
        setIsVideoOff(true);
        pushMeetingNotice('Camera stopped unexpectedly. Toggle camera to retry.', 'warning');
      };
      localVideoTrack.onunmute = () => setIsVideoOff(false);

      setLocalDisplayStream(stream);
      
      setIsConnected(true);
      setIsVideoOff(!localVideoTrack.enabled);
      setIsJoined(true);
      const monitorEnabled = role === 'admin';
      setIsAIMonitoring(monitorEnabled);
      isMonitoringRef.current = monitorEnabled;
      lastDraftAIByTurnRef.current = {};
      finalAIRequestedTurnRef.current = {};
    } catch (error) {
      addLog(`❌ Error: ${error.message}`);
      setError(error.message);
      alert('Failed to join meeting. Please check your camera and microphone permissions.');
    }
  };

  const toggleMute = () => {
    if (meetingService.localStream) {
      const audioTrack = meetingService.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        
        // Stop/start audio processing when muting/unmuting
        if (audioTrack.enabled) {
          meetingService.isRecording = true;
        } else {
          meetingService.isRecording = false;
        }
      }
    }
  };

  const toggleVideo = async () => {
    if (meetingService.localStream) {
      let videoTrack = meetingService.localStream.getVideoTracks()[0];
      let restartedCamera = false;

      if (!videoTrack || videoTrack.readyState === 'ended') {
        try {
          const refreshedStream = await meetingService.restartCameraTrack();
          videoTrack = refreshedStream.getVideoTracks()[0];
          restartedCamera = true;
          setLocalDisplayStream(isScreenSharing ? localDisplayStream : refreshedStream);
          setIsVideoOff(false);
          pushMeetingNotice('Camera restarted successfully.', 'success');
        } catch (err) {
          console.error('Camera restart failed:', err);
          pushMeetingNotice('Camera restart failed. Check permissions/device.', 'warning');
          return;
        }
      }

      if (videoTrack) {
        if (restartedCamera) {
          videoTrack.enabled = true;
          setIsVideoOff(false);
          await meetingService.ensureVideoTrackBroadcast();
          return;
        }
        const nextEnabled = !videoTrack.enabled;
        videoTrack.enabled = nextEnabled;
        setIsVideoOff(!nextEnabled);
        if (nextEnabled) {
          await meetingService.ensureVideoTrackBroadcast();
        }
      }
    }
  };

  const leaveMeetingNow = () => {
    settleManualAIRequest();
    meetingService.leaveMeeting();
    navigate('/');
  };

  const endCall = () => {
    if (role !== 'admin') {
      if (confirm('Are you sure you want to leave the consultation?')) {
        leaveMeetingNow();
      }
      return;
    }
    setLeaveFlowStep('choice');
    setIsLeaveSummaryGenerated(Boolean(summaryData?.callSummary));
    setIsLeaveSummarySaved(false);
    setShowLeaveConfirm(true);
  };

  const openLeaveSummaryStep = async () => {
    if (isLeaveActionRunning) return;
    setIsLeaveActionRunning(true);
    try {
      if (!summaryData?.callSummary) {
        const generated = await generateFinalSummary();
        setIsLeaveSummaryGenerated(Boolean(generated?.callSummary));
      } else {
        setIsLeaveSummaryGenerated(true);
      }
    } finally {
      setIsLeaveActionRunning(false);
      setLeaveFlowStep('summary');
    }
  };

  const generateLeaveSummary = async () => {
    if (isLeaveActionRunning) return;
    setIsLeaveActionRunning(true);
    try {
      const generated = await generateFinalSummary();
      setIsLeaveSummaryGenerated(Boolean(generated?.callSummary));
      if (!generated?.callSummary) {
        pushMeetingNotice('Could not generate summary. You can still leave or retry.', 'warning');
      }
    } finally {
      setIsLeaveActionRunning(false);
    }
  };

  const saveLeaveSummaryToSupabase = async () => {
    if (!summaryData?.callSummary) {
      pushMeetingNotice('Generate summary first.', 'warning');
      return;
    }
    const saved = await saveSummaryToSupabase();
    setIsLeaveSummarySaved(Boolean(saved));
  };

  const downloadConversation = (summaryOverride = null) => {
    const effectiveSummary = summaryOverride || summaryData;
    const hasAnyArtifacts = (
      conversationHistory.length > 0
      || transcriptions.length > 0
      || aiSuggestions.length > 0
      || Boolean(effectiveSummary?.callSummary)
    );
    if (!hasAnyArtifacts) {
      alert('No meeting data to download yet!');
      return;
    }

    const report = {
      generatedAt: new Date().toISOString(),
      meetingId,
      leadId: getEffectiveLeadId(),
      summary: effectiveSummary,
      transcriptions,
      aiResponses: aiSuggestions,
      fullChat: conversationHistory
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meeting-report-${meetingId}-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadPersistedCsv = async () => {
    const effectiveLeadId = getEffectiveLeadId();
    if (!effectiveLeadId) {
      alert('Lead context missing. Cannot download CSV.');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/leads/${effectiveLeadId}/meeting-artifacts.csv`);
      if (!res.ok) {
        throw new Error(`CSV export failed (${res.status})`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `meeting-artifacts-${effectiveLeadId}-${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addLog('Downloaded persisted CSV artifacts');
    } catch (err) {
      console.error('CSV download error:', err);
      pushMeetingNotice('Failed to download CSV artifacts.', 'warning');
    }
  };

  const startPanelResize = (dividerIndex, event) => {
    if (!panelContainerRef.current) return;
    panelResizeRef.current = {
      dividerIndex,
      startX: event.clientX,
      startWidths: [...panelWidths]
    };
    setIsPanelResizing(true);
  };

  useEffect(() => {
    if (!isPanelResizing) return;

    const onMouseMove = (event) => {
      const container = panelContainerRef.current;
      if (!container) return;
      const width = container.getBoundingClientRect().width;
      if (width <= 0) return;

      const { dividerIndex, startX, startWidths } = panelResizeRef.current;
      const deltaPercent = ((event.clientX - startX) / width) * 100;
      const next = [...startWidths];

      if (dividerIndex === 0) {
        const leftBase = startWidths[0];
        const rightBase = startWidths[1];
        const minDelta = MIN_PANEL_WIDTH_PERCENT - leftBase;
        const maxDelta = rightBase - MIN_PANEL_WIDTH_PERCENT;
        const clampedDelta = Math.min(maxDelta, Math.max(minDelta, deltaPercent));
        next[0] = leftBase + clampedDelta;
        next[1] = rightBase - clampedDelta;
      } else if (dividerIndex === 1) {
        const leftBase = startWidths[1];
        const rightBase = startWidths[2];
        const minDelta = MIN_PANEL_WIDTH_PERCENT - leftBase;
        const maxDelta = rightBase - MIN_PANEL_WIDTH_PERCENT;
        const clampedDelta = Math.min(maxDelta, Math.max(minDelta, deltaPercent));
        next[1] = leftBase + clampedDelta;
        next[2] = rightBase - clampedDelta;
      }

      setPanelWidths(next);
    };

    const onMouseUp = () => {
      setIsPanelResizing(false);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isPanelResizing]);

  const startMainLayoutResize = (event) => {
    if (!isDesktopLayout || role !== 'admin') return;
    if (!mainLayoutContainerRef.current) return;
    mainLayoutResizeRef.current = {
      startX: event.clientX,
      startWidth: videoPanelWidth
    };
    setIsMainLayoutResizing(true);
  };

  useEffect(() => {
    if (!isMainLayoutResizing) return;

    const onMouseMove = (event) => {
      const container = mainLayoutContainerRef.current;
      if (!container) return;
      const width = container.getBoundingClientRect().width;
      if (width <= 0) return;

      const deltaPercent = ((event.clientX - mainLayoutResizeRef.current.startX) / width) * 100;
      const tentative = mainLayoutResizeRef.current.startWidth + deltaPercent;
      const maxVideo = 100 - MIN_ADMIN_WIDTH_PERCENT;
      const clamped = Math.min(maxVideo, Math.max(MIN_VIDEO_WIDTH_PERCENT, tentative));
      setVideoPanelWidth(clamped);
    };

    const onMouseUp = () => setIsMainLayoutResizing(false);

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isMainLayoutResizing]);

  if (!isJoined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="card max-w-md w-full">
          <div className="text-center mb-8">
            <Video className="h-16 w-16 text-blue-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Join Consultation
            </h1>
            <p className="text-gray-600">
              You're about to join a video consultation with SecureLife Insurance
            </p>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Name
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your name"
              onKeyPress={(e) => e.key === 'Enter' && handleJoinMeeting()}
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-900 text-sm mb-2">Before joining:</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Make sure your camera and microphone are working</li>
              <li>• Find a quiet, well-lit space</li>
              <li>• Have any relevant documents ready</li>
            </ul>
          </div>

          <button
            onClick={handleJoinMeeting}
            disabled={isJoined || error} // Simple disable, ideally add isJoining state
            className={`w-full btn-primary text-lg py-3 ${isJoined ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isJoined ? 'Joining...' : 'Join Meeting'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={mainLayoutContainerRef}
      className={`h-screen bg-black flex flex-col md:flex-row ${isMainLayoutResizing ? 'select-none cursor-col-resize' : ''}`}
    >
      {/* Main Video Area - Full height on mobile, flex-1 on desktop */}
      <div
        className={`flex-1 flex flex-col relative ${role === 'admin' ? 'h-[50vh] md:h-full' : 'h-full'}`}
        style={role === 'admin' && isDesktopLayout ? { flex: `0 0 ${videoPanelWidth}%` } : undefined}
      >
        {/* Header - Hidden on small mobile screens if needed, or compact */}
        <header className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/70 to-transparent px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <h1 className="text-sm md:text-lg font-semibold text-white truncate">Consultation</h1>
              {role === 'admin' && <span className="text-[10px] bg-blue-600 px-2 py-0.5 rounded text-white">Admin</span>}
            </div>
            <div className="text-xs md:text-sm text-gray-300">
              {userName}
            </div>
          </div>
        </header>

        {/* Video Section */}
        <div className="flex-1 relative bg-gray-900 overflow-hidden">
          {/* Remote Video */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          
          {!isConnected && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-0">
              <div className="text-center text-gray-400 p-4">
                <Video className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">Connecting...</p>
              </div>
            </div>
          )}

          {/* Local Video - PiP */}
          <div className="absolute bottom-20 right-4 w-32 h-24 md:bottom-24 md:right-6 md:w-64 md:h-48 bg-gray-800 rounded-lg overflow-hidden shadow-2xl border border-gray-700 z-10">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          </div>

          {meetingNotices.length > 0 && (
            <div className="absolute top-16 right-4 z-20 space-y-2 max-w-xs">
              {meetingNotices.map((notice) => (
                <div
                  key={notice.id}
                  className={`px-3 py-2 rounded-lg text-xs border backdrop-blur-sm ${
                    notice.level === 'warning'
                      ? 'bg-amber-900/70 text-amber-100 border-amber-700/60'
                      : 'bg-emerald-900/70 text-emerald-100 border-emerald-700/60'
                  }`}
                >
                  {notice.message}
                </div>
              ))}
            </div>
          )}

          {/* Controls - Floating Bar */}
          <div className="absolute bottom-6 left-0 right-0 flex justify-center z-20 pointer-events-none">
            <div className="flex items-center space-x-4 bg-black/50 backdrop-blur-sm px-6 py-2 rounded-full pointer-events-auto">
              <button
                onClick={toggleMute}
                className={`p-4 rounded-full ${isMuted ? 'bg-red-600' : 'bg-gray-700'} hover:opacity-80 transition-all shadow-lg`}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <MicOff className="h-6 w-6 text-white" /> : <Mic className="h-6 w-6 text-white" />}
              </button>
              
              <button
                onClick={toggleVideo}
                className={`p-4 rounded-full ${isVideoOff ? 'bg-red-600' : 'bg-gray-700'} hover:opacity-80 transition-all shadow-lg`}
                title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
              >
                {isVideoOff ? <VideoOff className="h-6 w-6 text-white" /> : <Video className="h-6 w-6 text-white" />}
              </button>

              {role === 'admin' && (
                <button
                  onClick={async () => {
                    try {
                      if (!isScreenSharing) {
                        const stream = await meetingService.startScreenShare();
                        setLocalDisplayStream(stream);
                        setIsScreenSharing(true);
                        
                        // Detect when the stream ends (e.g. Stop sharing in browser)
                        stream.getVideoTracks()[0].onended = () => {
                          setIsScreenSharing(false);
                          setLocalDisplayStream(meetingService.localStream);
                        };
                      } else {
                        await meetingService.stopScreenShare();
                        setLocalDisplayStream(meetingService.localStream);
                        setIsScreenSharing(false);
                      }
                    } catch (err) {
                      console.error('Screen share error:', err);
                    }
                  }}
                  className={`p-4 rounded-full ${isScreenSharing ? 'bg-blue-600' : 'bg-gray-700'} hover:opacity-80 transition-all shadow-lg`}
                  title={isScreenSharing ? 'Stop sharing screen' : 'Share screen'}
                >
                  <MonitorUp className="h-6 w-6 text-white" />
                </button>
              )}
              
              <button
                onClick={endCall}
                className="p-4 rounded-full bg-red-600 hover:bg-red-700 transition-all shadow-lg"
                title="Leave meeting"
              >
                <Phone className="h-6 w-6 text-white transform rotate-135" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {role === 'admin' && isDesktopLayout && (
        <div
          className="w-1 bg-gray-700/80 hover:bg-blue-500 cursor-col-resize shrink-0 transition-colors"
          onMouseDown={startMainLayoutResize}
          title="Resize meeting and admin areas"
        />
      )}

      {/* Admin Panel - 3 Columns (50% width for more space) */}
      {role === 'admin' && (
        <div
          className="w-full bg-gray-900 flex flex-col"
          style={isDesktopLayout ? { flex: `0 0 ${100 - videoPanelWidth}%` } : undefined}
        >
          <div className="px-4 py-3 bg-gray-800 border-b border-gray-700 flex justify-between items-center">
            
            {/* Tabs */}
            <div className="flex space-x-4">
              <button 
                onClick={() => setActiveTab('ai')}
                className={`text-sm font-semibold pb-1 border-b-2 transition-colors ${activeTab === 'ai' ? 'text-white border-blue-500' : 'text-gray-400 border-transparent hover:text-gray-200'}`}
              >
                AI Assist
              </button>
              <button 
                onClick={() => setActiveTab('scripts')}
                className={`text-sm font-semibold pb-1 border-b-2 transition-colors ${activeTab === 'scripts' ? 'text-white border-blue-500' : 'text-gray-400 border-transparent hover:text-gray-200'}`}
              >
                Scripts & Tools
              </button>
            </div>

            <div className="flex items-center space-x-3">
              {/* Wrap Up Button */}
              <button
                onClick={() => setShowWrapUp(true)}
                className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded shadow-sm transition-colors flex items-center gap-1"
              >
                <CheckSquare className="w-3 h-3" /> Wrap Up
              </button>

              <div className="h-4 w-px bg-gray-600 mx-2"></div>

              <span className={`text-[10px] uppercase font-bold ${isAIMonitoring ? 'text-green-400' : 'text-gray-500'}`}>
                {isAIMonitoring ? 'AI Active' : 'AI Off'}
              </span>
              <button
                onClick={() => {
                  const newState = !isAIMonitoring;
                  setIsAIMonitoring(newState);
                  isMonitoringRef.current = newState;
                }}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                  isAIMonitoring ? 'bg-green-600' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    isAIMonitoring ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
          
          <div className="flex-1 flex overflow-hidden relative bg-gray-900">
            
            {/* Tab Content: AI Assist */}
            {activeTab === 'ai' && (
              <div
                ref={panelContainerRef}
                className={`flex flex-1 overflow-hidden ${isPanelResizing ? 'select-none cursor-col-resize' : ''}`}
              >
                {/* Column 1: Live Transcription */}
                <div
                  className="min-w-0 border-r border-gray-700 flex flex-col"
                  style={{ flex: `0 0 ${panelWidths[0]}%` }}
                >
              <div className="px-3 py-2 bg-gray-800 border-b border-gray-700 flex justify-between items-center">
                <h3 className="text-xs font-semibold text-white flex items-center justify-between w-full">
                  <span>Live Transcription</span>
                </h3>
                <button 
                  onClick={() => {
                    if (isManualAIRequestPending) {
                      pushMeetingNotice('AI request already in progress. Please wait.', 'warning');
                      return;
                    }
                    if (transcriptions.length > 0) {
                      const finalEntries = transcriptions.filter(item => normalizeTranscriptStage(item?.transcriptStage) === 'final');
                      const lastEntry = finalEntries.length > 0
                        ? finalEntries[finalEntries.length - 1]
                        : transcriptions[transcriptions.length - 1];
                      const now = Date.now();
                      const requestId = `manual-${now}-${Math.random().toString(36).slice(2, 8)}`;
                      beginManualAIRequest(requestId);
                      lastAIRequestAtRef.current = now;
                      lastAIRequestTextRef.current = lastEntry.text.trim().toLowerCase();
                      registerAIRequest(requestId, now);
                      meetingService.requestAISuggestion(
                        meetingId,
                        lastEntry.text,
                        'customer',
                        {
                          requestId,
                          requestOrigin: 'manual-button',
                          transcriptStage: normalizeTranscriptStage(lastEntry?.transcriptStage),
                          turnId: lastEntry?.turnId || null,
                          requestedAtMs: now,
                          sourceAudioStartMs: lastEntry.clientAudioStartMs || null,
                          sourceTranscriptionAtMs: lastEntry.receivedAtMs || null
                        }
                      );
                    } else {
                      alert('No transcription available to analyze.');
                    }
                  }}
                  disabled={isManualAIRequestPending || transcriptions.length === 0}
                  className={`px-2 py-0.5 text-white text-[10px] rounded flex items-center space-x-1 transition-colors ${
                    isManualAIRequestPending || transcriptions.length === 0
                      ? 'bg-purple-900 cursor-not-allowed opacity-70'
                      : 'bg-purple-600 hover:bg-purple-700'
                  }`}
                >
                  <span>{isManualAIRequestPending ? 'Waiting...' : 'Ask AI'}</span>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2 relative">
                {transcriptions.length === 0 ? (
                  <div className="text-center text-gray-500 text-xs mt-4">
                    <p>Waiting for customer...</p>
                  </div>
                ) : (
                  transcriptions.map((item, index) => (
                    <div key={`${item.turnId || 'transcript'}-${index}`} className="bg-gray-800 rounded p-2">
                      <div className="text-xs text-gray-400 mb-1 flex items-center justify-between">
                        <span>{item.timestamp}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          normalizeTranscriptStage(item?.transcriptStage) === 'draft'
                            ? 'bg-amber-900 text-amber-300'
                            : 'bg-green-900 text-green-300'
                        }`}>
                          {normalizeTranscriptStage(item?.transcriptStage) === 'draft' ? 'Draft' : 'Final'}
                        </span>
                      </div>
                      <div className="text-xs text-white">{item.text}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div
              className="w-1 bg-gray-700/80 hover:bg-blue-500 cursor-col-resize shrink-0 transition-colors"
              onMouseDown={(event) => startPanelResize(0, event)}
              title="Resize panels"
            />

            {/* Column 2: AI Suggestions */}
            <div
              className="min-w-0 border-r border-gray-700 flex flex-col"
              style={{ flex: `0 0 ${panelWidths[1]}%` }}
            >
              <div className="px-3 py-2 bg-gray-800 border-b border-gray-700">
                <h3 className="text-xs font-semibold text-white flex items-center justify-between w-full">
                  <div className="flex items-center">
                    <span className="mr-1">💡</span>
                    AI Suggestions
                  </div>
                  {!isAIMonitoring && <span className="text-[10px] text-gray-500 bg-gray-700 px-1 rounded animate-pulse">PAUSED</span>}
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2 relative">
                {aiSuggestions.length === 0 ? (
                  <div className="text-center text-gray-500 text-xs mt-4">
                    <p>{!isAIMonitoring ? 'Assistance Paused' : 'AI suggestions...'}</p>
                  </div>
                ) : (
                  aiSuggestions.map((item, index) => (
                    <div key={item.suggestionKey || `${item.turnId || 'ai'}-${index}`} className="bg-blue-900 bg-opacity-30 border border-blue-700 rounded p-2">
                      <div className="text-xs text-blue-300 mb-1 flex items-center justify-between">
                        <span>{item.timestamp}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          normalizeTranscriptStage(item?.transcriptStage) === 'draft'
                            ? 'bg-amber-900 text-amber-300'
                            : 'bg-green-900 text-green-300'
                        }`}>
                          {normalizeTranscriptStage(item?.transcriptStage) === 'draft' ? 'Draft Assist' : 'Final Assist'}
                        </span>
                      </div>
                      <div className="text-xs text-white">{item.suggestion}</div>
                      {item.citations && item.citations.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-blue-800">
                              <p className="text-[10px] text-gray-400 font-semibold mb-1">Sources:</p>
                              {item.citations.map((cit, cIdx) => (
                                  <div key={cIdx} className="text-[10px] text-blue-200 truncate">
                                      • {cit.source} <span className="text-gray-500">({Math.round(cit.score*100)}%)</span>
                                  </div>
                              ))}
                          </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div
              className="w-1 bg-gray-700/80 hover:bg-blue-500 cursor-col-resize shrink-0 transition-colors"
              onMouseDown={(event) => startPanelResize(1, event)}
              title="Resize panels"
            />
           
            {/* Column 3: Full Conversation */}
            <div
              className="min-w-0 flex flex-col"
              style={{ flex: `0 0 ${panelWidths[2]}%` }}
            >
              <div className="px-3 py-2 bg-gray-800 border-b border-gray-700 space-y-2">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-semibold text-white">Full Chat + Final Summary</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={downloadPersistedCsv}
                      className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-[10px] text-white transition"
                      title="Download persisted artifacts CSV"
                    >
                      CSV
                    </button>
                    <button
                      onClick={downloadConversation}
                      className="flex items-center space-x-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs text-white transition"
                      title="Download full meeting report (JSON)"
                    >
                      <Download className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={generateFinalSummary}
                    disabled={isSummaryLoading}
                    className={`px-2 py-1 rounded text-[10px] text-white flex items-center gap-1 ${
                      isSummaryLoading ? 'bg-blue-900 opacity-70 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    <Sparkles className="w-3 h-3" />
                    {isSummaryLoading ? 'Generating...' : 'Generate Summary'}
                  </button>
                  <button
                    onClick={saveSummaryToSupabase}
                    disabled={isSavingArtifacts || !summaryData?.callSummary}
                    className={`px-2 py-1 rounded text-[10px] text-white flex items-center gap-1 ${
                      isSavingArtifacts || !summaryData?.callSummary
                        ? 'bg-emerald-900 opacity-70 cursor-not-allowed'
                        : 'bg-emerald-600 hover:bg-emerald-700'
                    }`}
                  >
                    <Save className="w-3 h-3" />
                    {isSavingArtifacts ? 'Saving...' : 'Save to Supabase'}
                  </button>
                  {summaryData?.callSummary && (
                    <button
                      onClick={() => setIsInlineSummaryVisible(prev => !prev)}
                      className="px-2 py-1 rounded text-[10px] text-white bg-gray-700 hover:bg-gray-600"
                    >
                      {isInlineSummaryVisible ? 'Hide Summary' : 'Show Summary'}
                    </button>
                  )}
                </div>

                {summaryData?.callSummary && isInlineSummaryVisible ? (
                  <div className="bg-gray-900/70 border border-gray-700 rounded p-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] uppercase tracking-wide text-gray-400">Summary</p>
                      <button
                        onClick={() => setIsInlineSummaryVisible(false)}
                        className="text-[10px] text-gray-300 hover:text-white"
                        title="Hide summary"
                      >
                        Close
                      </button>
                    </div>
                    <p className="text-xs text-gray-100">{summaryData.callSummary}</p>
                    {Array.isArray(summaryData.actionItems) && summaryData.actionItems.length > 0 && (
                      <div className="text-[10px] text-gray-300">
                        {summaryData.actionItems.map((item, idx) => (
                          <div key={`${idx}-${item}`}>- {item}</div>
                        ))}
                      </div>
                    )}
                    {summaryData.complianceFlags && (
                      <div className="text-[10px] text-amber-300">
                        Compliance: {summaryData.complianceFlags.notes || 'Review compliance flags in wrap-up.'}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-[10px] text-gray-400">
                    {summaryData?.callSummary
                      ? 'Summary hidden. Click "Show Summary" to view.'
                      : 'No final summary yet. Generate one during or after the call.'}
                  </p>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2 relative">
                {conversationHistory.length === 0 ? (
                  <div className="text-center text-gray-500 text-xs mt-4">
                    <p>Chat will appear...</p>
                  </div>
                ) : (
                  conversationHistory.map((item, index) => (
                    <div
                      key={index}
                      className={`rounded p-2 ${
                        item.type === 'customer'
                          ? 'bg-gray-800'
                          : 'bg-blue-900 bg-opacity-30 border border-blue-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-semibold ${
                          item.type === 'customer' ? 'text-green-400' : 'text-blue-300'
                        }`}>
                          {item.type === 'customer' ? '👤' : '🤖'}
                        </span>
                        <span className="text-xs text-gray-400">{item.timestamp}</span>
                      </div>
                      <div className="text-xs text-white">{item.text}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
            </div>
            )}

            {/* Tab Content: Scripts & Tools */}
            {activeTab === 'scripts' && (
              <div className="w-full h-full p-4 bg-gray-900">
                 <ScriptPanel productType={leadContext?.productType || 'default'} />
              </div>
            )}

          </div>

          {/* Wrap Up Modal */}
          <WrapUpModal 
            isOpen={showWrapUp} 
            onClose={() => setShowWrapUp(false)}
            leadId={leadContext?.id || leadIdFromQuery || null}
            initialSummary={summaryData}
            onSave={(data) => {
              addLog(`✅ Wrap-up saved: ${data.disposition}`);
            }}
          />
          {showLeaveConfirm && (
            <div
              className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm"
              onClick={(event) => {
                if (event.target === event.currentTarget && !isLeaveActionRunning) {
                  if (leaveFlowStep === 'summary') {
                    setLeaveFlowStep('choice');
                    return;
                  }
                  setShowLeaveConfirm(false);
                }
              }}
            >
              {leaveFlowStep === 'choice' ? (
                <div className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 p-5 shadow-2xl">
                  <h3 className="text-base font-semibold text-white">Leave meeting?</h3>
                  <p className="mt-1 text-sm text-gray-300">
                    You can leave immediately or review summary/download/save details first.
                  </p>

                  <div className="mt-5 flex justify-end gap-2">
                    <button
                      onClick={() => setShowLeaveConfirm(false)}
                      className="rounded bg-gray-700 px-3 py-2 text-sm text-white hover:bg-gray-600"
                    >
                      Stay
                    </button>
                    <button
                      onClick={leaveMeetingNow}
                      className="rounded bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700"
                    >
                      Direct Leave
                    </button>
                    <button
                      onClick={openLeaveSummaryStep}
                      disabled={isLeaveActionRunning}
                      className="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                      {isLeaveActionRunning ? 'Loading...' : 'Summary & Leave'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="w-full max-w-2xl rounded-xl border border-gray-700 bg-gray-900 p-5 shadow-2xl">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-white">Meeting Details Before Exit</h3>
                    <button
                      onClick={() => setLeaveFlowStep('choice')}
                      className="text-xs text-gray-300 hover:text-white"
                    >
                      Back
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-300 md:grid-cols-4">
                    <div className="rounded border border-gray-700 bg-gray-800/70 p-2">Transcriptions: {transcriptions.length}</div>
                    <div className="rounded border border-gray-700 bg-gray-800/70 p-2">AI Responses: {aiSuggestions.length}</div>
                    <div className="rounded border border-gray-700 bg-gray-800/70 p-2">Full Chat: {conversationHistory.length}</div>
                    <div className="rounded border border-gray-700 bg-gray-800/70 p-2">Summary: {summaryData?.callSummary ? 'Ready' : 'Not ready'}</div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={generateLeaveSummary}
                      disabled={isLeaveActionRunning}
                      className="rounded bg-blue-600 px-3 py-2 text-xs text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                      {isLeaveActionRunning ? 'Working...' : 'Generate / Refresh Summary'}
                    </button>
                    <button
                      onClick={() => downloadConversation(summaryData)}
                      className="rounded bg-indigo-600 px-3 py-2 text-xs text-white hover:bg-indigo-700"
                    >
                      Download All Details (JSON)
                    </button>
                    <button
                      onClick={saveLeaveSummaryToSupabase}
                      disabled={!summaryData?.callSummary || isSavingArtifacts}
                      className="rounded bg-emerald-600 px-3 py-2 text-xs text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {isSavingArtifacts ? 'Saving...' : 'Save Summary to Supabase'}
                    </button>
                    <button
                      onClick={leaveMeetingNow}
                      className="rounded bg-red-600 px-3 py-2 text-xs text-white hover:bg-red-700"
                    >
                      Leave Meeting
                    </button>
                  </div>

                  <p className="mt-3 text-[11px] text-gray-400">
                    Note: Live transcription, AI responses, and full chat are persisted during the meeting. Saving summary stores wrap-up fields to Supabase.
                  </p>
                  {isLeaveSummaryGenerated && (
                    <p className="mt-1 text-[11px] text-green-300">Summary generated for this meeting.</p>
                  )}
                  {isLeaveSummarySaved && (
                    <p className="mt-1 text-[11px] text-emerald-300">Summary saved to Supabase.</p>
                  )}

                  <div className="mt-3 max-h-32 overflow-y-auto rounded border border-gray-700 bg-gray-800/70 p-2 text-xs text-gray-100">
                    {summaryData?.callSummary || 'No summary available yet.'}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
