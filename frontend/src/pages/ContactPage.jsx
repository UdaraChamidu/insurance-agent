import { Building2, ShieldCheck, Users } from 'lucide-react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import Breadcrumbs from '../components/Breadcrumbs';
import PageHero from '../components/PageHero';
import Seo from '../components/Seo';
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

const individualPreviewFields = [
  'State and preferred contact details',
  'Enrollment timing or recent coverage change',
  'Marketplace, subsidy, provider, or prescription questions',
  'Personal or family coverage only',
];

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
        description="Start with the individual intake for personal or family coverage, or use the employer intake for company benefits, renewal reviews, and group coverage questions."
        highlights={[
          'Separate paths for individuals and employers',
          'Cleaner CRM routing',
          'Less back-and-forth after submission',
        ]}
        actions={(
          <>
            <Link className="btn-primary" to={individualPath}>
              Open Individual Intake
            </Link>
            <Link className="btn-primary" to={employerPath}>
              Open Employer Intake
            </Link>
            <Link className="btn-secondary" to="/schedule">
              Schedule a Meeting
            </Link>
          </>
        )}
        aside={(
          <div>
            <p className="eyebrow">How To Choose Quickly</p>
            <div className="mt-4 space-y-3">
              {[
                'Choose individual intake if the coverage is for you, your spouse, or your family.',
                'Choose employer intake if the request is for a company, team, or employee benefits review.',
                'If you are still unsure, schedule a meeting and the case can be routed for you.',
              ].map((item) => (
                <div key={item} className="soft-panel text-sm leading-7 text-slate-700">
                  {item}
                </div>
              ))}
            </div>
          </div>
        )}
      />

      <section className="section-pad">
        <div className="grid gap-6 lg:grid-cols-2">
          <article className="surface-card gradient-border">
            <div className="flex items-start gap-4">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-[0_14px_30px_rgba(188,25,24,0.18)]"
                style={{ background: 'var(--brand)' }}
              >
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="eyebrow">Individual / Family Coverage</p>
                <h2 className="section-title mt-2">Open the individual intake for personal or family coverage.</h2>
              </div>
            </div>
            <p className="body-copy mt-4 text-slate-700">
              Choose this path if the coverage is for you or your family. It is the right fit for plan comparison, monthly cost questions, provider checks, prescription concerns, and enrollment timing.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {individualPreviewFields.map((item) => (
                <div key={item} className="soft-panel text-sm leading-7 text-slate-700">
                  {item}
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link className="btn-primary" to={individualPath}>
                Open Individual Intake
              </Link>
              <Link className="btn-secondary" to="/individual-health-insurance">
                Review Individual Coverage Guide
              </Link>
            </div>
          </article>

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
                <h2 className="section-title mt-2">Open the employer intake for group coverage cases.</h2>
              </div>
            </div>
            <p className="body-copy mt-4 text-slate-700">
              Choose this path if the request involves a company, employee benefits, renewal timing, or group coverage quotes. It keeps employer cases in the correct workflow from the beginning.
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
                Open Employer Intake
              </Link>
              <Link className="btn-secondary" to="/shop-health-insurance">
                Review Employer Coverage Guide
              </Link>
            </div>
          </article>
        </div>
      </section>

      <section className="section-pad pt-0">
        <div className="surface-card">
          <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <div>
              <p className="eyebrow">Quick Rule</p>
              <h2 className="section-title mt-2">Choose based on who needs the coverage.</h2>
              <p className="body-copy mt-4 text-slate-700">
                If the coverage is for a person or family, open the individual intake. If the
                coverage is for a company, team, or employee benefits review, open the employer
                intake. Keeping those two starts separate makes follow-up much cleaner.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="soft-panel">
                <ShieldCheck className="h-5 w-5 text-[var(--brand-dark)]" />
                <p className="mt-3 font-semibold text-slate-950">Use individual intake for:</p>
                <p className="mt-2 text-sm leading-7 text-slate-700">
                  personal or family coverage questions, comparing plan options, provider checks,
                  prescription questions, or replacing lost coverage.
                </p>
              </div>
              <div className="soft-panel">
                <Users className="h-5 w-5 text-[var(--brand-dark)]" />
                <p className="mt-3 font-semibold text-slate-950">Use employer intake for:</p>
                <p className="mt-2 text-sm leading-7 text-slate-700">
                  group quotes, benefit renewals, contribution planning, employee-count based review,
                  and business coverage questions.
                </p>
              </div>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link className="btn-primary" to={individualPath}>
              Open Individual Intake
            </Link>
            <Link className="btn-secondary" to={employerPath}>
              Open Employer Intake
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
