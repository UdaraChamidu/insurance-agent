import { Link } from 'react-router-dom';
import Breadcrumbs from '../components/Breadcrumbs';
import FaqAccordion from '../components/FaqAccordion';
import PageHero from '../components/PageHero';
import Seo from '../components/Seo';
import { faqItems } from '../content/siteContent';
import {
  buildBreadcrumbSchema,
  buildCollectionPageSchema,
  buildFaqSchema,
  buildOrganizationSchema,
} from '../utils/site';

export default function FaqPage() {
  const breadcrumbs = [
    { label: 'Home', to: '/' },
    { label: 'FAQ', to: '/faq' },
  ];

  return (
    <>
      <Seo
        description="Frequently asked questions about employer group health insurance, renewals, tax credits, broker support, and individual ACA help."
        keywords={[
          'group health insurance FAQ',
          'employee benefits FAQ',
          'small business health insurance FAQ',
          'ACA help questions',
        ]}
        path="/faq"
        structuredData={[
          buildOrganizationSchema(),
          buildCollectionPageSchema({
            path: '/faq',
            title: 'FAQ',
            description:
              'Frequently asked questions about employer group health insurance, renewals, tax credits, broker support, and individual ACA help.',
          }),
          buildBreadcrumbSchema(breadcrumbs),
          buildFaqSchema(faqItems),
        ]}
        title="FAQ"
      />

      <Breadcrumbs items={breadcrumbs} />
      <PageHero
        eyebrow="Frequently Asked Questions"
        title="Answers to the employer, group coverage, and ACA questions people ask most."
        description="These questions are written to support employers reviewing group coverage, renewals, tax credits, and broker support, while still keeping individual Affordable Care Act (ACA) topics available where they matter."
        highlights={[
          `${faqItems.length} common questions`,
          'Built for employers and individual searchers',
          'Linked to service and contact pages',
        ]}
        actions={(
          <>
            <Link className="btn-primary" to="/contact">
              Start Here
            </Link>
            <Link className="btn-secondary" to="/schedule">
              Schedule a Meeting
            </Link>
          </>
        )}
      />

      <section className="section-pad">
        <FaqAccordion items={faqItems} />
      </section>

      <section className="section-pad">
        <div className="cta-glow-border rounded-[2rem] border border-slate-200 bg-white px-6 py-10 shadow-[0_30px_80px_rgba(15,23,42,0.06)] sm:px-10">
          <h2 className="section-title">Still need help applying this to your situation?</h2>
          <p className="body-copy mt-4 max-w-3xl text-slate-700">
            Move into the next step through the <Link className="link-accent" to="/contact">path selector</Link>, use the <Link className="link-accent" to="/employer-intake">employer intake</Link> for group cases, or go deeper with the service guides for <Link className="link-accent" to="/individual-health-insurance">individual Marketplace coverage</Link> and <Link className="link-accent" to="/shop-health-insurance">employer coverage guidance</Link>.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link className="btn-primary" to="/contact">
              Start Here
            </Link>
            <Link className="btn-secondary" to="/individual-intake">
              Enroll Now
            </Link>
            <Link className="btn-secondary" to="/employer-intake">
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
