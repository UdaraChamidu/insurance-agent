import { useEffect } from 'react';
import { absoluteUrl, buildTitle, siteConfig } from '../utils/site';

function upsertMeta(selector, attributes) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement('meta');
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      element.removeAttribute(key);
      return;
    }
    element.setAttribute(key, value);
  });

  return element;
}

function upsertLink(selector, attributes) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement('link');
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });

  return element;
}

export default function Seo({
  title,
  description = siteConfig.defaultDescription,
  path = '/',
  image = siteConfig.ogImage,
  type = 'website',
  keywords = [],
  noindex = false,
  structuredData = [],
  publishedTime,
  modifiedTime,
}) {
  useEffect(() => {
    const canonicalUrl = absoluteUrl(path);
    const imageUrl = image.startsWith('http') ? image : absoluteUrl(image);
    document.title = buildTitle(title);

    upsertMeta('meta[name="description"]', {
      name: 'description',
      content: description,
    });
    upsertMeta('meta[name="keywords"]', {
      name: 'keywords',
      content: Array.isArray(keywords) ? keywords.join(', ') : keywords,
    });
    upsertMeta('meta[name="robots"]', {
      name: 'robots',
      content: noindex
        ? 'noindex, nofollow, noarchive'
        : 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1',
    });
    upsertMeta('meta[name="googlebot"]', {
      name: 'googlebot',
      content: noindex
        ? 'noindex, nofollow, noarchive'
        : 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1',
    });
    upsertMeta('meta[property="og:type"]', {
      property: 'og:type',
      content: type,
    });
    upsertMeta('meta[property="og:locale"]', {
      property: 'og:locale',
      content: siteConfig.locale,
    });
    upsertMeta('meta[property="og:title"]', {
      property: 'og:title',
      content: buildTitle(title),
    });
    upsertMeta('meta[property="og:description"]', {
      property: 'og:description',
      content: description,
    });
    upsertMeta('meta[property="og:url"]', {
      property: 'og:url',
      content: canonicalUrl,
    });
    upsertMeta('meta[property="og:image"]', {
      property: 'og:image',
      content: imageUrl,
    });
    upsertMeta('meta[property="og:site_name"]', {
      property: 'og:site_name',
      content: siteConfig.name,
    });
    upsertMeta('meta[name="twitter:card"]', {
      name: 'twitter:card',
      content: 'summary_large_image',
    });
    upsertMeta('meta[name="twitter:title"]', {
      name: 'twitter:title',
      content: buildTitle(title),
    });
    upsertMeta('meta[name="twitter:description"]', {
      name: 'twitter:description',
      content: description,
    });
    upsertMeta('meta[name="twitter:image"]', {
      name: 'twitter:image',
      content: imageUrl,
    });

    if (publishedTime) {
      upsertMeta('meta[property="article:published_time"]', {
        property: 'article:published_time',
        content: publishedTime,
      });
    } else {
      upsertMeta('meta[property="article:published_time"]', {
        property: 'article:published_time',
        content: undefined,
      });
    }

    if (modifiedTime) {
      upsertMeta('meta[property="article:modified_time"]', {
        property: 'article:modified_time',
        content: modifiedTime,
      });
    } else {
      upsertMeta('meta[property="article:modified_time"]', {
        property: 'article:modified_time',
        content: undefined,
      });
    }

    upsertLink('link[rel="canonical"]', {
      rel: 'canonical',
      href: canonicalUrl,
    });

    document
      .querySelectorAll('script[data-seo-jsonld="true"]')
      .forEach((element) => element.remove());

    structuredData.forEach((item) => {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.dataset.seoJsonld = 'true';
      script.text = JSON.stringify(item);
      document.head.appendChild(script);
    });
  }, [description, image, keywords, modifiedTime, noindex, path, publishedTime, structuredData, title, type]);

  return null;
}
