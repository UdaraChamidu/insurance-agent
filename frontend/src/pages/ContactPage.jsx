import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, Loader2, Send, ShieldCheck } from 'lucide-react';
import Breadcrumbs from '../components/Breadcrumbs';
import NextStepModal from '../components/NextStepModal';
import Seo from '../components/Seo';
import leadsService from '../services/leadsService';
import { getApiBaseUrl } from '../utils/network';
import {
  buildBreadcrumbSchema,
  buildContactPageSchema,
  buildOrganizationSchema,
} from '../utils/site';

const API_URL = getApiBaseUrl();

const stateOptions = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DC', 'DE', 'FL', 'GA', 'HI', 'IA', 'ID', 'IL',
  'IN', 'KS', 'KY', 'LA', 'MA', 'MD', 'ME', 'MI', 'MN', 'MO', 'MS', 'MT', 'NC', 'ND', 'NE',
  'NH', 'NJ', 'NM', 'NV', 'NY', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT',
  'VA', 'VT', 'WA', 'WI', 'WV', 'WY',
];

const benefitsOptions = [
  { value: 'medical', label: 'Medical' },
  { value: 'dental', label: 'Dental' },
  { value: 'vision', label: 'Vision' },
  { value: 'life', label: 'Life / AD&D' },
  { value: 'std', label: 'Short-Term Disability' },
  { value: 'ltd', label: 'Long-Term Disability' },
];

