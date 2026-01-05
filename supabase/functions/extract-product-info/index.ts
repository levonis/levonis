import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Detect platform from URL
function detectPlatform(url: string): { platform: string; itemId: string | null } {
  const urlLower = url.toLowerCase();
  
  if (urlLower.includes('taobao.com') || urlLower.includes('m.tb.cn') || urlLower.includes('e.tb.cn')) {
    const idMatch = url.match(/[?&]id=(\d+)/);
    return { platform: 'taobao', itemId: idMatch?.[1] || null };
  }
  
  if (urlLower.includes('tmall.com')) {
    const idMatch = url.match(/[?&]id=(\d+)/);
    return { platform: 'tmall', itemId: idMatch?.[1] || null };
  }
  
  if (urlLower.includes('1688.com')) {
    const idMatch = url.match(/offer\/(\d+)/);
    return { platform: '1688', itemId: idMatch?.[1] || null };
  }
  
  if (urlLower.includes('jd.com')) {
    const idMatch = url.match(/\/(\d+)\.html/);
    return { platform: 'jd', itemId: idMatch?.[1] || null };
  }
  
  if (urlLower.includes('aliexpress.com') || urlLower.includes('aliexpress.ru')) {
    const idMatch = url.match(/\/item\/(\d+)/) || url.match(/\/(\d+)\.html/);
    return { platform: 'aliexpress', itemId: idMatch?.[1] || null };
  }
  
  if (urlLower.includes('amazon.')) {
    const asinMatch = url.match(/\/dp\/([A-Z0-9]{10})/) || url.match(/\/product\/([A-Z0-9]{10})/);
    return { platform: 'amazon', itemId: asinMatch?.[1] || null };
  }
  
  if (urlLower.includes('shein.com')) {
    const idMatch = url.match(/-p-(\d+)/);
    return { platform: 'shein', itemId: idMatch?.[1] || null };
  }
  
  if (urlLower.includes('bambulab.com')) {
    return { platform: 'bambulab', itemId: null };
  }
  
  if (urlLower.includes('/products/')) {
    return { platform: 'shopify', itemId: null };
  }
  
  return { platform: 'other', itemId: null };
}

// Color mapping
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
};

// Validate color name
function isValidColorName(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  const nameLower = name.toLowerCase().trim();
  if (nameLower.length < 2 || nameLower.length > 25) return false;
  if (/<|>|\[|\]|\{|\}|\\|http|class=|style=/.test(nameLower)) return false;
  return Object.keys(COLOR_MAP).some(c => nameLower === c || nameLower.includes(c));
}

// Validate option name
function isValidOptionName(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  const nameTrimmed = name.trim();
  if (nameTrimmed.length < 1 || nameTrimmed.length > 50) return false;
  if (/<|>|\{|\}|\\/.test(nameTrimmed)) return false;
  if (/^(select|choose|pick|اختر|option)/i.test(nameTrimmed)) return false;
  return true;
}

