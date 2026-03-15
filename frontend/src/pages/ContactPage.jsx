import { Link, useSearchParams } from 'react-router-dom';
import Breadcrumbs from '../components/Breadcrumbs';
import ContactForm from '../components/ContactForm';
import PageHero from '../components/PageHero';
import Seo from '../components/Seo';
import { contactChecklist } from '../content/siteContent';
import {
  buildBreadcrumbSchema,
  buildContactPageSchema,
  buildOrganizationSchema,
} from '../utils/site';

export default function ContactPage() {
  const [searchParams] = useSearchParams();
  const coverage = searchParams.get('coverage') === 'shop' ? 'shop' : 'aca';

  const breadcrumbs = [
    { label: 'Home', to: '/' },
    { label: 'Contact', to: '/contact' },
  ];

  const contactHighlights = [
    'Choose ACA or SHOP support',
    'Send the form once',
    'Continue into scheduling when ready',
  ];

  return (
    <>
      <Seo
        description="Contact Elite Deal Broker for ACA Marketplace enrollment assistance or SHOP health insurance guidance for your small business."
        keywords={[
          'contact health insurance broker',
          'ACA enrollment assistance',
          'SHOP health insurance broker',
          'small business health insurance help',
        ]}
        path="/contact"
        structuredData={[
          buildOrganizationSchema(),
          buildContactPageSchema({
            description:
              'Contact Elite Deal Broker for ACA Marketplace enrollment assistance or SHOP health insurance guidance for your small business.',
          }),
          buildBreadcrumbSchema(breadcrumbs),
        ]}
        title="Contact"
      />

      <Breadcrumbs items={breadcrumbs} />
      <PageHero
        eyebrow="Contact"
        title="Request help with ACA Marketplace coverage or SHOP health insurance."
        description="Use the form to tell us whether you need individual Marketplace guidance or small business SHOP support. Your submission feeds the current lead workflow so scheduling and follow-up can happen in the same system."
        highlights={contactHighlights}
        aside={
          <div>
            <p className="eyebrow">What Happens Next</p>
            <div className="mt-4 space-y-3">
              {[
                'We route the request based on coverage type and state.',
                'You can continue directly into scheduling after submission.',
                'If you are still researching, the FAQ and service pages stay one click away.',
              ].map((item) => (
                <div key={item} className="soft-panel text-sm leading-7 text-slate-700">
                  {item}
                </div>
              ))}
            </div>
          </div>
        }
      />

      <section className="section-pad grid gap-8 lg:grid-cols-[0.82fr_1.18fr]">
        <div className="surface-card">
          <p className="eyebrow">Before You Submit</p>
          <h2 className="section-title mt-2">The best information to have ready</h2>
          <div className="soft-panel mt-6">
            <p className="font-display text-lg font-bold text-slate-950">Fastest path</p>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              Choose ACA if you need personal or family coverage. Choose SHOP if you are reviewing
              coverage for employees and contribution strategy.
            </p>
          </div>
          <div className="mt-6 space-y-4">
            {contactChecklist.map((item, index) => (
              <div key={item} className="soft-panel text-sm leading-7 text-slate-700 reveal" style={{ animationDelay: `${index * 100}ms` }}>
                {item}
              </div>
            ))}
          </div>
          <p className="body-copy mt-6 text-slate-700">
            If you want to read more before submitting the form, start with the <Link className="link-accent" to="/faq">FAQ page</Link> or the service guides for <Link className="link-accent" to="/individual-health-insurance">individual Marketplace insurance</Link> and <Link className="link-accent" to="/shop-health-insurance">SHOP coverage</Link>.
          </p>
        </div>
        <div className="lg:sticky lg:top-28 pulse-glow rounded-[2rem]">
          <ContactForm initialProductType={coverage} />
        </div>
      </section>

      <section className="section-pad pt-0">
        <div className="grid gap-5 lg:grid-cols-3">
          {[
            {
              title: 'Share your situation',
              text: 'Tell us which market you need, where you are located, and any timing issues that matter.',
            },
            {
              title: 'Review the right path',
              text: 'We keep the next step aligned to ACA Marketplace guidance for individuals or SHOP strategy for employers.',
            },
            {
              title: 'Move into scheduling',
              text: 'If you are ready after submitting the form, continue into scheduling without starting over.',
            },
          ].map((item, index) => (
            <div key={item.title} className="soft-panel gradient-border reveal" style={{ animationDelay: `${index * 120}ms` }}>
              <p className="font-display text-xl font-bold text-slate-950">{item.title}</p>
              <p className="mt-3 text-sm leading-7 text-slate-600">{item.text}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
