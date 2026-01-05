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
        }
      }
      
      // Extract item ID
      const itemId = extractItemId(extractedUrl);
      
      return new Response(
        JSON.stringify({
          success: true,
          original_text: text,
          extracted_url: extractedUrl,
          item_id: itemId,
          platform: detectPlatform(extractedUrl),
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
        temperature: 0.1,
        max_tokens: 1000,
        messages: [
          {
            role: 'system',
            content: `أنت متخصص في استخراج روابط المنتجات من النصوص.
            
مهمتك: استخراج رابط المنتج الأصلي من النص المُعطى.

المنصات المدعومة:
- Taobao (taobao.com, e.tb.cn, s.taobao.com, m.tb.cn, a.m.taobao.com)
- Tmall (tmall.com, detail.tmall.com)
- JD (jd.com, item.jd.com, m.jd.com)
- 1688 (1688.com, detail.1688.com)

قواعد مهمة:
1. ابحث عن أي رابط URL في النص (قد يكون مختصراً)
2. إذا وجدت رابط مختصر مثل e.tb.cn أو m.tb.cn، أعده كما هو
3. استخرج معرف المنتج (item ID) إذا كان متاحاً في الرابط
4. تجاهل أي نص صيني أو عربي أو رموز تعبيرية، فقط ركز على الرابط

أعد الإجابة بتنسيق JSON فقط:
{
  "url": "الرابط المستخرج",
  "item_id": "معرف المنتج إن وجد",
  "platform": "taobao أو jd أو tmall أو 1688"
}`
          },
          {
            role: 'user',
            content: `استخرج رابط المنتج من هذا النص:\n\n${text}`
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

    if (parsedResult.url) {
      let finalUrl = parsedResult.url;
      
      // Resolve short URL if needed
      if (isShortUrl(finalUrl)) {
        console.log('AI found short URL, resolving...');
        const resolvedUrl = await resolveShortUrl(finalUrl);
        if (resolvedUrl) {
          finalUrl = resolvedUrl;
          parsedResult.item_id = extractItemId(finalUrl) || parsedResult.item_id;
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          original_text: text,
          extracted_url: finalUrl,
          item_id: parsedResult.item_id || extractItemId(finalUrl),
          platform: parsedResult.platform || detectPlatform(finalUrl),
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
  // Pattern 1: Standard URLs
  const urlPatterns = [
    // Full URLs
    /https?:\/\/(?:www\.)?(?:item\.taobao\.com|taobao\.com|detail\.tmall\.com|tmall\.com|item\.jd\.com|jd\.com|detail\.1688\.com|1688\.com)[^\s\]》】)]+/gi,
    // Shortened Taobao URLs
    /https?:\/\/(?:e\.tb\.cn|m\.tb\.cn|s\.taobao\.com|a\.m\.taobao\.com)[^\s\]》】)]+/gi,
    // Mobile JD URLs
    /https?:\/\/m\.jd\.com[^\s\]》】)]+/gi,
    // Any URL that looks like a product link
    /https?:\/\/[^\s\]》】]+(?:item|product|detail|goods)[^\s\]》】]*/gi,
    // Generic shortened URLs that might be Taobao/JD
    /https?:\/\/[a-z0-9]+\.[a-z]+\.[a-z]+\/[^\s\]》】]+/gi,
  ];

  for (const pattern of urlPatterns) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      // Clean up the URL
      let url = matches[0];
      // Remove trailing Chinese/Arabic characters or punctuation
      url = url.replace(/[》】」』）\)]+$/, '');
      return url;
    }
  }

  return null;
}

function isShortUrl(url: string): boolean {
  const shortDomains = [
    'e.tb.cn',
    'm.tb.cn',
    's.taobao.com',
    'a.m.taobao.com',
    'c.tb.cn',
  ];
  return shortDomains.some(domain => url.includes(domain));
}

async function resolveShortUrl(shortUrl: string): Promise<string | null> {
  try {
    // Follow redirects to get the final URL
    const response = await fetch(shortUrl, {
      method: 'HEAD',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
      }
    });
    
    const finalUrl = response.url;
    console.log('Resolved URL:', finalUrl);
    
    // Verify it's a valid product URL
    if (finalUrl && (
      finalUrl.includes('taobao.com') ||
      finalUrl.includes('tmall.com') ||
      finalUrl.includes('jd.com') ||
      finalUrl.includes('1688.com')
    )) {
      return finalUrl;
    }
    
    // Try GET request for more accurate redirect following
    const getResponse = await fetch(shortUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
      }
    });
    
    return getResponse.url || null;
  } catch (error) {
    console.error('Error resolving short URL:', error);
    return null;
  }
}

function extractItemId(url: string): string | null {
  // Taobao item ID patterns
  const patterns = [
    /[?&]id=(\d+)/i,
    /\/item\/(\d+)/i,
    /\/i(\d+)\.htm/i,
    /offer\/(\d+)\.html/i,  // 1688
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

function detectPlatform(url: string): string {
  if (url.includes('jd.com')) return 'jd';
  if (url.includes('tmall.com')) return 'tmall';
  if (url.includes('1688.com')) return '1688';
  return 'taobao';
}
