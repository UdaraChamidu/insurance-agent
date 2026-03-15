import { Link, useParams } from 'react-router-dom';
import Breadcrumbs from '../components/Breadcrumbs';
import InlineLinkText from '../components/InlineLinkText';
import Seo from '../components/Seo';
import { blogPosts, getPostBySlug } from '../content/blogPosts';
import { buildArticleSchema, buildBreadcrumbSchema, buildOrganizationSchema } from '../utils/site';
import NotFoundPage from './NotFoundPage';

export default function BlogPostPage() {
  const { slug } = useParams();
  const post = getPostBySlug(slug);

  if (!post) {
    return <NotFoundPage />;
  }

  const relatedPosts = blogPosts
    .filter((item) => item.slug !== post.slug)
    .filter(
      (item) =>
        item.category === post.category ||
        item.keywords.some((keyword) => post.keywords.includes(keyword)),
    )
    .slice(0, 3);

  const breadcrumbs = [
    { label: 'Home', to: '/' },
    { label: 'Blog', to: '/blog' },
    { label: post.title, to: `/blog/${post.slug}` },
  ];

  return (
    <>
      <Seo
        description={post.description}
        keywords={post.keywords}
        modifiedTime={post.updated}
        path={`/blog/${post.slug}`}
        publishedTime={post.published}
        structuredData={[
          buildOrganizationSchema(),
          buildBreadcrumbSchema(breadcrumbs),
          buildArticleSchema(post),
        ]}
        title={post.title}
        type="article"
      />

      <Breadcrumbs items={breadcrumbs} />
      <article className="mx-auto max-w-4xl">
        <header className="reveal rounded-[2rem] border border-white/70 bg-white px-6 py-10 shadow-[0_30px_80px_rgba(15,23,42,0.06)] sm:px-10">
          <p className="eyebrow">{post.category}</p>
          <h1 className="display-title text-5xl">{post.title}</h1>
          <p className="body-copy mt-5 text-lg text-slate-700">{post.description}</p>
          <p className="mt-6 text-sm text-slate-500">
            Published {post.published} | Updated {post.updated} | {post.readTime}
          </p>
        </header>

        <div className="section-pad">
          <div className="space-y-8 rounded-[2rem] border border-slate-200 bg-white px-6 py-10 shadow-[0_30px_80px_rgba(15,23,42,0.06)] sm:px-10">
            {post.sections.map((section) => (
              <section key={section.heading} className="article-prose">
                <h2>{section.heading}</h2>
                {section.paragraphs.map((paragraph, index) => (
                  <p key={`${section.heading}-${index}`}>
                    <InlineLinkText text={paragraph} />
                  </p>
                ))}
              </section>
            ))}
          </div>
        </div>

        <section className="section-pad">
          <div className="rounded-[2rem] border border-slate-200 bg-white px-6 py-10 shadow-[0_30px_80px_rgba(15,23,42,0.06)] sm:px-10">
            <p className="eyebrow">Helpful Next Steps</p>
            <h2 className="section-title mt-2">Related resources for this topic</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {post.relatedLinks.map((item) => (
                <Link
                  key={item.href}
                  className="gradient-border rounded-[1.5rem] border border-blue-100 bg-blue-50/70 px-5 py-5 font-semibold text-slate-950 transition hover:bg-blue-100 hover:scale-[1.02]"
                  to={item.href}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="section-pad">
          <div className="grid gap-6 lg:grid-cols-3">
            {relatedPosts.map((item, index) => (
              <article key={item.slug} className="surface-card gradient-border reveal" style={{ animationDelay: `${index * 100}ms` }}>
                <p className="eyebrow">{item.category}</p>
                <h2 className="section-title mt-2 text-2xl">{item.title}</h2>
                <p className="body-copy mt-4 text-slate-700">{item.excerpt}</p>
                <Link
                  className="link-arrow pt-6"
                  to={`/blog/${item.slug}`}
                >
                  Read article
                </Link>
              </article>
            ))}
          </div>
        </section>
      </article>
    </>
  );
}
