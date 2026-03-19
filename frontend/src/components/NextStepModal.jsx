import { useEffect } from 'react';
import { CheckCircle2, X } from 'lucide-react';

export default function NextStepModal({
  open,
  eyebrow = 'Request Saved',
  title,
  description,
  referenceId,
  primaryLabel = 'Continue',
  secondaryLabel = 'Not Now',
  onPrimary,
  onSecondary,
  onClose,
}) {
  useEffect(() => {
    if (!open) return undefined;

    const handleEsc = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(34,24,23,0.52)] p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.();
        }
      }}
      role="dialog"
    >
      <div className="w-full max-w-lg rounded-[2rem] border border-[var(--line)] bg-white p-6 shadow-[0_32px_80px_rgba(59,33,29,0.24)] sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-[1.4rem] text-white shadow-[0_14px_30px_rgba(188,25,24,0.18)]"
            style={{ background: 'var(--brand)' }}
          >
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <button
            aria-label="Close dialog"
            className="rounded-2xl border border-[var(--line)] bg-white p-2 text-slate-500 transition hover:bg-[var(--panel-soft)] hover:text-[var(--brand-dark)]"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5">
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="section-title mt-2 text-2xl">{title}</h2>
          <p className="body-copy mt-4 text-slate-700">{description}</p>
          {referenceId ? (
            <p className="mt-4 text-sm leading-7 text-slate-600">
              Reference ID: <span className="font-semibold text-slate-950">{referenceId}</span>
            </p>
          ) : null}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button className="btn-primary" onClick={onPrimary} type="button">
            {primaryLabel}
          </button>
          <button className="btn-secondary" onClick={onSecondary} type="button">
            {secondaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
