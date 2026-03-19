import { Link, useSearchParams } from 'react-router-dom';
import Breadcrumbs from '../components/Breadcrumbs';
import ContactForm from '../components/ContactForm';
import PageHero from '../components/PageHero';
import Seo from '../components/Seo';
import {
  buildBreadcrumbSchema,
  buildContactPageSchema,
  buildOrganizationSchema,
} from '../utils/site';

function buildPath(basePath, searchParams) {
  const nextParams = new URLSearchParams(searchParams);
  nextParams.delete('coverage');

  const query = nextParams.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export default function IndividualIntakePage() {
  const [searchParams] = useSearchParams();
  const employerPath = buildPath('/employer-intake', searchParams);

  const breadcrumbs = [
    { label: 'Home', to: '/' },
    { label: 'Individual Intake', to: '/individual-intake' },
  ];

  return (
    <>
      <Seo
        description="Request individual or family health coverage help with a short form, and our team will follow up directly."
        keywords={[
          'ACA Marketplace help',
          'individual health insurance broker',
          'ACA enrollment assistance',
          'individual intake form',
        ]}
        path="/individual-intake"
        structuredData={[
          buildOrganizationSchema(),
            buildContactPageSchema({
              path: '/individual-intake',
              title: 'Individual Intake',
              description:
                'Request individual or family health coverage help with a short form, and our team will follow up directly.',
            }),
            buildBreadcrumbSchema(breadcrumbs),
          ]}
        title="Individual Intake"
      />

      <Breadcrumbs items={breadcrumbs} />
      <PageHero
        eyebrow="Individual Intake"
        title="Request help with individual or family health coverage."
        description="Use this short request form for personal or family coverage questions. Share a few basics and our team will contact you directly after reviewing your request."
        highlights={[
          'Individual and family coverage only',
          'Short request form',
          'We follow up after you submit',
        ]}
        layoutClassName="grid gap-8 lg:grid-cols-[0.86fr_1.14fr] lg:items-start"
        asideClassName="border-0 bg-transparent p-0 shadow-none"
        actions={(
          <>
            <Link className="btn-primary" to="/individual-health-insurance">
              Review Coverage Guide
            </Link>
            <Link className="btn-secondary" to={employerPath}>
              Need Employer Coverage Instead?
            </Link>
          </>
        )}
        children={(
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="soft-panel">
              <p className="font-semibold text-slate-950">Have these basics ready</p>
              <p className="mt-2 text-sm leading-7 text-slate-700">
                Your state, the best contact details to reach you, and any timing details that help
                us understand when you need coverage.
              </p>
            </div>
            <div className="soft-panel">
              <p className="font-semibold text-slate-950">Best use for this form</p>
              <p className="mt-2 text-sm leading-7 text-slate-700">
                Personal or family coverage questions, plan comparison, monthly cost concerns,
                provider checks, prescription questions, or lost coverage timing.
              </p>
            </div>
            <div className="surface-card sm:col-span-2">
              <p className="eyebrow">Before You Submit</p>
              <h2 className="section-title mt-2">The information that helps most</h2>
              <div className="mt-6 space-y-4">
                {[
                  'Your state and preferred contact information.',
                  'Any recent life event affecting enrollment timing, such as losing coverage.',
                  'Questions about subsidies, provider access, prescriptions, or plan comparison.',
                ].map((item) => (
                  <div key={item} className="soft-panel text-sm leading-7 text-slate-700">
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
          </div>
        )}
        aside={(
          <div id="individual-form" className="pulse-glow lg:sticky lg:top-28">
            <ContactForm compact={false} initialProductType="aca" lockProductType />
          </div>
        )}
      />
    </>
  );
}