// Extract product images
function extractImages(html: string): string[] {
  const images: string[] = [];
  const seenImages = new Set<string>();

  const addImage = (url: string) => {
    if (!url || seenImages.has(url)) return;
    let cleanUrl = url.trim();
    if (cleanUrl.startsWith('//')) cleanUrl = 'https:' + cleanUrl;
    if (!cleanUrl.startsWith('http')) return;
    if (/data:image|placeholder|icon|logo|avatar|consent|trustarc|\.svg/i.test(cleanUrl)) return;
    if (cleanUrl.length < 20) return;
    seenImages.add(cleanUrl);
    images.push(cleanUrl);
  };

  // OG image
  const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
  if (ogMatch) addImage(ogMatch[1]);

  // JSON-LD images
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

  // Product images from common patterns
  const imgPatterns = [
    /<img[^>]*src=["']([^"']+(?:store\.bblcdn|cdn\.)[^"']+)["']/gi,
    /<img[^>]*data-src=["']([^"']+(?:store\.bblcdn|cdn\.)[^"']+)["']/gi,
    /<img[^>]*src=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["'][^>]*(?:alt|class)=["'][^"']*product[^"']*["']/gi,
  ];
  
  for (const pattern of imgPatterns) {
    const matches = html.matchAll(pattern);
    for (const match of matches) addImage(match[1]);
  }

  return images.slice(0, 10);
}

// Extract price
function extractPrice(html: string): number | null {
  const patterns = [
    /\$(\d+(?:\.\d{2})?)\s*USD/gi,
    /"price"\s*:\s*"?(\d+(?:\.\d{2})?)"?/gi,
    /data-price=["'](\d+(?:\.\d{2})?)["']/gi,
  ];

  for (const pattern of patterns) {
    const matches = html.matchAll(pattern);
    for (const match of matches) {
      const price = parseFloat(match[1]);
      if (price > 0 && price < 100000) return price;
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

    const { platform, itemId } = detectPlatform(url);
    console.log('Detected platform:', platform, 'Item ID:', itemId);

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
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

    // Fetch page
    let pageContent = '';
    let fetchSuccess = false;

    try {
      console.log('Fetching page...');
      const pageResponse = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        }
      });

      if (pageResponse.ok) {
        pageContent = await pageResponse.text();
        fetchSuccess = pageContent.length > 500;
        console.log('Page fetched, length:', pageContent.length);
      }
    } catch (e) {
      console.log('Fetch error:', e);
    }

    if (!fetchSuccess) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          requiresManualInput: true,
          item_id: itemId,
          platform: platform,
          message: 'لا يمكن الوصول للصفحة - يرجى إدخال البيانات يدوياً'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Direct extraction
    const directImages = extractImages(pageContent);
    const directPrice = extractPrice(pageContent);
    console.log('Direct extraction - images:', directImages.length, 'price:', directPrice);

    // AI extraction with improved prompt
    console.log('Using AI...');

    const prompt = `Extract product information from this webpage. Return ONLY valid JSON.

URL: ${url}

HTML Content (first 25000 chars):
${pageContent.substring(0, 25000)}

Return this exact JSON structure:
{
  "name": "Product name in English",
  "name_ar": "اسم المنتج بالعربية",
  "description": "Brief description in English",
  "description_ar": "وصف موجز بالعربية",
  "price": 29.99,
  "currency": "USD",
  "images": ["https://full-image-url.jpg"],
  "colors": [{"name": "Black", "name_ar": "أسود", "hex_code": "#000000"}],
  "options": [{"name": "0.4mm", "name_ar": "0.4 ملم"}]
}

IMPORTANT RULES:
1. colors: ONLY real color names (Black, White, Red, Blue, etc). Empty array [] if no colors.
2. options: Product variants like sizes, nozzle sizes, etc. Look for dropdown menus, buttons, variant selectors.
3. For this product, look for nozzle size options like 0.4mm, 0.6mm, 0.8mm if they exist.
4. images: Full URLs starting with https://
5. NO HTML tags, NO code, NO garbage text in any field.
6. Return ONLY the JSON object, nothing else.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          { role: 'system', content: 'You are a product data extractor. Return only valid JSON.' },
          { role: 'user', content: prompt }
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
        const text = aiData.choices[0]?.message?.content || '';
        console.log('AI response length:', text.length);
        
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const ai = JSON.parse(jsonMatch[0]);
          
          productInfo.name = ai.name || productInfo.name;
          productInfo.name_ar = ai.name_ar || productInfo.name_ar;
          productInfo.description = ai.description || '';
          productInfo.description_ar = ai.description_ar || '';
          productInfo.price = ai.price || productInfo.price;
          productInfo.currency = ai.currency || 'USD';
          
          // Merge images
          if (ai.images && Array.isArray(ai.images)) {
            for (const img of ai.images) {
              if (img?.startsWith('http') && !productInfo.images.includes(img) && !/\.svg/i.test(img)) {
                productInfo.images.push(img);
              }
            }
          }
          
          // Add valid colors
          if (ai.colors && Array.isArray(ai.colors)) {
            for (const c of ai.colors) {
              if (c.name && isValidColorName(c.name)) {
                const colorLower = c.name.toLowerCase();
                const info = Object.entries(COLOR_MAP).find(([k]) => colorLower.includes(k));
                productInfo.colors.push({
                  name: c.name,
                  name_ar: info ? info[1].ar : c.name_ar || c.name,
                  hex_code: info ? info[1].hex : c.hex_code || '#808080',
                  image_url: null
                });
              }
            }
          }
          
          // Add valid options
          if (ai.options && Array.isArray(ai.options)) {
            for (const o of ai.options) {
              if (o.name && isValidOptionName(o.name)) {
                productInfo.options.push({
                  name: o.name,
                  name_ar: o.name_ar || o.name,
                  price_adjustment: 0,
                  image_url: null
                });
              }
            }
          }
        }
      } catch (e) {
        console.error('Parse error:', e);
      }
    } else {
      console.error('AI error:', aiResponse.status);
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'تم تجاوز حد الطلبات', requiresManualInput: true }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Remove duplicate and SVG images
    const uniqueImages = [...new Set(productInfo.images as string[])];
    productInfo.images = uniqueImages
      .filter((img) => !/\.svg/i.test(img))
      .slice(0, 10);

    console.log('Final - colors:', productInfo.colors.length, 'options:', productInfo.options.length, 'images:', productInfo.images.length);

    return new Response(
      JSON.stringify({
        success: true,
        productInfo,
        platform,
        item_id: itemId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'حدث خطأ',
        requiresManualInput: true
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
