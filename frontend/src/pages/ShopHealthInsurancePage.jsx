import { Link } from 'react-router-dom';
import Breadcrumbs from '../components/Breadcrumbs';
import PageHero from '../components/PageHero';
import Seo from '../components/Seo';
import { shopBenefits } from '../content/siteContent';
import { buildBreadcrumbSchema, buildOrganizationSchema, buildServiceSchema } from '../utils/site';

const sections = [
  {
    title: 'What is SHOP?',
    text: 'SHOP stands for Small Business Health Options Program. It is the ACA pathway built for eligible small employers that want to offer group health insurance and compare plans within a more structured small-group framework.',
  },
  {
    title: 'Who qualifies',
    text: 'Eligibility depends on business structure, workforce size, and market rules. The first step is to confirm whether your company fits the SHOP path before comparing plans in detail.',
  },
  {
    title: 'Benefits for small businesses',
    text: 'SHOP can help employers organize benefit comparisons, create a clearer contribution strategy, and support a more formal employee health insurance offering.',
  },
  {
    title: 'Tax credit opportunities',
    text: 'Some employers may qualify for the small business health care tax credit. That possibility should be part of the strategy conversation early because it can materially change how the business evaluates cost.',
  },
  {
    title: 'Why use a broker',
    text: 'A broker helps translate quotes into decisions. That includes comparing plan value, contribution structure, participation expectations, provider access, and timing.',
  },
  {
    title: 'Enrollment assistance',
    text: 'We help small businesses gather information, compare practical options, and keep enrollment moving with less confusion and fewer avoidable mistakes.',
  },
];

export default function ShopHealthInsurancePage() {
  const breadcrumbs = [
    { label: 'Home', to: '/' },
    { label: 'SHOP Health Insurance', to: '/shop-health-insurance' },
  ];

  const serviceSchema = buildServiceSchema({
    name: 'SHOP Health Insurance Broker Guidance',
    path: '/shop-health-insurance',
    description:
      'Detailed guidance on SHOP Marketplace coverage, small business ACA insurance, tax credits, and broker-led enrollment assistance.',
    serviceType: 'SHOP Marketplace and small business health insurance guidance',
    audience: 'Small business owners and employers',
  });

  return (
    <>
      <Seo
        description="Detailed guidance on SHOP Marketplace coverage, small business ACA insurance, tax credits, and broker-led enrollment assistance."
        keywords={[
          'small business health insurance',
          'SHOP Marketplace',
          'small business ACA insurance',
          'health insurance for small businesses',
        ]}
        path="/shop-health-insurance"
        structuredData={[
          buildOrganizationSchema(),
          buildBreadcrumbSchema(breadcrumbs),
          serviceSchema,
        ]}
        title="SHOP Health Insurance"
      />

      <Breadcrumbs items={breadcrumbs} />
      <PageHero
        eyebrow="SHOP Health Insurance"
        title="Small business health insurance guidance built around the SHOP Marketplace."
        description="If you are evaluating health insurance for a small business, SHOP deserves a structured review. We help employers compare ACA-compliant options, think through contribution strategy, and move toward enrollment with a clearer plan."
        highlights={[
          'Small employer decision support',
          'SHOP eligibility and fit',
          'Contribution and tax credit context',
        ]}
        actions={
          <>
            <Link className="btn-primary" to="/contact?coverage=shop">
              Request SHOP Guidance
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
          <h2 className="section-title mt-2">Why employers evaluate SHOP coverage</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {shopBenefits.map((item, index) => (
            <div key={item} className="reveal rounded-[1.5rem] border border-slate-200 bg-white px-5 py-5 text-sm leading-7 text-slate-700 shadow-[0_18px_45px_rgba(15,23,42,0.05)]" style={{ animationDelay: `${index * 100}ms` }}>
              <span className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-sky-500 text-xs font-bold text-white number-pop" style={{ animationDelay: `${index * 150}ms` }}>{index + 1}</span>
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
          <h2 className="section-title mt-2">Keep researching before you enroll.</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <Link className="rounded-[1.5rem] border border-blue-100 bg-blue-50/70 px-5 py-5 font-semibold text-slate-950 transition hover:bg-blue-100" to="/blog/what-is-shop-health-insurance-for-small-businesses">
              What is SHOP health insurance?
            </Link>
            <Link className="rounded-[1.5rem] border border-blue-100 bg-blue-50/70 px-5 py-5 font-semibold text-slate-950 transition hover:bg-blue-100" to="/blog/how-small-businesses-can-save-on-health-insurance">
              How small businesses can save on coverage
            </Link>
            <Link className="gradient-border rounded-[1.5rem] border border-blue-100 bg-blue-50/70 px-5 py-5 font-semibold text-slate-950 transition hover:bg-blue-100 hover:scale-[1.02]" to="/contact?coverage=shop">
              Start a small business review
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
