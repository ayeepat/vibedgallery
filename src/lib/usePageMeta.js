import { useEffect } from 'react';

const SITE_NAME = 'VibedGallery';
const SITE_URL = 'https://www.vibedgallery.com';
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

// Site-wide defaults — mirror the static tags in index.html. Restored on
// unmount so SPA navigation can't leak a page's title/description/canonical if
// the next route ever forgets to call usePageMeta.
const DEFAULT_TITLE = `${SITE_NAME} — A gallery of apps built with AI`;
const DEFAULT_DESCRIPTION =
  'VibedGallery is a curated gallery of real apps built with AI coding tools. Browse, try, and submit apps made by independent builders.';
const DEFAULT_ROBOTS =
  'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1';
const DEFAULT_CANONICAL = `${SITE_URL}/`;

// Mutate or insert a <meta> by attribute=value (e.g. ["name","description"]).
function setMeta(attr, value, content) {
  if (!content) return;
  let el = document.head.querySelector(`meta[${attr}="${value}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, value);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setLink(rel, href) {
  if (!href) return;
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

// Replace (or insert) a <script type="application/ld+json" data-page-meta>
function setStructuredData(json) {
  // Always start by removing any previously-injected page-scoped block.
  document
    .querySelectorAll('script[type="application/ld+json"][data-page-meta]')
    .forEach((el) => el.remove());
  if (!json) return;
  const el = document.createElement('script');
  el.type = 'application/ld+json';
  el.setAttribute('data-page-meta', 'true');
  el.text = JSON.stringify(json);
  document.head.appendChild(el);
}

/**
 * Update <head> meta tags (title, description, OG, Twitter, canonical, JSON-LD)
 * for the current route. Reverts to sensible defaults on unmount so SPA
 * navigation doesn't leak stale tags between pages.
 *
 * Usage:
 *   usePageMeta({
 *     title: 'Gallery',
 *     description: 'Browse apps built with AI.',
 *     path: '/gallery',
 *   });
 */
export function usePageMeta({
  title,
  description,
  path = '',
  image = DEFAULT_OG_IMAGE,
  type = 'website',
  noindex = false,
  structuredData = null,
} = {}) {
  useEffect(() => {
    const fullTitle = title ? `${title} — ${SITE_NAME}` : SITE_NAME;
    const url = `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;

    document.title = fullTitle;

    setMeta('name', 'description', description);
    setMeta(
      'name',
      'robots',
      noindex
        ? 'noindex,nofollow'
        : 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'
    );

    // Open Graph
    setMeta('property', 'og:title', fullTitle);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:image', image);
    setMeta('property', 'og:type', type);

    // Twitter
    setMeta('name', 'twitter:title', fullTitle);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', image);

    // Canonical
    setLink('canonical', url);

    setStructuredData(structuredData);

    // Revert to site-wide defaults on unmount (or before the next effect run).
    // Belt-and-suspenders: every page sets its own meta on mount, but if a
    // future route forgets, the head won't keep showing the previous page's
    // title/description/canonical/JSON-LD.
    return () => {
      document.title = DEFAULT_TITLE;
      setMeta('name', 'description', DEFAULT_DESCRIPTION);
      setMeta('name', 'robots', DEFAULT_ROBOTS);
      setMeta('property', 'og:title', DEFAULT_TITLE);
      setMeta('property', 'og:description', DEFAULT_DESCRIPTION);
      setMeta('property', 'og:url', DEFAULT_CANONICAL);
      setMeta('property', 'og:image', DEFAULT_OG_IMAGE);
      setMeta('property', 'og:type', 'website');
      setMeta('name', 'twitter:title', DEFAULT_TITLE);
      setMeta('name', 'twitter:description', DEFAULT_DESCRIPTION);
      setMeta('name', 'twitter:image', DEFAULT_OG_IMAGE);
      setLink('canonical', DEFAULT_CANONICAL);
      setStructuredData(null);
    };
  }, [title, description, path, image, type, noindex, structuredData]);
}
