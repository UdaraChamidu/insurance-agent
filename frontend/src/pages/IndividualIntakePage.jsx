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
        description="Request ACA Marketplace guidance for individual or family health coverage and continue into scheduling when ready."
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
              'Request ACA Marketplace guidance for individual or family health coverage and continue into scheduling when ready.',
          }),
          buildBreadcrumbSchema(breadcrumbs),
        ]}
        title="Individual Intake"
      />

      <Breadcrumbs items={breadcrumbs} />
      <PageHero
        eyebrow="Individual Intake"
        title="Request ACA Marketplace help for individual or family coverage."
        description="Use the short request form for personal coverage questions. ACA means Affordable Care Act Marketplace coverage for individuals and families. If you are reviewing benefits for a company or employer group, switch to the employer intake so the case starts in the right workflow."
        highlights={[
          'Individual and family coverage only',
          'Short request form',
          'Ready for scheduling after submission',
        ]}
        actions={(
          <>
            <Link className="btn-primary" to="/schedule">
              Schedule a Meeting
            </Link>
            <Link className="btn-secondary" to={employerPath}>
              Need Employer Coverage Instead?
            </Link>
          </>
        )}
        aside={(
          <div>
            <p className="eyebrow">Need Employer Help Instead?</p>
            <div className="mt-4 space-y-3">
              {[
                'Employer and group cases use a separate intake with company details, employee counts, and renewal timing.',
                'That intake creates the CRM case directly in the group pipeline.',
                'Use the employer intake if you are gathering quotes for a business.',
              ].map((item) => (
                <div key={item} className="soft-panel text-sm leading-7 text-slate-700">
                  {item}
                </div>
              ))}
            </div>
            <div className="mt-5">
              <Link className="btn-secondary" to={employerPath}>
                Open Employer Intake
              </Link>
            </div>
          </div>
        )}
      />

      <section className="section-pad grid gap-8 lg:grid-cols-[1.06fr_0.94fr]">
        <div id="individual-form" className="lg:sticky lg:top-28 pulse-glow">
          <ContactForm compact={false} initialProductType="aca" lockProductType />
        </div>
        <div className="space-y-6">
          <div className="surface-card">
            <p className="eyebrow">Before You Submit</p>
            <h2 className="section-title mt-2">The information that helps most</h2>
            <div className="mt-6 space-y-4">
              {[
                'Your state and preferred contact information.',
                'Any recent life event affecting enrollment timing, such as losing coverage.',
                'Questions about subsidies, provider access, prescriptions, or plan comparison.',
              ].map((item, index) => (
                <div
                  key={item}
                  className="soft-panel text-sm leading-7 text-slate-700 reveal"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
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

          <div className="surface-card">
            <p className="eyebrow">Plain Language</p>
            <h2 className="section-title mt-2">ACA means personal or family Marketplace coverage.</h2>
            <p className="body-copy mt-4 text-slate-700">
              If the request is for a business, an employer, or employee benefits, use the employer intake instead of this individual form.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link className="btn-secondary" to={employerPath}>
                Start Employer Intake
              </Link>
              <Link className="btn-primary" to="/schedule">
                Schedule a Meeting
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
