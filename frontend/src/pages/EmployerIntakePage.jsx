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

const initialFormData = {
  companyName: '',
  contactPerson: '',
  email: '',
  phone: '',
  numEmployees: '',
  state: 'FL',
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
      text: 'Start with the company name, state, and a few core details instead of a long intake.',
    },
    {
      icon: Users,
      title: 'Team size',
      text: 'Approximate employee count helps us understand the kind of employer case you are opening.',
    },
    {
      icon: CalendarDays,
      title: 'Timing notes',
      text: 'Share any renewal date, urgency, or current coverage concerns that matter right now.',
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
      state: formData.state,
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
          Share a few basics so you can continue to scheduling for your employer coverage request.
        </h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          This short form gives us the company and contact details we need before you choose a meeting time.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {['Employer coverage questions', 'Short first-step form', 'Scheduling opens after submission'].map((item) => (
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
                Approximate Team Size
              </label>
              <input
                className="input"
                id="numEmployees"
                min="1"
                onChange={updateField('numEmployees')}
                type="number"
                value={formData.numEmployees}
                placeholder="Example: 12"
              />
            </div>
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
        description="Use this short form for company or group coverage questions. Share a few basics, save the intake, and then continue to scheduling."
        highlights={[
          'Built for employer and group cases',
          'Short first-step form',
          'Scheduling opens after you submit',
        ]}
        layoutClassName="grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-start"
        asideClassName="border-0 bg-transparent p-0 shadow-none"
        actions={(
          <>
            <Link className="btn-primary" to="/shop-health-insurance">
              Review Group Coverage Info
            </Link>
            <Link className="btn-secondary" to="/individual-intake">
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
                  'Your company name and the best contact details to reach you.',
                  'Approximate team size if you already know it.',
                  'Any timing, renewal, or coverage questions you want us to review first.',
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