function toOptionalInteger(value) {
  if (value === '' || value === null || value === undefined) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/* ─── Individual Form ─── */
const individualInitial = {
  state: 'FL',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  notes: '',
};

/* ─── Employer Form ─── */
const employerInitial = {
  companyName: '',
  contactPerson: '',
  email: '',
  phone: '',
  numEmployees: '',
  numEligible: '',
  state: 'FL',
  industry: '',
  renewalDate: '',
  currentCarrier: '',
  currentPlan: '',
  contributionStrategy: '',
  benefitsNeeded: [],
  groupNotes: '',
};

export default function ContactPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Determine initial tab from query or path
  const coverageParam = searchParams.get('coverage') || searchParams.get('tab');
  const initialTab = coverageParam === 'employer' || coverageParam === 'shop' ? 'employer' : 'individual';
  const [activeTab, setActiveTab] = useState(initialTab);

  // Individual state
  const [indForm, setIndForm] = useState(individualInitial);
  const [indLoading, setIndLoading] = useState(false);
  const [indError, setIndError] = useState('');
  const [indSuccess, setIndSuccess] = useState('');

  // Employer state
  const [empForm, setEmpForm] = useState(employerInitial);
  const [empLoading, setEmpLoading] = useState(false);
  const [empError, setEmpError] = useState('');
  const [empSuccess, setEmpSuccess] = useState(null);

  useEffect(() => {
    if (coverageParam === 'employer' || coverageParam === 'shop') {
      setActiveTab('employer');
    } else if (coverageParam === 'aca' || coverageParam === 'individual') {
      setActiveTab('individual');
    }
  }, [coverageParam]);

  const breadcrumbs = [
    { label: 'Home', to: '/' },
    { label: 'Contact', to: '/contact' },
  ];

  /* ─── Individual submit ─── */
  async function handleIndividualSubmit(e) {
    e.preventDefault();
    setIndError('');
    setIndLoading(true);

    const params = new URLSearchParams(window.location.search);
    const payload = {
      productType: 'aca',
      state: indForm.state,
      firstName: indForm.firstName.trim(),
      lastName: indForm.lastName.trim(),
      email: indForm.email.trim(),
      phone: indForm.phone.trim(),
      triggers: ['aca_enrollment_help'],
      utmSource: params.get('utm_source') || undefined,
      utmMedium: params.get('utm_medium') || undefined,
      utmCampaign: params.get('utm_campaign') || undefined,
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

      if (indForm.notes.trim()) {
        await fetch(`${API_URL}/api/leads/${data.leadId}/session`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: indForm.notes.trim() }),
        }).catch(() => null);
      }

      setIndForm(individualInitial);
      setIndSuccess(data.leadId);
    } catch (err) {
      setIndError(err.message || 'Unable to submit your request right now.');
    } finally {
      setIndLoading(false);
    }
  }

  /* ─── Employer submit ─── */
  async function handleEmployerSubmit(e) {
    e.preventDefault();
    setEmpError('');
    setEmpLoading(true);

    const payload = {
      companyName: empForm.companyName.trim(),
      contactPerson: empForm.contactPerson.trim() || undefined,
      email: empForm.email.trim() || undefined,
      phone: empForm.phone.trim() || undefined,
      numEmployees: toOptionalInteger(empForm.numEmployees),
      numEligible: toOptionalInteger(empForm.numEligible),
      state: empForm.state,
      industry: empForm.industry.trim() || undefined,
      renewalDate: empForm.renewalDate || undefined,
      currentCarrier: empForm.currentCarrier.trim() || undefined,
      currentPlan: empForm.currentPlan.trim() || undefined,
      contributionStrategy: empForm.contributionStrategy || undefined,
      benefitsNeeded: empForm.benefitsNeeded.length > 0 ? empForm.benefitsNeeded : undefined,
      groupNotes: empForm.groupNotes.trim() || undefined,
      utmSource: searchParams.get('utm_source') || undefined,
      utmMedium: searchParams.get('utm_medium') || undefined,
      utmCampaign: searchParams.get('utm_campaign') || undefined,
    };

    try {
      const response = await leadsService.createEmployerLead(payload);
      if (!response?.success || !response?.leadId) {
        throw new Error('We could not create the employer intake right now.');
      }
      localStorage.setItem('currentLeadId', response.leadId);
      setEmpForm(employerInitial);
      setEmpSuccess({
        id: response.leadId,
        companyName: response.companyName || payload.companyName,
      });
    } catch (err) {
      setEmpError(err.message || 'Unable to submit the employer intake right now.');
    } finally {
      setEmpLoading(false);
    }
  }

  const updateInd = (field) => (e) => setIndForm((c) => ({ ...c, [field]: e.target.value }));
  const updateEmp = (field) => (e) => setEmpForm((c) => ({ ...c, [field]: e.target.value }));

  return (
    <>
      <Seo
        description="Fill out the individual or employer intake form to get started with your health coverage review."
        keywords={[
          'health insurance intake',
          'individual ACA help',
          'employer group health intake',
          'insurance contact form',
        ]}
        path="/contact"
        structuredData={[
          buildOrganizationSchema(),
          buildContactPageSchema({
            description: 'Fill out the individual or employer intake form to get started with your health coverage review.',
          }),
          buildBreadcrumbSchema(breadcrumbs),
        ]}
        title="Contact"
      />

      <Breadcrumbs items={breadcrumbs} />

      {/* ═══ FORMS AT THE TOP ═══ */}
      <section className="section-pad pb-0 pt-1">
        <div className="mx-auto max-w-8xl">
          {/* Heading */}
          <div className="mb-6 text-center">
            <p className="eyebrow">Start Here</p>
            <h1 className="font-display mt-2 text-3xl font-bold text-slate-950 sm:text-4xl">
              Choose your coverage type and fill out the form.
            </h1>
            <p className="body-copy mx-auto mt-3 max-w-2xl text-slate-600">
              Select individual for personal or family coverage, or employer for group insurance, renewals, and business coverage questions.
            </p>
          </div>

          {/* Tab switcher */}
          <div className="mb-6 flex items-center justify-center gap-2">
            <button
              onClick={() => setActiveTab('individual')}
              className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-all ${
                activeTab === 'individual'
                  ? 'bg-[var(--brand)] text-white shadow-lg shadow-red-200'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-[var(--brand)] hover:text-[var(--brand-dark)]'
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
              Individual / Family
            </button>
            <button
              onClick={() => setActiveTab('employer')}
              className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-all ${
                activeTab === 'employer'
                  ? 'bg-[var(--brand)] text-white shadow-lg shadow-red-200'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-[var(--brand)] hover:text-[var(--brand-dark)]'
              }`}
            >
              <Building2 className="h-4 w-4" />
              Employer / Group
            </button>
          </div>

          {/* ─── INDIVIDUAL FORM ─── */}
          {activeTab === 'individual' && (
            <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
              <form className="surface-card" onSubmit={handleIndividualSubmit}>
                <div className="accent-panel">
                  <p className="eyebrow">Individual / Family Intake</p>
                  <h2 className="font-display text-2xl font-bold text-slate-950">
                    Share your details for personal or family coverage help.
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    Fill this out and our team will follow up directly. After submission you can continue to schedule a meeting.
                  </p>
                </div>

                <div className="mt-8 grid gap-6">
                  <div>
                    <p className="label mb-3">Coverage details</p>
                    <div>
                      <label className="label" htmlFor="ind-state">State</label>
                      <select className="input" id="ind-state" onChange={updateInd('state')} value={indForm.state}>
                        {stateOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <p className="label mb-3">Your contact details</p>
                    <div className="grid gap-5 md:grid-cols-2">
                      <div>
                        <label className="label" htmlFor="ind-firstName">First Name</label>
                        <input className="input" id="ind-firstName" onChange={updateInd('firstName')} required type="text" value={indForm.firstName} />
                      </div>
                      <div>
                        <label className="label" htmlFor="ind-lastName">Last Name</label>
                        <input className="input" id="ind-lastName" onChange={updateInd('lastName')} required type="text" value={indForm.lastName} />
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <div>
                      <label className="label" htmlFor="ind-email">Email</label>
                      <input className="input" id="ind-email" onChange={updateInd('email')} required type="email" value={indForm.email} />
                    </div>
                    <div>
                      <label className="label" htmlFor="ind-phone">Phone</label>
                      <input className="input" id="ind-phone" onChange={updateInd('phone')} type="tel" value={indForm.phone} />
                    </div>
                  </div>

                  <div>
                    <label className="label" htmlFor="ind-notes">What kind of help do you need?</label>
                    <textarea
                      className="input min-h-[120px] resize-y"
                      id="ind-notes"
                      onChange={updateInd('notes')}
                      placeholder="Tell us about your coverage question, timing, current coverage, or anything helpful."
                      value={indForm.notes}
                    />
                  </div>

                  {indError && (
                    <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{indError}</p>
                  )}

                  <button className="btn-primary w-full justify-center" disabled={indLoading} type="submit">
                    {indLoading ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Sending information
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <Send className="h-4 w-4" /> Send My Information
                      </span>
                    )}
                  </button>
                </div>
              </form>

              {/* Side info */}
              <div className="space-y-4 lg:sticky lg:top-28">
                <div className="soft-panel">
                  <p className="font-semibold text-slate-950">Best use for this form</p>
                  <p className="mt-2 text-sm leading-7 text-slate-700">
                    Personal or family coverage, plan comparison, monthly cost questions, provider checks, prescription concerns, or enrollment timing.
                  </p>
                </div>
                <div className="soft-panel">
                  <p className="font-semibold text-slate-950">What happens next</p>
                  <p className="mt-2 text-sm leading-7 text-slate-700">
                    After you submit, you can continue to schedule a meeting time. Our team reviews your information and follows up directly.
                  </p>
                </div>
                <div className="surface-card">
                  <p className="eyebrow">Have these basics ready</p>
                  <div className="mt-4 space-y-2">
                    {[
                      'Your state and preferred contact information.',
                      'Any recent life event affecting enrollment timing.',
                      'Questions about subsidies, provider access, or plan comparison.',
                    ].map((item) => (
                      <div key={item} className="soft-panel text-sm leading-7 text-slate-700">{item}</div>
                    ))}
                  </div>
                </div>
                <div className="soft-panel">
                  <p className="font-semibold text-slate-950">Need employer coverage instead?</p>
                  <p className="mt-2 text-sm leading-7 text-slate-700">
                    Switch to the <button onClick={() => setActiveTab('employer')} className="font-semibold text-[var(--brand-dark)] hover:underline">Employer / Group</button> tab above if this request is for a company or team.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ─── EMPLOYER FORM ─── */}
          {activeTab === 'employer' && (
            <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
              <form className="surface-card" onSubmit={handleEmployerSubmit}>
                <div className="accent-panel">
                  <p className="eyebrow">Employer / Group Intake</p>
                  <h2 className="font-display text-2xl font-bold text-slate-950">
                    Complete your employer intake so we can prepare coverage options.
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    This form captures the company, coverage, and contact details we need to start quoting your group case.
                  </p>
                </div>

                <div className="mt-8 grid gap-6">
                  {/* Company details */}
                  <div>
                    <p className="label mb-3">Company details</p>
                    <div className="grid gap-5 md:grid-cols-2">
                      <div className="md:col-span-2">
                        <label className="label" htmlFor="emp-companyName">Company Name</label>
                        <input className="input" id="emp-companyName" onChange={updateEmp('companyName')} required type="text" value={empForm.companyName} />
                      </div>
                      <div>
                        <label className="label" htmlFor="emp-state">State</label>
                        <select className="input" id="emp-state" onChange={updateEmp('state')} required value={empForm.state}>
                          {stateOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="label" htmlFor="emp-numEmployees">Total Employees</label>
                        <input className="input" id="emp-numEmployees" min="1" onChange={updateEmp('numEmployees')} type="number" value={empForm.numEmployees} placeholder="Example: 25" />
                      </div>
                      <div>
                        <label className="label" htmlFor="emp-numEligible">Eligible Employees</label>
                        <input className="input" id="emp-numEligible" min="1" onChange={updateEmp('numEligible')} type="number" value={empForm.numEligible} placeholder="Example: 18" />
                      </div>
                      <div>
                        <label className="label" htmlFor="emp-industry">Industry</label>
                        <input className="input" id="emp-industry" onChange={updateEmp('industry')} type="text" value={empForm.industry} placeholder="e.g. Construction, Restaurant, Technology" />
                      </div>
                    </div>
                  </div>

                  {/* Current coverage */}
                  <div>
                    <p className="label mb-3">Current coverage</p>
                    <div className="grid gap-5 md:grid-cols-2">
                      <div>
                        <label className="label" htmlFor="emp-currentCarrier">Current Carrier</label>
                        <input className="input" id="emp-currentCarrier" onChange={updateEmp('currentCarrier')} type="text" value={empForm.currentCarrier} placeholder="e.g. Blue Cross, Aetna" />
                      </div>
                      <div>
                        <label className="label" htmlFor="emp-currentPlan">Current Plan Name</label>
                        <input className="input" id="emp-currentPlan" onChange={updateEmp('currentPlan')} type="text" value={empForm.currentPlan} placeholder="e.g. PPO Gold 500" />
                      </div>
                      <div>
                        <label className="label" htmlFor="emp-renewalDate">Renewal Date</label>
                        <input className="input" id="emp-renewalDate" onChange={updateEmp('renewalDate')} type="date" value={empForm.renewalDate} />
                      </div>
                      <div>
                        <label className="label" htmlFor="emp-contributionStrategy">Contribution Strategy</label>
                        <select className="input" id="emp-contributionStrategy" onChange={updateEmp('contributionStrategy')} value={empForm.contributionStrategy}>
                          <option value="">Select...</option>
                          <option value="percentage">Percentage of Premium</option>
                          <option value="fixed_dollar">Fixed Dollar Amount</option>
                          <option value="defined_contribution">Defined Contribution</option>
                          <option value="salary_based">Salary-Based</option>
                          <option value="unsure">Not Sure Yet</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Benefits needed */}
                  <div>
                    <p className="label mb-3">Benefits needed</p>
                    <div className="flex flex-wrap gap-3">
                      {benefitsOptions.map((opt) => (
                        <label
                          key={opt.value}
                          className={`cursor-pointer rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                            empForm.benefitsNeeded.includes(opt.value)
                              ? 'border-red-600 bg-red-50 text-red-700'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={empForm.benefitsNeeded.includes(opt.value)}
                            onChange={(ev) => {
                              setEmpForm((c) => ({
                                ...c,
                                benefitsNeeded: ev.target.checked
                                  ? [...c.benefitsNeeded, opt.value]
                                  : c.benefitsNeeded.filter((v) => v !== opt.value),
                              }));
                            }}
                          />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Primary contact */}
                  <div>
                    <p className="label mb-3">Primary contact</p>
                    <div className="grid gap-5 md:grid-cols-2">
                      <div className="md:col-span-2">
                        <label className="label" htmlFor="emp-contactPerson">Your Name</label>
                        <input className="input" id="emp-contactPerson" onChange={updateEmp('contactPerson')} placeholder="Full name or main benefits contact" required type="text" value={empForm.contactPerson} />
                      </div>
                      <div>
                        <label className="label" htmlFor="emp-email">Email</label>
                        <input className="input" id="emp-email" onChange={updateEmp('email')} required type="email" value={empForm.email} />
                      </div>
                      <div>
                        <label className="label" htmlFor="emp-phone">Phone</label>
                        <input className="input" id="emp-phone" onChange={updateEmp('phone')} type="tel" value={empForm.phone} />
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="label" htmlFor="emp-groupNotes">What do you need help with?</label>
                    <textarea
                      className="input min-h-[120px] resize-y"
                      id="emp-groupNotes"
                      onChange={updateEmp('groupNotes')}
                      placeholder="Tell us about your coverage question, timing, renewal concerns, or anything helpful."
                      value={empForm.groupNotes}
                    />
                  </div>

                  {empError && (
                    <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{empError}</p>
                  )}

                  <button className="btn-primary w-full justify-center" disabled={empLoading} type="submit">
                    {empLoading ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Sending employer request
                      </span>
                    ) : (
                      'Send Employer Request'
                    )}
                  </button>
                </div>
              </form>

              {/* Side info */}
              <div className="space-y-4 lg:sticky lg:top-28">
                <div className="soft-panel">
                  <p className="font-semibold text-slate-950">Best use for this form</p>
                  <p className="mt-2 text-sm leading-7 text-slate-700">
                    Group quotes, benefit renewals, contribution planning, employee-count reviews, and business coverage questions.
                  </p>
                </div>
                <div className="soft-panel">
                  <p className="font-semibold text-slate-950">What happens next</p>
                  <p className="mt-2 text-sm leading-7 text-slate-700">
                    After you submit, you can continue to schedule a meeting time. We review your company details and prepare coverage options.
                  </p>
                </div>
                <div className="surface-card">
                  <p className="eyebrow">What to have ready</p>
                  <div className="mt-4 space-y-2">
                    {[
                      'Company name, state, industry, and team size.',
                      'Current carrier, plan name, and renewal date if you have them.',
                      'Your contribution approach and which benefits you need.',
                    ].map((item) => (
                      <div key={item} className="soft-panel text-sm leading-7 text-slate-700">{item}</div>
                    ))}
                  </div>
                </div>
                <div className="soft-panel">
                  <p className="font-semibold text-slate-950">Need individual coverage instead?</p>
                  <p className="mt-2 text-sm leading-7 text-slate-700">
                    Switch to the <button onClick={() => setActiveTab('individual')} className="font-semibold text-[var(--brand-dark)] hover:underline">Individual / Family</button> tab above if this is for personal coverage.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Quick rule section */}
      <section className="section-pad">
        <div className="mx-auto max-w-5xl">
          <div className="surface-card">
            <div className="grid gap-6 lg:grid-cols-2 lg:items-center">
              <div>
                <p className="eyebrow">Quick Rule</p>
                <h2 className="section-title mt-2">Choose based on who needs the coverage.</h2>
                <p className="body-copy mt-4 text-slate-700">
                  If the coverage is for a person or family, use the individual form. If the
                  coverage is for a company, team, or employee benefits review, use the employer form.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="soft-panel">
                  <ShieldCheck className="h-5 w-5 text-[var(--brand-dark)]" />
                  <p className="mt-3 font-semibold text-slate-950">Individual intake for:</p>
                  <p className="mt-2 text-sm leading-7 text-slate-700">
                    Personal or family coverage questions, plan comparison, provider checks,
                    prescription questions, or replacing lost coverage.
                  </p>
                </div>
                <div className="soft-panel">
                  <Building2 className="h-5 w-5 text-[var(--brand-dark)]" />
                  <p className="mt-3 font-semibold text-slate-950">Employer intake for:</p>
                  <p className="mt-2 text-sm leading-7 text-slate-700">
                    Group quotes, benefit renewals, contribution planning, employee-count reviews,
                    and business coverage questions.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Success modals */}
      <NextStepModal
        description="Your request was submitted successfully. Continue to scheduling to choose a meeting time."
        onClose={() => setIndSuccess('')}
        onPrimary={() => navigate('/schedule')}
        onSecondary={() => setIndSuccess('')}
        open={Boolean(indSuccess)}
        primaryLabel="Continue to Scheduling"
        referenceId={indSuccess}
        secondaryLabel="Stay on This Page"
        title="Your information is ready."
      />
      <NextStepModal
        description="Your employer intake was submitted successfully. Continue to scheduling to choose a meeting time."
        eyebrow="Employer Intake Saved"
        onClose={() => setEmpSuccess(null)}
        onPrimary={() => navigate('/schedule')}
        onSecondary={() => setEmpSuccess(null)}
        open={Boolean(empSuccess)}
        primaryLabel="Continue to Scheduling"
        referenceId={empSuccess?.id}
        secondaryLabel="Stay on This Page"
        title={empSuccess?.companyName ? `${empSuccess.companyName} is ready.` : 'Your employer request is ready.'}
      />
    </>
  );
}
