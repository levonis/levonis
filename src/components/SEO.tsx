import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article' | 'product';
  jsonLd?: Record<string, any> | Record<string, any>[];
  noindex?: boolean;
  canonical?: string;
  locale?: string; // ar_IQ, en_US, ku_IQ
}

const SITE = 'https://levonisiq.com';
const DEFAULT_IMAGE = `${SITE}/og-logo.png`;

const SEO = ({
  title,
  description,
  image = DEFAULT_IMAGE,
  url,
  type = 'website',
  jsonLd,
  noindex = false,
  canonical,
  locale = 'ar_IQ',
}: SEOProps) => {
  const fullTitle = title ? `${title} — LEVONIS` : 'LEVONIS — متجرك الموثوق للتقنية في العراق';
  const finalUrl = url || (typeof window !== 'undefined' ? window.location.href : SITE);
  const finalCanonical = canonical || finalUrl.split('?')[0].split('#')[0];
  const ldArray = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Helmet>
      <title>{fullTitle}</title>
      {description && <meta name="description" content={description} />}
      <link rel="canonical" href={finalCanonical} />
      {noindex && <meta name="robots" content="noindex,nofollow" />}

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      {description && <meta property="og:description" content={description} />}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={finalUrl} />
      <meta property="og:image" content={image} />
      <meta property="og:site_name" content="LEVONIS" />
      <meta property="og:locale" content={locale} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      {description && <meta name="twitter:description" content={description} />}
      <meta name="twitter:image" content={image} />
      <meta name="twitter:site" content="@levonis_iq" />

      {ldArray.map((ld, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(ld)}
        </script>
      ))}
    </Helmet>
  );
};

export default SEO;
