import { Link } from 'react-router-dom';
import Seo from '../components/Seo';

export default function NotFoundPage() {
  return (
    <>
      <Seo noindex path="/404" title="Page Not Found" />
      <section className="section-pad">
        <div className="blob-bg mx-auto max-w-3xl rounded-[2rem] border border-slate-200 bg-white px-6 py-14 text-center shadow-[0_30px_80px_rgba(15,23,42,0.06)] sm:px-10">
          <p className="eyebrow reveal">Page Not Found</p>
          <h1 className="reveal reveal-delay-1 display-title text-5xl">
            <span className="gradient-text">404</span>
          </h1>
          <p className="reveal reveal-delay-2 mt-2 font-display text-3xl font-bold text-slate-950">
            That page is not available.
          </p>
          <p className="reveal reveal-delay-3 body-copy mt-5 text-slate-700">
            Try the main service pages, the FAQ page, or the blog to keep exploring ACA Marketplace
            insurance and SHOP health insurance topics.
          </p>
          <div className="reveal reveal-delay-4 mt-8 flex flex-wrap justify-center gap-3">
            <Link className="btn-primary" to="/">
              Return Home
            </Link>
            <Link className="btn-secondary" to="/blog">
              Browse Articles
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
