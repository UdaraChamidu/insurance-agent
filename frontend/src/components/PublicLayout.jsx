import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { ArrowRight, Building2, LogIn, Menu, ShieldCheck, UserRound, X } from 'lucide-react';
import { blogPosts } from '../content/blogPosts';
import { navigationItems } from '../content/siteContent';

const footerArticles = blogPosts.slice(0, 3);
const serviceShortcuts = [
  {
    title: 'Individual Coverage',
    description: 'ACA Marketplace guidance for individuals and families.',
    to: '/individual-health-insurance',
    icon: UserRound,
  },
  {
    title: 'Employer Intake',
    description: 'Start the employer and group coverage workflow directly.',
    to: '/employer-intake',
    icon: Building2,
  },
];

function NavLinks({ mobile = false, onSelect }) {
  return navigationItems.map((item) => (
    <NavLink
      key={item.to}
      className={({ isActive }) =>
        mobile
          ? `rounded-[1.35rem] border px-4 py-4 transition ${
              isActive
                ? 'border-blue-300 bg-white text-slate-950 shadow-[0_16px_34px_rgba(37,99,235,0.12)]'
                : 'border-transparent bg-transparent text-slate-700 hover:border-blue-200 hover:bg-white/80'
            }`
          : `nav-link-modern ${isActive ? 'active' : ''}`
      }
      onClick={onSelect}
      to={item.to}
    >
      {mobile ? (
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-display text-lg font-bold text-current">{item.label}</p>
            <p className={`mt-1 text-sm leading-6 ${item.description ? 'text-slate-500' : 'hidden'}`}>
              {item.description}
            </p>
          </div>
          <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-blue-600" />
        </div>
      ) : (
        item.shortLabel || item.label
      )}
    </NavLink>
  ));
}

