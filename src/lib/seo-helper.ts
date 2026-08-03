import { useEffect } from 'react';

interface SeoProps {
  title: string;
  description: string;
  keywords?: string[];
  canonicalUrl?: string;
  ogType?: 'website' | 'article';
  ogImage?: string;
  jsonLd?: Record<string, any> | Array<Record<string, any>>;
}

export function updateSeoTags({
  title,
  description,
  keywords,
  canonicalUrl,
  ogType = 'website',
  ogImage = 'https://codingmarvel.com/favicon.svg',
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

  // 5. Canonical Link
  if (canonicalUrl) {
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', canonicalUrl);
  }

  // 6. JSON-LD Structured Data Schema for AI & Search Engine Crawlers
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
  useEffect(() => {
    updateSeoTags(props);
  }, [props.title, props.description, props.canonicalUrl]);
}
