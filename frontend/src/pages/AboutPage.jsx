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
    'ACA Marketplace and SHOP only',
    'Built for individuals and small businesses',
    'Research paths that lead into action',
  ];

  return (
    <>
      <Seo
        description="Learn about Elite Deal Broker, our mission, and how we help individuals and small businesses navigate ACA Marketplace and SHOP enrollment."
        keywords={[
          'about health insurance broker',
          'ACA Marketplace broker',
          'SHOP health insurance broker',
          'ACA enrollment assistance',
        ]}
        path="/about-us"
        structuredData={[
          buildOrganizationSchema(),
          buildAboutPageSchema({
            description:
              'Learn about Elite Deal Broker, our mission, and how we help individuals and small businesses navigate ACA Marketplace and SHOP enrollment.',
          }),
          buildBreadcrumbSchema(breadcrumbs),
          buildFaqSchema(aboutFaqItems),
        ]}
        title="About Us"
      />

      <Breadcrumbs items={breadcrumbs} />
      <PageHero
        eyebrow="About Our Brokerage"
        title="A focused brokerage built around ACA Marketplace and SHOP guidance."
        description="We keep the public side of the business narrow on purpose: individual Marketplace coverage and small business SHOP health insurance. That focus helps our content stay more useful, our routing stay cleaner, and our client conversations start in the right place."
        highlights={heroHighlights}
        aside={
          <div>
            <p className="eyebrow">How We Work</p>
            <div className="mt-4 space-y-3">
              {[
                'Explain the market first, so people do not start in the wrong place.',
                'Use linked service pages, FAQs, and articles to support self-guided research.',
                'Move into contact and scheduling only when the visitor is ready.',
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
            Our mission is to help people move through ACA Marketplace and SHOP enrollment with less
            friction and more confidence. That means explaining plan choices clearly, organizing next
            steps, and keeping the conversation centered on the factors that actually affect a good
            decision: budget, provider access, timing, and coverage fit.
          </p>
          <p className="body-copy mt-4">
            We are not trying to be a general insurance directory. We are building a focused brokerage
            experience for individuals, families, and small businesses that specifically need Affordable
            Care Act Marketplace guidance or help evaluating SHOP coverage.
          </p>
        </article>

        <article className="rounded-[2rem] border border-blue-100 bg-blue-50/75 p-6 shadow-[0_24px_60px_rgba(37,99,235,0.08)] sm:p-8">
          <p className="eyebrow">Insurance Expertise</p>
          <h2 className="section-title mt-2">Broker-led support for real enrollment decisions.</h2>
          <p className="body-copy mt-4">
            We help clients sort through deductibles, networks, plan metal levels, employer contribution
            questions, and enrollment timing. For small businesses, that often means working through
            whether SHOP fits the company and how the benefit should be structured. For individuals, it
            usually means clarifying how Marketplace plan comparison works and what to review before applying.
          </p>
          <p className="body-copy mt-4">
            The site itself is designed to support that process. Public pages, FAQs, and blog articles
            are linked together so visitors can keep researching before they contact us.
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
              title: 'Why individuals contact us',
              text: 'People usually need help after losing coverage, approaching open enrollment, or trying to compare Marketplace plans beyond premium alone.',
            },
            {
              title: 'Why small businesses contact us',
              text: 'Employers want a clearer path to offering benefits, understanding SHOP, and reviewing whether tax credits should be part of the plan strategy.',
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
            Trust here comes from clarity: focused subject matter, readable explanations, and a process
            that keeps research, contact, and next steps connected.
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
              guidance for ACA Marketplace coverage or SHOP health insurance.
            </p>
          </div>
          <FaqAccordion items={aboutFaqItems} />
        </div>
      </section>

      <section className="section-pad">
        <div className="cta-glow-border rounded-[2rem] border border-slate-200 bg-white px-6 py-10 shadow-[0_30px_80px_rgba(15,23,42,0.06)] sm:px-10">
          <h2 className="section-title">Ready to work with a focused ACA and SHOP brokerage?</h2>
          <p className="body-copy mt-4 max-w-3xl text-slate-700">
            Move into the next step through the <Link className="link-accent" to="/contact">contact page</Link>, or review the service guides for <Link className="link-accent" to="/individual-health-insurance">individual Marketplace insurance</Link> and <Link className="link-accent" to="/shop-health-insurance">SHOP health insurance</Link>.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link className="btn-primary" to="/contact">
              Start with Contact
            </Link>
            <Link className="btn-secondary" to="/faq">
              Review FAQs First
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
