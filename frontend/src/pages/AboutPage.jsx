import { Link } from 'react-router-dom';
import Breadcrumbs from '../components/Breadcrumbs';
import FaqAccordion from '../components/FaqAccordion';
import PageHero from '../components/PageHero';
import Seo from '../components/Seo';
import { aboutFaqItems, aboutTrustSignals } from '../content/siteContent';
import {
  buildAboutPageSchema,
  buildBreadcrumbSchema,
  buildFaqSchema,
  buildOrganizationSchema,
} from '../utils/site';

export default function AboutPage() {
  const breadcrumbs = [
    { label: 'Home', to: '/' },
    { label: 'About Us', to: '/about-us' },
  ];

  const heroHighlights = [
    'Employer and group cases first',
    'Separate path for individual ACA support',
    'Public routing built to reduce intake confusion',
  ];

  return (
    <>
      <Seo
        description="Learn about Elite Deal Broker, our mission, and how we help employers review group health insurance while keeping a separate path for individual ACA support."
        keywords={[
          'about health insurance broker',
          'group health insurance broker',
          'employee benefits broker',
          'ACA support',
        ]}
        path="/about-us"
        structuredData={[
          buildOrganizationSchema(),
          buildAboutPageSchema({
            description:
              'Learn about Elite Deal Broker, our mission, and how we help employers review group health insurance while keeping a separate path for individual ACA support.',
          }),
          buildBreadcrumbSchema(breadcrumbs),
          buildFaqSchema(aboutFaqItems),
        ]}
        title="About Us"
      />

      <Breadcrumbs items={breadcrumbs} />
      <PageHero
        eyebrow="About Our Brokerage"
        title="A brokerage now centered on employer health insurance and cleaner intake routing."
        description="The public site has been reshaped around employer and group health insurance work first. Individual ACA support is still available, but it now follows its own request path so the business can handle both without mixing the workflows."
        highlights={heroHighlights}
        aside={
          <div>
            <p className="eyebrow">How We Work</p>
            <div className="mt-4 space-y-3">
              {[
                'Start employer cases with the company and renewal context that actually matters.',
                'Keep individual ACA requests in a separate short-form path.',
                'Use linked pages, FAQs, and intake flows to reduce re-routing later.',
              ].map((item) => (
                <div key={item} className="soft-panel text-sm leading-7 text-slate-700">
                  {item}
                </div>
              ))}
            </div>
          </div>
        }
      />

      <section className="section-pad grid gap-8 lg:grid-cols-[1fr_1fr]">
        <article className="surface-card">
          <p className="eyebrow">Company Mission</p>
          <h2 className="section-title mt-2">Make health insurance decisions easier to understand.</h2>
          <p className="body-copy mt-4">
            Our mission is to help employers make clearer benefits decisions with less friction and
            more confidence. That means organizing intake correctly, explaining options in plain
            language, and keeping the conversation centered on the details that actually affect a
            sound decision: budget, provider access, timing, contribution strategy, and coverage fit.
          </p>
          <p className="body-copy mt-4">
            We are not trying to be a general insurance directory. We are building a more focused
            brokerage experience for employer and group health insurance work, while still supporting
            individual ACA cases through a clearly separate path.
          </p>
        </article>

        <article className="rounded-[2rem] border border-blue-100 bg-blue-50/75 p-6 shadow-[0_24px_60px_rgba(37,99,235,0.08)] sm:p-8">
          <p className="eyebrow">Insurance Expertise</p>
          <h2 className="section-title mt-2">Practical support for real enrollment decisions.</h2>
          <p className="body-copy mt-4">
            We help clients sort through deductibles, networks, plan design tradeoffs, employer
            contribution questions, and enrollment timing. For employer cases, that often means
            working through renewal pressure, census readiness, current carrier context, and what
            the benefit should look like before quotes are even requested.
          </p>
          <p className="body-copy mt-4">
            The site itself is designed to support that process. Public pages, FAQs, and intake
            paths are now separated more clearly so employer and individual visitors reach the right
            workflow sooner.
          </p>
        </article>
      </section>

      <section className="section-pad">
        <div className="grid gap-6 lg:grid-cols-3">
          {[
            {
              title: 'How working with a broker helps',
              text: 'A broker can help compare plans, highlight tradeoffs, and keep the enrollment process moving in the right order.',
            },
            {
              title: 'Why employers contact us',
              text: 'Employers usually need a cleaner path for benefits review, renewals, quoting preparation, contribution strategy, and next-step coordination.',
            },
            {
              title: 'Why the routing matters',
              text: 'Separate intake paths reduce confusion, keep the CRM cleaner, and make it easier to follow up with the right information and workflow.',
            },
          ].map((item, index) => (
            <article key={item.title} className="soft-panel gradient-border reveal" style={{ animationDelay: `${index * 120}ms` }}>
              <h2 className="section-title text-2xl">{item.title}</h2>
              <p className="body-copy mt-3 text-slate-700">{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-pad grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="surface-card">
          <p className="eyebrow">Trust Signals</p>
          <h2 className="section-title mt-2">What clients should expect from our process</h2>
          <p className="body-copy mt-4 text-slate-700">
            Trust here comes from clarity: cleaner routing, readable explanations, and a process
            that keeps employer intake, research, and next steps connected.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {aboutTrustSignals.map((item, index) => (
            <div key={item} className="soft-panel text-sm leading-7 text-slate-700">
              <p className="mb-3 font-display text-sm font-bold uppercase tracking-[0.18em] text-blue-800">
                0{index + 1}
              </p>
              {item}
            </div>
          ))}
        </div>
      </section>

      <section className="section-pad">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="surface-card">
          <p className="eyebrow">FAQ Section</p>
          <h2 className="section-title mt-2">About our brokerage and enrollment support</h2>
          <p className="body-copy mt-4 text-slate-700">
            These are the questions we hear most often from people deciding whether to use broker
            guidance for employer coverage review, renewals, or individual ACA support.
          </p>
        </div>
          <FaqAccordion items={aboutFaqItems} />
        </div>
      </section>

      <section className="section-pad">
        <div className="cta-glow-border rounded-[2rem] border border-slate-200 bg-white px-6 py-10 shadow-[0_30px_80px_rgba(15,23,42,0.06)] sm:px-10">
          <h2 className="section-title">Ready to work with a group-first brokerage and cleaner intake flow?</h2>
          <p className="body-copy mt-4 max-w-3xl text-slate-700">
            Move into the next step through the <Link className="link-accent" to="/contact">path selector</Link>, use the <Link className="link-accent" to="/employer-intake">employer intake</Link> for group cases, or review the service guides for <Link className="link-accent" to="/individual-health-insurance">individual Marketplace insurance</Link> and <Link className="link-accent" to="/shop-health-insurance">employer coverage guidance</Link>.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link className="btn-primary" to="/employer-intake">
              Start Employer Intake
            </Link>
            <Link className="btn-secondary" to="/contact">
              Choose Coverage Path
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
