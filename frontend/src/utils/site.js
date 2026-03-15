import { seoConfig } from '../content/seoConfig';

const FALLBACK_SITE_URL = seoConfig.siteUrl;

export const siteConfig = seoConfig;

export function getSiteUrl() {
  const configured = String(import.meta.env.VITE_SITE_URL || '').trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }
  return FALLBACK_SITE_URL;
}

export function absoluteUrl(path = '/') {
  return new URL(path, `${getSiteUrl()}/`).toString();
}

export function buildTitle(title) {
  if (!title) {
    return `${siteConfig.defaultTitle} | ${siteConfig.titleSuffix}`;
  }
  return `${title} | ${siteConfig.titleSuffix}`;
}

export function buildOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'InsuranceAgency',
    name: siteConfig.name,
    url: getSiteUrl(),
    description: siteConfig.defaultDescription,
    image: absoluteUrl(siteConfig.ogImage),
    inLanguage: siteConfig.language,
    areaServed: {
      '@type': 'Country',
      name: 'United States',
    },
    brand: {
      '@type': 'Brand',
      name: siteConfig.name,
    },
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        url: absoluteUrl(siteConfig.contactPath),
        availableLanguage: ['English'],
      },
    ],
    serviceType: [
      'ACA Marketplace Insurance',
      'Obamacare Marketplace Enrollment Assistance',
      'SHOP Health Insurance',
      'Small Business Health Insurance',
    ],
    knowsAbout: siteConfig.focusAreas,
    publishingPrinciples: absoluteUrl('/about-us'),
  };
}

export function buildWebsiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteConfig.name,
    url: getSiteUrl(),
    description: siteConfig.defaultDescription,
    inLanguage: siteConfig.language,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${getSiteUrl()}/blog?query={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

export function buildWebPageSchema({
  path = '/',
  title = siteConfig.defaultTitle,
  description = siteConfig.defaultDescription,
  type = 'WebPage',
}) {
  return {
    '@context': 'https://schema.org',
    '@type': type,
    name: title,
    url: absoluteUrl(path),
    description,
    isPartOf: {
      '@type': 'WebSite',
      name: siteConfig.name,
      url: getSiteUrl(),
    },
    about: siteConfig.focusAreas,
    inLanguage: siteConfig.language,
  };
}

export function buildCollectionPageSchema({
  path = '/',
  title = siteConfig.defaultTitle,
  description = siteConfig.defaultDescription,
}) {
  return buildWebPageSchema({
    path,
    title,
    description,
    type: 'CollectionPage',
  });
}

export function buildItemListSchema(items = []) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      url: absoluteUrl(item.path),
    })),
  };
}

export function buildAboutPageSchema({
  path = '/about-us',
  title = 'About Us',
  description = siteConfig.defaultDescription,
}) {
  return buildWebPageSchema({
    path,
    title,
    description,
    type: 'AboutPage',
  });
}

export function buildContactPageSchema({
  path = '/contact',
  title = 'Contact',
  description = siteConfig.defaultDescription,
}) {
  return buildWebPageSchema({
    path,
    title,
    description,
    type: 'ContactPage',
  });
}

export function buildServiceSchema({
  name,
  path,
  description,
  serviceType,
  audience,
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name,
    url: absoluteUrl(path),
    description,
    serviceType,
    provider: {
      '@type': 'InsuranceAgency',
      name: siteConfig.name,
      url: getSiteUrl(),
    },
    areaServed: {
      '@type': 'Country',
      name: 'United States',
    },
    audience: audience
      ? {
          '@type': 'Audience',
          audienceType: audience,
        }
      : undefined,
  };
}

export function buildFaqSchema(items = []) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

export function buildBreadcrumbSchema(items = []) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label,
      item: absoluteUrl(item.to),
    })),
  };
}

export function buildArticleSchema(post) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    image: absoluteUrl(siteConfig.ogImage),
    datePublished: post.published,
    dateModified: post.updated || post.published,
    inLanguage: siteConfig.language,
    isAccessibleForFree: true,
    wordCount: post.wordCount,
    author: {
      '@type': 'Organization',
      name: siteConfig.name,
    },
    publisher: {
      '@type': 'Organization',
      name: siteConfig.name,
      logo: {
        '@type': 'ImageObject',
        url: absoluteUrl(siteConfig.ogImage),
      },
    },
    mainEntityOfPage: absoluteUrl(`/blog/${post.slug}`),
    keywords: post.keywords.join(', '),
    articleSection: post.category,
    about: post.keywords.map((keyword) => ({
      '@type': 'Thing',
      name: keyword,
    })),
  };
}
