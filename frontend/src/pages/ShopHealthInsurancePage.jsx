import { Link } from 'react-router-dom';
import Breadcrumbs from '../components/Breadcrumbs';
import PageHero from '../components/PageHero';
import Seo from '../components/Seo';
import { shopBenefits } from '../content/siteContent';
import { buildBreadcrumbSchema, buildOrganizationSchema, buildServiceSchema } from '../utils/site';

const sections = [
  {
    title: 'Employer coverage review',
    text: 'Many employer cases start before plan comparison. The first job is to understand company size, current setup, renewal timing, contribution goals, and what the business is actually trying to fix or improve.',
  },
  {
    title: 'Where SHOP fits',
    text: 'SHOP can still be part of the conversation for eligible small employers, but it is not the only lens. The broader goal is to find the most practical group strategy for the business, not force every employer into one path.',
  },
  {
    title: 'Benefits strategy',
    text: 'A strong employer benefits review looks at employee counts, participation expectations, contribution structure, provider access, plan usability, and the timing around renewals or new offerings.',
  },
  {
    title: 'Tax credit opportunities',
    text: 'Small business tax credits may still matter for some employers, and that should be part of the planning conversation early. It can change how the business evaluates cost and whether SHOP deserves a closer review.',
  },
  {
    title: 'Why use a broker',
    text: 'A broker helps turn scattered information into a structured decision. That includes comparing plan value, contribution structure, participation expectations, provider access, and the next operational steps.',
  },
  {
    title: 'Next-step workflow',
    text: 'We help employers gather the right intake details, move into quoting or discovery cleanly, and keep the case moving with less confusion and fewer avoidable mistakes.',
  },
];

export default function ShopHealthInsurancePage() {
  const breadcrumbs = [
    { label: 'Home', to: '/' },
    { label: 'SHOP Health Insurance', to: '/shop-health-insurance' },
  ];

  const serviceSchema = buildServiceSchema({
    name: 'Employer Health Insurance and Benefits Guidance',
    path: '/shop-health-insurance',
    description:
      'Detailed guidance on employer group health insurance, benefits review, renewal planning, tax-credit context, and broker-led next steps.',
    serviceType: 'Employer group health insurance and benefits guidance',
    audience: 'Employers, owners, and operations leaders reviewing employee benefits',
  });

  return (
    <>
      <Seo
        description="Detailed guidance on employer group health insurance, benefits review, renewal planning, tax-credit context, and broker-led next steps."
        keywords={[
          'group health insurance for employers',
          'employee benefits review',
          'small business health insurance',
          'benefits renewal planning',
        ]}
        path="/shop-health-insurance"
        structuredData={[
          buildOrganizationSchema(),
          buildBreadcrumbSchema(breadcrumbs),
          serviceSchema,
        ]}
        title="Employer Health Insurance Guidance"
      />

      <Breadcrumbs items={breadcrumbs} />
      <PageHero
        eyebrow="Employer Health Insurance"
        title="Employer health insurance guidance built for group coverage, renewals, and next-step clarity."
        description="If you are evaluating health insurance for a business, the first step is not just quoting. We help employers organize the intake details, think through contribution strategy, review whether the Small Business Health Options Program (SHOP) is relevant, and move toward the right group coverage path."
        highlights={[
          'Employer and group coverage review',
          'Renewal and contribution context',
          'SHOP considered where relevant',
        ]}
        actions={
          <>
            <Link className="btn-primary" to="/employer-intake">
              Start Employer Intake
            </Link>
            <Link className="btn-secondary" to="/schedule">
              Schedule a Meeting
            </Link>
            <Link className="btn-secondary" to="/blog/tax-credits-for-small-business-health-insurance">
              Read about tax credits
            </Link>
          </>
        }
      />

      <section className="section-pad grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="eyebrow">Key Benefits</p>
          <h2 className="section-title mt-2">Why employers need a structured benefits review</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {shopBenefits.map((item, index) => (
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
          <h2 className="section-title mt-2">Keep researching before you move into quotes or renewal decisions.</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <Link className="rounded-[1.5rem] border border-[var(--line)] bg-[var(--panel-soft)] px-5 py-5 font-semibold text-slate-950 transition hover:border-[var(--brand-soft-strong)] hover:bg-white" to="/blog/what-is-shop-health-insurance-for-small-businesses">
              What is SHOP health insurance?
            </Link>
            <Link className="rounded-[1.5rem] border border-[var(--line)] bg-[var(--panel-soft)] px-5 py-5 font-semibold text-slate-950 transition hover:border-[var(--brand-soft-strong)] hover:bg-white" to="/blog/how-small-businesses-can-save-on-health-insurance">
              How small businesses can save on coverage
            </Link>
            <Link className="gradient-border rounded-[1.5rem] border border-[var(--line)] bg-[var(--panel-soft)] px-5 py-5 font-semibold text-slate-950 transition hover:bg-white hover:scale-[1.02]" to="/employer-intake">
              Start Employer Intake
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
