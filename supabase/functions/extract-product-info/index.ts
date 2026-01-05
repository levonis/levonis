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
  
  // Bambu Lab
  if (urlLower.includes('bambulab.com')) {
    return { platform: 'bambulab', itemId: null };
  }
  
  // Shopify stores (generic)
  if (urlLower.includes('/products/')) {
    return { platform: 'shopify', itemId: null };
  }
  
  // Unknown platform
  return { platform: 'other', itemId: null };
}

// Enhanced color keywords with Arabic translations
const COLOR_MAP: Record<string, { ar: string; hex: string }> = {
  'black': { ar: 'أسود', hex: '#000000' },
  'white': { ar: 'أبيض', hex: '#FFFFFF' },
  'red': { ar: 'أحمر', hex: '#FF0000' },
  'blue': { ar: 'أزرق', hex: '#0000FF' },
  'green': { ar: 'أخضر', hex: '#008000' },
  'yellow': { ar: 'أصفر', hex: '#FFFF00' },
  'pink': { ar: 'وردي', hex: '#FFC0CB' },
  'purple': { ar: 'بنفسجي', hex: '#800080' },
  'orange': { ar: 'برتقالي', hex: '#FFA500' },
  'gray': { ar: 'رمادي', hex: '#808080' },
  'grey': { ar: 'رمادي', hex: '#808080' },
  'brown': { ar: 'بني', hex: '#A52A2A' },
  'gold': { ar: 'ذهبي', hex: '#FFD700' },
  'silver': { ar: 'فضي', hex: '#C0C0C0' },
  'navy': { ar: 'كحلي', hex: '#000080' },
  'beige': { ar: 'بيج', hex: '#F5F5DC' },
  'cream': { ar: 'كريمي', hex: '#FFFDD0' },
  'khaki': { ar: 'كاكي', hex: '#C3B091' },
  'olive': { ar: 'زيتي', hex: '#808000' },
  'maroon': { ar: 'خمري', hex: '#800000' },
  'cyan': { ar: 'سماوي', hex: '#00FFFF' },
  'teal': { ar: 'أخضر مزرق', hex: '#008080' },
  'coral': { ar: 'مرجاني', hex: '#FF7F50' },
  'burgundy': { ar: 'عنابي', hex: '#800020' },
  'turquoise': { ar: 'تركوازي', hex: '#40E0D0' },
  'rose': { ar: 'وردي', hex: '#FF007F' },
  'mint': { ar: 'نعناعي', hex: '#98FF98' },
  'lavender': { ar: 'لافندر', hex: '#E6E6FA' },
  'peach': { ar: 'خوخي', hex: '#FFDAB9' },
  'apricot': { ar: 'مشمشي', hex: '#FBCEB1' },
  'champagne': { ar: 'شامبانيا', hex: '#F7E7CE' },
  'charcoal': { ar: 'فحمي', hex: '#36454F' },
  'chocolate': { ar: 'شوكولاتي', hex: '#7B3F00' },
  'coffee': { ar: 'بني قهوة', hex: '#6F4E37' },
  'camel': { ar: 'جملي', hex: '#C19A6B' },
  'tan': { ar: 'أسمر', hex: '#D2B48C' },
  'nude': { ar: 'نود', hex: '#E3BC9A' },
  'ivory': { ar: 'عاجي', hex: '#FFFFF0' },
  'sand': { ar: 'رملي', hex: '#C2B280' },
  'stone': { ar: 'حجري', hex: '#928E85' },
  'graphite': { ar: 'جرافيت', hex: '#383838' },
};

// Clean and validate color name
function isValidColorName(name: string): boolean {
  const nameLower = name.toLowerCase().trim();
  // Must be a simple color name, not HTML/code garbage
  if (nameLower.length < 2 || nameLower.length > 30) return false;
  if (nameLower.includes('<') || nameLower.includes('>')) return false;
  if (nameLower.includes('[') || nameLower.includes(']')) return false;
  if (nameLower.includes('{') || nameLower.includes('}')) return false;
  if (nameLower.includes('\\')) return false;
  if (nameLower.includes('http')) return false;
  if (nameLower.includes('class=')) return false;
  if (nameLower.includes('style=')) return false;
  if (/^\d+$/.test(nameLower)) return false; // Just numbers
  // Must match a known color or be simple text
  return Object.keys(COLOR_MAP).some(c => nameLower === c || nameLower.includes(c));
}

