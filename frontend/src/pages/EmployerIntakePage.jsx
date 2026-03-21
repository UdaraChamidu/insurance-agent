import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, CalendarDays, Loader2, ShieldCheck, Users } from 'lucide-react';
import Breadcrumbs from '../components/Breadcrumbs';
import NextStepModal from '../components/NextStepModal';
import PageHero from '../components/PageHero';
import Seo from '../components/Seo';
import leadsService from '../services/leadsService';
import {
  buildBreadcrumbSchema,
  buildContactPageSchema,
  buildOrganizationSchema,
} from '../utils/site';

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

const initialFormData = {
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

function toOptionalInteger(value) {
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export default function EmployerIntakePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [formData, setFormData] = useState(initialFormData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successLead, setSuccessLead] = useState(null);

  const breadcrumbs = [
    { label: 'Home', to: '/' },
    { label: 'Employer Intake', to: '/employer-intake' },
  ];
  const employerSupportCards = [
    {
      icon: Building2,
      title: 'Company basics',
      text: 'Company name, state, industry, team size, and eligible employees to start your case.',
    },
    {
      icon: Users,
      title: 'Team size',
      text: 'Approximate employee count helps us understand the kind of employer case you are opening.',
    },
    {
      icon: CalendarDays,
      title: 'Timing notes',
      text: 'Current carrier, renewal date, and contribution strategy help us prepare options sooner.',
    },
    {
      icon: ShieldCheck,
      title: 'Clear next step',
      text: 'After you submit the form, you can continue directly into scheduling and choose a meeting time.',
    },
  ];

  const updateField = (field) => (event) => {
    setFormData((current) => ({ ...current, [field]: event.target.value }));
  };

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);

    const payload = {
      companyName: formData.companyName.trim(),
      contactPerson: formData.contactPerson.trim() || undefined,
      email: formData.email.trim() || undefined,
      phone: formData.phone.trim() || undefined,
      numEmployees: toOptionalInteger(formData.numEmployees),
      numEligible: toOptionalInteger(formData.numEligible),
      state: formData.state,
      industry: formData.industry.trim() || undefined,
      renewalDate: formData.renewalDate || undefined,
      currentCarrier: formData.currentCarrier.trim() || undefined,
      currentPlan: formData.currentPlan.trim() || undefined,
      contributionStrategy: formData.contributionStrategy || undefined,
      benefitsNeeded: formData.benefitsNeeded.length > 0 ? formData.benefitsNeeded : undefined,
      groupNotes: formData.groupNotes.trim() || undefined,
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
      setFormData(initialFormData);
      setSuccessLead({
        id: response.leadId,
        companyName: response.companyName || payload.companyName,
      });
    } catch (submitError) {
      setError(submitError.message || 'Unable to submit the employer intake right now.');
    } finally {
      setLoading(false);
    }
  }

  const employerForm = (
    <form className="surface-card" onSubmit={handleSubmit}>
      <div className="accent-panel">
        <p className="eyebrow">Employer Details</p>
        <h2 className="font-display text-2xl font-bold text-slate-950">
          Complete your employer intake so we can prepare coverage options.
        </h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          This form captures the company, coverage, and contact details we need to start quoting your group case.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {['Employer coverage questions', 'Full employer intake', 'Scheduling opens after submission'].map((item) => (
            <span key={item} className="chip-pill">
              {item}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-6">
        <div>
          <p className="label mb-3">Company details</p>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="label" htmlFor="companyName">
                Company Name
              </label>
              <input
                className="input"
                id="companyName"
                onChange={updateField('companyName')}
                required
                type="text"
                value={formData.companyName}
              />
            </div>
            <div>
              <label className="label" htmlFor="state">
                State
              </label>
              <select
                className="input"
                id="state"
                onChange={updateField('state')}
                required
                value={formData.state}
              >
                {stateOptions.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="numEmployees">
                Total Employees
              </label>
              <input
                className="input"
                id="numEmployees"
                min="1"
                onChange={updateField('numEmployees')}
                type="number"
                value={formData.numEmployees}
                placeholder="Example: 25"
              />
            </div>
            <div>
              <label className="label" htmlFor="numEligible">
                Eligible Employees
              </label>
              <input
                className="input"
                id="numEligible"
                min="1"
                onChange={updateField('numEligible')}
                type="number"
                value={formData.numEligible}
                placeholder="Example: 18"
              />
            </div>
            <div>
              <label className="label" htmlFor="industry">
                Industry
              </label>
              <input
                className="input"
                id="industry"
                onChange={updateField('industry')}
                type="text"
                value={formData.industry}
                placeholder="e.g. Construction, Restaurant, Technology"
              />
            </div>
          </div>
        </div>

        <div>
          <p className="label mb-3">Current coverage</p>
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="label" htmlFor="currentCarrier">
                Current Carrier
              </label>
              <input
                className="input"
                id="currentCarrier"
                onChange={updateField('currentCarrier')}
                type="text"
                value={formData.currentCarrier}
                placeholder="e.g. Blue Cross, Aetna, UnitedHealthcare"
              />
            </div>
            <div>
              <label className="label" htmlFor="currentPlan">
                Current Plan Name
              </label>
              <input
                className="input"
                id="currentPlan"
                onChange={updateField('currentPlan')}
                type="text"
                value={formData.currentPlan}
                placeholder="e.g. PPO Gold 500"
              />
            </div>
            <div>
              <label className="label" htmlFor="renewalDate">
                Renewal Date
              </label>
              <input
                className="input"
                id="renewalDate"
                onChange={updateField('renewalDate')}
                type="date"
                value={formData.renewalDate}
              />
            </div>
            <div>
              <label className="label" htmlFor="contributionStrategy">
                Contribution Strategy
              </label>
              <select
                className="input"
                id="contributionStrategy"
                onChange={updateField('contributionStrategy')}
                value={formData.contributionStrategy}
              >
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

        <div>
          <p className="label mb-3">Benefits needed</p>
          <div className="flex flex-wrap gap-3">
            {benefitsOptions.map((opt) => (
              <label
                key={opt.value}
                className={`cursor-pointer rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                  formData.benefitsNeeded.includes(opt.value)
                    ? 'border-red-600 bg-red-50 text-red-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={formData.benefitsNeeded.includes(opt.value)}
                  onChange={(e) => {
                    setFormData((current) => ({
                      ...current,
                      benefitsNeeded: e.target.checked
                        ? [...current.benefitsNeeded, opt.value]
                        : current.benefitsNeeded.filter((v) => v !== opt.value),
                    }));
                  }}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        <div>
          <p className="label mb-3">Primary contact</p>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="label" htmlFor="contactPerson">
                Your Name
              </label>
              <input
                className="input"
                id="contactPerson"
                onChange={updateField('contactPerson')}
                placeholder="Full name or main benefits contact"
                required
                type="text"
                value={formData.contactPerson}
              />
            </div>
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
        </div>

        <div>
          <label className="label" htmlFor="groupNotes">
            What do you need help with?
          </label>
          <textarea
            className="input min-h-[150px] resize-y"
            id="groupNotes"
            onChange={updateField('groupNotes')}
            placeholder="Tell us about your coverage question, timing, renewal concerns, or anything helpful before we contact you."
            value={formData.groupNotes}
          />
        </div>

        {error ? (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        <div className="space-y-3">
          <button
            className="btn-primary w-full justify-center"
            disabled={loading}
            type="submit"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending employer request
              </span>
            ) : (
              'Send Employer Request'
            )}
          </button>
          <p className="text-sm leading-7 text-slate-500">
            After submission, we will show the next step so you can continue into scheduling.
          </p>
        </div>
      </div>
    </form>
  );

  return (
    <>
      <Seo
        description="Submit a short employer intake form for group health coverage questions, then continue to scheduling."
        keywords={[
          'employer intake form',
          'group health insurance review',
          'small business benefits intake',
          'employee census preparation',
        ]}
        path="/employer-intake"
        structuredData={[
            buildOrganizationSchema(),
              buildContactPageSchema({
                path: '/employer-intake',
                title: 'Employer Intake',
                description: 'Submit a short employer intake form for group health coverage questions, then continue to scheduling.',
              }),
            buildBreadcrumbSchema(breadcrumbs),
          ]}
        title="Employer Intake"
      />

      <Breadcrumbs items={breadcrumbs} />
      <PageHero
        eyebrow="Employer Intake"
        title="Start your group health insurance review with the employer details that matter."
        description="Complete this form for group coverage. Share your company details, current coverage, and benefits needed so we can start quoting."
        highlights={[
          'Built for employer and group cases',
          'Full employer intake with all key fields',
          'Scheduling opens after you submit',
        ]}
        layoutClassName="grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-start"
        asideClassName="border-0 bg-transparent p-0 shadow-none"
        actions={(
          <>
            <Link className="btn-primary" to="/shop-health-insurance">
              Review Group Coverage Info
            </Link>
            <Link className="btn-secondary" to="/contact?tab=individual">
              Need Personal Coverage Instead?
            </Link>
          </>
        )}
        children={(
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="surface-card sm:col-span-2">
              <p className="eyebrow">What To Have Ready</p>
              <h2 className="section-title mt-2">Bring the basics and we can start from there.</h2>
              <div className="mt-6 space-y-3">
                {[
                  'Company name, state, industry, and team size.',
                  'Current carrier, plan name, and renewal date if you have them.',
                  'Your contribution approach and which benefits you need (medical, dental, vision, etc.).',
                ].map((item) => (
                  <div key={item} className="soft-panel text-sm leading-7 text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="soft-panel">
              <p className="font-semibold text-slate-950">What happens next</p>
              <p className="mt-2 text-sm leading-7 text-slate-700">
                Once the intake is saved, you can continue to scheduling and pick a time for the employer review.
              </p>
            </div>
            <div className="soft-panel">
              <p className="font-semibold text-slate-950">Why this form exists</p>
              <p className="mt-2 text-sm leading-7 text-slate-700">
                This intake stays separate from the individual path so employer and business
                requests start in the right workflow from the beginning.
              </p>
            </div>
          </div>
        )}
        aside={employerForm}
      />
      <section className="section-pad pt-0">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {employerSupportCards.map((item) => (
            <article key={item.title} className="surface-card h-full">
              <div
                className="icon-float flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-[0_14px_30px_rgba(188,25,24,0.2)]"
                style={{ background: 'var(--brand)' }}
              >
                <item.icon className="h-5 w-5" />
              </div>
              <h2 className="section-title mt-5 text-2xl">{item.title}</h2>
              <p className="body-copy mt-3 text-slate-700">{item.text}</p>
            </article>
          ))}
        </div>
      </section>
      <NextStepModal
        description="Your employer intake was submitted successfully. Continue to scheduling to choose a meeting time."
        eyebrow="Employer Intake Saved"
        onClose={() => setSuccessLead(null)}
        onPrimary={() => navigate('/schedule')}
        onSecondary={() => setSuccessLead(null)}
        open={Boolean(successLead)}
        primaryLabel="Continue to Scheduling"
        referenceId={successLead?.id}
        secondaryLabel="Stay on This Page"
        title={successLead?.companyName ? `${successLead.companyName} is ready.` : 'Your employer request is ready.'}
      />
    </>
  );
}
