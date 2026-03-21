import { ArrowRight, BadgeCheck, Briefcase, FileSearch, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import FaqAccordion from '../components/FaqAccordion';
import Seo from '../components/Seo';
import { homeFaqItems, homepageHighlights, termDefinitions } from '../content/siteContent';
import {
  buildFaqSchema,
  buildItemListSchema,
  buildOrganizationSchema,
  buildWebPageSchema,
  buildWebsiteSchema,
} from '../utils/site';

const brokerAdvantages = [
  {
    title: 'Employer strategy first',
    description:
      'We help employers review group health insurance, renewal timing, contribution strategy, and quoting readiness in plain language.',
    icon: ShieldCheck,
  },
  {
    title: 'Cleaner intake and follow-up',
    description:
      'Employer requests now move through a dedicated intake flow so group cases start in the right workflow from day one.',
    icon: Briefcase,
  },
  {
    title: 'Individual support still available',
    description:
      'If the need is personal or family coverage instead of employer benefits, the individual ACA path remains available without mixing the two journeys.',
    icon: FileSearch,
  },
];

const heroStats = [
  'Employer and group health insurance intake',
  'Renewal, contribution, and quoting workflow support',
  'Separate path for individual Affordable Care Act (ACA) requests',
];

const quickStartSteps = [
  {
    step: '1',
    title: 'Choose the right case type',
    text: 'Employer and group cases follow the dedicated intake. Individual and family requests use the shorter Affordable Care Act (ACA) request form.',
  },
  {
    step: '2',
    title: 'Share the right details',
    text: 'Employer cases capture company and renewal context. Individual cases stay short and focused on enrollment timing and coverage needs.',
  },
  {
    step: '3',
    title: 'Move into the next step',
    text: 'Once the request is in the correct path, scheduling and follow-up can happen without re-routing the case later.',
  },
];

export default function HomePage() {
  return (
    <>
      <Seo
        description="Helping employers review group health insurance, employee benefits, renewals, and quoting workflow, with a separate path for individual ACA support."
        keywords={[
          'health insurance broker',
          'group health insurance',
          'employee benefits broker',
          'small business health insurance',
          'benefits renewal review',
          'small business health insurance',
          'ACA enrollment assistance',
        ]}
        path="/"
        structuredData={[
          buildOrganizationSchema(),
          buildWebsiteSchema(),
          buildWebPageSchema({
            path: '/',
            title: 'Group Health Insurance Broker for Employers and ACA Support',
            description:
              'Helping employers review group health insurance, employee benefits, renewals, and quoting workflow, with a separate path for individual ACA support.',
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
        title="Group Health Insurance Broker for Employers and ACA Support"
      />

      <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
        <div className="page-reveal surface-card">
          <p className="eyebrow">Elite Deal Broker</p>
          <h1 className="display-title max-w-4xl">
            A clear starting point for employer health insurance, benefits review, and renewal planning.
          </h1>
          <p className="body-copy mt-6 max-w-3xl text-lg text-slate-700">
            Elite Deal Broker is now positioned around employer and group health insurance work first.
            We help businesses organize intake, compare practical options, think through contribution
            strategy, and move into quoting or discovery with less confusion. Individual support
            remains available through a separate Affordable Care Act (ACA) path.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link className="btn-primary" to="/contact">
              Start Here
            </Link>
            <Link className="btn-secondary" to="/contact?tab=individual">
              Enroll Now
            </Link>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {heroStats.map((item) => (
              <div key={item} className="soft-panel">
                <p className="text-sm font-semibold text-slate-900">{item}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {termDefinitions.map((item) => (
              <div key={item.term} className="soft-panel">
                <p className="font-display text-lg font-bold text-slate-950">
                  {item.term} = {item.label}
                </p>
                <p className="mt-2 text-sm leading-7 text-slate-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>

        <aside className="page-reveal stagger-1 surface-card">
          <p className="eyebrow">Start Here</p>
          <h2 className="section-title mt-2">A clearer first step for employer cases and ACA support.</h2>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            The public experience now separates employer intake from individual requests so the case
            starts in the right workflow from the beginning.
          </p>
          <div className="mt-6 space-y-3">
            {quickStartSteps.map((item) => (
              <div key={item.step} className="soft-panel flex items-start gap-4">
                <div
                  className="number-pop flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-bold text-white shadow-[0_12px_24px_rgba(188,25,24,0.18)]"
                  style={{ animationDelay: `${(parseInt(item.step, 10) - 1) * 150}ms`, background: 'var(--brand)' }}
                >
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
                className="block rounded-[1.5rem] border border-[var(--line)] bg-white px-5 py-5 transition hover:border-[var(--brand-soft-strong)] hover:bg-[var(--panel-soft)]"
                to={item.href}
              >
                <p className="text-lg font-semibold text-slate-950">{item.title}</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">{item.description}</p>
              </Link>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link className="btn-primary" to="/contact?tab=employer">
              Start Employer Intake
            </Link>
          </div>
        </aside>
      </section>

      <section className="section-pad">
        <div className="grid gap-6 lg:grid-cols-3">
          {brokerAdvantages.map((item, index) => (
            <article key={item.title} className="surface-card gradient-border reveal" style={{ animationDelay: `${index * 120}ms` }}>
              <div
                className="icon-float flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-[0_14px_30px_rgba(188,25,24,0.2)]"
                style={{ background: 'var(--brand)' }}
              >
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
          <p className="eyebrow">Employer Benefits Review</p>
          <h2 className="section-title mt-2">How employer and group health insurance cases start</h2>
          <p className="body-copy mt-4">
            Employer cases usually begin with the business basics: company size, eligible employees,
            current coverage, renewal timing, contribution goals, and the benefits the team actually
            needs. Starting there keeps quoting and follow-up more practical.
          </p>
          <ul className="mt-6 space-y-3 text-slate-700">
            <li className="flex items-start gap-3">
              <BadgeCheck className="mt-1 h-5 w-5 text-[var(--brand-dark)]" />
              Capture employee counts and benefits scope before the discovery call
            </li>
            <li className="flex items-start gap-3">
              <BadgeCheck className="mt-1 h-5 w-5 text-[var(--brand-dark)]" />
              Review renewal timing and current carrier context earlier
            </li>
            <li className="flex items-start gap-3">
              <BadgeCheck className="mt-1 h-5 w-5 text-[var(--brand-dark)]" />
              Keep employer cases in a dedicated CRM workflow instead of a generic contact path
            </li>
          </ul>
          <Link className="link-arrow pt-6" to="/contact?tab=employer">
            Open the employer intake
            <ArrowRight className="arrow-animate h-4 w-4" />
          </Link>
        </article>

        <article className="surface-card">
          <p className="eyebrow">Individual Support</p>
          <h2 className="section-title mt-2">How the individual ACA path fits into the site now</h2>
          <p className="body-copy mt-4">
            Individual and family coverage support is still available, but it now follows a separate
            Affordable Care Act (ACA) request path so personal cases do not get mixed into the
            employer workflow.
          </p>
          <ul className="mt-6 space-y-3 text-slate-700">
            <li className="flex items-start gap-3">
              <BadgeCheck className="mt-1 h-5 w-5 text-[var(--brand-dark)]" />
              Best for personal or family coverage questions
            </li>
            <li className="flex items-start gap-3">
              <BadgeCheck className="mt-1 h-5 w-5 text-[var(--brand-dark)]" />
              Keeps ACA timing, subsidy, and plan comparison questions in a simpler short form
            </li>
            <li className="flex items-start gap-3">
              <BadgeCheck className="mt-1 h-5 w-5 text-[var(--brand-dark)]" />
              Still moves into scheduling once the request is submitted
            </li>
          </ul>
          <Link className="link-arrow pt-6" to="/contact?tab=individual">
            Open the individual request form
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
              'The site now centers employer group coverage while keeping a separate individual ACA path for cases that need it.',
              'Employer visitors now have a dedicated intake instead of being pushed through a generic request form.',
              'The public site and contact flow are connected to the current lead system, which makes follow-up more consistent.',
              'Content is written for non-technical readers who want practical health insurance explanations instead of generic marketing language.',
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
          <h2 className="section-title mt-2">Common employer, group coverage, and ACA questions</h2>
          <p className="body-copy mt-4 text-slate-700">
            The full FAQ page covers employer benefits review, tax credits, renewal timing, broker
            support, and individual ACA questions in more detail.
          </p>
          <Link className="link-arrow pt-6" to="/faq">
            View all FAQ answers
            <ArrowRight className="arrow-animate h-4 w-4" />
          </Link>
        </div>
        <FaqAccordion items={homeFaqItems} />
      </section>

      <section className="section-pad">
        <div className="cta-glow-border rounded-[2rem] border border-[#7d1c1c] bg-[linear-gradient(135deg,#6f1414,#991413,#bc1918)] px-6 py-10 text-white shadow-[0_30px_80px_rgba(188,25,24,0.22)] sm:px-10">
          <p className="eyebrow text-[#ffd8d4]">Call To Action</p>
          <h2 className="font-display text-4xl text-white">
            Ready to review employer coverage or route a case into the right workflow?
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-8 text-[#fff0ed]">
            Start with the right path so individual Affordable Care Act requests and employer group
            cases go into the correct workflow from the beginning. If you want to keep reading
            first, the blog and FAQ sections are built to support that research path.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link className="btn-light" to="/contact">
              Start Here
            </Link>
            <Link className="btn-outline-light" to="/contact?tab=individual">
              Enroll Now
            </Link>
            <Link className="btn-outline-light" to="/blog">
              Browse Articles
            </Link>
          </div>
        </div>
      </section>

      <section className="section-pad grid gap-8 lg:grid-cols-[0.82fr_1.18fr]">
        <div className="surface-card">
          <p className="eyebrow">Start Here</p>
          <h2 className="section-title mt-2">Choose the right starting point before you submit.</h2>
          <p className="body-copy mt-4 text-slate-700">
            We now separate individual ACA requests from employer group intake so each case starts
            in the correct workflow and reaches the right follow-up steps faster.
          </p>
          <div className="mt-6 space-y-4 text-sm leading-7 text-slate-700">
            <div className="soft-panel">
              <p className="font-semibold text-slate-950">Best for individuals and families</p>
              <p>Use the individual request form if you need personal Marketplace coverage or lost job-based insurance.</p>
            </div>
            <div className="soft-panel">
              <p className="font-semibold text-slate-950">Best for small employers</p>
              <p>Use the employer intake if you want to compare group coverage, renewal timing, and contribution strategies.</p>
            </div>
          </div>
        </div>
        <div className="grid gap-5">
          <div className="surface-card gradient-border">
            <p className="eyebrow">Individual Path</p>
            <h3 className="section-title mt-2 text-2xl">ACA Marketplace help for personal or family coverage.</h3>
            <p className="body-copy mt-4 text-slate-700">
              Use the shorter request form when the question is about individual or family health insurance.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link className="btn-primary" to="/contact?tab=individual">
                Enroll Now
              </Link>
            </div>
          </div>
          <div className="surface-card gradient-border">
            <p className="eyebrow">Employer Path</p>
            <h3 className="section-title mt-2 text-2xl">Group health insurance intake for employer cases.</h3>
            <p className="body-copy mt-4 text-slate-700">
              Use the employer intake when the request involves a company, employee counts, current carrier, or renewal review.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link className="btn-secondary" to="/contact?tab=employer">
                Start Employer Intake
              </Link>
              <Link className="btn-primary" to="/contact">
                Start Here
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
