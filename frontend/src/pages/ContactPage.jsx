import { Building2, ShieldCheck, Users } from 'lucide-react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import Breadcrumbs from '../components/Breadcrumbs';
import ContactForm from '../components/ContactForm';
import PageHero from '../components/PageHero';
import Seo from '../components/Seo';
import { termDefinitions } from '../content/siteContent';
import {
  buildBreadcrumbSchema,
  buildContactPageSchema,
  buildOrganizationSchema,
} from '../utils/site';

function buildPath(basePath, searchParams, coverageValue = null) {
  const nextParams = new URLSearchParams(searchParams);

  if (coverageValue) {
    nextParams.set('coverage', coverageValue);
  } else {
    nextParams.delete('coverage');
  }

  const query = nextParams.toString();
  return query ? `${basePath}?${query}` : basePath;
}

const employerPreviewFields = [
  'Company name and state',
  'Total and eligible employee counts',
  'Renewal date and current carrier',
  'Benefits needed and contribution strategy',
];

export default function ContactPage() {
  const [searchParams] = useSearchParams();
  const coverage = searchParams.get('coverage');

  const individualPath = buildPath('/individual-intake', searchParams);
  const employerPath = buildPath('/employer-intake', searchParams);

  const breadcrumbs = [
    { label: 'Home', to: '/' },
    { label: 'Contact', to: '/contact' },
  ];

  if (coverage === 'shop') {
    return <Navigate replace to={employerPath} />;
  }

  if (coverage === 'aca') {
    return <Navigate replace to={individualPath} />;
  }

  return (
    <>
      <Seo
        description="Choose the right starting point for individual ACA Marketplace help or employer group health insurance intake."
        keywords={[
          'health insurance contact page',
          'individual ACA help',
          'employer group health intake',
          'choose coverage path',
        ]}
        path="/contact"
        structuredData={[
          buildOrganizationSchema(),
          buildContactPageSchema({
            description:
              'Choose the right starting point for individual ACA Marketplace help or employer group health insurance intake.',
          }),
          buildBreadcrumbSchema(breadcrumbs),
        ]}
        title="Contact"
      />

      <Breadcrumbs items={breadcrumbs} />
      <PageHero
        eyebrow="Start Here"
        title="See the forms clearly and choose the right path without guessing."
        description="ACA means Affordable Care Act Marketplace coverage for individuals and families. SHOP means Small Business Health Options Program for eligible small employers. Use the individual request form for personal coverage, and use the employer intake for group benefits, renewal reviews, and quoting."
        highlights={[
          'Separate paths for individuals and employers',
          'Cleaner CRM routing',
          'Less back-and-forth after submission',
        ]}
        actions={(
          <>
            <Link className="btn-primary" to={individualPath}>
              Enroll Now
            </Link>
            <Link className="btn-secondary" to={employerPath}>
              Start Employer Intake
            </Link>
            <Link className="btn-secondary" to="/schedule">
              Schedule a Meeting
            </Link>
          </>
        )}
        aside={(
          <div>
            <p className="eyebrow">What The Terms Mean</p>
            <div className="mt-4 space-y-3">
              {termDefinitions.map((item) => (
                <div key={item.term} className="soft-panel text-sm leading-7 text-slate-700">
                  <p className="font-display text-base font-bold text-slate-950">
                    {item.term} = {item.label}
                  </p>
                  <p className="mt-2">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      />

      <section className="section-pad grid gap-8 lg:grid-cols-[1.02fr_0.98fr]">
        <div id="individual-form" className="lg:sticky lg:top-28 pulse-glow">
          <ContactForm compact={false} initialProductType="aca" lockProductType />
        </div>

        <div className="space-y-6">
          <article className="surface-card gradient-border">
            <div className="flex items-start gap-4">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-[0_14px_30px_rgba(188,25,24,0.18)]"
                style={{ background: 'var(--brand)' }}
              >
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <p className="eyebrow">Employer / Small Business Coverage</p>
                <h2 className="section-title mt-2">See the employer intake before you start.</h2>
              </div>
            </div>
            <p className="body-copy mt-4 text-slate-700">
              If the request involves a company, employee benefits, renewal timing, or group coverage quotes, the employer intake is the right form.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {employerPreviewFields.map((item) => (
                <div key={item} className="soft-panel text-sm leading-7 text-slate-700">
                  {item}
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link className="btn-primary" to={employerPath}>
                Start Employer Intake
              </Link>
              <Link className="btn-secondary" to="/schedule">
                Schedule a Meeting
              </Link>
            </div>
          </article>

          <article className="surface-card">
            <p className="eyebrow">Why This Changed</p>
            <h2 className="section-title mt-2">The forms are separate so users do not get routed into the wrong workflow.</h2>
            <div className="mt-6 space-y-3">
              {[
                'Employer cases need more detail than a short general request form can capture.',
                'The dedicated employer intake feeds the group pipeline directly.',
                'The individual request form stays available for Affordable Care Act Marketplace support.',
              ].map((item) => (
                <div key={item} className="soft-panel text-sm leading-7 text-slate-700">
                  {item}
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="section-pad pt-0">
        <div className="surface-card">
          <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <div>
              <p className="eyebrow">Quick Rule</p>
              <h2 className="section-title mt-2">If it involves a company, use the employer intake.</h2>
              <p className="body-copy mt-4 text-slate-700">
                Employer cases usually need company details, employee counts, current carrier
                context, and renewal timing. That is why the employer path no longer uses the same
                short request form as individual ACA support.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="soft-panel">
                <Users className="h-5 w-5 text-[var(--brand-dark)]" />
                <p className="mt-3 font-semibold text-slate-950">Use employer intake for:</p>
                <p className="mt-2 text-sm leading-7 text-slate-700">
                  group quotes, benefit renewals, contribution planning, employee-count based review,
                  and business coverage questions.
                </p>
              </div>
              <div className="soft-panel">
                <ShieldCheck className="h-5 w-5 text-[var(--brand-dark)]" />
                <p className="mt-3 font-semibold text-slate-950">Use individual request form for:</p>
                <p className="mt-2 text-sm leading-7 text-slate-700">
                  ACA Marketplace questions, family coverage, subsidy-related research, or personal
                  enrollment timing after losing coverage.
                </p>
              </div>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link className="btn-primary" to={individualPath}>
              Enroll Now
            </Link>
            <Link className="btn-secondary" to={employerPath}>
              Start Employer Intake
            </Link>
            <Link className="btn-secondary" to="/schedule">
              Schedule a Meeting
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
