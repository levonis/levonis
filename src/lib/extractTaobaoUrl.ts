/**
 * Extract Taobao/JD URL and item ID from messy text
 * Handles formats like: 【淘宝】假一赔四 https://e.tb.cn/h.77BGXtZFQ2kzrfF?tk=G4D2UbFSfoL CZ356...
 */

export interface ExtractedUrlInfo {
  url: string | null;
  itemId: string | null;
  platform: 'taobao' | 'jd' | 'tmall' | '1688' | null;
  isShortUrl?: boolean;
}

// Short URL patterns that need expansion
const SHORT_URL_PATTERNS = [
  /https?:\/\/e\.tb\.cn\/[^\s」】\]]+/i,
  /https?:\/\/m\.tb\.cn\/[^\s」】\]]+/i,
  /https?:\/\/s\.click\.taobao\.com\/[^\s」】\]]+/i,
];

// Direct URL patterns
const DIRECT_URL_PATTERNS = [
  // Taobao
  { pattern: /https?:\/\/(?:item\.taobao\.com|world\.taobao\.com)\/item\.htm[^\s]*/i, platform: 'taobao' as const },
  { pattern: /https?:\/\/(?:h5\.)?m\.taobao\.com\/[^\s]*[?&]id=(\d+)[^\s]*/i, platform: 'taobao' as const },
  { pattern: /https?:\/\/a\.m\.taobao\.com\/[^\s]*/i, platform: 'taobao' as const },
  // Tmall
  { pattern: /https?:\/\/detail\.tmall\.com\/item\.htm[^\s]*/i, platform: 'tmall' as const },
  { pattern: /https?:\/\/detail\.tmall\.hk\/[^\s]*/i, platform: 'tmall' as const },
  // JD
  { pattern: /https?:\/\/item\.jd\.com\/(\d+)\.html[^\s]*/i, platform: 'jd' as const },
  { pattern: /https?:\/\/m\.jd\.com\/product\/(\d+)\.html[^\s]*/i, platform: 'jd' as const },
  // 1688
  { pattern: /https?:\/\/detail\.1688\.com\/offer\/(\d+)\.html[^\s]*/i, platform: '1688' as const },
];

/**
 * Extract item ID from a clean URL
 */
function extractItemId(url: string): { itemId: string | null; platform: ExtractedUrlInfo['platform'] } {
  // Taobao/Tmall - extract id parameter
  const taobaoMatch = url.match(/[?&]id=(\d+)/i);
  if (taobaoMatch) {
    const isTmall = url.includes('tmall');
    return { itemId: taobaoMatch[1], platform: isTmall ? 'tmall' : 'taobao' };
  }

  // JD - extract from path
  const jdMatch = url.match(/item\.jd\.com\/(\d+)\.html/i) || url.match(/product\/(\d+)/i);
  if (jdMatch) {
    return { itemId: jdMatch[1], platform: 'jd' };
  }

  // 1688 - extract from path
  const alibabaMatch = url.match(/offer\/(\d+)\.html/i);
  if (alibabaMatch) {
    return { itemId: alibabaMatch[1], platform: '1688' };
  }

  return { itemId: null, platform: null };
}

/**
 * Build a canonical product URL from item ID and platform
 */
export function buildCanonicalUrl(itemId: string, platform: ExtractedUrlInfo['platform']): string {
  switch (platform) {
    case 'taobao':
      return `https://item.taobao.com/item.htm?id=${itemId}`;
    case 'tmall':
      return `https://detail.tmall.com/item.htm?id=${itemId}`;
    case 'jd':
      return `https://item.jd.com/${itemId}.html`;
    case '1688':
      return `https://detail.1688.com/offer/${itemId}.html`;
    default:
      return `https://item.taobao.com/item.htm?id=${itemId}`;
  }
}

/**
 * Check if a URL is a short URL that needs to be followed
 */
export function isShortUrl(url: string): boolean {
  return SHORT_URL_PATTERNS.some(pattern => pattern.test(url));
}

/**
 * Extract URL from messy text containing Taobao/JD links
 */
export function extractUrlFromText(text: string): ExtractedUrlInfo {
  if (!text || typeof text !== 'string') {
    return { url: null, itemId: null, platform: null };
  }

  // First check for short URLs (these are the most common in shared text)
  for (const pattern of SHORT_URL_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const shortUrl = match[0].trim().replace(/[」】\]]+$/, '');
      // Return the short URL - the edge function will follow it to get the real URL
      return { 
        url: shortUrl, 
        itemId: null,
        platform: 'taobao',
        isShortUrl: true
      };
    }
  }

  // Check for direct URLs
  for (const { pattern, platform } of DIRECT_URL_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const url = match[0].trim().replace(/[」】\]]+$/, '');
      const { itemId } = extractItemId(url);
      // If we have an itemId, build the canonical URL
      const canonicalUrl = itemId ? buildCanonicalUrl(itemId, platform) : url;
      return { url: canonicalUrl, itemId, platform, isShortUrl: false };
    }
  }

  // Try to find any URL that looks like it could be a product link
  const generalUrlPattern = /https?:\/\/[^\s\u4e00-\u9fff」】\]]+/gi;
  const urls = text.match(generalUrlPattern);
  
  if (urls) {
    for (const url of urls) {
      const cleanUrl = url.replace(/[」】\]]+$/, '').trim();
      // Check if it's from a known e-commerce domain
      if (/taobao|tmall|jd\.com|1688|tb\.cn/i.test(cleanUrl)) {
        const { itemId, platform } = extractItemId(cleanUrl);
        // If we have an itemId, build the canonical URL
        const canonicalUrl = itemId ? buildCanonicalUrl(itemId, platform || 'taobao') : cleanUrl;
        const isShort = isShortUrl(cleanUrl);
        return { 
          url: canonicalUrl, 
          itemId, 
          platform: platform || 'taobao',
          isShortUrl: isShort
        };
      }
    }
  }

  return { url: null, itemId: null, platform: null };
}

/**
 * Check if text contains a Taobao/JD URL
 */
export function containsProductUrl(text: string): boolean {
  const result = extractUrlFromText(text);
  return result.url !== null;
}
