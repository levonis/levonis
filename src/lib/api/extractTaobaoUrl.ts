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
 */
export async function extractTaobaoUrl(text: string): Promise<ExtractResult> {
  try {
    // First try local extraction (faster)
    const localResult = extractUrlLocally(text);
    if (localResult) {
      return {
        success: true,
        original_text: text,
        extracted_url: localResult.url,
        item_id: localResult.itemId,
        platform: localResult.platform,
        method: 'regex'
      };
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
  // Pattern for various URL formats - ordered by priority
  const urlPatterns = [
    // Full Taobao/Tmall URLs with item ID (highest priority)
    /https?:\/\/(?:www\.)?item\.taobao\.com\/item\.htm[^\s\]》】)「」]*/gi,
    /https?:\/\/(?:www\.)?detail\.tmall\.com\/item\.htm[^\s\]》】)「」]*/gi,
    // Full JD URLs
    /https?:\/\/(?:www\.)?item\.jd\.com\/\d+\.html[^\s\]》】)「」]*/gi,
    // 1688 URLs
    /https?:\/\/(?:www\.)?detail\.1688\.com\/offer\/\d+\.html[^\s\]》】)「」]*/gi,
    // Shortened Taobao URLs (need resolution)
    /https?:\/\/e\.tb\.cn\/[^\s\]》】)「」]+/gi,
    /https?:\/\/m\.tb\.cn\/[^\s\]》】)「」]+/gi,
    /https?:\/\/c\.tb\.cn\/[^\s\]》】)「」]+/gi,
    /https?:\/\/s\.taobao\.com\/[^\s\]》】)「」]+/gi,
    /https?:\/\/a\.m\.taobao\.com\/[^\s\]》】)「」]+/gi,
    // Mobile JD URLs
    /https?:\/\/m\.jd\.com\/[^\s\]》】)「」]+/gi,
    // Mobile 1688 URLs
    /https?:\/\/m\.1688\.com\/[^\s\]》】)「」]+/gi,
  ];

  for (const pattern of urlPatterns) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      let url = matches[0];
      // Clean up trailing characters (Chinese brackets, parentheses, etc.)
      url = url.replace(/[》】」』）\)「【]+$/, '');
      // Remove any trailing query params that might be cut off
      if (url.endsWith('&') || url.endsWith('?')) {
        url = url.slice(0, -1);
      }
      
      const platform = detectPlatform(url);
      const itemId = extractItemId(url);
      
      // If we have an item ID, convert to standard format
      if (itemId) {
        const standardUrl = convertToStandardUrl(itemId, platform);
        return { url: standardUrl, itemId, platform };
      }
      
      return { url, itemId, platform };
    }
  }

  return null;
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
  if (url.includes('jd.com')) return 'jd';
  if (url.includes('tmall.com')) return 'tmall';
  if (url.includes('1688.com')) return '1688';
  return 'taobao';
}

function extractItemId(url: string): string | null {
  const patterns = [
    /[?&]id=(\d+)/i,
    /\/item\/(\d+)/i,
    /\/i(\d+)\.htm/i,
    /offer\/(\d+)\.html/i,
    /\/(\d+)\.html/i,
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
