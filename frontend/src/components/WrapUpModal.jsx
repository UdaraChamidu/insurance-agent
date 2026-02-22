import React, { useEffect, useState } from 'react';
import { X, Save, Loader, Sparkles } from 'lucide-react';
import { getApiBaseUrl } from '../utils/network';

const API_URL = getApiBaseUrl();

const defaultFormData = {
  disposition: 'interested',
  notes: '',
  planName: '',
  premium: '',
  callSummary: '',
  complianceFlags: null,
  actionItems: null
};

export default function WrapUpModal({ isOpen, onClose, leadId, onSave, initialSummary }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(defaultFormData);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleEsc = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    setFormData((prev) => ({
      ...defaultFormData,
      disposition: prev.disposition || 'interested',
      notes: prev.notes || '',
      planName: prev.planName || '',
      premium: prev.premium || '',
      callSummary: initialSummary?.callSummary || prev.callSummary || '',
      complianceFlags: initialSummary?.complianceFlags || prev.complianceFlags || null,
      actionItems: initialSummary?.actionItems || prev.actionItems || null
    }));
  }, [isOpen, initialSummary]);

  useEffect(() => {
    if (!isOpen || !leadId) return;

    const loadPersistedArtifacts = async () => {
      try {
        const res = await fetch(`${API_URL}/api/leads/${leadId}/meeting-artifacts`);
        if (!res.ok) return;

        const payload = await res.json();
        if (!payload?.success || !payload.summary) return;

        setFormData((prev) => ({
          ...prev,
          callSummary: prev.callSummary || payload.summary.callSummary || '',
          complianceFlags: prev.complianceFlags || payload.summary.complianceFlags || null,
          actionItems: prev.actionItems || payload.summary.actionItems || null
        }));
      } catch (err) {
        console.error('Error loading persisted meeting artifacts:', err);
      }
    };

    loadPersistedArtifacts();
  }, [isOpen, leadId]);

  const handleRegenerateSummary = async () => {
    if (!leadId) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/leads/${leadId}/generate-summary`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data?.success && data?.data) {
        setFormData((prev) => ({
          ...prev,
          callSummary: data.data.callSummary || '',
          complianceFlags: data.data.complianceFlags || null,
          actionItems: data.data.actionItems || null
        }));
      }
    } catch (err) {
      console.error('Summary regenerate error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!leadId) {
      alert('Lead context missing. Cannot save wrap-up.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/leads/${leadId}/wrapup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        onSave(formData);
        onClose();
        alert('Wrap-up saved successfully.');
      } else {
        alert('Failed to save wrap-up.');
      }
    } catch (error) {
      console.error('Wrap-up error:', error);
      alert('Error saving wrap-up.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-700 overflow-hidden animate-fadeIn">
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Post-Call Wrap Up</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Call Outcome</label>
            <select
              value={formData.disposition}
              onChange={(e) => setFormData({ ...formData, disposition: e.target.value })}
              className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="booked">Application Submitted (Won)</option>
              <option value="quoted">Quoted (Pipeline)</option>
              <option value="interested">Interested / Follow Up</option>
              <option value="not_interested">Not Interested</option>
              <option value="bad_number">Bad Number / Spam</option>
            </select>
          </div>

          {(formData.disposition === 'booked' || formData.disposition === 'quoted') && (
            <div className="grid grid-cols-2 gap-4 animate-fadeIn">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Plan Name</label>
                <input
                  type="text"
                  placeholder="e.g. Aetna Silver"
                  value={formData.planName}
                  onChange={(e) => setFormData({ ...formData, planName: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Monthly Premium</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={formData.premium}
                    onChange={(e) => setFormData({ ...formData, premium: e.target.value })}
                    className="w-full pl-7 p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Agent Notes</label>
            <textarea
              rows="4"
              placeholder="Summarize the conversation..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-500" /> AI Call Summary
              </h3>
              <button
                type="button"
                onClick={handleRegenerateSummary}
                className="text-xs text-blue-600 hover:underline"
              >
                Regenerate
              </button>
            </div>

            {formData.callSummary ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase">Summary</label>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{formData.callSummary}</p>
                </div>

                {Array.isArray(formData.actionItems) && formData.actionItems.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase">Action Items</label>
                    <div className="text-xs text-gray-700 dark:text-gray-300 space-y-1">
                      {formData.actionItems.map((item, idx) => (
                        <div key={`${idx}-${item}`}>- {item}</div>
                      ))}
                    </div>
                  </div>
                )}

                {formData.complianceFlags && (
                  <div className="grid grid-cols-1 gap-2">
                    <div className={`p-2 rounded text-xs border ${formData.complianceFlags.disclaimerRead ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                      {formData.complianceFlags.disclaimerRead ? 'Disclaimer read' : 'Disclaimer missed'}
                    </div>
                    <div className={`p-2 rounded text-xs border ${!formData.complianceFlags.forbiddenTopics ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                      {!formData.complianceFlags.forbiddenTopics ? 'No forbidden topics' : 'Forbidden topic detected'}
                    </div>
                    {formData.complianceFlags.notes && (
                      <div className="text-xs text-gray-600 dark:text-gray-400">{formData.complianceFlags.notes}</div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500 text-xs">Click "Regenerate" to fetch AI summary.</div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {loading ? <Loader className="animate-spin w-4 h-4" /> : <><Save className="w-4 h-4" /> Save & Close call</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
