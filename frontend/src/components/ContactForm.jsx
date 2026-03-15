import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2, Send } from 'lucide-react';
import { getApiBaseUrl } from '../utils/network';

const API_URL = getApiBaseUrl();

const coverageOptions = [
  { value: 'aca', label: 'Individual ACA Marketplace' },
  { value: 'shop', label: 'SHOP Small Business Coverage' },
];

const stateOptions = [
  'AL', 'AZ', 'CA', 'CO', 'FL', 'GA', 'IL', 'NC', 'NJ', 'NY', 'OH', 'PA', 'SC', 'TN', 'TX', 'VA',
];

export default function ContactForm({ initialProductType = 'aca', compact = false }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    productType: initialProductType,
    state: 'FL',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successLeadId, setSuccessLeadId] = useState('');

  const formGuidance =
    formData.productType === 'shop'
      ? ['Small business review', 'SHOP-focused routing', 'Scheduling available after submission']
      : ['Individual Marketplace help', 'ACA-focused routing', 'Scheduling available after submission'];

  useEffect(() => {
    if (initialProductType) {
      setFormData((current) => ({ ...current, productType: initialProductType }));
    }
  }, [initialProductType]);

  const updateField = (field) => (event) => {
    setFormData((current) => ({ ...current, [field]: event.target.value }));
  };

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);

    const params = new URLSearchParams(location.search);
    const payload = {
      productType: formData.productType,
      state: formData.state,
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      triggers:
        formData.productType === 'shop'
          ? ['shop_quote_request']
          : ['aca_enrollment_help'],
      utmSource: params.get('utm_source') || undefined,
      utmMedium: params.get('utm_medium') || undefined,
      utmCampaign: params.get('utm_campaign') || undefined,
      utmTerm: params.get('utm_term') || undefined,
      utmContent: params.get('utm_content') || undefined,
    };

    try {
      const response = await fetch(`${API_URL}/api/leads/intake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success || !data.leadId) {
        throw new Error(data.detail || 'We could not submit your request. Please try again.');
      }

      localStorage.setItem('currentLeadId', data.leadId);

      if (formData.notes.trim()) {
        await fetch(`${API_URL}/api/leads/${data.leadId}/session`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            notes: formData.notes.trim(),
          }),
        }).catch(() => null);
      }

      setSuccessLeadId(data.leadId);
      setFormData((current) => ({
        ...current,
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        notes: '',
      }));
    } catch (submitError) {
      setError(submitError.message || 'Unable to submit your request right now.');
    } finally {
      setLoading(false);
    }
  }

  if (successLeadId) {
    return (
      <div className="surface-card">
        <div className="soft-panel">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-sky-500 text-white shadow-[0_14px_30px_rgba(37,99,235,0.2)]">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="eyebrow">Request Received</p>
              <h3 className="section-title mt-2 text-2xl">Your request is in the system.</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Reference ID: <span className="font-semibold text-slate-950">{successLeadId}</span>
              </p>
            </div>
          </div>
        </div>
        <p className="body-copy mt-6">
          We saved your information and prepared the next step. If you want to continue now, you
          can move into scheduling.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            className="btn-primary"
            onClick={() => navigate('/schedule')}
            type="button"
          >
            Continue to Scheduling
          </button>
          <Link className="btn-secondary" to="/faq">
            Review FAQs
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form className="surface-card" onSubmit={handleSubmit}>
      <div className="rounded-[1.75rem] border border-blue-100 bg-blue-50/70 px-5 py-5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.75)]">
        <p className="eyebrow">Request Form</p>
        <h3 className="font-display text-2xl font-bold text-slate-950">
          Start with a few basics so we can route your request correctly.
        </h3>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          Choose the coverage type, share the best contact details, and add any timing or enrollment
          notes that will help us understand your situation.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {formGuidance.map((item) => (
            <span key={item} className="chip-pill">
              {item}
            </span>
          ))}
        </div>
      </div>

      <div className={compact ? 'mt-6 grid gap-5' : 'mt-8 grid gap-6'}>
        <div>
          <p className="label mb-3">Coverage details</p>
          <div className="grid gap-5 md:grid-cols-[1.1fr_0.9fr]">
            <div>
              <label className="label" htmlFor="productType">
                Coverage Type
              </label>
              <select
                className="input"
                id="productType"
                onChange={updateField('productType')}
                required
                value={formData.productType}
              >
                {coverageOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="state">
                State
              </label>
              <select className="input" id="state" onChange={updateField('state')} value={formData.state}>
                {stateOptions.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div>
          <p className="label mb-3">Your contact details</p>
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="label" htmlFor="firstName">
                First Name
              </label>
              <input
                className="input"
                id="firstName"
                onChange={updateField('firstName')}
                required
                type="text"
                value={formData.firstName}
              />
            </div>
            <div>
              <label className="label" htmlFor="lastName">
                Last Name
              </label>
              <input
                className="input"
                id="lastName"
                onChange={updateField('lastName')}
                required
                type="text"
                value={formData.lastName}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              className="input"
              id="email"
              onChange={updateField('email')}
              required
              type="email"
              value={formData.email}
            />
          </div>
          <div>
            <label className="label" htmlFor="phone">
              Phone
            </label>
            <input
              className="input"
              id="phone"
              onChange={updateField('phone')}
              type="tel"
              value={formData.phone}
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="notes">
            What kind of help do you need?
          </label>
          <textarea
            className="input min-h-[140px] resize-y"
            id="notes"
            onChange={updateField('notes')}
            placeholder="Tell us whether you need ACA Marketplace enrollment help, SHOP plan guidance, or both."
            value={formData.notes}
          />
        </div>

        {error ? (
          <p aria-live="polite" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        <div className="space-y-3">
          <button className="btn-primary w-full justify-center" disabled={loading} type="submit">
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending request
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <Send className="h-4 w-4" />
                Request ACA or SHOP Help
              </span>
            )}
          </button>
          <p className="text-sm leading-7 text-slate-500">
            After submission, you can continue directly into scheduling if you are ready for the next step.
          </p>
        </div>
      </div>
    </form>
  );
}
