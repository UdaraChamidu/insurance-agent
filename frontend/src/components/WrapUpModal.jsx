import React, { useState } from 'react';
import { X, Save, Loader } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function WrapUpModal({ isOpen, onClose, leadId, onSave }) {
  if (!isOpen) return null;

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    disposition: 'interested',
    notes: '',
    planName: '',
    premium: ''
  });

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
              className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 resize-none"
            />
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
