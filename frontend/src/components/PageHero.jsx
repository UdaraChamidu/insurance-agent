export default function PageHero({
  eyebrow,
  title,
  description,
  actions,
  highlights = [],
  aside,
  children,
}) {
  const hasAside = Boolean(aside);

  return (
    <section className="page-reveal pb-8 pt-2">
      {/* Compact header layout */}
      <div className={hasAside ? 'grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-start' : ''}>
        <div>
          {eyebrow ? (
            <p className="eyebrow reveal">{eyebrow}</p>
          ) : null}

          <h1 className="reveal reveal-delay-1 mt-2 max-w-3xl text-3xl font-bold leading-tight text-slate-950 sm:text-4xl lg:text-[2.75rem]" style={{ fontFamily: 'var(--font-public-display)', letterSpacing: '-0.03em' }}>
            {title}
          </h1>

          <p className="reveal reveal-delay-2 mt-4 max-w-2xl text-base leading-7 text-slate-600">
            {description}
          </p>

          {highlights.length ? (
            <div className="reveal reveal-delay-3 mt-4 flex flex-wrap gap-2">
              {highlights.map((item) => (
                <span key={item} className="chip-pill text-[10px] px-3 py-1.5">
                  {item}
                </span>
              ))}
            </div>
          ) : null}

          {actions ? (
            <div className="reveal reveal-delay-4 mt-6 flex flex-wrap gap-3">{actions}</div>
          ) : null}

          {children ? (
            <div className="reveal reveal-delay-4 mt-6">{children}</div>
          ) : null}
        </div>

        {aside ? (
          <aside className="page-reveal stagger-1 rounded-[1.5rem] border border-blue-100 bg-white/85 p-5 backdrop-blur-sm shadow-[0_16px_40px_rgba(37,99,235,0.06)] sm:p-6">
            {aside}
          </aside>
        ) : null}
      </div>

      {/* Subtle gradient bottom line */}
      <div className="mt-8 h-[2px] rounded-full bg-gradient-to-r from-transparent via-blue-400/40 to-transparent" />
    </section>
  );
}
