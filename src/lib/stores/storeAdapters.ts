/**
 * Store Adapters - منظومة معالجة المتاجر المختلفة
 * 
 * كل Adapter يوفر:
 * - isProductPage(url): هل الرابط لصفحة منتج؟
 * - extractProductIdentity(url): استخراج هوية المنتج
 * - getStoreName(): اسم المتجر
 * - getSourceCountry(): دولة المتجر
 */

export interface ProductIdentity {
  store: string;
  productId: string; // ASIN for Amazon, SKU for Newegg, etc.
  canonicalUrl: string;
  rawUrl: string;
}

export interface StoreAdapter {
  name: string;
  nameAr: string;
  sourceCountry: 'usa' | 'china';
  isProductPage: (url: string) => boolean;
  extractProductIdentity: (url: string) => ProductIdentity | null;
  getSearchPromptHints: () => string;
}

// Amazon Adapter
const amazonAdapter: StoreAdapter = {
  name: 'amazon',
  nameAr: 'أمازون',
  sourceCountry: 'usa',
  
  isProductPage: (url: string): boolean => {
    try {
      const parsedUrl = new URL(url);
      const hostname = parsedUrl.hostname.toLowerCase();
      
      // Check if it's an Amazon domain
      if (!hostname.includes('amazon.')) return false;
      
      // Check for product page patterns
      const productPatterns = [
        /\/dp\//,           // Direct product page
        /\/gp\/product\//,  // General product page
        /\/product\//,      // Simple product page
        /\/asin\//,         // ASIN-based URL
      ];
      
      return productPatterns.some(pattern => pattern.test(parsedUrl.pathname));
    } catch {
      return false;
    }
  },
  
  extractProductIdentity: (url: string): ProductIdentity | null => {
    try {
      const parsedUrl = new URL(url);
      const hostname = parsedUrl.hostname.toLowerCase();
      
      if (!hostname.includes('amazon.')) return null;
      
      // Extract ASIN
      let asin: string | null = null;
      
      // Pattern: /dp/ASIN or /gp/product/ASIN
      const dpMatch = parsedUrl.pathname.match(/\/(?:dp|gp\/product|product|asin)\/([A-Z0-9]{10})/i);
      if (dpMatch) {
        asin = dpMatch[1].toUpperCase();
      }
      
      // Check URL params for ASIN
      if (!asin) {
        asin = parsedUrl.searchParams.get('asin') || null;
      }
      
      if (!asin) return null;
      
      // Determine the domain (amazon.com, amazon.ae, etc.)
      const domainMatch = hostname.match(/amazon\.(\w+(?:\.\w+)?)/);
      const domain = domainMatch ? domainMatch[1] : 'com';
      
      return {
        store: 'amazon',
        productId: asin,
        canonicalUrl: `https://www.amazon.${domain}/dp/${asin}`,
        rawUrl: url,
      };
    } catch {
      return null;
    }
  },
  
  getSearchPromptHints: () => `
    عند البحث في Amazon:
    - ابحث عن السعر في div#corePrice أو span.a-price
    - الوزن في #productDetails أو #detailBullets
    - الأبعاد في Shipping Weight أو Product Dimensions
    - تأكد من استخراج السعر الحالي وليس السعر المشطوب
  `,
};

// Newegg Adapter
const neweggAdapter: StoreAdapter = {
  name: 'newegg',
  nameAr: 'نيو إيج',
  sourceCountry: 'usa',
  
  isProductPage: (url: string): boolean => {
    try {
      const parsedUrl = new URL(url);
      const hostname = parsedUrl.hostname.toLowerCase();
      
      if (!hostname.includes('newegg.')) return false;
      
      // Product page patterns
      const productPatterns = [
        /\/p\//,        // Product page
        /\/Product\//,  // Alternative product page
        /\/products\//,
        /N[0-9]+/,      // Item number pattern
      ];
      
      return productPatterns.some(pattern => pattern.test(parsedUrl.pathname)) ||
             parsedUrl.searchParams.has('Item');
    } catch {
      return false;
    }
  },
  
  extractProductIdentity: (url: string): ProductIdentity | null => {
    try {
      const parsedUrl = new URL(url);
      const hostname = parsedUrl.hostname.toLowerCase();
      
      if (!hostname.includes('newegg.')) return null;
      
      let itemNumber: string | null = null;
      
      // Pattern: /p/N82E... or Item= param
      const itemMatch = parsedUrl.pathname.match(/\/(N[A-Z0-9]+)/i);
      if (itemMatch) {
        itemNumber = itemMatch[1];
      }
      
      if (!itemNumber) {
        itemNumber = parsedUrl.searchParams.get('Item') || null;
      }
      
      // Try to extract from /p/pl?... format
      if (!itemNumber) {
        const pMatch = parsedUrl.pathname.match(/\/p\/(\w+)/);
        if (pMatch) {
          itemNumber = pMatch[1];
        }
      }
      
      if (!itemNumber) return null;
      
      return {
        store: 'newegg',
        productId: itemNumber,
        canonicalUrl: `https://www.newegg.com/p/${itemNumber}`,
        rawUrl: url,
      };
    } catch {
      return null;
    }
  },
  
  getSearchPromptHints: () => `
    عند البحث في Newegg:
    - ابحث عن السعر في .price-current أو .product-price
    - المواصفات في #Specs أو .tab-content
    - الوزن في Weight ضمن Specifications
    - الأبعاد في Package Dimensions
  `,
};

