import { Search } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import Breadcrumbs from '../components/Breadcrumbs';
import PageHero from '../components/PageHero';
import Seo from '../components/Seo';
import { blogPosts } from '../content/blogPosts';
import {
  buildBreadcrumbSchema,
  buildCollectionPageSchema,
  buildItemListSchema,
  buildOrganizationSchema,
} from '../utils/site';

export default function BlogIndexPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = (searchParams.get('query') || '').trim();
  const normalizedQuery = query.toLowerCase();
  const popularTopics = ['ACA', 'SHOP', 'tax credit', 'small business', 'enrollment'];

  const breadcrumbs = [
    { label: 'Home', to: '/' },
    { label: 'Blog', to: '/blog' },
  ];

  const filteredPosts = normalizedQuery
    ? blogPosts.filter((post) => {
        const haystack = [
          post.title,
          post.excerpt,
          post.description,
          post.category,
          ...post.keywords,
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(normalizedQuery);
      })
    : blogPosts;

  const featuredPost = filteredPosts[0] || blogPosts[0];

  function handleQueryChange(event) {
    updateQuery(event.target.value);
  }

  function updateQuery(nextValue) {
    const nextParams = new URLSearchParams(searchParams);

    if (!nextValue.trim()) {
      nextParams.delete('query');
    } else {
      nextParams.set('query', nextValue);
    }

    setSearchParams(nextParams, { replace: true });
  }

  return (
    <>
      <Seo
        description="Read SEO-focused articles about ACA Marketplace insurance, SHOP health insurance, enrollment assistance, and small business coverage strategy."
        keywords={[
          'health insurance blog',
          'ACA Marketplace articles',
          'SHOP health insurance blog',
          'small business health insurance resources',
        ]}
        noindex={Boolean(query)}
        path="/blog"
        structuredData={[
          buildOrganizationSchema(),
          buildCollectionPageSchema({
            path: '/blog',
            title: 'Blog',
            description:
              'Read SEO-focused articles about ACA Marketplace insurance, SHOP health insurance, enrollment assistance, and small business coverage strategy.',
          }),
          buildBreadcrumbSchema(breadcrumbs),
          buildItemListSchema(
            blogPosts.map((post) => ({
              name: post.title,
              path: `/blog/${post.slug}`,
            })),
          ),
        ]}
        title="Blog"
      />

      <Breadcrumbs items={breadcrumbs} />
      <PageHero
        eyebrow="Resource Center"
        title="Articles about ACA Marketplace insurance and SHOP coverage."
        description="This blog is built to support high-intent search topics around health insurance brokers, ACA enrollment assistance, small business health insurance, and the SHOP Marketplace."
        highlights={[
          `${blogPosts.length} long-form articles`,
          'Built around high-intent search questions',
          'Linked directly to service and contact pages',
        ]}
        aside={
          <div>
            <p className="eyebrow">Browse By Intent</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {popularTopics.map((topic) => (
                <button
                  key={topic}
                  className="chip-pill cursor-pointer border-blue-200 hover:border-blue-300"
                  onClick={() => updateQuery(topic)}
                  type="button"
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>
        }
      />

      <section className="section-pad pt-0">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="surface-card">
            <label className="label" htmlFor="blog-search">
              Search articles
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                className="input pl-12"
                id="blog-search"
                onChange={handleQueryChange}
                placeholder="Search ACA Marketplace, SHOP, tax credits, enrollment..."
                type="search"
                value={query}
              />
            </div>
            {query ? (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <p className="text-sm text-slate-600">
                  Showing {filteredPosts.length} result{filteredPosts.length === 1 ? '' : 's'} for "{query}".
                </p>
                <button className="btn-secondary px-4 py-2" onClick={() => updateQuery('')} type="button">
                  Clear search
                </button>
              </div>
            ) : (
              <p className="mt-4 text-sm leading-7 text-slate-600">
                Search the article library by topic, or use one of the suggested themes to jump into the
                highest-intent insurance questions.
              </p>
            )}
          </div>
          <div className="surface-card">
            <p className="eyebrow">Popular Topics</p>
            <h2 className="section-title mt-2 text-2xl">Start from the questions people ask first.</h2>
            <div className="mt-5 flex flex-wrap gap-2">
              {popularTopics.map((topic) => (
                <button
                  key={topic}
                  className="chip-pill cursor-pointer border-blue-200 hover:border-blue-300"
                  onClick={() => updateQuery(topic)}
                  type="button"
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section-pad ">
        <article className="cta-glow-border rounded-[2rem] border border-blue-200 bg-red-900 px-6 py-10 text-white shadow-[0_30px_80px_rgba(37,99,235,0.26)] sm:px-10">
          <p className="eyebrow text-blue-100">Featured Article</p>
          <h2 className="font-display text-4xl text-white">{featuredPost.title}</h2>
          <p className="mt-4 max-w-3xl text-base leading-8 text-blue-50">{featuredPost.excerpt}</p>
          <Link className="btn-light mt-8" to={`/blog/${featuredPost.slug}`}>
            Read Featured Article
          </Link>
        </article>
      </section>

      <section className="section-pad">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow">Article Library</p>
            <h2 className="section-title mt-2 text-3xl">
              {query ? 'Matching resources' : 'Latest Marketplace and SHOP guidance'}
            </h2>
          </div>
          <p className="text-sm leading-7 text-slate-600">
            {filteredPosts.length} article{filteredPosts.length === 1 ? '' : 's'} available.
          </p>
        </div>
        {filteredPosts.length === 0 ? (
          <div className="surface-card">
            <h2 className="section-title text-2xl">No articles matched that search.</h2>
            <p className="body-copy mt-4 text-slate-700">
              Try a broader term like "ACA", "SHOP", "small business", or "tax credit".
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredPosts.map((post, index) => (
              <article key={post.slug} className="surface-card gradient-border reveal" style={{ animationDelay: `${index * 80}ms` }}>
                <p className="eyebrow">{post.category}</p>
                <h2 className="section-title mt-2 text-2xl">{post.title}</h2>
                <p className="mt-3 text-sm text-slate-500">
                  {post.readTime} | {post.published}
                </p>
                <p className="body-copy mt-4 text-slate-700">{post.excerpt}</p>
                <Link className="link-arrow pt-6" to={`/blog/${post.slug}`}>
                  Read article
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
