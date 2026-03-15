import { ArrowRight, BadgeCheck, Briefcase, FileSearch, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import ContactForm from '../components/ContactForm';
import FaqAccordion from '../components/FaqAccordion';
import Seo from '../components/Seo';
import { homeFaqItems, homepageHighlights } from '../content/siteContent';
import {
  buildFaqSchema,
  buildItemListSchema,
  buildOrganizationSchema,
  buildWebPageSchema,
  buildWebsiteSchema,
} from '../utils/site';

const brokerAdvantages = [
  {
    title: 'ACA Marketplace clarity',
    description:
      'We explain metal tiers, subsidy basics, provider networks, and enrollment timing in plain language.',
    icon: ShieldCheck,
  },
  {
    title: 'Small business planning',
    description:
      'We help employers compare SHOP options, contribution strategies, and practical enrollment steps.',
    icon: Briefcase,
  },
  {
    title: 'Process that stays organized',
    description:
      'Contact capture, follow-up, and scheduling are built into the current platform so next steps stay visible.',
    icon: FileSearch,
  },
];

const heroStats = [
  'ACA Marketplace enrollment support',
  'SHOP guidance for small businesses',
  'Internal linking across service pages, FAQs, and articles',
];

const quickStartSteps = [
  {
    step: '1',
    title: 'Choose the right lane',
    text: 'ACA Marketplace for individuals and families, SHOP guidance for small businesses.',
  },
  {
    step: '2',
    title: 'Share the basics',
    text: 'Tell us your coverage type, state, and timing so the next step starts in the right place.',
  },
  {
    step: '3',
    title: 'Compare with more clarity',
    text: 'Move from research into guided plan comparison and scheduling when you are ready.',
  },
];

export default function HomePage() {
  return (
    <>
      <Seo
        description="Helping individuals and small businesses find affordable health insurance through the ACA Marketplace and the SHOP program."
        keywords={[
          'health insurance broker',
          'ACA Marketplace insurance',
          'Obamacare Marketplace',
          'small business health insurance',
          'SHOP health insurance',
          'ACA enrollment assistance',
        ]}
        path="/"
        structuredData={[
          buildOrganizationSchema(),
          buildWebsiteSchema(),
          buildWebPageSchema({
            path: '/',
            title: 'Health Insurance Broker for ACA Marketplace and SHOP Coverage',
            description:
              'Helping individuals and small businesses find affordable health insurance through the ACA Marketplace and the SHOP program.',
          }),
          buildItemListSchema([
            { name: 'About Us', path: '/about-us' },
            { name: 'SHOP Health Insurance', path: '/shop-health-insurance' },
            { name: 'Individual Marketplace Insurance', path: '/individual-health-insurance' },
            { name: 'FAQ', path: '/faq' },
            { name: 'Contact', path: '/contact' },
          ]),
          buildFaqSchema(homeFaqItems),
        ]}
        title="Health Insurance Broker for ACA Marketplace and SHOP Coverage"
      />

      <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
        <div className="page-reveal blob-bg relative overflow-hidden rounded-[2rem] border border-blue-100 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.22),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(125,211,252,0.2),transparent_30%),linear-gradient(135deg,rgba(248,251,255,0.98),rgba(255,255,255,0.92))] px-6 py-12 shadow-[0_30px_80px_rgba(37,99,235,0.1)] sm:px-10 lg:px-12 lg:py-16">
          <p className="eyebrow">ACA Marketplace and SHOP Health Insurance</p>
          <h1 className="display-title max-w-4xl">
            Helping individuals and small businesses find affordable health insurance through the ACA Marketplace and SHOP.
          </h1>
          <p className="body-copy mt-6 max-w-3xl text-lg text-slate-700">
            Elite Deal Broker is a health insurance brokerage focused exclusively on individual Marketplace
            coverage and small business SHOP guidance. We help you compare options, understand enrollment
            timing, and move into the next step with more clarity.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link className="btn-primary" to="/contact">
              Talk to a Broker
            </Link>
            <Link className="btn-secondary" to="/shop-health-insurance">
              Explore SHOP Coverage
            </Link>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {heroStats.map((item) => (
              <div key={item} className="rounded-[1.5rem] border border-blue-100 bg-white/85 p-5 shadow-[0_12px_30px_rgba(37,99,235,0.06)]">
                <p className="text-sm font-semibold text-slate-900">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <aside className="page-reveal stagger-1 surface-card">
          <p className="eyebrow">Start Here</p>
          <h2 className="section-title mt-2">A clearer first step for both coverage paths.</h2>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            The site is structured to move from orientation into action. Start with the right market,
            keep researching if needed, and use the form when you are ready.
          </p>
          <div className="mt-6 space-y-3">
            {quickStartSteps.map((item) => (
              <div key={item.step} className="soft-panel flex items-start gap-4">
                <div className="number-pop flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-700 to-sky-500 text-sm font-bold text-white shadow-[0_12px_24px_rgba(37,99,235,0.22)]" style={{ animationDelay: `${(parseInt(item.step) - 1) * 150}ms` }}>
                  {item.step}
                </div>
                <div>
                  <p className="font-display text-lg font-bold text-slate-950">{item.title}</p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 space-y-4">
            {homepageHighlights.map((item) => (
              <Link
                key={item.href}
                className="block rounded-[1.5rem] border border-blue-100 bg-white/75 px-5 py-5 transition hover:border-blue-300 hover:bg-blue-50"
                to={item.href}
              >
                <p className="text-lg font-semibold text-slate-950">{item.title}</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">{item.description}</p>
              </Link>
            ))}
          </div>
        </aside>
      </section>

      <section className="section-pad">
        <div className="grid gap-6 lg:grid-cols-3">
          {brokerAdvantages.map((item, index) => (
            <article key={item.title} className="surface-card gradient-border reveal" style={{ animationDelay: `${index * 120}ms` }}>
              <div className="icon-float flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-sky-500 text-white shadow-[0_14px_30px_rgba(37,99,235,0.24)]">
                <item.icon className="h-5 w-5" />
              </div>
              <h2 className="section-title mt-5 text-2xl">{item.title}</h2>
              <p className="body-copy mt-3 text-slate-700">{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-pad grid gap-8 lg:grid-cols-2">
        <article className="surface-card">
          <p className="eyebrow">ACA Marketplace Explanation</p>
          <h2 className="section-title mt-2">How individual Marketplace health insurance works</h2>
          <p className="body-copy mt-4">
            The ACA Marketplace is designed for individuals and families who need personal health
            coverage. It is the place where qualified health plans are compared and where subsidy
            eligibility is reviewed through the official application process.
          </p>
          <ul className="mt-6 space-y-3 text-slate-700">
            <li className="flex items-start gap-3">
              <BadgeCheck className="mt-1 h-5 w-5 text-blue-700" />
              Coverage for people without employer-sponsored health insurance
            </li>
            <li className="flex items-start gap-3">
              <BadgeCheck className="mt-1 h-5 w-5 text-blue-700" />
              Premium tax credit review through the Marketplace application
            </li>
            <li className="flex items-start gap-3">
              <BadgeCheck className="mt-1 h-5 w-5 text-blue-700" />
              Broker support for plan comparisons, networks, and enrollment timing
            </li>
          </ul>
          <Link className="link-arrow pt-6" to="/individual-health-insurance">
            Read the ACA Marketplace guide
            <ArrowRight className="arrow-animate h-4 w-4" />
          </Link>
        </article>

        <article className="surface-card">
          <p className="eyebrow">SHOP Program Explanation</p>
          <h2 className="section-title mt-2">How small businesses use SHOP health insurance</h2>
          <p className="body-copy mt-4">
            SHOP exists for eligible small employers that want ACA-compliant group health insurance
            and a clearer way to compare plan options. It can also be relevant when an employer wants
            to review whether the small business health care tax credit may apply.
          </p>
          <ul className="mt-6 space-y-3 text-slate-700">
            <li className="flex items-start gap-3">
              <BadgeCheck className="mt-1 h-5 w-5 text-blue-700" />
              Structured comparison of small business health insurance plans
            </li>
            <li className="flex items-start gap-3">
              <BadgeCheck className="mt-1 h-5 w-5 text-blue-700" />
              Employer contribution planning and enrollment coordination
            </li>
            <li className="flex items-start gap-3">
              <BadgeCheck className="mt-1 h-5 w-5 text-blue-700" />
              Broker guidance on fit, timing, and tax credit conversations
            </li>
          </ul>
          <Link className="link-arrow pt-6" to="/shop-health-insurance">
            Read the SHOP guide
            <ArrowRight className="arrow-animate h-4 w-4" />
          </Link>
        </article>
      </section>

      <section className="section-pad">
        <div className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr]">
          <div className="surface-card">
            <p className="eyebrow">Why Choose Our Brokerage</p>
            <h2 className="section-title mt-2">Built for people who want explanation, not pressure.</h2>
            <p className="body-copy mt-4 text-slate-700">
              The public experience is intentionally narrow, which makes each section easier to scan,
              each service page easier to compare, and every next step more obvious on mobile and desktop.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <span className="chip-pill">Focused on two coverage paths</span>
              <span className="chip-pill">Guided research flow</span>
              <span className="chip-pill">Connected to scheduling</span>
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {[
              'We focus only on ACA Marketplace and SHOP topics, so the site stays tightly aligned with your actual search intent.',
              'Service pages, FAQs, and blog articles link to each other so it is easy to keep researching before you contact us.',
              'The public site and contact flow are connected to the current lead system, which makes follow-up more consistent.',
              'Content is written for non-technical readers who want clear health insurance explanations instead of generic marketing language.',
            ].map((item) => (
              <div key={item} className="soft-panel text-sm leading-7 text-slate-700">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-pad grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="surface-card">
          <p className="eyebrow">FAQ Preview</p>
          <h2 className="section-title mt-2">Common ACA Marketplace and SHOP questions</h2>
          <p className="body-copy mt-4 text-slate-700">
            The full FAQ page covers enrollment timing, tax credits, broker support, and small business
            plan questions in more detail.
          </p>
          <Link className="link-arrow pt-6" to="/faq">
            View all FAQ answers
            <ArrowRight className="arrow-animate h-4 w-4" />
          </Link>
        </div>
        <FaqAccordion items={homeFaqItems} />
      </section>

      <section className="section-pad">
        <div className="cta-glow-border rounded-[2rem] border border-blue-200 bg-[linear-gradient(135deg,#1e3a8a,#2563eb,#38bdf8)] px-6 py-10 text-white shadow-[0_30px_80px_rgba(37,99,235,0.28)] sm:px-10">
          <p className="eyebrow text-blue-100">Call To Action</p>
          <h2 className="font-display text-4xl text-white">
            Ready to compare ACA Marketplace plans or review SHOP options for your business?
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-8 text-blue-50">
            Start with the contact form so we know whether you need individual Marketplace help or
            small business health insurance guidance. If you want to keep reading first, the blog
            and FAQ sections are built to support that research path.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link className="btn-light" to="/contact">
              Start the Conversation
            </Link>
            <Link className="btn-outline-light" to="/blog">
              Browse Articles
            </Link>
          </div>
        </div>
      </section>

      <section className="section-pad grid gap-8 lg:grid-cols-[0.82fr_1.18fr]">
        <div className="surface-card">
          <p className="eyebrow">Contact Section</p>
          <h2 className="section-title mt-2">Tell us whether you need ACA or SHOP support.</h2>
          <p className="body-copy mt-4 text-slate-700">
            This form feeds the current lead workflow so we can keep your request organized and move
            directly into scheduling if you want to continue now.
          </p>
          <div className="mt-6 space-y-4 text-sm leading-7 text-slate-700">
            <div className="soft-panel">
              <p className="font-semibold text-slate-950">Best for individuals and families</p>
              <p>Use the ACA option if you need personal Marketplace coverage or lost job-based insurance.</p>
            </div>
            <div className="soft-panel">
              <p className="font-semibold text-slate-950">Best for small employers</p>
              <p>Use the SHOP option if you want to compare group coverage and contribution strategies.</p>
            </div>
          </div>
        </div>
        <ContactForm compact initialProductType="aca" />
      </section>
    </>
  );
}