// Clean and validate option name
function isValidOptionName(name: string): boolean {
  const nameTrimmed = name.trim();
  if (nameTrimmed.length < 1 || nameTrimmed.length > 50) return false;
  if (nameTrimmed.includes('<') || nameTrimmed.includes('>')) return false;
  if (nameTrimmed.includes('{') || nameTrimmed.includes('}')) return false;
  if (nameTrimmed.includes('\\')) return false;
  if (/^(select|choose|pick|اختر|option)/i.test(nameTrimmed)) return false;
  return true;
}

// Extract product images from HTML
function extractImages(html: string): string[] {
  const images: string[] = [];
  const seenImages = new Set<string>();

  const addImage = (url: string) => {
    if (!url || seenImages.has(url)) return;
    let cleanUrl = url.trim();
    if (cleanUrl.startsWith('//')) cleanUrl = 'https:' + cleanUrl;
    if (!cleanUrl.startsWith('http')) return;
    if (cleanUrl.includes('data:image')) return;
    if (cleanUrl.includes('placeholder')) return;
    if (cleanUrl.includes('icon')) return;
    if (cleanUrl.includes('logo')) return;
    if (cleanUrl.includes('avatar')) return;
    if (cleanUrl.includes('consent')) return;
    if (cleanUrl.includes('trustarc')) return;
    if (cleanUrl.length < 20) return;
    // Must be a product image (common patterns)
    if (cleanUrl.includes('product') || 
        cleanUrl.includes('store.bblcdn') || 
        cleanUrl.includes('cdn.') ||
        cleanUrl.includes('images/') ||
        cleanUrl.includes('img.') ||
        cleanUrl.includes('media.') ||
        /\.(jpg|jpeg|png|webp)/i.test(cleanUrl)) {
      seenImages.add(cleanUrl);
      images.push(cleanUrl);
    }
  };

  // Extract from og:image
  const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
  if (ogMatch) addImage(ogMatch[1]);

  // Extract from JSON-LD
  const jsonLdMatches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of jsonLdMatches) {
    try {
      const data = JSON.parse(match[1]);
      if (data['@type'] === 'Product' && data.image) {
        const imgs = Array.isArray(data.image) ? data.image : [data.image];
        imgs.forEach(addImage);
      }
    } catch {}
  }

  // Extract from product gallery images
  const galleryPatterns = [
    /<img[^>]*class=["'][^"']*(?:gallery|product|main|zoom)[^"']*["'][^>]*src=["']([^"']+)["']/gi,
    /<img[^>]*src=["']([^"']+store\.bblcdn[^"']+)["']/gi,
    /<img[^>]*data-src=["']([^"']+store\.bblcdn[^"']+)["']/gi,
    /<img[^>]*src=["']([^"']+)["'][^>]*alt=["'][^"']*(?:product|item)[^"']*["']/gi,
  ];
  
  for (const pattern of galleryPatterns) {
    const matches = html.matchAll(pattern);
    for (const match of matches) {
      addImage(match[1]);
    }
  }

  return images.slice(0, 10);
}