// BestBuy Adapter
const bestbuyAdapter: StoreAdapter = {
  name: 'bestbuy',
  nameAr: 'بست باي',
  sourceCountry: 'usa',
  
  isProductPage: (url: string): boolean => {
    try {
      const parsedUrl = new URL(url);
      const hostname = parsedUrl.hostname.toLowerCase();
      
      if (!hostname.includes('bestbuy.')) return false;
      
      // Product page patterns
      return /\/site\/.*\/\d+\.p/.test(parsedUrl.pathname) ||
             parsedUrl.searchParams.has('skuId');
    } catch {
      return false;
    }
  },
  
  extractProductIdentity: (url: string): ProductIdentity | null => {
    try {
      const parsedUrl = new URL(url);
      const hostname = parsedUrl.hostname.toLowerCase();
      
      if (!hostname.includes('bestbuy.')) return null;
      
      let skuId: string | null = null;
      
      // Pattern: /site/.../12345.p
      const skuMatch = parsedUrl.pathname.match(/\/(\d+)\.p/);
      if (skuMatch) {
        skuId = skuMatch[1];
      }
      
      if (!skuId) {
        skuId = parsedUrl.searchParams.get('skuId') || null;
      }
      
      if (!skuId) return null;
      
      return {
        store: 'bestbuy',
        productId: skuId,
        canonicalUrl: `https://www.bestbuy.com/site/${skuId}.p`,
        rawUrl: url,
      };
    } catch {
      return null;
    }
  },
  
  getSearchPromptHints: () => `
    عند البحث في BestBuy:
    - ابحث عن السعر في .priceView-customer-price
    - المواصفات في .specifications-wrapper
    - الوزن والأبعاد في Product Weight و Dimensions
  `,
};

// Taobao/1688/JD Adapter (China)
const chinaStoreAdapter: StoreAdapter = {
  name: 'china',
  nameAr: 'متاجر صينية',
  sourceCountry: 'china',
  
  isProductPage: (url: string): boolean => {
    try {
      const parsedUrl = new URL(url);
      const hostname = parsedUrl.hostname.toLowerCase();
      
      return hostname.includes('taobao.') ||
             hostname.includes('1688.') ||
             hostname.includes('jd.') ||
             hostname.includes('tmall.');
    } catch {
      return false;
    }
  },
  
  extractProductIdentity: (url: string): ProductIdentity | null => {
    try {
      const parsedUrl = new URL(url);
      const hostname = parsedUrl.hostname.toLowerCase();
      
      let store: string;
      let productId: string | null = null;
      
      if (hostname.includes('taobao.')) {
        store = 'taobao';
        productId = parsedUrl.searchParams.get('id') || null;
      } else if (hostname.includes('1688.')) {
        store = '1688';
        const match = parsedUrl.pathname.match(/offer\/(\d+)/);
        productId = match ? match[1] : null;
      } else if (hostname.includes('jd.')) {
        store = 'jd';
        const match = parsedUrl.pathname.match(/(\d+)\.html/);
        productId = match ? match[1] : null;
      } else if (hostname.includes('tmall.')) {
        store = 'tmall';
        productId = parsedUrl.searchParams.get('id') || null;
      } else {
        return null;
      }
      
      if (!productId) return null;
      
      return {
        store,
        productId,
        canonicalUrl: url,
        rawUrl: url,
      };
    } catch {
      return null;
    }
  },
  
  getSearchPromptHints: () => `
    عند البحث في المتاجر الصينية:
    - الأسعار بالـ Yuan (CNY/RMB/¥)
    - قم بتحويل للدولار (1 USD ≈ 7.2 CNY)
    - ابحث عن الوزن في 重量 أو 毛重
    - الأبعاد في 尺寸 أو 包装尺寸
  `,
};

// Registry of all adapters
const adapters: StoreAdapter[] = [
  amazonAdapter,
  neweggAdapter,
  bestbuyAdapter,
  chinaStoreAdapter,
];

/**
 * Detect which store a URL belongs to
 */
export function detectStore(url: string): StoreAdapter | null {
  for (const adapter of adapters) {
    if (adapter.isProductPage(url)) {
      return adapter;
    }
  }
  return null;
}

/**
 * Extract product identity from URL
 */
export function extractProductIdentity(url: string): ProductIdentity | null {
  const adapter = detectStore(url);
  if (!adapter) return null;
  return adapter.extractProductIdentity(url);
}

/**
 * Get store-specific search hints for AI
 */
export function getStoreSearchHints(url: string): string {
  const adapter = detectStore(url);
  if (!adapter) return '';
  return adapter.getSearchPromptHints();
}

/**
 * Get source country from URL
 */
export function getSourceCountryFromUrl(url: string): 'usa' | 'china' | null {
  const adapter = detectStore(url);
  if (!adapter) return null;
  return adapter.sourceCountry;
}

export { amazonAdapter, neweggAdapter, bestbuyAdapter, chinaStoreAdapter };
