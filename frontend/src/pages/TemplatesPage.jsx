import React, { useState, useEffect, useCallback } from 'react';
import {
  Mail, MessageSquare, Plus, Edit3, Trash2, Save, X, Send,
  ChevronDown, ChevronUp, Zap, RefreshCw, AlertCircle, Check
} from 'lucide-react';
import {
  listTemplates, createTemplate, updateTemplate, deleteTemplate,
  seedDefaultTemplates
} from '../services/templatesService';

const GROUP_STAGES = [
  { value: '', label: 'No auto-trigger' },
  { value: 'new_lead', label: 'New Lead' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'discovery_scheduled', label: 'Discovery Scheduled' },
  { value: 'census_requested', label: 'Census Requested' },
  { value: 'census_received', label: 'Census Received' },
  { value: 'sent_to_warner', label: 'Sent to Warner' },
  { value: 'quotes_received', label: 'Quotes Received' },
  { value: 'proposal_presented', label: 'Proposal Presented' },
  { value: 'closed_won', label: 'Closed Won' },
  { value: 'closed_lost', label: 'Closed Lost' },
  { value: 'renewal_followup', label: 'Renewal Follow-up' },
];

const AVAILABLE_VARIABLES = [
  'company_name', 'contact_name', 'first_name', 'last_name',
  'email', 'phone', 'state', 'num_employees', 'num_eligible',
  'industry', 'renewal_date', 'current_carrier', 'current_plan',
  'contribution_strategy', 'pipeline_status',
  'schedule_link', 'census_link', 'contact_link',
];

const EMPTY_TEMPLATE = {
  name: '',
  type: 'email',
  subject: '',
  body: '',
  variables: [],
  triggerStage: '',
  isActive: true,
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_TEMPLATE });
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listTemplates();
      setTemplates(data.templates || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleSeed = async () => {
    try {
      setSaving(true);
      const result = await seedDefaultTemplates();
      showSuccess(`Seeded ${result.created?.length || 0} templates (${result.skipped?.length || 0} already existed)`);
      await fetchTemplates();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = () => {
    setCreating(true);
    setEditingId(null);
    setForm({ ...EMPTY_TEMPLATE });
  };

  const handleEdit = (t) => {
    setCreating(false);
    setEditingId(t.id);
    setForm({
      name: t.name || '',
      type: t.type || 'email',
      subject: t.subject || '',
      body: t.body || '',
      variables: t.variables || [],
      triggerStage: t.triggerStage || '',
      isActive: t.isActive !== false,
    });
  };

  const handleCancel = () => {
    setCreating(false);
    setEditingId(null);
    setForm({ ...EMPTY_TEMPLATE });
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.body.trim()) {
      setError('Name and body are required');
      return;
    }
    try {
      setSaving(true);
      setError(null);
      const payload = {
        ...form,
        triggerStage: form.triggerStage || null,
        variables: form.variables.length ? form.variables : null,
      };
      if (creating) {
        await createTemplate(payload);
        showSuccess(`Template "${form.name}" created`);
      } else {
        await updateTemplate(editingId, payload);
        showSuccess(`Template "${form.name}" updated`);
      }
      handleCancel();
      await fetchTemplates();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete template "${name}"?`)) return;
    try {
      await deleteTemplate(id);
      showSuccess(`Template "${name}" deleted`);
      if (editingId === id) handleCancel();
      await fetchTemplates();
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleVariable = (varName) => {
    setForm((prev) => {
      const vars = prev.variables.includes(varName)
        ? prev.variables.filter((v) => v !== varName)
        : [...prev.variables, varName];
      return { ...prev, variables: vars };
    });
  };

  const insertVariable = (varName) => {
    setForm((prev) => ({
      ...prev,
      body: prev.body + `{{${varName}}}`,
    }));
  };

  const isEditing = creating || editingId;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Message Templates</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Email and SMS templates for your group insurance workflow
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSeed}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border border-gray-300 dark:border-white/10 text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" />
            Seed Defaults
          </button>
          <button
            onClick={handleCreate}
            disabled={!!isEditing}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            New Template
          </button>
        </div>
      </div>

      {/* Success / Error */}
      {successMsg && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-sm border border-green-200 dark:border-green-800">
          <Check className="h-4 w-4 shrink-0" /> {successMsg}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm border border-red-200 dark:border-red-800">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          <button onClick={() => setError(null)} className="ml-auto"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Editor Panel */}
      {isEditing && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {creating ? 'Create New Template' : 'Edit Template'}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Template Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., First Outreach"
              />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Auto-Trigger Stage</label>
                <select
                  value={form.triggerStage}
                  onChange={(e) => setForm({ ...form, triggerStage: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  {GROUP_STAGES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {form.type === 'email' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject Line</label>
              <input
                type="text"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Group Health Insurance Options for {{company_name}}"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Message Body
            </label>
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              rows={8}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              placeholder="Write your template here. Use {{variable_name}} for dynamic content."
            />
          </div>

          {/* Variable chips - click to insert */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Insert Variable (click to add to body)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {AVAILABLE_VARIABLES.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => insertVariable(v)}
                  className="px-2.5 py-1 text-xs font-mono rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                >
                  {`{{${v}}}`}
                </button>
              ))}
            </div>
          </div>

          {/* Active toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Active</span>
          </label>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save Template'}
            </button>
            <button
              onClick={handleCancel}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-xl border border-gray-300 dark:border-white/10 text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Templates List */}
      {loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading templates...</div>
      ) : templates.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-white/10">
          <Mail className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No templates yet</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Click "Seed Defaults" to load the 6 workflow templates, or create your own.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => {
            const isExpanded = expandedId === t.id;
            return (
              <div
                key={t.id}
                className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm overflow-hidden"
              >
                {/* Row header */}
                <div
                  className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-750 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : t.id)}
                >
                  <div className={`shrink-0 h-9 w-9 rounded-lg flex items-center justify-center ${
                    t.type === 'email'
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                      : 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                  }`}>
                    {t.type === 'email' ? <Mail className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900 dark:text-white truncate">{t.name}</h3>
                      {!t.isActive && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium uppercase rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-gray-500 dark:text-gray-400 uppercase">{t.type}</span>
                      {t.triggerStage && (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                          <Zap className="h-3 w-3" />
                          {GROUP_STAGES.find((s) => s.value === t.triggerStage)?.label || t.triggerStage}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleEdit(t); }}
                      className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                      title="Edit"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(t.id, t.name); }}
                      className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                  </div>
                </div>

                {/* Expanded body */}
                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-gray-100 dark:border-white/5 pt-4 space-y-3">
                    {t.subject && (
                      <div>
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Subject</span>
                        <p className="text-sm text-gray-800 dark:text-gray-200 mt-0.5">{t.subject}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Body</span>
                      <pre className="mt-1 text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-sans bg-gray-50 dark:bg-slate-900/50 rounded-lg p-3 border border-gray-100 dark:border-white/5">
                        {t.body}
                      </pre>
                    </div>
                    {t.variables && t.variables.length > 0 && (
                      <div>
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Variables</span>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {t.variables.map((v) => (
                            <span key={v} className="px-2 py-0.5 text-xs font-mono rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                              {`{{${v}}}`}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
