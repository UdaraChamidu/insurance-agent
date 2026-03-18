import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { ArrowRight, Building2, CalendarDays, LogIn, Menu, UserRound, X } from 'lucide-react';
import { blogPosts } from '../content/blogPosts';
import { navigationItems } from '../content/siteContent';

const footerArticles = blogPosts.slice(0, 3);
const serviceShortcuts = [
  {
    title: 'Individual / Family Coverage',
    description: 'Start the individual intake for ACA Marketplace guidance and personal coverage.',
    to: '/individual-intake',
    icon: UserRound,
  },
  {
    title: 'Employer / Small Business Coverage',
    description: 'Start the employer intake for group health insurance and renewals.',
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
                ? 'border-[var(--brand-soft-strong)] bg-white text-slate-950 shadow-[0_16px_34px_rgba(188,25,24,0.08)]'
                : 'border-transparent bg-transparent text-slate-700 hover:border-[var(--brand-soft)] hover:bg-[var(--panel-soft)]'
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
          <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[var(--brand)]" />
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
  const showMobileActionBar = !['/contact', '/individual-intake', '/employer-intake', '/employer-census'].includes(location.pathname) && !isMenuOpen;

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
          <div className="flex items-center justify-between gap-4">
            <Link className="group flex shrink-0 items-center gap-3" to="/">
              <div className="logo-glow overflow-hidden rounded-2xl border border-[var(--line)] bg-white p-1 transition-transform duration-300 group-hover:scale-105">
                <img
                  alt="Elite Deal Broker logo"
                  className="h-11 w-11 rounded-[0.9rem] object-cover"
                  src="/logo.jpeg"
                />
              </div>
              <div className="min-w-0">
                <p className="text-base font-bold leading-tight text-slate-900 tracking-tight xl:text-lg" style={{ fontFamily: 'var(--font-public-display)' }}>
                  Elite Deal Broker
                </p>
                <p className="mt-1 hidden text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--brand-dark)] 2xl:block">
                  Health Insurance Brokerage
                </p>
              </div>
            </Link>

            <nav className="hidden flex-1 justify-center lg:flex">
              <div className="flex items-center gap-1">
                <NavLinks />
              </div>
            </nav>

            <div className="hidden shrink-0 items-center gap-2.5 lg:flex">
              {/* <Link
                className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-[var(--line)] bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-[var(--brand)] hover:bg-[var(--panel-soft)] hover:text-[var(--brand-dark)]"
                to="/schedule"
              >
                <CalendarDays className="h-4 w-4" />
                Schedule a Meeting
              </Link> */}
              <Link
                className="inline-flex items-center gap-2 whitespace-nowrap px-2 py-2 text-sm font-semibold text-slate-600 transition hover:text-[var(--brand-dark)]"
                to="/admin/login"
              >
                <LogIn className="h-4 w-4" />
                Admin
              </Link>
              <Link className="btn-primary whitespace-nowrap" to="/contact">
                Start Here
              </Link>
            </div>

            <button
              aria-label="Toggle navigation"
              className="inline-flex items-center gap-2 rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-slate-900 shadow-sm transition-all duration-200 hover:bg-[var(--panel-soft)] hover:shadow-md lg:hidden"
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
          <div className="border-t border-[var(--line)] bg-white px-4 pb-5 pt-4 shadow-[0_24px_60px_rgba(59,33,29,0.08)] lg:hidden">
            <div className="mx-auto max-w-lg space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {serviceShortcuts.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      className="rounded-[1.6rem] border border-[var(--line)] bg-[var(--panel-soft)] p-4 shadow-[0_14px_30px_rgba(59,33,29,0.05)] transition hover:border-[var(--brand-soft-strong)] hover:bg-white"
                      onClick={() => setIsMenuOpen(false)}
                      to={item.to}
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--brand)] text-white shadow-[0_12px_26px_rgba(188,25,24,0.18)]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <p className="mt-4 font-display text-lg font-bold text-slate-950">{item.title}</p>
                      <p className="mt-2 text-sm leading-7 text-slate-600">{item.description}</p>
                    </Link>
                  );
                })}
              </div>

              <div className="rounded-[1.6rem] border border-[var(--line)] bg-[var(--panel-soft)] p-3">
                <p className="px-2 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--brand-dark)]">
                  Browse the Site
                </p>
                <div className="mt-2 grid gap-2">
                  <NavLinks mobile onSelect={() => setIsMenuOpen(false)} />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Link className="btn-secondary justify-center text-center" to="/schedule">
                  Schedule
                </Link>
                <Link className="btn-primary justify-center text-center" to="/contact">
                  Start Here
                </Link>
              </div>

              <Link
                className="inline-flex items-center justify-center gap-2 rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-[var(--brand)] hover:bg-[var(--panel-soft)] hover:text-[var(--brand-dark)]"
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
          <div className="mx-auto flex max-w-md items-center gap-3 rounded-[1.75rem] border border-[var(--line)] bg-white p-3 shadow-[0_24px_50px_rgba(59,33,29,0.14)]">
            <Link className="btn-secondary flex-1 justify-center px-4 py-3" to="/schedule">
              Schedule
            </Link>
            <Link className="btn-primary flex-1 justify-center px-4 py-3" to="/contact">
              Start Here
            </Link>
          </div>
        </div>
      ) : null}

      <footer className="border-t border-[#511414] bg-[linear-gradient(135deg,#2b0d0d,#4b1111,#6f1414)] text-slate-200">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[1.3fr_0.8fr_0.9fr] lg:px-8">
          <div>
            <div className="flex items-center gap-3">
              <div className="overflow-hidden rounded-2xl border border-white/15 bg-white p-1">
                <img
                  alt="Elite Deal Broker logo"
                  className="h-12 w-12 rounded-[0.95rem] object-cover"
                  src="/logo.jpeg"
                />
              </div>
              <div>
                <p className="eyebrow text-[#f8d9d5]">Elite Deal Broker</p>
                <p className="text-sm text-[#f0b8b1]">Health Insurance Brokerage</p>
              </div>
            </div>
            <h2 className="font-display text-3xl text-white">
              Group health insurance and employer benefits guidance without the noise.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-8 text-slate-300">
              We help employers review group coverage, renewal timing, and next steps with more
              clarity, while keeping a separate path available for individual ACA support.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link className="btn-primary" to="/contact">
                Start Here
              </Link>
              <Link className="btn-light" to="/individual-intake">
                Enroll Now
              </Link>
              <Link className="btn-outline-light" to="/schedule">
                Schedule a Meeting
              </Link>
              <Link className="inline-flex items-center gap-2 text-sm font-semibold text-[#f6cfc9] transition hover:text-white" to="/blog">
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
                <Link key={post.slug} className="group rounded-3xl border border-white/10 px-5 py-4 transition hover:border-[#f1b8b1] hover:bg-[#7a1c1d]" to={`/blog/${post.slug}`}>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#f6cfc9]">
                    {post.category}
                  </p>
                  <p className="mt-2 font-semibold text-white transition group-hover:text-[#fff3f1]">
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
