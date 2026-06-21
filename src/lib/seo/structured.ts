// Helpers for building JSON-LD structured data for SEO + AI assistants.

const SITE = 'https://levonisiq.com';

export const organizationLd = () => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'LEVONIS',
  alternateName: 'ليفونيس',
  url: SITE,
  logo: `${SITE}/logo-medium.png`,
  description:
    'متجر LEVONIS الإلكتروني — متخصص في طابعات 3D، الأجهزة الذكية، الإلكترونيات، الألعاب، ومجتمع التجار في العراق.',
  sameAs: [
    'https://www.facebook.com/levonisiq',
    'https://www.instagram.com/levonis_iq',
  ],
  contactPoint: [
    {
      '@type': 'ContactPoint',
      telephone: '+964-783-845-5220',
      contactType: 'customer service',
      areaServed: 'IQ',
      availableLanguage: ['Arabic', 'English', 'Kurdish'],
    },
  ],
  address: {
    '@type': 'PostalAddress',
    addressCountry: 'IQ',
  },
});

export const websiteLd = () => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'LEVONIS',
  url: SITE,
  potentialAction: {
    '@type': 'SearchAction',
    target: `${SITE}/search?q={search_term_string}`,
    'query-input': 'required name=search_term_string',
  },
});

export const breadcrumbLd = (items: { name: string; url: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((it, idx) => ({
    '@type': 'ListItem',
    position: idx + 1,
    name: it.name,
    item: it.url.startsWith('http') ? it.url : `${SITE}${it.url}`,
  })),
});

export interface ProductLdInput {
  name: string;
  description?: string | null;
  image?: string | string[] | null;
  sku?: string | null;
  brand?: string | null;
  priceIqd?: number | null;
  inStock?: boolean;
  url: string;
  ratingValue?: number | null;
  reviewCount?: number | null;
  category?: string | null;
  additionalProperty?: any[];
  keywords?: string[];
}

export const productLd = (p: ProductLdInput) => {
  const images = Array.isArray(p.image) ? p.image : p.image ? [p.image] : [];
  const ld: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: p.description || p.name,
    image: images.length ? images : [`${SITE}/og-image.jpg`],
    sku: p.sku || undefined,
    brand: { '@type': 'Brand', name: p.brand || 'LEVONIS' },
    category: p.category || undefined,
    url: p.url.startsWith('http') ? p.url : `${SITE}${p.url}`,
    additionalProperty: p.additionalProperty && p.additionalProperty.length ? p.additionalProperty : undefined,
    keywords: p.keywords && p.keywords.length ? p.keywords.join(', ') : undefined,
  };

  if (p.priceIqd != null && p.priceIqd > 0) {
    ld.offers = {
      '@type': 'Offer',
      priceCurrency: 'IQD',
      price: Math.round(p.priceIqd),
      availability: p.inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/PreOrder',
      url: ld.url,
      seller: { '@type': 'Organization', name: 'LEVONIS' },
    };
  }

  if (p.ratingValue && p.reviewCount && p.reviewCount > 0) {
    ld.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Number(p.ratingValue.toFixed(1)),
      reviewCount: p.reviewCount,
    };
  }

  return ld;
};

export const faqLd = (qa: { q: string; a: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: qa.map((it) => ({
    '@type': 'Question',
    name: it.q,
    acceptedAnswer: { '@type': 'Answer', text: it.a },
  })),
});

export interface CollectionPageInput {
  name: string;
  description?: string | null;
  url: string;
  items: { name: string; url: string }[];
}

export const collectionPageLd = (c: CollectionPageInput) => ({
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: c.name,
  description: c.description || c.name,
  url: c.url.startsWith('http') ? c.url : `${SITE}${c.url}`,
  mainEntity: {
    '@type': 'ItemList',
    numberOfItems: c.items.length,
    itemListElement: c.items.slice(0, 50).map((it, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: it.name,
      url: it.url.startsWith('http') ? it.url : `${SITE}${it.url}`,
    })),
  },
});
