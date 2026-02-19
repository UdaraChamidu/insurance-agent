import React, { useState } from 'react';
import { X, Save, Loader, Sparkles } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function WrapUpModal({ isOpen, onClose, leadId, onSave }) {
  if (!isOpen) return null;

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    disposition: 'interested',
    notes: '',
    planName: '',
    premium: '',
    // New Fields
    callSummary: '',
    complianceFlags: null,
    actionItems: null
  });

  // Pre-fill data if available (e.g. from AI summary generation)
  // In a real app, we might fetch this from the API if leadId is passed
  // For now, we'll assume it might be passed via props or we fetch it on mount
  React.useEffect(() => {
      if(isOpen && leadId) {
          fetch(`${API_URL}/api/leads/${leadId}`)
            .then(res => res.json())
            .then(data => {
                // If the backend has recent session data with summary
                // We would need an endpoint to get the SESSION details, not just lead
                // For now, let's assume get_lead_session returns this if we update the endpoint
            })
            .catch(err => console.error(err));
            
          // Better: Check for a "latest session" endpoint or just trust the user to fill/AI to fill
          // Let's implement a quick fetch for session details
          fetch(`${API_URL}/api/leads/${leadId}`)
             .then(res => res.json())
             .then(data => {
                 // Check if session has summary
             });
      }
  }, [isOpen, leadId]);

  // Actually, MeetingPage should probably pass the summary data if it just generated it
  // But to be safe, let's add a "Load AI Summary" button or just let it be manual for now if not passed


  const handleSubmit = async (e) => {
    e.preventDefault();
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
        alert('Wrap-up saved successfully!');
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-700 overflow-hidden animate-fadeIn">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Post-Call Wrap Up</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {/* Disposition */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Call Outcome</label>
            <select
              value={formData.disposition}
              onChange={e => setFormData({...formData, disposition: e.target.value})}
              className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="booked">✅ Application Submitted (Won)</option>
              <option value="quoted">📝 Quoted (Pipeline)</option>
              <option value="interested">🤔 Interested / Follow Up</option>
              <option value="not_interested">❌ Not Interested</option>
              <option value="bad_number">⚠️ Bad Number / Spam</option>
            </select>
          </div>

          {/* Plan Details (Conditional) */}
          {(formData.disposition === 'booked' || formData.disposition === 'quoted') && (
            <div className="grid grid-cols-2 gap-4 animate-fadeIn">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Plan Name</label>
                <input
                  type="text"
                  placeholder="e.g. Aetna Silver"
                  value={formData.planName}
                  onChange={e => setFormData({...formData, planName: e.target.value})}
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
                    onChange={e => setFormData({...formData, premium: e.target.value})}
                    className="w-full pl-7 p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Agent Notes</label>
            <textarea
              rows="4"
              placeholder="Summarize the conversation..."
              value={formData.notes}
              onChange={e => setFormData({...formData, notes: e.target.value})}
            />
          </div>

          {/* AI Summary Section */}
          <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-500" /> AI Call Summary
                  </h3>
                   <button 
                      type="button"
                      onClick={() => {
                          setLoading(true);
                          fetch(`${API_URL}/api/leads/${leadId}/generate-summary`, { method: 'POST' })
                            .then(res => res.json())
                            .then(data => {
                                setLoading(false);
                                if(data.success && data.data) {
                                    setFormData(prev => ({
                                        ...prev,
                                        callSummary: data.data.callSummary,
                                        complianceFlags: data.data.complianceFlags,
                                        actionItems: data.data.actionItems
                                    }));
                                }
                            })
                            .catch(() => setLoading(false));
                      }}
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
                      
                      {formData.complianceFlags && (
                          <div className="grid grid-cols-2 gap-2">
                              <div className={`p-2 rounded text-xs border ${formData.complianceFlags.disclaimerRead ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                                  {formData.complianceFlags.disclaimerRead ? '✅ Disclaimer Read' : '❌ Disclaimer Missed'}
                              </div>
                              <div className={`p-2 rounded text-xs border ${!formData.complianceFlags.forbiddenTopics ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                                  {!formData.complianceFlags.forbiddenTopics ? '✅ No Forbidden Topics' : '⚠️ Forbidden Topic Detected'}
                              </div>
                          </div>
                      )}
                  </div>
              ) : (
                  <div className="text-center py-4 text-gray-500 text-xs">
                      Click "Regenerate" to fetch AI summary...
                  </div>
              )}
          </div>

          {/* Actions */}
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
