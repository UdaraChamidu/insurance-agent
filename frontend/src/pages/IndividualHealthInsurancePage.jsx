import { Link } from 'react-router-dom';
import Breadcrumbs from '../components/Breadcrumbs';
import PageHero from '../components/PageHero';
import Seo from '../components/Seo';
import { acaBenefits } from '../content/siteContent';
import { buildBreadcrumbSchema, buildOrganizationSchema, buildServiceSchema } from '../utils/site';

const sections = [
  {
    title: 'What this coverage path is for',
    text: 'This path is for people and families who need their own health coverage and want a clearer way to compare plan options.',
  },
  {
    title: 'How enrollment works',
    text: 'Enrollment usually happens during the annual open enrollment period or after a qualifying life event triggers a special enrollment period. Timing is one of the first things to confirm.',
  },
  {
    title: 'Who qualifies',
    text: 'Individuals and families who need personal coverage generally start here. Whether you can enroll now depends on your enrollment window, while subsidy eligibility is reviewed through the official application process.',
  },
  {
    title: 'Premium tax credits',
    text: 'Premium tax credits can reduce monthly costs for eligible households. We help explain how that concept fits into plan comparison without replacing the official determination process.',
  },
  {
    title: 'How brokers help with enrollment',
    text: 'We help compare premiums, deductibles, networks, and prescriptions so the plan choice reflects how you expect to use coverage rather than only what looks cheapest up front.',
  },
];

export default function IndividualHealthInsurancePage() {
  const breadcrumbs = [
    { label: 'Home', to: '/' },
    { label: 'Individual Marketplace Insurance', to: '/individual-health-insurance' },
  ];

  const serviceSchema = buildServiceSchema({
    name: 'ACA Marketplace Enrollment Assistance',
    path: '/individual-health-insurance',
    description:
      'ACA Marketplace insurance guidance for individuals and families, including enrollment help, premium tax credit basics, and plan comparison support.',
    serviceType: 'Individual Marketplace insurance and ACA enrollment assistance',
    audience: 'Individuals and families seeking health insurance',
  });

  return (
    <>
      <Seo
        description="ACA Marketplace insurance guidance for individuals and families, including enrollment help, premium tax credit basics, and plan comparison support."
        keywords={[
          'Obamacare Marketplace',
          'ACA health insurance',
          'Affordable Care Act insurance',
          'individual health insurance Marketplace',
        ]}
        path="/individual-health-insurance"
        structuredData={[
          buildOrganizationSchema(),
          buildBreadcrumbSchema(breadcrumbs),
          serviceSchema,
        ]}
        title="Individual Marketplace Insurance"
      />

      <Breadcrumbs items={breadcrumbs} />
      <PageHero
        eyebrow="Individual Health Coverage"
        title="Guidance for individual and family health coverage."
        description="If you need personal health coverage, this page helps you understand plan comparison, enrollment timing, provider fit, prescription questions, and what to do next."
        highlights={[
          'Built for individuals and families',
          'Enrollment timing support',
          'Plan comparison beyond premium alone',
        ]}
        actions={
          <>
            <Link className="btn-primary" to="/individual-intake">
              Enroll Now
            </Link>
            <Link className="btn-secondary" to="/schedule">
              Schedule a Meeting
            </Link>
            <Link className="btn-secondary" to="/blog/how-to-choose-the-right-aca-plan">
              Learn how to compare plans
            </Link>
          </>
        }
      />

      <section className="section-pad grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="eyebrow">Coverage Review</p>
          <h2 className="section-title mt-2">What most people need to review before choosing a plan</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {acaBenefits.map((item, index) => (
            <div key={item} className="reveal rounded-[1.5rem] border border-slate-200 bg-white px-5 py-5 text-sm leading-7 text-slate-700 shadow-[0_18px_45px_rgba(15,23,42,0.05)]" style={{ animationDelay: `${index * 100}ms` }}>
              <span
                className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold text-white number-pop"
                style={{ animationDelay: `${index * 150}ms`, background: 'var(--brand)' }}
              >
                {index + 1}
              </span>
              <p className="mt-1">{item}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section-pad">
        <div className="grid gap-6 lg:grid-cols-2">
          {sections.map((section, index) => (
            <article key={section.title} className="surface-card gradient-border reveal" style={{ animationDelay: `${index * 100}ms` }}>
              <h2 className="section-title text-2xl">{section.title}</h2>
              <p className="body-copy mt-4 text-slate-700">{section.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-pad">
        <div className="rounded-[2rem] border border-slate-200 bg-white px-6 py-10 shadow-[0_30px_80px_rgba(15,23,42,0.06)] sm:px-10">
          <p className="eyebrow">Internal Resources</p>
          <h2 className="section-title mt-2">Keep comparing before you apply.</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <Link className="rounded-[1.5rem] border border-[var(--line)] bg-[var(--panel-soft)] px-5 py-5 font-semibold text-slate-950 transition hover:border-[var(--brand-soft-strong)] hover:bg-white" to="/blog/how-the-affordable-care-act-marketplace-works">
              How the individual Marketplace works
            </Link>
            <Link className="rounded-[1.5rem] border border-[var(--line)] bg-[var(--panel-soft)] px-5 py-5 font-semibold text-slate-950 transition hover:border-[var(--brand-soft-strong)] hover:bg-white" to="/blog/who-qualifies-for-aca-health-insurance">
              Who this coverage is for
            </Link>
            <Link className="gradient-border rounded-[1.5rem] border border-[var(--line)] bg-[var(--panel-soft)] px-5 py-5 font-semibold text-slate-950 transition hover:bg-white hover:scale-[1.02]" to="/individual-intake">
              Enroll Now
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
