import { useEffect } from 'react';

export interface ArticleMeta {
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
  section?: string;
  tags?: string[];
}

export interface SeoProps {
  title: string;
  description: string;
  keywords?: string[];
  canonicalUrl?: string;
  ogType?: 'website' | 'article';
  ogImage?: string;
  article?: ArticleMeta;
  jsonLd?: Record<string, any> | Array<Record<string, any>>;
}

export function updateSeoTags({
  title,
  description,
  keywords,
  canonicalUrl,
  ogType = 'website',
  ogImage = SITE_LOGO,
  article,
  jsonLd,
}: SeoProps) {
  if (typeof document === 'undefined') return;

  try {
    // 1. Document Title
    document.title = title;

    // Helper function to set or update <meta> tags
    const setMeta = (nameAttr: 'name' | 'property', attrValue: string, content: string) => {
      let el = document.querySelector(`meta[${nameAttr}="${attrValue}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(nameAttr, attrValue);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    // Helper function to remove <meta> tags
    const removeMeta = (nameAttr: 'name' | 'property', attrValue: string) => {
      const elements = document.querySelectorAll(`meta[${nameAttr}="${attrValue}"]`);
      elements.forEach((el) => el.remove());
    };

    // 2. Standard Meta Tags
    setMeta('name', 'description', description);
    setMeta('name', 'robots', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
    if (keywords && keywords.length > 0) {
      setMeta('name', 'keywords', keywords.join(', '));
    }

    // 3. OpenGraph Social & AI Engine Tags
    setMeta('property', 'og:site_name', 'Love for PDF');
    setMeta('property', 'og:type', ogType);
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:image', ogImage);
    if (canonicalUrl) {
      setMeta('property', 'og:url', canonicalUrl);
    }

    // 4. Twitter Card Meta Tags
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', ogImage);

    // 5. Article-Specific OpenGraph Meta Tags
    if (ogType === 'article') {
      if (article?.publishedTime) {
        setMeta('property', 'article:published_time', article.publishedTime);
      }
      if (article?.modifiedTime) {
        setMeta('property', 'article:modified_time', article.modifiedTime);
      }
      if (article?.author) {
        setMeta('property', 'article:author', article.author);
      }
      if (article?.section) {
        setMeta('property', 'article:section', article.section);
      }

      // Handle article tags (multi-instance meta property)
      removeMeta('property', 'article:tag');
      if (article?.tags && article.tags.length > 0) {
        article.tags.forEach((tag) => {
          const el = document.createElement('meta');
          el.setAttribute('property', 'article:tag');
          el.setAttribute('content', tag);
          document.head.appendChild(el);
        });
      }
    } else {
      // Clean up article meta tags when on generic non-article pages
      removeMeta('property', 'article:published_time');
      removeMeta('property', 'article:modified_time');
      removeMeta('property', 'article:author');
      removeMeta('property', 'article:section');
      removeMeta('property', 'article:tag');
    }

    // 6. Canonical Link
    if (canonicalUrl) {
      let canonical = document.querySelector('link[rel="canonical"]');
      if (!canonical) {
        canonical = document.createElement('link');
        canonical.setAttribute('rel', 'canonical');
        document.head.appendChild(canonical);
      }
      canonical.setAttribute('href', canonicalUrl);
    }

    // 7. JSON-LD Structured Data Schema for AI & Search Engine Crawlers
    if (jsonLd) {
      let script = document.querySelector('script[id="json-ld-schema"]') as HTMLScriptElement;
      if (!script) {
        script = document.createElement('script');
        script.id = 'json-ld-schema';
        script.type = 'application/ld+json';
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(jsonLd);
    }
  } catch (error) {
    console.warn('[SEO] Failed to update document head tags:', error);
  }
}

export function useSeoHead(props: SeoProps) {
  const serializedProps = JSON.stringify(props);
  useEffect(() => {
    updateSeoTags(props);
  }, [serializedProps]);
}

// ==========================================
// Schema.org JSON-LD Builders
// ==========================================

export const SITE_URL = 'https://pdf.codingmarvel.com';
export const SITE_NAME = 'Love for PDF';
export const SITE_LOGO = `${SITE_URL}/favicon.svg`;

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export interface HowToStepItem {
  name: string;
  text: string;
}

export interface FaqEntry {
  question: string;
  answer: string;
}

export function buildOrganizationSchema() {
  return {
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: SITE_URL,
    logo: {
      '@type': 'ImageObject',
      url: SITE_LOGO,
    },
    sameAs: [],
  };
}

export function buildWebSiteSchema() {
  return {
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    url: SITE_URL,
    name: SITE_NAME,
    description: 'Free online PDF toolkit with 35 tools. Most run right in your browser with no upload; Office, OCR and a few other conversions use our conversion service, which deletes each file as soon as the result is returned.',
    publisher: {
      '@id': `${SITE_URL}/#organization`,
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/sitemap?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function buildBreadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${SITE_URL}${item.url}`,
    })),
  };
}

export function buildWebApplicationSchema(tool: {
  name: string;
  desc: string;
  slug: string;
  category?: string;
}) {
  return {
    '@type': 'WebApplication',
    '@id': `${SITE_URL}/${tool.slug}#webapp`,
    name: tool.name,
    description: tool.desc,
    url: `${SITE_URL}/${tool.slug}`,
    applicationCategory: 'UtilityApplication',
    operatingSystem: 'All',
    browserRequirements: 'Requires JavaScript and HTML5 canvas/WASM support',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
  };
}

export function buildHowToSchema(title: string, steps: string[]) {
  return {
    '@type': 'HowTo',
    name: `How to use ${title}`,
    step: steps.map((stepText, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: `Step ${index + 1}`,
      text: stepText,
    })),
  };
}

export function buildFaqSchema(faqItems: FaqEntry[]) {
  return {
    '@type': 'FAQPage',
    mainEntity: faqItems.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

export function buildCollectionPageSchema({
  name,
  description,
  url,
}: {
  name: string;
  description: string;
  url: string;
}) {
  return {
    '@type': 'CollectionPage',
    '@id': `${url}#webpage`,
    url,
    name,
    description,
    isPartOf: {
      '@id': `${SITE_URL}/#website`,
    },
  };
}
