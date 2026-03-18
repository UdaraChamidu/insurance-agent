import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, CalendarDays, CheckCircle2, Loader2, ShieldCheck, Users } from 'lucide-react';
import Breadcrumbs from '../components/Breadcrumbs';
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

const benefitOptions = [
  'medical',
  'dental',
  'vision',
  'life',
  'disability',
  'supplemental',
];

const initialFormData = {
  companyName: '',
  contactPerson: '',
  firstName: '',
  lastName: '',
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
  benefitsNeeded: ['medical'],
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

  const updateField = (field) => (event) => {
    setFormData((current) => ({ ...current, [field]: event.target.value }));
  };

  const toggleBenefit = (benefit) => {
    setFormData((current) => {
      const nextBenefits = current.benefitsNeeded.includes(benefit)
        ? current.benefitsNeeded.filter((item) => item !== benefit)
        : [...current.benefitsNeeded, benefit];

      return {
        ...current,
        benefitsNeeded: nextBenefits,
      };
    });
  };

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);

    const normalizedContactPerson = formData.contactPerson.trim()
      || `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim();

    const payload = {
      companyName: formData.companyName.trim(),
      contactPerson: normalizedContactPerson || undefined,
      firstName: formData.firstName.trim() || undefined,
      lastName: formData.lastName.trim() || undefined,
      email: formData.email.trim() || undefined,
      phone: formData.phone.trim() || undefined,
      numEmployees: toOptionalInteger(formData.numEmployees),
      numEligible: toOptionalInteger(formData.numEligible),
      state: formData.state,
      industry: formData.industry.trim() || undefined,
      renewalDate: formData.renewalDate || undefined,
      currentCarrier: formData.currentCarrier.trim() || undefined,
      currentPlan: formData.currentPlan.trim() || undefined,
      contributionStrategy: formData.contributionStrategy.trim() || undefined,
      benefitsNeeded: formData.benefitsNeeded,
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
      setSuccessLead({
        id: response.leadId,
        companyName: response.companyName || payload.companyName,
      });
      setFormData(initialFormData);
    } catch (submitError) {
      setError(submitError.message || 'Unable to submit the employer intake right now.');
    } finally {
      setLoading(false);
    }
  }

  if (successLead) {
    return (
      <>
        <Seo
          description="Submit your employer group health insurance intake and move directly into the next step."
          keywords={[
            'employer health insurance intake',
            'group health insurance intake',
            'small business employee benefits intake',
          ]}
          path="/employer-intake"
          structuredData={[
            buildOrganizationSchema(),
            buildContactPageSchema({
              path: '/employer-intake',
              title: 'Employer Intake',
              description: 'Submit your employer group health insurance intake and move directly into the next step.',
            }),
            buildBreadcrumbSchema(breadcrumbs),
          ]}
          title="Employer Intake"
        />

        <Breadcrumbs items={breadcrumbs} />
        <section className="section-pad">
          <div className="surface-card max-w-3xl">
            <div className="soft-panel">
              <div className="flex items-start gap-3">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-[0_14px_30px_rgba(188,25,24,0.18)]"
                  style={{ background: 'var(--brand)' }}
                >
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="eyebrow">Employer Intake Received</p>
                  <h1 className="section-title mt-2 text-2xl">Your group case is now in the CRM.</h1>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    Company: <span className="font-semibold text-slate-950">{successLead.companyName}</span>
                  </p>
                  <p className="mt-1 text-sm leading-7 text-slate-600">
                    Reference ID: <span className="font-semibold text-slate-950">{successLead.id}</span>
                  </p>
                </div>
              </div>
            </div>

            <p className="body-copy mt-6 text-slate-700">
              The employer lead has been created and saved under the new group pipeline. You can
              move into census collection now, continue into scheduling, or return to the site and
              come back later.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                className="btn-primary"
                onClick={() => navigate('/schedule')}
                type="button"
              >
                Continue to Scheduling
              </button>
              <Link className="btn-secondary" to={`/employer-census?leadId=${successLead.id}`}>
                Census Template &amp; Upload
              </Link>
              <Link className="btn-secondary" to="/shop-health-insurance">
                Review Group Coverage Info
              </Link>
            </div>
          </div>
        </section>
      </>
    );
  }

  const employerForm = (
    <form className="surface-card" onSubmit={handleSubmit}>
      <div className="accent-panel">
        <p className="eyebrow">Employer Details</p>
        <h2 className="font-display text-2xl font-bold text-slate-950">
          Open a group case with the information needed for the first review.
        </h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          Complete the fields you have now. The key goal is to capture enough context to start
          the employer workflow cleanly and avoid re-entering details later.
        </p>
      </div>

      <div className="mt-8 grid gap-6">
        <div>
          <p className="label mb-3">Company details</p>
          <div className="grid gap-5 md:grid-cols-2">
            {/* <div className="md:col-span-2">
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
            </div> */}
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
              <label className="label" htmlFor="industry">
                Industry / SIC Code
              </label>
              <input
                className="input"
                id="industry"
                onChange={updateField('industry')}
                placeholder="Construction, hospitality, retail, SIC code, etc."
                type="text"
                value={formData.industry}
              />
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
                required
                type="number"
                value={formData.numEmployees}
              />
            </div>
            <div>
              <label className="label" htmlFor="numEligible">
                Eligible Employees
              </label>
              <input
                className="input"
                id="numEligible"
                min="0"
                onChange={updateField('numEligible')}
                type="number"
                value={formData.numEligible}
              />
            </div>
          </div>
        </div>

        <div>
          <p className="label mb-3">Primary contact</p>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="label" htmlFor="contactPerson">
                Contact Person
              </label>
              <input
                className="input"
                id="contactPerson"
                onChange={updateField('contactPerson')}
                placeholder="Full name or main benefits contact"
                type="text"
                value={formData.contactPerson}
              />
            </div>
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
          <p className="label mb-3">Current benefits context</p>
          <div className="grid gap-5 md:grid-cols-2">
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
              <label className="label" htmlFor="currentCarrier">
                Current Carrier
              </label>
              <input
                className="input"
                id="currentCarrier"
                onChange={updateField('currentCarrier')}
                placeholder="Current medical carrier"
                type="text"
                value={formData.currentCarrier}
              />
            </div>
            <div className="md:col-span-2">
              <label className="label" htmlFor="currentPlan">
                Current Plan Name
              </label>
              <input
                className="input"
                id="currentPlan"
                onChange={updateField('currentPlan')}
                placeholder="Plan name, funding type, or current setup"
                type="text"
                value={formData.currentPlan}
              />
            </div>
            <div className="md:col-span-2">
              <label className="label" htmlFor="contributionStrategy">
                Contribution Strategy
              </label>
              <textarea
                className="input min-h-[120px] resize-y"
                id="contributionStrategy"
                onChange={updateField('contributionStrategy')}
                placeholder="Example: employer pays 70% of employee-only medical, employees cover dependents."
                value={formData.contributionStrategy}
              />
            </div>
          </div>
        </div>

        <div>
          <p className="label mb-3">Benefits needed</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {benefitOptions.map((benefit) => {
              const isSelected = formData.benefitsNeeded.includes(benefit);
              const label = benefit.charAt(0).toUpperCase() + benefit.slice(1);

              return (
                <button
                  key={benefit}
                  aria-pressed={isSelected}
                  className={`rounded-[1.25rem] border px-4 py-4 text-left text-sm font-medium transition ${
                    isSelected
                      ? 'border-[var(--brand-soft-strong)] bg-[var(--panel-soft)] text-[var(--brand-dark)]'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-[var(--brand-soft-strong)] hover:bg-[var(--panel-soft)]'
                  }`}
                  onClick={() => toggleBenefit(benefit)}
                  type="button"
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="groupNotes">
            Notes
          </label>
          <textarea
            className="input min-h-[160px] resize-y"
            id="groupNotes"
            onChange={updateField('groupNotes')}
            placeholder="Anything helpful before the discovery call: current pain points, timing, benefits issues, participation concerns, or quote goals."
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
                Saving employer intake
              </span>
            ) : (
              'Submit Employer Intake'
            )}
          </button>
          <p className="text-sm leading-7 text-slate-500">
            After submission, the employer record is created in the CRM and can continue
            directly into scheduling.
          </p>
        </div>
      </div>
    </form>
  );

  return (
    <>
      <Seo
        description="Submit employer details for a group health insurance review, including employee counts, renewal timing, and benefit needs."
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
            description: 'Submit employer details for a group health insurance review, including employee counts, renewal timing, and benefit needs.',
          }),
          buildBreadcrumbSchema(breadcrumbs),
        ]}
        title="Employer Intake"
      />

      <Breadcrumbs items={breadcrumbs} />
      <PageHero
        eyebrow="Employer Intake"
        title="Start your group health insurance review with the employer details that matter."
        description="Share the core company, contact, and renewal information here so we can open the case correctly, route it into the group CRM, and move into the next step without back-and-forth."
        highlights={[
          'Built for employer and group cases',
          'Creates the CRM record automatically',
          'Ready for scheduling after submission',
        ]}
        layoutClassName="grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-start"
        asideClassName="border-0 bg-transparent p-0 shadow-none"
        actions={(
          <>
            <Link className="btn-primary" to="/schedule">
              Schedule a Meeting
            </Link>
            <Link className="btn-secondary" to="/employer-census">
              View Census Upload
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
                  'Basic company details and your best contact information.',
                  'Approximate employee counts and current coverage context.',
                  'Renewal timing and the benefits you want reviewed.',
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
                The group case is created in the CRM, stays in the employer workflow, and can move
                forward into census collection or scheduling without re-entry.
              </p>
            </div>
            <div className="soft-panel">
              <p className="font-semibold text-slate-950">Why this form exists</p>
              <p className="mt-2 text-sm leading-7 text-slate-700">
                This intake is separate from the individual flow so employer requests can start with
                the right pipeline stages, renewal context, and group-specific notes.
              </p>
            </div>
            <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
              {[
                {
                  icon: Building2,
                  title: 'Company profile',
                  text: 'Capture the employer name, state, industry, and basic team size before quoting starts.',
                },
                {
                  icon: Users,
                  title: 'Benefits scope',
                  text: 'Identify whether the case involves medical, dental, vision, life, disability, or mixed benefits.',
                },
                {
                  icon: CalendarDays,
                  title: 'Renewal timing',
                  text: 'Log the current carrier and renewal date now so follow-up can happen on the right timeline.',
                },
                {
                  icon: ShieldCheck,
                  title: 'Next-step ready',
                  text: 'Once submitted, the lead is saved to the group CRM and can move directly into scheduling.',
                },
              ].map((item) => (
                <article key={item.title} className="soft-panel gradient-border">
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
          </div>
        )}
        aside={employerForm}
      />
    </>
  );
}
