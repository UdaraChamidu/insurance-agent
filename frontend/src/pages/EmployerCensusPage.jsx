import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  ShieldCheck,
  UploadCloud,
  Users,
  X,
} from 'lucide-react';
import Breadcrumbs from '../components/Breadcrumbs';
import PageHero from '../components/PageHero';
import Seo from '../components/Seo';
import clientDocsService from '../services/clientDocsService';
import leadsService from '../services/leadsService';
import {
  buildBreadcrumbSchema,
  buildContactPageSchema,
  buildOrganizationSchema,
} from '../utils/site';

const ACCEPTED_FILE_TYPES = '.csv,.xlsx,.xls,.pdf';
const MAX_UPLOAD_FILES = 5;

function formatFileSize(bytes) {
  if (!bytes) {
    return '0 KB';
  }

  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function EmployerCensusPage() {
  const [searchParams] = useSearchParams();
  const queryLeadId = searchParams.get('leadId') || searchParams.get('lead') || '';
  const [leadId, setLeadId] = useState(() => queryLeadId || localStorage.getItem('currentLeadId') || '');
  const [lead, setLead] = useState(null);
  const [leadLoading, setLeadLoading] = useState(true);
  const [leadError, setLeadError] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadResult, setUploadResult] = useState(null);

  const breadcrumbs = [
    { label: 'Home', to: '/' },
    { label: 'Employer Intake', to: '/employer-intake' },
    { label: 'Employer Census', to: '/employer-census' },
  ];

  useEffect(() => {
    const resolvedLeadId = queryLeadId || localStorage.getItem('currentLeadId') || '';
    if (resolvedLeadId) {
      localStorage.setItem('currentLeadId', resolvedLeadId);
    }
    setLeadId(resolvedLeadId);
  }, [queryLeadId]);

  useEffect(() => {
    let cancelled = false;

    async function loadLead() {
      if (!leadId) {
        setLead(null);
        setLeadError('');
        setLeadLoading(false);
        return;
      }

      setLeadLoading(true);
      setLeadError('');

      try {
        const response = await leadsService.getLeadById(leadId);
        if ((response?.leadType || '').toLowerCase() !== 'group') {
          throw new Error('This census page is only available for employer/group leads.');
        }

        if (!cancelled) {
          setLead(response);
        }
      } catch (error) {
        if (!cancelled) {
          setLead(null);
          setLeadError(error.message || 'We could not load this employer census request right now.');
        }
      } finally {
        if (!cancelled) {
          setLeadLoading(false);
        }
      }
    }

    loadLead();
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  const handleFileChange = (event) => {
    const nextFiles = Array.from(event.target.files || []);
    if (!nextFiles.length) {
      return;
    }

    setSelectedFiles((current) => {
      const merged = [...current];
      nextFiles.forEach((file) => {
        const alreadyIncluded = merged.some(
          (item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified,
        );
        if (!alreadyIncluded && merged.length < MAX_UPLOAD_FILES) {
          merged.push(file);
        }
      });
      return merged;
    });

    event.target.value = '';
  };

  const removeFile = (targetFile) => {
    setSelectedFiles((current) => current.filter((file) => file !== targetFile));
  };

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!leadId || !selectedFiles.length) {
      return;
    }

    setUploading(true);
    setUploadError('');
    setUploadResult(null);

    try {
      const results = [];
      for (const file of selectedFiles) {
        const response = await clientDocsService.uploadCensusDocument({
          leadId,
          file,
          description,
        });
        results.push(response);
      }

      const finalLead = results[results.length - 1]?.lead;
      if (finalLead?.pipelineStatus) {
        setLead((current) => (current ? { ...current, pipelineStatus: finalLead.pipelineStatus } : current));
      }

      setUploadResult({
        count: results.length,
        filenames: results.map((item) => item?.document?.filename).filter(Boolean),
        pipelineStatus: finalLead?.pipelineStatus || lead?.pipelineStatus || '',
      });
      setSelectedFiles([]);
      setDescription('');
    } catch (error) {
      setUploadError(error.message || 'We could not upload the census file right now.');
    } finally {
      setUploading(false);
    }
  };

  const currentCompanyLabel = lead?.companyName || 'Employer case';

  return (
    <>
      <Seo
        description="Download the employer census template, upload the completed file, and link it directly to your group health insurance lead."
        keywords={[
          'employer census upload',
          'employee census template',
          'group health insurance census',
          'small business census file upload',
        ]}
        path="/employer-census"
        structuredData={[
          buildOrganizationSchema(),
          buildContactPageSchema({
            path: '/employer-census',
            title: 'Employer Census Upload',
            description: 'Download the employer census template, upload the completed file, and link it directly to your group health insurance lead.',
          }),
          buildBreadcrumbSchema(breadcrumbs),
        ]}
        title="Employer Census Upload"
      />

      <Breadcrumbs items={breadcrumbs} />
      <PageHero
        eyebrow="Employer Census"
        title="Download the census template and upload the completed file into the employer workflow."
        description="This step gives the case the employee census needed for quoting and moves the group lead closer to the next review stage without manual follow-up."
        highlights={[
          'CSV template ready to download',
          'Upload links directly to the employer lead',
          'Moves the CRM toward census received',
        ]}
        actions={(
          <>
            <a className="btn-primary" download href="/templates/employer-census-template.csv">
              <Download className="h-4 w-4" />
              Download CSV Template
            </a>
          </>
        )}
        aside={(
          <div>
            <p className="eyebrow">Template Includes</p>
            <div className="mt-4 space-y-3">
              {[
                'Employee name, date of birth, gender, and ZIP code.',
                'Coverage election, tobacco-use, spouse, and dependent columns.',
                'A simple CSV format that can be completed and uploaded here.',
              ].map((item) => (
                <div key={item} className="soft-panel text-sm leading-7 text-slate-700">
                  {item}
                </div>
              ))}
            </div>
          </div>
        )}
      />

      {!leadId && (
        <section className="section-pad">
          <div className="surface-card max-w-3xl">
            <p className="eyebrow">Employer Lead Required</p>
            <h2 className="section-title mt-2">Start with the employer intake before uploading a census.</h2>
            <p className="body-copy mt-4 text-slate-700">
              We need a group lead record first so the census file lands in the right CRM case and
              document bucket.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link className="btn-primary" to="/contact?tab=employer">
                Open Employer Intake
              </Link>
              <Link className="btn-secondary" to="/contact">
                Choose Coverage Path
              </Link>
            </div>
          </div>
        </section>
      )}

      {leadId && leadLoading && (
        <section className="section-pad">
          <div className="surface-card max-w-3xl">
            <div className="flex items-center gap-3 text-slate-700">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--brand)]" />
              <span>Loading the employer census request...</span>
            </div>
          </div>
        </section>
      )}

      {leadId && !leadLoading && leadError && (
        <section className="section-pad">
          <div className="surface-card max-w-3xl">
            <p className="eyebrow">Unable To Load Case</p>
            <h2 className="section-title mt-2">We could not open this employer census request.</h2>
            <p className="body-copy mt-4 text-slate-700">{leadError}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link className="btn-primary" to="/contact?tab=employer">
                Back to Employer Intake
              </Link>
              <Link className="btn-secondary" to="/contact">
                Choose Coverage Path
              </Link>
            </div>
          </div>
        </section>
      )}

      {lead && !leadLoading && !leadError && (
        <section className="section-pad grid gap-8 lg:grid-cols-[0.88fr_1.12fr]">
          <div className="space-y-6">
            <article className="surface-card">
              <p className="eyebrow">Employer Case</p>
              <h2 className="section-title mt-2">{currentCompanyLabel}</h2>
              <div className="mt-5 grid gap-4 text-sm text-slate-700 sm:grid-cols-2">
                <div className="soft-panel">
                  <p className="font-semibold text-slate-950">Reference ID</p>
                  <p className="mt-1 break-all">{lead.id}</p>
                </div>
                <div className="soft-panel">
                  <p className="font-semibold text-slate-950">Current pipeline stage</p>
                  <p className="mt-1 uppercase tracking-[0.14em] text-[var(--brand-dark)]">{(lead.pipelineStatus || 'new_lead').replaceAll('_', ' ')}</p>
                </div>
                <div className="soft-panel">
                  <p className="font-semibold text-slate-950">Contact person</p>
                  <p className="mt-1">{lead.contactPerson || `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Not provided yet'}</p>
                </div>
                <div className="soft-panel">
                  <p className="font-semibold text-slate-950">Employees</p>
                  <p className="mt-1">{lead.numEmployees || 'Not provided yet'}</p>
                </div>
              </div>
            </article>

            <article className="surface-card">
              <p className="eyebrow">How This Step Helps</p>
              <div className="mt-5 space-y-4">
                {[
                  {
                    icon: FileSpreadsheet,
                    title: 'Standard template',
                    text: 'Use the CSV file if you need a simple starting structure for employee census details.',
                  },
                  {
                    icon: Users,
                    title: 'Lead-linked upload',
                    text: 'Files uploaded here are attached to the current employer lead instead of landing in a generic inbox.',
                  },
                  {
                    icon: ShieldCheck,
                    title: 'CRM progress',
                    text: 'A successful upload moves eligible group leads into the census received stage automatically.',
                  },
                ].map((item) => (
                  <div key={item.title} className="soft-panel">
                    <div className="flex items-start gap-3">
                      <div
                        className="icon-float flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-[0_14px_30px_rgba(188,25,24,0.18)]"
                        style={{ background: 'var(--brand)' }}
                      >
                        <item.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-950">{item.title}</h3>
                        <p className="mt-2 text-sm leading-7 text-slate-700">{item.text}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6">
                <a className="btn-secondary" download href="/templates/employer-census-template.csv">
                  <Download className="h-4 w-4" />
                  Download CSV Template
                </a>
              </div>
            </article>
          </div>

          <form className="surface-card" onSubmit={handleUpload}>
            <div className="accent-panel">
              <p className="eyebrow">Upload Census</p>
              <h2 className="font-display text-2xl font-bold text-slate-950">
                Attach the completed census file to this employer case.
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Accepted formats: CSV, XLSX, XLS, or PDF. Upload up to {MAX_UPLOAD_FILES} files if
                the census comes in more than one attachment.
              </p>
            </div>

            <div className="mt-8 grid gap-6">
              {uploadResult && (
                <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 px-5 py-5 text-sm text-emerald-900">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                    <div>
                      <p className="font-semibold">Census upload completed.</p>
                      <p className="mt-2 leading-7">
                        Uploaded {uploadResult.count} file{uploadResult.count === 1 ? '' : 's'} for {currentCompanyLabel}.
                        {uploadResult.pipelineStatus ? ` Pipeline stage: ${uploadResult.pipelineStatus.replaceAll('_', ' ')}.` : ''}
                      </p>
                      {uploadResult.filenames.length > 0 && (
                        <p className="mt-2 leading-7">
                          Files: {uploadResult.filenames.join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {uploadError && (
                <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-5 py-4 text-sm leading-7 text-rose-900">
                  {uploadError}
                </div>
              )}

              <label className="block">
                <span className="label mb-3 block">Census file</span>
                <div className="rounded-[1.75rem] border-2 border-dashed border-[var(--brand-soft-strong)] bg-white px-6 py-10 text-center">
                  <div
                    className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-[0_14px_30px_rgba(188,25,24,0.18)]"
                    style={{ background: 'var(--brand)' }}
                  >
                    <UploadCloud className="h-6 w-6" />
                  </div>
                  <p className="mt-4 font-semibold text-slate-950">Select the completed census file to upload.</p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    Keep employee rows in the template order if possible so review and quoting stay clean.
                  </p>
                  <input
                    accept={ACCEPTED_FILE_TYPES}
                    className="mt-5 block w-full cursor-pointer text-sm text-slate-700 file:mr-4 file:rounded-full file:border-0 file:bg-[#bc1918] file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-[#991413]"
                    multiple
                    onChange={handleFileChange}
                    type="file"
                  />
                </div>
              </label>

              {selectedFiles.length > 0 && (
                <div>
                  <p className="label mb-3">Selected files</p>
                  <div className="space-y-3">
                    {selectedFiles.map((file) => (
                      <div key={`${file.name}-${file.lastModified}`} className="soft-panel flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-950">{file.name}</p>
                          <p className="mt-1 text-sm text-slate-600">{formatFileSize(file.size)}</p>
                        </div>
                        <button
                          className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:border-rose-200 hover:text-rose-600"
                          onClick={() => removeFile(file)}
                          type="button"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <label className="block">
                <span className="label mb-3 block">Notes for this upload (optional)</span>
                <textarea
                  className="input min-h-[120px] resize-y"
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Add any notes about the census version, missing dependents, waiver counts, or other context."
                  value={description}
                />
              </label>

              <div className="flex flex-wrap gap-3">
                <button
                  className="btn-primary"
                  disabled={uploading || selectedFiles.length === 0}
                  type="submit"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Uploading Census
                    </>
                  ) : (
                    <>
                      <UploadCloud className="h-4 w-4" />
                      Upload Census File
                    </>
                  )}
                </button>
                <a className="btn-secondary" download href="/templates/employer-census-template.csv">
                  <Download className="h-4 w-4" />
                  Download Template
                </a>
                <Link className="btn-secondary" to="/contact">
                  Back to Contact
                </Link>
              </div>
            </div>
          </form>
        </section>
      )}
    </>
  );
}
