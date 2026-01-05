import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();

    if (!text || typeof text !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'Text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Extracting URL from text:', text.substring(0, 200));

    // Method 1: Try regex extraction first (faster, no AI needed)
    let extractedUrl = extractUrlWithRegex(text);
    
    if (extractedUrl) {
      console.log('URL extracted via regex:', extractedUrl);
      
      // If it's a shortened URL, try to resolve it
      if (isShortUrl(extractedUrl)) {
        console.log('Detected short URL, resolving...');
        const resolvedUrl = await resolveShortUrl(extractedUrl);
        if (resolvedUrl) {
          extractedUrl = resolvedUrl;
          console.log('Resolved to:', extractedUrl);
        } else {
          // If resolution fails, still try to extract item ID from any redirects we got
          console.log('Short URL resolution failed, trying alternate methods...');
        }
      }
      
      // Extract item ID
      const itemId = extractItemId(extractedUrl);
      const platform = detectPlatform(extractedUrl);
      
      // Convert to standard format
      const standardUrl = convertToStandardUrl(extractedUrl, itemId, platform);
      
      console.log('Final result:', { standardUrl, itemId, platform });
      
      return new Response(
        JSON.stringify({
          success: true,
          original_text: text,
          extracted_url: standardUrl,
          item_id: itemId,
          platform: platform,
          method: 'regex'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Method 2: Use AI for complex cases
    console.log('Regex failed, trying AI extraction...');
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `أنت متخصص في استخراج روابط المنتجات من النصوص الصينية.
            
مهمتك: استخراج رابط المنتج ومعرف المنتج (item ID) من النص المُعطى.

المنصات المدعومة:
- Taobao (taobao.com, e.tb.cn, s.taobao.com, m.tb.cn, a.m.taobao.com)
- Tmall (tmall.com, detail.tmall.com)
- JD (jd.com, item.jd.com, m.jd.com)
- 1688 (1688.com, detail.1688.com)

قواعد مهمة:
1. ابحث عن أي رابط URL في النص
2. استخرج معرف المنتج (item ID) - عادة رقم طويل مكون من 9-15 رقم
3. إذا وجدت رابط مختصر مثل e.tb.cn، ابحث عن معرف المنتج في النص أو أعد الرابط المختصر
4. تجاهل أي نص صيني أو عربي، فقط ركز على الرابط ومعرف المنتج

أعد الإجابة بتنسيق JSON فقط:
{
  "url": "الرابط المستخرج",
  "item_id": "معرف المنتج (رقم فقط)",
  "platform": "taobao أو jd أو tmall أو 1688"
}`
          },
          {
            role: 'user',
            content: `استخرج رابط المنتج ومعرف المنتج من هذا النص:\n\n${text}`
          }
        ]
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiResult = await aiResponse.json();
    const content = aiResult.choices?.[0]?.message?.content || '';
    console.log('AI response:', content);

    // Parse AI response
    let parsedResult: { url?: string; item_id?: string; platform?: string } = {};
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResult = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('Failed to parse AI response:', e);
    }

    if (parsedResult.url || parsedResult.item_id) {
      let finalUrl = parsedResult.url || '';
      
      // If we have item_id, we can build the standard URL directly
      const itemId = parsedResult.item_id || extractItemId(finalUrl);
      const platform = parsedResult.platform || detectPlatform(finalUrl) || 'taobao';
      
      // Build standard URL from item ID
      const standardUrl = itemId 
        ? convertToStandardUrl(finalUrl, itemId, platform)
        : finalUrl;
      
      console.log('AI extraction result:', { standardUrl, itemId, platform });
      
      return new Response(
        JSON.stringify({
          success: true,
          original_text: text,
          extracted_url: standardUrl,
          item_id: itemId,
          platform: platform,
          method: 'ai'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: 'لم يتم العثور على رابط منتج صالح في النص',
        original_text: text
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error extracting URL:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function extractUrlWithRegex(text: string): string | null {
  // Pattern 1: Standard full URLs with item ID (highest priority)
  const fullUrlPatterns = [
    // Full Taobao URLs with item ID
    /https?:\/\/(?:www\.)?item\.taobao\.com\/item\.htm\?[^\s\]》】)「」]*/gi,
    // Full Tmall URLs with item ID
    /https?:\/\/(?:www\.)?detail\.tmall\.com\/item\.htm\?[^\s\]》】)「」]*/gi,
    // Full JD URLs
    /https?:\/\/(?:www\.)?item\.jd\.com\/\d+\.html/gi,
    // 1688 URLs
    /https?:\/\/(?:www\.)?detail\.1688\.com\/offer\/\d+\.html/gi,
  ];

  // Try full URLs first - these are already in the correct format
  for (const pattern of fullUrlPatterns) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      let url = matches[0];
      // Clean up trailing characters
      url = cleanUrl(url);
      console.log('Found full URL:', url);
      return url;
    }
  }

  // Pattern 2: Shortened URLs (need resolution)
  const shortUrlPatterns = [
    /https?:\/\/e\.tb\.cn\/[a-zA-Z0-9._\-?=&]+/gi,
    /https?:\/\/m\.tb\.cn\/[a-zA-Z0-9._\-?=&]+/gi,
    /https?:\/\/c\.tb\.cn\/[a-zA-Z0-9._\-?=&]+/gi,
  ];

  for (const pattern of shortUrlPatterns) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      let url = matches[0];
      // Clean up trailing characters
      url = cleanUrl(url);
      console.log('Found short URL:', url);
      return url;
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
      return url;
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