// Extract price from HTML
function extractPrice(html: string): number | null {
  // Look for price patterns
  const pricePatterns = [
    /\$(\d+(?:\.\d{2})?)\s*USD/gi,
    /"price"\s*:\s*"?(\d+(?:\.\d{2})?)"?/gi,
    /data-price=["'](\d+(?:\.\d{2})?)["']/gi,
    /class=["'][^"']*price[^"']*["'][^>]*>\s*\$?(\d+(?:\.\d{2})?)/gi,
  ];

  for (const pattern of pricePatterns) {
    const matches = html.matchAll(pattern);
    for (const match of matches) {
      const price = parseFloat(match[1]);
      if (price > 0 && price < 100000) {
        return price;
      }
    }
  }
  return null;
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
          'Accept-Language': 'en-US,en;q=0.5,ar;q=0.3,zh;q=0.2',
          'Cache-Control': 'no-cache',
        }
      });

      if (pageResponse.ok) {
        pageContent = await pageResponse.text();
        fetchSuccess = pageContent.length > 500;
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
        'bambulab': 'بامبو لاب',
        'shopify': 'المتجر',
        'other': 'الموقع'
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

    // Extract images and price directly from HTML
    const directImages = extractImages(pageContent);
    const directPrice = extractPrice(pageContent);
    console.log('Direct extraction - images:', directImages.length, 'price:', directPrice);

    // Use AI to extract complete product info
    console.log('Using AI to extract product info...');

    const prompt = `أنت خبير في استخراج بيانات المنتجات من صفحات الويب.

استخرج معلومات المنتج من هذه الصفحة:
URL: ${url}
Platform: ${platform}

=== HTML محتوى الصفحة ===
${pageContent.substring(0, 20000)}

=== التعليمات ===
استخرج وأرجع كائن JSON بهذا الهيكل بالضبط:
{
  "name": "اسم المنتج بالإنجليزية",
  "name_ar": "اسم المنتج بالعربية",
  "description": "وصف مختصر بالإنجليزية (جملة أو جملتين)",
  "description_ar": "وصف مختصر بالعربية (جملة أو جملتين)",
  "price": 29.99,
  "original_price": 39.99,
  "currency": "USD",
  "images": ["https://image1.jpg", "https://image2.jpg"],
  "colors": [
    {"name": "Black", "name_ar": "أسود", "hex_code": "#000000"}
  ],
  "options": [
    {"name": "Size M", "name_ar": "مقاس M"}
  ]
}

قواعد مهمة جداً:
1. الألوان يجب أن تكون أسماء ألوان فعلية فقط (Black, White, Red, Blue, إلخ)
2. لا تضع أي نص HTML أو كود في الألوان أو الخيارات
3. إذا لم تجد ألوان حقيقية، أرجع مصفوفة فارغة []
4. الخيارات يجب أن تكون خيارات منتج فعلية (مقاسات، أحجام، نماذج)
5. استخرج الصور من الصفحة - يجب أن تكون روابط كاملة تبدأ بـ https://
6. السعر يجب أن يكون رقم فقط
7. أرجع JSON فقط بدون أي نص إضافي`;

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
            content: 'أنت مساعد لاستخراج بيانات المنتجات. أرجع JSON صالح فقط.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
      }),
    });

    let productInfo: any = {
      name: 'Product',
      name_ar: 'منتج',
      description: '',
      description_ar: '',
      price: directPrice || 0,
      original_price: null,
      currency: 'USD',
      images: directImages,
      colors: [],
      options: []
    };
    
    if (aiResponse.ok) {
      try {
        const aiData = await aiResponse.json();
        const extractedText = aiData.choices[0]?.message?.content || '';
        console.log('AI response length:', extractedText.length);
        
        const jsonMatch = extractedText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const aiProductInfo = JSON.parse(jsonMatch[0]);
          
          // Merge AI results with direct extraction
          productInfo.name = aiProductInfo.name || productInfo.name;
          productInfo.name_ar = aiProductInfo.name_ar || productInfo.name_ar;
          productInfo.description = aiProductInfo.description || productInfo.description;
          productInfo.description_ar = aiProductInfo.description_ar || productInfo.description_ar;
          productInfo.price = aiProductInfo.price || productInfo.price;
          productInfo.original_price = aiProductInfo.original_price;
          productInfo.currency = aiProductInfo.currency || productInfo.currency;
          
          // Merge images - prefer direct extraction, add AI images if unique
          if (aiProductInfo.images && Array.isArray(aiProductInfo.images)) {
            for (const img of aiProductInfo.images) {
              if (img && img.startsWith('http') && !productInfo.images.includes(img)) {
                productInfo.images.push(img);
              }
            }
          }
          
          // Filter and add colors - only valid color names
          if (aiProductInfo.colors && Array.isArray(aiProductInfo.colors)) {
            for (const color of aiProductInfo.colors) {
              if (color.name && isValidColorName(color.name)) {
                const colorLower = color.name.toLowerCase();
                const colorInfo = Object.entries(COLOR_MAP).find(([key]) => colorLower.includes(key));
                productInfo.colors.push({
                  name: color.name,
                  name_ar: colorInfo ? colorInfo[1].ar : color.name_ar || color.name,
                  hex_code: colorInfo ? colorInfo[1].hex : color.hex_code || '#808080',
                  image_url: null
                });
              }
            }
          }
          
          // Filter and add options - only valid option names
          if (aiProductInfo.options && Array.isArray(aiProductInfo.options)) {
            for (const opt of aiProductInfo.options) {
              if (opt.name && isValidOptionName(opt.name)) {
                productInfo.options.push({
                  name: opt.name,
                  name_ar: opt.name_ar || opt.name,
                  price_adjustment: 0,
                  image_url: null
                });
              }
            }
          }
        }
      } catch (parseError) {
        console.error('AI response parse error:', parseError);
      }
    } else {
      const errorText = await aiResponse.text();
      console.error('AI request failed:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'تم تجاوز حد الطلبات، يرجى المحاولة لاحقاً',
            requiresManualInput: true
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'يرجى إضافة رصيد للمحفظة',
            requiresManualInput: true
          }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Limit images to 10
    productInfo.images = productInfo.images.slice(0, 10);

    console.log('Final product info - colors:', productInfo.colors.length, 'options:', productInfo.options.length, 'images:', productInfo.images.length);

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
