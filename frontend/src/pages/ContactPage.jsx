import { Building2, ShieldCheck, Users } from 'lucide-react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import Breadcrumbs from '../components/Breadcrumbs';
import ContactForm from '../components/ContactForm';
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

export default function ContactPage() {
  const [searchParams] = useSearchParams();
  const coverage = searchParams.get('coverage');

  const individualPath = buildPath('/contact', searchParams, 'aca');
  const employerPath = buildPath('/employer-intake', searchParams);

  const breadcrumbs = [
    { label: 'Home', to: '/' },
    { label: 'Contact', to: '/contact' },
  ];

  if (coverage === 'shop') {
    return <Navigate replace to={employerPath} />;
  }

  if (coverage === 'aca') {
    return (
      <>
        <Seo
          description="Request ACA Marketplace guidance for individual or family health coverage and continue into scheduling when ready."
          keywords={[
            'ACA Marketplace help',
            'individual health insurance broker',
            'ACA enrollment assistance',
          ]}
          path="/contact"
          structuredData={[
            buildOrganizationSchema(),
            buildContactPageSchema({
              description:
                'Request ACA Marketplace guidance for individual or family health coverage and continue into scheduling when ready.',
            }),
            buildBreadcrumbSchema(breadcrumbs),
          ]}
          title="Contact"
        />

        <Breadcrumbs items={breadcrumbs} />
        <PageHero
          eyebrow="Individual Contact"
          title="Request ACA Marketplace help for individual or family coverage."
          description="Use the short request form for personal coverage questions. If you are reviewing benefits for a company or employer group, switch to the employer intake so the case starts in the right workflow."
          highlights={[
            'Individual and family coverage only',
            'Short request form',
            'Ready for scheduling after submission',
          ]}
          aside={(
            <div>
              <p className="eyebrow">Need Employer Help Instead?</p>
              <div className="mt-4 space-y-3">
                {[
                  'Employer and group cases use a separate intake with company details, employee counts, and renewal timing.',
                  'That intake creates the CRM case directly in the group pipeline.',
                  'Use the employer intake if you are gathering quotes for a business.',
                ].map((item) => (
                  <div key={item} className="soft-panel text-sm leading-7 text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
              <div className="mt-5">
                <Link className="btn-secondary" to={employerPath}>
                  Open Employer Intake
                </Link>
              </div>
            </div>
          )}
        />

        <section className="section-pad grid gap-8 lg:grid-cols-[0.82fr_1.18fr]">
          <div className="surface-card">
            <p className="eyebrow">Before You Submit</p>
            <h2 className="section-title mt-2">The information that helps most</h2>
            <div className="mt-6 space-y-4">
              {[
                'Your state and preferred contact information.',
                'Any recent life event affecting enrollment timing, such as losing coverage.',
                'Questions about subsidies, provider access, prescriptions, or plan comparison.',
              ].map((item, index) => (
                <div
                  key={item}
                  className="soft-panel text-sm leading-7 text-slate-700 reveal"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  {item}
                </div>
              ))}
            </div>
            <p className="body-copy mt-6 text-slate-700">
              If you want to keep researching before you submit, use the service page for{' '}
              <Link className="link-accent" to="/individual-health-insurance">individual Marketplace insurance</Link>{' '}
              or review the <Link className="link-accent" to="/faq">FAQ page</Link>.
            </p>
          </div>
          <div className="lg:sticky lg:top-28 pulse-glow rounded-[2rem]">
            <ContactForm compact={false} initialProductType="aca" lockProductType />
          </div>
        </section>
      </>
    );
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
        title="Choose the right path before you submit anything."
        description="Individual and employer requests now follow different workflows. Use the individual request form for personal or family coverage, and use the employer intake for group benefits, renewal reviews, and quoting."
        highlights={[
          'Separate paths for individuals and employers',
          'Cleaner CRM routing',
          'Less back-and-forth after submission',
        ]}
        aside={(
          <div>
            <p className="eyebrow">Why This Changed</p>
            <div className="mt-4 space-y-3">
              {[
                'Employer cases need more detail than a short general request form can capture.',
                'The dedicated employer intake feeds the group pipeline directly.',
                'The individual request form stays available for ACA Marketplace support.',
              ].map((item) => (
                <div key={item} className="soft-panel text-sm leading-7 text-slate-700">
                  {item}
                </div>
              ))}
            </div>
          </div>
        )}
      />

      <section className="section-pad grid gap-6 lg:grid-cols-2">
        {[
          {
            title: 'Individual / Family Coverage',
            description:
              'Use the short request form if you need ACA Marketplace help for yourself or your family.',
            icon: ShieldCheck,
            bullets: [
              'Best for personal or family health coverage',
              'Shorter request form',
              'Continues into scheduling after submission',
            ],
            actionLabel: 'Open Individual Request Form',
            actionTo: individualPath,
          },
          {
            title: 'Employer / Group Coverage',
            description:
              'Use the dedicated employer intake if you are reviewing group benefits, renewal timing, or requesting quotes for a company.',
            icon: Building2,
            bullets: [
              'Captures company and employee details',
              'Built for employer and group workflow',
              'Creates the case directly in the CRM pipeline',
            ],
            actionLabel: 'Open Employer Intake',
            actionTo: employerPath,
          },
        ].map((item, index) => (
          <article
            key={item.title}
            className="surface-card gradient-border reveal"
            style={{ animationDelay: `${index * 120}ms` }}
          >
            <div className="icon-float flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-sky-500 text-white shadow-[0_14px_30px_rgba(37,99,235,0.24)]">
              <item.icon className="h-5 w-5" />
            </div>
            <h2 className="section-title mt-5 text-2xl">{item.title}</h2>
            <p className="body-copy mt-3 text-slate-700">{item.description}</p>
            <div className="mt-6 space-y-3 text-sm leading-7 text-slate-700">
              {item.bullets.map((bullet) => (
                <div key={bullet} className="soft-panel">
                  {bullet}
                </div>
              ))}
            </div>
            <div className="mt-6">
              <Link className="btn-primary" to={item.actionTo}>
                {item.actionLabel}
              </Link>
            </div>
          </article>
        ))}
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
                <Users className="h-5 w-5 text-blue-700" />
                <p className="mt-3 font-semibold text-slate-950">Use employer intake for:</p>
                <p className="mt-2 text-sm leading-7 text-slate-700">
                  group quotes, benefit renewals, contribution planning, employee-count based review,
                  and business coverage questions.
                </p>
              </div>
              <div className="soft-panel">
                <ShieldCheck className="h-5 w-5 text-blue-700" />
                <p className="mt-3 font-semibold text-slate-950">Use individual request form for:</p>
                <p className="mt-2 text-sm leading-7 text-slate-700">
                  ACA Marketplace questions, family coverage, subsidy-related research, or personal
                  enrollment timing after losing coverage.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
