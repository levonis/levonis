import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Detect platform from URL
function detectPlatform(url: string): { platform: string; itemId: string | null } {
  const urlLower = url.toLowerCase();
  
  // Taobao
  if (urlLower.includes('taobao.com') || urlLower.includes('m.tb.cn') || urlLower.includes('e.tb.cn')) {
    const idMatch = url.match(/[?&]id=(\d+)/);
    return { platform: 'taobao', itemId: idMatch?.[1] || null };
  }
  
  // Tmall
  if (urlLower.includes('tmall.com')) {
    const idMatch = url.match(/[?&]id=(\d+)/);
    return { platform: 'tmall', itemId: idMatch?.[1] || null };
  }
  
  // 1688
  if (urlLower.includes('1688.com')) {
    const idMatch = url.match(/offer\/(\d+)/);
    return { platform: '1688', itemId: idMatch?.[1] || null };
  }
  
  // JD
  if (urlLower.includes('jd.com')) {
    const idMatch = url.match(/\/(\d+)\.html/);
    return { platform: 'jd', itemId: idMatch?.[1] || null };
  }
  
  // AliExpress
  if (urlLower.includes('aliexpress.com') || urlLower.includes('aliexpress.ru')) {
    const idMatch = url.match(/\/item\/(\d+)/) || url.match(/\/(\d+)\.html/);
    return { platform: 'aliexpress', itemId: idMatch?.[1] || null };
  }
  
  // Amazon
  if (urlLower.includes('amazon.')) {
    const asinMatch = url.match(/\/dp\/([A-Z0-9]{10})/) || url.match(/\/product\/([A-Z0-9]{10})/);
    return { platform: 'amazon', itemId: asinMatch?.[1] || null };
  }
  
  // Shein
  if (urlLower.includes('shein.com')) {
    const idMatch = url.match(/-p-(\d+)/);
    return { platform: 'shein', itemId: idMatch?.[1] || null };
  }
  
  // Unknown platform
  return { platform: 'unknown', itemId: null };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    
    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'الرجاء إدخال رابط المنتج' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Extracting product info from URL:', url);

    // Detect platform
    const { platform, itemId } = detectPlatform(url);
    console.log('Detected platform:', platform, 'Item ID:', itemId);

    // Get Lovable API Key for AI extraction
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ 
          success: false, 
          requiresManualInput: true,
          item_id: itemId,
          platform: platform,
          message: 'يرجى إدخال البيانات يدوياً'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Try to fetch the page
    let pageContent = '';
    let fetchSuccess = false;

    try {
      console.log('Attempting to fetch page...');
      const pageResponse = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5,ar;q=0.3',
        }
      });

      if (pageResponse.ok) {
        pageContent = await pageResponse.text();
        fetchSuccess = pageContent.length > 1000;
        console.log('Page fetched, content length:', pageContent.length);
      } else {
        console.log('Fetch failed with status:', pageResponse.status);
      }
    } catch (fetchError) {
      console.log('Fetch error:', fetchError);
    }

    // If we couldn't fetch the page, request manual input
    if (!fetchSuccess) {
      console.log('Could not fetch page, requesting manual input');
      
      const platformNames: Record<string, string> = {
        'taobao': 'تاوباو',
        'tmall': 'تي مول',
        '1688': '1688',
        'jd': 'جي دي',
        'aliexpress': 'علي إكسبريس',
        'amazon': 'أمازون',
        'shein': 'شي إن',
        'unknown': 'غير معروف'
      };

      return new Response(
        JSON.stringify({ 
          success: false, 
          requiresManualInput: true,
          item_id: itemId,
          platform: platform,
          message: `لا يمكن الوصول المباشر لـ ${platformNames[platform] || platform} - يرجى إدخال البيانات يدوياً`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use AI to extract product info from the page content
    console.log('Using AI to extract product info...');

    const prompt = `Extract product information from this HTML page content.

URL: ${url}
Platform: ${platform}
Item ID: ${itemId || 'Unknown'}

Page content (first 15000 chars):
${pageContent.substring(0, 15000)}

Extract and return ONLY a JSON object with this exact structure:
{
  "name": "Product name in English",
  "name_ar": "اسم المنتج بالعربية",
  "description": "Brief description in English",
  "description_ar": "وصف مختصر بالعربية",
  "price": 0,
  "original_price": 0,
  "currency": "USD",
  "images": ["image_url_1", "image_url_2"],
  "colors": [
    {
      "name": "Color name",
      "name_ar": "اسم اللون",
      "image_url": "color_image_url",
      "hex_code": "#000000"
    }
  ],
  "options": [
    {
      "name": "Option name",
      "name_ar": "اسم الخيار",
      "price_adjustment": 0,
      "image_url": "option_image_url"
    }
  ]
}

Important:
- Extract ALL available images
- Extract ALL color variants
- Extract ALL size/option variants
- Translate names to Arabic
- Ensure image URLs are complete (add https: if missing)
- Return ONLY the JSON object, no other text`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are a product data extraction expert. Extract accurate product information from HTML content. Always return valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', errorText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          requiresManualInput: true,
          item_id: itemId,
          platform: platform,
          message: 'فشل في استخراج المعلومات - يرجى إدخال البيانات يدوياً'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const extractedText = aiData.choices[0].message.content;

    console.log('AI response received');

    // Parse the extracted JSON
    const jsonMatch = extractedText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Failed to extract JSON from AI response');
      return new Response(
        JSON.stringify({ 
          success: false, 
          requiresManualInput: true,
          item_id: itemId,
          platform: platform,
          message: 'فشل في تحليل البيانات - يرجى إدخال البيانات يدوياً'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let productInfo;
    try {
      productInfo = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          requiresManualInput: true,
          item_id: itemId,
          platform: platform,
          message: 'فشل في تحليل البيانات - يرجى إدخال البيانات يدوياً'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fix image URLs (add https: if missing)
    if (productInfo.images) {
      productInfo.images = productInfo.images.map((img: string) => {
        if (img.startsWith('//')) return 'https:' + img;
        return img;
      });
    }

    if (productInfo.colors) {
      productInfo.colors = productInfo.colors.map((color: any) => ({
        ...color,
        image_url: color.image_url?.startsWith('//') ? 'https:' + color.image_url : color.image_url
      }));
    }

    console.log('Product info extracted successfully');

    return new Response(
      JSON.stringify({
        success: true,
        productInfo: productInfo,
        platform: platform,
        item_id: itemId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in extract-product-info:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
        requiresManualInput: true,
        message: 'حدث خطأ - يرجى إدخال البيانات يدوياً'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