export default function PublicLayout() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();
  const showMobileActionBar = !['/contact', '/employer-intake'].includes(location.pathname) && !isMenuOpen;

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 24);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMenuOpen]);

  return (
    <div className="site-shell public-shell">
      {isMenuOpen ? (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-slate-950/20 backdrop-blur-[2px] lg:hidden"
          onClick={() => setIsMenuOpen(false)}
          type="button"
        />
      ) : null}

      <header
        className={`navbar-glass navbar-entrance sticky top-0 z-40 ${isScrolled ? 'scrolled' : ''}`}
      >
        <div className="navbar-accent-bar" />

        <div className={`mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 transition-all duration-300 ${isScrolled ? 'py-2.5' : 'py-3.5'}`}>
          <div className="flex items-center justify-between gap-6">
            <Link className="group flex min-w-0 items-center gap-3" to="/">
              <div className="logo-glow flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-sky-500 text-white transition-transform duration-300 group-hover:scale-105">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-lg font-bold text-slate-900 tracking-tight" style={{ fontFamily: 'var(--font-public-display)' }}>
                  Elite Deal Broker
                </p>
                <p className="truncate text-[11px] font-medium uppercase tracking-[0.18em] text-blue-600/80">
                  Employer Benefits Brokerage
                </p>
              </div>
            </Link>

            <nav className="hidden flex-1 justify-center lg:flex">
              <div className="flex items-center gap-1">
                <NavLinks />
              </div>
            </nav>

            <div className="hidden items-center gap-3 lg:flex">
              <Link
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/85 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                to="/admin/login"
              >
                <LogIn className="h-4 w-4" />
                Admin Login
              </Link>
              <Link className="btn-secondary" to="/faq">
                View FAQs
              </Link>
              <Link className="btn-primary" to="/contact">
                Start Here
              </Link>
            </div>

            <button
              aria-label="Toggle navigation"
              className="inline-flex items-center gap-2 rounded-2xl border border-blue-100/80 bg-white/90 px-4 py-3 text-slate-900 shadow-sm transition-all duration-200 hover:bg-blue-50 hover:shadow-md lg:hidden"
              onClick={() => setIsMenuOpen((value) => !value)}
              type="button"
            >
              <div className="relative h-5 w-5">
                <Menu className={`absolute inset-0 h-5 w-5 transition-all duration-300 ${isMenuOpen ? 'rotate-90 opacity-0' : 'rotate-0 opacity-100'}`} />
                <X className={`absolute inset-0 h-5 w-5 transition-all duration-300 ${isMenuOpen ? 'rotate-0 opacity-100' : '-rotate-90 opacity-0'}`} />
              </div>
              <span className="text-sm font-semibold">{isMenuOpen ? 'Close' : 'Menu'}</span>
            </button>
          </div>
        </div>

        {isMenuOpen ? (
          <div className="border-t border-blue-100/90 bg-white/98 px-4 pb-5 pt-4 shadow-[0_24px_60px_rgba(37,99,235,0.08)] lg:hidden">
            <div className="mx-auto max-w-lg space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {serviceShortcuts.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      className="rounded-[1.6rem] border border-blue-100 bg-blue-50/65 p-4 shadow-[0_14px_30px_rgba(37,99,235,0.05)] transition hover:border-blue-300 hover:bg-white"
                      onClick={() => setIsMenuOpen(false)}
                      to={item.to}
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-700 to-sky-500 text-white shadow-[0_12px_26px_rgba(37,99,235,0.2)]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <p className="mt-4 font-display text-lg font-bold text-slate-950">{item.title}</p>
                      <p className="mt-2 text-sm leading-7 text-slate-600">{item.description}</p>
                    </Link>
                  );
                })}
              </div>

              <div className="rounded-[1.6rem] border border-blue-100 bg-blue-50/55 p-3">
                <p className="px-2 text-xs font-semibold uppercase tracking-[0.22em] text-blue-700">
                  Browse the Site
                </p>
                <div className="mt-2 grid gap-2">
                  <NavLinks mobile onSelect={() => setIsMenuOpen(false)} />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Link className="btn-secondary justify-center text-center" to="/faq">
                  View FAQs
                </Link>
                <Link className="btn-primary justify-center text-center" to="/contact">
                  Start Here
                </Link>
              </div>

              <Link
                className="inline-flex items-center justify-center gap-2 rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                onClick={() => setIsMenuOpen(false)}
                to="/admin/login"
              >
                <LogIn className="h-4 w-4" />
                Admin Login
              </Link>
            </div>
          </div>
        ) : null}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <Outlet />
      </main>

      {showMobileActionBar ? (
        <div className="fixed inset-x-0 bottom-4 z-30 px-4 lg:hidden">
          <div className="mx-auto flex max-w-md items-center gap-3 rounded-[1.75rem] border border-blue-100 bg-white/92 p-3 shadow-[0_24px_50px_rgba(37,99,235,0.18)] backdrop-blur-xl">
            <Link className="btn-secondary flex-1 justify-center px-4 py-3" to="/faq">
              View FAQ
            </Link>
            <Link className="btn-primary flex-1 justify-center px-4 py-3" to="/contact">
              Start Here
            </Link>
          </div>
        </div>
      ) : null}

      <footer className="border-t border-white/10 bg-[linear-gradient(135deg,#0f172a,#102a4c,#1d4ed8)] text-slate-200">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[1.3fr_0.8fr_0.9fr] lg:px-8">
          <div>
            <p className="eyebrow text-blue-200">Elite Deal Broker</p>
            <h2 className="font-display text-3xl text-white">
              Group health insurance and employer benefits guidance without the noise.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-8 text-slate-300">
              We help employers review group coverage, renewal timing, and next steps with more
              clarity, while keeping a separate path available for individual ACA support.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link className="btn-primary" to="/contact">
                Choose Coverage Path
              </Link>
              <Link className="btn-secondary" to="/employer-intake">
                Employer Intake
              </Link>
              <Link className="inline-flex items-center gap-2 text-sm font-semibold text-blue-200 transition hover:text-white" to="/blog">
                Read the resource center
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">
              Site Links
            </h3>
            <div className="mt-5 flex flex-col gap-3">
              {navigationItems.map((item) => (
                <Link key={item.to} className="transition hover:text-white" to={item.to}>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">
              Featured Articles
            </h3>
            <div className="mt-5 flex flex-col gap-4">
              {footerArticles.map((post) => (
                <Link key={post.slug} className="group rounded-3xl border border-white/10 px-5 py-4 transition hover:border-blue-300/40 hover:bg-white/5" to={`/blog/${post.slug}`}>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-200">
                    {post.category}
                  </p>
                  <p className="mt-2 font-semibold text-white transition group-hover:text-blue-100">
                    {post.title}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 text-sm text-slate-400 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <p>Focused on employer group health insurance, renewals, and a separate ACA support path.</p>
            <p>&copy; {new Date().getFullYear()} Elite Deal Broker. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
