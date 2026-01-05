import { supabase } from '@/integrations/supabase/client';

interface ExtractResult {
  success: boolean;
  original_text?: string;
  extracted_url?: string;
  item_id?: string;
  platform?: 'taobao' | 'jd' | 'tmall' | '1688';
  method?: 'regex' | 'ai';
  error?: string;
}

/**
 * Extract clean Taobao/JD URL from pasted text using AI
 * Handles messy text like: 【淘宝】假一赔四 https://e.tb.cn/h.77BGXtZFQ2kzrfF?tk=G4D2UbFSfoL CZ356 「拓竹...」
 * Returns standard format: https://item.taobao.com/item.htm?id=903027880049
 */
export async function extractTaobaoUrl(text: string): Promise<ExtractResult> {
  try {
    // First try local extraction (faster)
    const localResult = extractUrlLocally(text);
    
    // If we got an item ID locally, return immediately with standard URL
    if (localResult && localResult.itemId) {
      console.log('Local extraction successful with item ID:', localResult.itemId);
      return {
        success: true,
        original_text: text,
        extracted_url: localResult.url,
        item_id: localResult.itemId,
        platform: localResult.platform,
        method: 'regex'
      };
    }

    // If we found a short URL, call the edge function to resolve it
    if (localResult && !localResult.itemId && isShortUrl(localResult.url)) {
      console.log('Found short URL, calling edge function to resolve:', localResult.url);
    }

    // Fall back to edge function with AI
    const { data, error } = await supabase.functions.invoke('extract-taobao-url', {
      body: { text }
    });

    if (error) {
      console.error('Extract URL error:', error);
      return { success: false, error: error.message };
    }

    return data;
  } catch (err) {
    console.error('Extract URL failed:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error'
    };
  }
}

/**
 * Try to extract URL locally without calling the edge function
 */
function extractUrlLocally(text: string): { url: string; itemId: string | null; platform: 'taobao' | 'jd' | 'tmall' | '1688' } | null {
  // Pattern 1: Full URLs with item ID (highest priority - already in correct format)
  const fullUrlPatterns = [
    // Full Taobao URLs with item ID
    /https?:\/\/(?:www\.)?item\.taobao\.com\/item\.htm\?[^\s\]》】)「」]*/gi,
    // Full Tmall URLs with item ID
    /https?:\/\/(?:www\.)?detail\.tmall\.com\/item\.htm\?[^\s\]》】)「」]*/gi,
    // Full JD URLs
    /https?:\/\/(?:www\.)?item\.jd\.com\/(\d+)\.html/gi,
    // 1688 URLs
    /https?:\/\/(?:www\.)?detail\.1688\.com\/offer\/(\d+)\.html/gi,
  ];

  // Try full URLs first - these are the best matches
  for (const pattern of fullUrlPatterns) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      let url = matches[0];
      url = cleanUrl(url);
      const platform = detectPlatform(url);
      const itemId = extractItemId(url);
      
      if (itemId) {
        // Return standard format URL
        const standardUrl = convertToStandardUrl(itemId, platform);
        return { url: standardUrl, itemId, platform };
      }
      
      return { url, itemId: null, platform };
    }
  }

  // Pattern 2: Shortened URLs (will need resolution via edge function)
  const shortUrlPatterns = [
    /https?:\/\/e\.tb\.cn\/[a-zA-Z0-9._\-?=&]+/gi,
    /https?:\/\/m\.tb\.cn\/[a-zA-Z0-9._\-?=&]+/gi,
    /https?:\/\/c\.tb\.cn\/[a-zA-Z0-9._\-?=&]+/gi,
  ];

  for (const pattern of shortUrlPatterns) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      let url = matches[0];
      url = cleanUrl(url);
      return { url, itemId: null, platform: 'taobao' };
    }
  }

  // Pattern 3: Mobile/alternate URLs
  const mobileUrlPatterns = [
    /https?:\/\/s\.taobao\.com\/[^\s\]》】)「」]+/gi,
    /https?:\/\/a\.m\.taobao\.com\/[^\s\]》】)「」]+/gi,
    /https?:\/\/m\.jd\.com\/[^\s\]》】)「」]+/gi,
    /https?:\/\/m\.1688\.com\/[^\s\]》】)「」]+/gi,
  ];

  for (const pattern of mobileUrlPatterns) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      let url = matches[0];
      url = cleanUrl(url);
      const platform = detectPlatform(url);
      const itemId = extractItemId(url);
      
      if (itemId) {
        const standardUrl = convertToStandardUrl(itemId, platform);
        return { url: standardUrl, itemId, platform };
      }
      
      return { url, itemId: null, platform };
    }
  }

  return null;
}

function cleanUrl(url: string): string {
  // Remove trailing Chinese characters and brackets
  url = url.replace(/[》】」』）\)「【\u4e00-\u9fff]+$/, '');
  // Remove trailing punctuation
  if (url.endsWith('&') || url.endsWith('?') || url.endsWith(',')) {
    url = url.slice(0, -1);
  }
  return url;
}

// Convert to standard format: https://item.taobao.com/item.htm?id=...
function convertToStandardUrl(itemId: string, platform: 'taobao' | 'jd' | 'tmall' | '1688'): string {
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

function detectPlatform(url: string): 'taobao' | 'jd' | 'tmall' | '1688' {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('jd.com')) return 'jd';
  if (lowerUrl.includes('tmall.com')) return 'tmall';
  if (lowerUrl.includes('1688.com')) return '1688';
  return 'taobao';
}

function extractItemId(url: string): string | null {
  const patterns = [
    /[?&]id=(\d{9,15})/i,           // Standard ?id= or &id=
    /\/item\/(\d{9,15})/i,          // /item/12345
    /\/i(\d{9,15})\.htm/i,          // /i12345.htm
    /offer\/(\d{9,15})\.html/i,     // 1688: /offer/12345.html
    /item\.jd\.com\/(\d{9,15})/i,   // JD: item.jd.com/12345
    /\/(\d{9,15})\.html/i,          // Generic /12345.html
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Check if a URL is a shortened URL that needs resolution
 */
export function isShortUrl(url: string): boolean {
  const shortDomains = ['e.tb.cn', 'm.tb.cn', 's.taobao.com', 'a.m.taobao.com', 'c.tb.cn'];
  return shortDomains.some(domain => url.includes(domain));
}

/**
 * Get the app deep link for a platform
 */
export function getAppLink(url: string, platform: string): string {
  // For now, return the web URL - deep links are complex and platform-specific
  return url;
}
