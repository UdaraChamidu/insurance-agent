import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { blogPosts } from '../src/content/blogPosts.js';
import { seoConfig } from '../src/content/seoConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const publicDir = path.join(projectRoot, 'public');

const staticPages = [
  {
    path: '/',
    title: 'ACA Marketplace and SHOP Health Insurance Broker',
    description:
      'Helping individuals and small businesses find affordable health insurance through the ACA Marketplace and SHOP.',
    source: 'src/pages/HomePage.jsx',
    priority: '1.0',
    changefreq: 'weekly',
  },
  {
    path: '/about-us',
    title: 'About Us',
    description:
      'Learn about Elite Deal Broker and how we help people navigate ACA Marketplace and SHOP enrollment.',
    source: 'src/pages/AboutPage.jsx',
    priority: '0.8',
    changefreq: 'monthly',
  },
  {
    path: '/shop-health-insurance',
    title: 'SHOP Health Insurance',
    description:
      'Small business health insurance guidance built around the SHOP Marketplace.',
    source: 'src/pages/ShopHealthInsurancePage.jsx',
    priority: '0.9',
    changefreq: 'weekly',
  },
  {
    path: '/individual-health-insurance',
    title: 'Individual Marketplace Insurance',
    description:
      'ACA Marketplace insurance guidance for individuals and families.',
    source: 'src/pages/IndividualHealthInsurancePage.jsx',
    priority: '0.9',
    changefreq: 'weekly',
  },
  {
    path: '/blog',
    title: 'Blog',
    description:
      'Articles about ACA Marketplace insurance and SHOP coverage.',
    source: 'src/pages/BlogIndexPage.jsx',
    priority: '0.8',
    changefreq: 'weekly',
  },
  {
    path: '/faq',
    title: 'FAQ',
    description:
      'Frequently asked questions about ACA Marketplace insurance and SHOP coverage.',
    source: 'src/pages/FaqPage.jsx',
    priority: '0.8',
    changefreq: 'weekly',
  },
  {
    path: '/contact',
    title: 'Contact',
    description:
      'Request help with ACA Marketplace coverage or SHOP health insurance.',
    source: 'src/pages/ContactPage.jsx',
    priority: '0.8',
    changefreq: 'weekly',
  },
];

const privatePaths = [
  '/admin/',
  '/meeting',
  '/schedule',
  '/appointment/manage/',
];

async function ensurePublicDir() {
  await fs.mkdir(publicDir, { recursive: true });
}

async function getLastModified(relativePath) {
  try {
    const filePath = path.join(projectRoot, relativePath);
    const stats = await fs.stat(filePath);
    return stats.mtime.toISOString().slice(0, 10);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

async function buildSitemap() {
  const routes = await Promise.all(
    staticPages.map(async (page) => ({
      ...page,
      lastmod: await getLastModified(page.source),
    })),
  );

  const blogRoutes = blogPosts.map((post) => ({
    path: `/blog/${post.slug}`,
    title: post.title,
    description: post.description,
    priority: '0.7',
    changefreq: 'monthly',
    lastmod: post.updated || post.published,
  }));

  const allRoutes = [...routes, ...blogRoutes];

  const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...allRoutes.map(
      (route) => `  <url>
    <loc>${new URL(route.path, `${seoConfig.siteUrl}/`).toString()}</loc>
    <lastmod>${route.lastmod}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`,
    ),
    '</urlset>',
    '',
  ].join('\n');

  await fs.writeFile(path.join(publicDir, 'sitemap.xml'), sitemap, 'utf8');
}

async function buildRobots() {
  const robots = [
    'User-agent: *',
    'Allow: /',
    ...privatePaths.map((route) => `Disallow: ${route}`),
    '',
    `Sitemap: ${seoConfig.siteUrl}/sitemap.xml`,
    `Host: ${seoConfig.domain}`,
    '',
  ].join('\n');

  await fs.writeFile(path.join(publicDir, 'robots.txt'), robots, 'utf8');
}

async function buildManifest() {
  const manifest = {
    name: seoConfig.name,
    short_name: seoConfig.shortName,
    description: seoConfig.defaultDescription,
    start_url: '/',
    display: 'standalone',
    background_color: '#f4efe6',
    theme_color: '#0f766e',
    icons: [
      {
        src: '/favicon.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/favicon.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };

  await fs.writeFile(
    path.join(publicDir, 'manifest.webmanifest'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
}

async function buildLlmsFiles() {
  const keyPages = staticPages
    .filter((page) => page.path !== '/')
    .map((page) => `- ${page.path}: ${page.title} - ${page.description}`);
  const articleLines = blogPosts.map(
    (post) => `- /blog/${post.slug}: ${post.title} - ${post.excerpt}`,
  );

  const llms = [
    `# ${seoConfig.name}`,
    '',
    `> ${seoConfig.llmsSummary}`,
    '',
    '## Primary focus',
    '- ACA Marketplace insurance for individuals and families',
    '- SHOP health insurance for small businesses',
    '- Broker-guided enrollment assistance and plan comparison',
    '',
    '## Key pages',
    '- /: homepage and service overview',
    ...keyPages,
    '',
    '## Articles',
    ...articleLines,
    '',
    '## Non-public routes',
    '- /admin/',
    '- /meeting',
    '- /schedule',
    '- /appointment/manage/',
    '',
  ].join('\n');

  const llmsFull = [
    `# ${seoConfig.name}`,
    '',
    `> ${seoConfig.defaultDescription}`,
    '',
    '## Business summary',
    seoConfig.llmsSummary,
    '',
    '## Focus areas',
    ...seoConfig.focusAreas.map((item) => `- ${item}`),
    '',
    '## Public page summaries',
    ...staticPages.map(
      (page) => `- ${page.path}\n  Title: ${page.title}\n  Summary: ${page.description}`,
    ),
    '',
    '## Article summaries',
    ...blogPosts.map(
      (post) =>
        `- /blog/${post.slug}\n  Title: ${post.title}\n  Category: ${post.category}\n  Keywords: ${post.keywords.join(', ')}\n  Summary: ${post.excerpt}`,
    ),
    '',
    '## Contact',
    `- ${seoConfig.contactPath}: request ACA Marketplace or SHOP guidance`,
    '',
  ].join('\n');

  await fs.writeFile(path.join(publicDir, 'llms.txt'), `${llms}\n`, 'utf8');
  await fs.writeFile(path.join(publicDir, 'llms-full.txt'), `${llmsFull}\n`, 'utf8');
}

async function main() {
  await ensurePublicDir();
  await Promise.all([
    buildSitemap(),
    buildRobots(),
    buildManifest(),
    buildLlmsFiles(),
  ]);
}

main().catch((error) => {
  console.error('Failed to generate SEO assets:', error);
  process.exitCode = 1;
});
