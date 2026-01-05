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
  // Pattern for various URL formats
  const urlPatterns = [
    // Full Taobao/Tmall URLs
    /https?:\/\/(?:www\.)?(?:item\.taobao\.com|detail\.tmall\.com)[^\s\]》】)]+/gi,
    // Shortened Taobao URLs
    /https?:\/\/(?:e\.tb\.cn|m\.tb\.cn|s\.taobao\.com|a\.m\.taobao\.com)[^\s\]》】)]+/gi,
    // JD URLs
    /https?:\/\/(?:item\.jd\.com|m\.jd\.com)[^\s\]》】)]+/gi,
    // 1688 URLs
    /https?:\/\/(?:detail\.1688\.com|m\.1688\.com)[^\s\]》】)]+/gi,
  ];

  for (const pattern of urlPatterns) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      let url = matches[0];
      // Clean up trailing characters
      url = url.replace(/[》】」』）\)]+$/, '');
      
      const platform = detectPlatform(url);
      const itemId = extractItemId(url);
      
      return { url, itemId, platform };
    }
  }

  return null;
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