function isShortUrl(url: string): boolean {
  const shortDomains = [
    'e.tb.cn',
    'm.tb.cn',
    'c.tb.cn',
    's.taobao.com',
    'a.m.taobao.com',
  ];
  return shortDomains.some(domain => url.includes(domain));
}

async function resolveShortUrl(shortUrl: string): Promise<string | null> {
  try {
    console.log('Attempting to resolve short URL:', shortUrl);
    
    // Try following redirects with GET request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    const response = await fetch(shortUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      }
    });
    
    clearTimeout(timeoutId);
    
    const finalUrl = response.url;
    console.log('Redirect resolved to:', finalUrl);
    
    // Check if we got a valid product URL
    if (finalUrl && (
      finalUrl.includes('item.taobao.com') ||
      finalUrl.includes('detail.tmall.com') ||
      finalUrl.includes('item.jd.com') ||
      finalUrl.includes('detail.1688.com')
    )) {
      return finalUrl;
    }
    
    // Try to extract item ID from the response URL even if not exact match
    const itemId = extractItemId(finalUrl);
    if (itemId) {
      const platform = detectPlatform(finalUrl);
      console.log('Extracted item ID from redirect:', itemId);
      return convertToStandardUrl(finalUrl, itemId, platform);
    }
    
    // Check the response body for redirects or item IDs
    const html = await response.text();
    const itemIdMatch = html.match(/id=(\d{9,15})/);
    if (itemIdMatch) {
      console.log('Found item ID in response body:', itemIdMatch[1]);
      return `https://item.taobao.com/item.htm?id=${itemIdMatch[1]}`;
    }
    
    return finalUrl;
  } catch (error) {
    console.error('Error resolving short URL:', error);
    return null;
  }
}

function extractItemId(url: string): string | null {
  // Multiple patterns for item ID extraction
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
      console.log('Extracted item ID:', match[1], 'using pattern:', pattern.source);
      return match[1];
    }
  }

  return null;
}

function detectPlatform(url: string): string {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('jd.com')) return 'jd';
  if (lowerUrl.includes('tmall.com')) return 'tmall';
  if (lowerUrl.includes('1688.com')) return '1688';
  return 'taobao';
}

// Convert any URL to standard format
function convertToStandardUrl(url: string, itemId: string | null, platform: string): string {
  // If we have an item ID, return the standard format
  if (itemId) {
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
  
  // If no item ID, return the original URL
  return url;
}
