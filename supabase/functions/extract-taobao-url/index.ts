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
        JSON.stringify({ success: false, error: 'No text provided' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Extracting URL from text:', text.substring(0, 200));

    let extractedUrl = '';
    let platform = '';
    let itemId = '';

    // Pattern 1: Direct full URLs with item ID
    const fullUrlPatterns = [
      // Taobao item page
      { regex: /https?:\/\/(?:item|detail)\.taobao\.com\/item\.htm\?[^\s【】「」]*id=(\d+)[^\s【】「」]*/i, platform: 'taobao' },
      // Tmall item page
      { regex: /https?:\/\/detail\.tmall\.com\/item\.htm\?[^\s【】「」]*id=(\d+)[^\s【】「」]*/i, platform: 'tmall' },
      // JD item page
      { regex: /https?:\/\/item\.jd\.com\/(\d+)\.html/i, platform: 'jd' },
      // 1688 item page
      { regex: /https?:\/\/detail\.1688\.com\/offer\/(\d+)\.html/i, platform: '1688' },
      // Mobile Taobao
      { regex: /https?:\/\/(?:m|h5)\.taobao\.com\/[^\s【】「」]*[?&]id=(\d+)/i, platform: 'taobao' },
      // World Taobao
      { regex: /https?:\/\/world\.taobao\.com\/item\/(\d+)\.htm/i, platform: 'taobao' },
    ];

    for (const { regex, platform: p } of fullUrlPatterns) {
      const match = text.match(regex);
      if (match) {
        itemId = match[1];
        platform = p;
        if (platform === 'tmall') {
          extractedUrl = `https://detail.tmall.com/item.htm?id=${itemId}`;
        } else if (platform === 'jd') {
          extractedUrl = `https://item.jd.com/${itemId}.html`;
        } else if (platform === '1688') {
          extractedUrl = `https://detail.1688.com/offer/${itemId}.html`;
        } else {
          extractedUrl = `https://item.taobao.com/item.htm?id=${itemId}`;
        }
        break;
      }
    }

    // Pattern 2: Short URLs (need to resolve)
    if (!extractedUrl) {
      const shortUrlPatterns = [
        /(https?:\/\/e\.tb\.cn\/[^\s【】「」]+)/i,
        /(https?:\/\/m\.tb\.cn\/[^\s【】「」]+)/i,
        /(https?:\/\/c\.tb\.cn\/[^\s【】「」]+)/i,
        /(https?:\/\/s\.click\.taobao\.com\/[^\s【】「」]+)/i,
      ];

      for (const pattern of shortUrlPatterns) {
        const match = text.match(pattern);
        if (match) {
          let shortUrl = match[1].split(/[【】「」\s]/)[0];
          // Clean trailing punctuation
          shortUrl = shortUrl.replace(/[,，。！!?？)）]+$/, '');
          console.log('Found short URL:', shortUrl);
          
          try {
            // Follow redirects to get the final URL
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            
            const response = await fetch(shortUrl, {
              method: 'GET',
              redirect: 'follow',
              signal: controller.signal,
              headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
              }
            });
            
            clearTimeout(timeoutId);
            const finalUrl = response.url;
            console.log('Resolved to:', finalUrl);
            
            // Extract ID from resolved URL
            const idMatch = finalUrl.match(/[?&]id=(\d+)/);
            if (idMatch) {
              itemId = idMatch[1];
              if (finalUrl.includes('tmall.com')) {
                platform = 'tmall';
                extractedUrl = `https://detail.tmall.com/item.htm?id=${itemId}`;
              } else {
                platform = 'taobao';
                extractedUrl = `https://item.taobao.com/item.htm?id=${itemId}`;
              }
            } else {
              // Try to get item ID from response body
              const html = await response.text();
              const bodyIdMatch = html.match(/[?&]id=(\d{9,15})/);
              if (bodyIdMatch) {
                itemId = bodyIdMatch[1];
                platform = 'taobao';
                extractedUrl = `https://item.taobao.com/item.htm?id=${itemId}`;
              }
            }
          } catch (e) {
            console.warn('Failed to resolve short URL:', e);
          }
          break;
        }
      }
    }

    // Pattern 3: Just item ID mentioned in text
    if (!extractedUrl) {
      const idPatterns = [
        /id[=:：]\s*(\d{9,15})/i,
        /商品ID[：:]\s*(\d{9,15})/i,
        /item[\/]?(\d{9,15})/i,
      ];

      for (const pattern of idPatterns) {
        const match = text.match(pattern);
        if (match) {
          itemId = match[1];
          platform = 'taobao';
          extractedUrl = `https://item.taobao.com/item.htm?id=${itemId}`;
          break;
        }
      }
    }

    if (extractedUrl) {
      console.log('Successfully extracted:', extractedUrl, 'Platform:', platform, 'ID:', itemId);
      return new Response(
        JSON.stringify({ 
          success: true, 
          extracted_url: extractedUrl,
          platform,
          item_id: itemId
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Could not extract URL from text');
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'لم يتم العثور على رابط منتج صالح',
        hint: 'يرجى لصق رابط المنتج الكامل أو رابط مختصر من Taobao/Tmall/JD/1688'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'فشل في معالجة الطلب' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
