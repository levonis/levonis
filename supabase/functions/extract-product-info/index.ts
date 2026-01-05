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

// Extract colors and options directly from HTML
function extractFromHtml(html: string): {
  colors: Array<{ name: string; name_ar: string; hex_code: string; image_url: string | null }>;
  options: Array<{ name: string; name_ar: string; price_adjustment: number; image_url: string | null }>;
  images: string[];
  prices: number[];
} {
  const colors: Array<{ name: string; name_ar: string; hex_code: string; image_url: string | null }> = [];
  const options: Array<{ name: string; name_ar: string; price_adjustment: number; image_url: string | null }> = [];
  const images: string[] = [];
  const prices: number[] = [];
  
  const seenColors = new Set<string>();
  const seenOptions = new Set<string>();
  const seenImages = new Set<string>();

  // Helper to add color
  const addColor = (name: string, imageUrl: string | null = null) => {
    const nameLower = name.toLowerCase().trim();
    if (nameLower.length < 2 || nameLower.length > 50 || seenColors.has(nameLower)) return;
    
    // Find matching color in our map
    let colorInfo = Object.entries(COLOR_MAP).find(([key]) => 
      nameLower.includes(key) || key.includes(nameLower)
    );
    
    const hex = colorInfo ? colorInfo[1].hex : '#808080';
    const ar = colorInfo ? colorInfo[1].ar : name;
    
    seenColors.add(nameLower);
    colors.push({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      name_ar: ar,
      hex_code: hex,
      image_url: imageUrl
    });
  };

  // Helper to add option
  const addOption = (name: string, imageUrl: string | null = null) => {
    const nameLower = name.toLowerCase().trim();
    if (nameLower.length < 1 || nameLower.length > 100 || seenOptions.has(nameLower)) return;
    if (/^(select|choose|pick|اختر)/i.test(nameLower)) return;
    
    seenOptions.add(nameLower);
    options.push({
      name: name.trim(),
      name_ar: name.trim(),
      price_adjustment: 0,
      image_url: imageUrl
    });
  };

  // Helper to add image
  const addImage = (url: string) => {
    if (!url || seenImages.has(url)) return;
    let cleanUrl = url.trim();
    if (cleanUrl.startsWith('//')) cleanUrl = 'https:' + cleanUrl;
    if (!cleanUrl.startsWith('http')) return;
    if (cleanUrl.includes('data:image')) return;
    if (cleanUrl.includes('placeholder')) return;
    if (cleanUrl.length < 20) return;
    seenImages.add(cleanUrl);
    images.push(cleanUrl);
  };

  // 1. Extract from JSON-LD (most reliable)
  const jsonLdMatches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of jsonLdMatches) {
    try {
      const data = JSON.parse(match[1]);
      
      // Handle single product
      if (data['@type'] === 'Product') {
        if (data.image) {
          const imgs = Array.isArray(data.image) ? data.image : [data.image];
          imgs.forEach(addImage);
        }
        if (data.offers?.price) prices.push(parseFloat(data.offers.price));
        if (data.color) addColor(data.color);
        if (Array.isArray(data.hasVariant)) {
          for (const variant of data.hasVariant) {
            if (variant.color) addColor(variant.color, variant.image);
            if (variant.size) addOption(variant.size);
            if (variant.name) {
              // Check if it's a color or size
              const isColor = Object.keys(COLOR_MAP).some(c => variant.name.toLowerCase().includes(c));
              if (isColor) addColor(variant.name, variant.image);
              else addOption(variant.name);
            }
          }
        }
      }
      
      // Handle offers array
      if (Array.isArray(data.offers)) {
        for (const offer of data.offers) {
          if (offer.price) prices.push(parseFloat(offer.price));
          if (offer.name) addOption(offer.name);
        }
      }
    } catch {}
  }

  // 2. Extract from Shopify JSON (very reliable)
  const shopifyPatterns = [
    /var\s+meta\s*=\s*(\{[\s\S]*?\});/,
    /var\s+product\s*=\s*(\{[\s\S]*?\});/,
    /<script[^>]*>[\s\S]*?window\.ShopifyAnalytics[\s\S]*?product['"]\s*:\s*(\{[\s\S]*?\})\s*[,}]/,
  ];
  
  for (const pattern of shopifyPatterns) {
    const match = html.match(pattern);
    if (match) {
      try {
        const data = JSON.parse(match[1]);
        const product = data.product || data;
        
        if (product.variants && Array.isArray(product.variants)) {
          for (const v of product.variants) {
            if (v.option1) {
              const isColor = Object.keys(COLOR_MAP).some(c => v.option1.toLowerCase().includes(c));
              if (isColor) addColor(v.option1, v.featured_image?.src);
              else addOption(v.option1);
            }
            if (v.option2) addOption(v.option2);
            if (v.option3) addOption(v.option3);
            if (v.featured_image?.src) addImage(v.featured_image.src);
          }
        }
        
        if (product.images && Array.isArray(product.images)) {
          product.images.forEach((img: any) => addImage(typeof img === 'string' ? img : img.src));
        }
      } catch {}
    }
  }

  // 3. Extract from product options/variants containers
  const variantContainerPatterns = [
    /<select[^>]*(?:variant|option|color|size)[^>]*>([\s\S]*?)<\/select>/gi,
    /<div[^>]*class=["'][^"']*(?:variant|swatch|color|option)[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
    /<ul[^>]*class=["'][^"']*(?:variant|swatch|color|option)[^"']*["'][^>]*>([\s\S]*?)<\/ul>/gi,
  ];

  for (const pattern of variantContainerPatterns) {
    const matches = html.matchAll(pattern);
    for (const match of matches) {
      const container = match[1] || match[0];
      
      // Extract options from select
      const optionMatches = container.matchAll(/<option[^>]*(?:value=["']([^"']+)["'])?[^>]*>([^<]*)<\/option>/gi);
      for (const opt of optionMatches) {
        const value = (opt[2] || opt[1] || '').trim();
        if (value && value.length > 0) {
          const isColor = Object.keys(COLOR_MAP).some(c => value.toLowerCase().includes(c));
          if (isColor) addColor(value);
          else addOption(value);
        }
      }
      
      // Extract from buttons/links
      const buttonMatches = container.matchAll(/<(?:button|a|span|label)[^>]*(?:data-value|data-option|aria-label|title)=["']([^"']+)["'][^>]*>/gi);
      for (const btn of buttonMatches) {
        const value = btn[1].trim();
        const isColor = Object.keys(COLOR_MAP).some(c => value.toLowerCase().includes(c));
        if (isColor) addColor(value);
        else if (value.length < 50) addOption(value);
      }
    }
  }

  // 4. Extract from data attributes (very common pattern)
  const dataAttrPatterns = [
    /data-(?:color|variant-color|option-color)=["']([^"']+)["']/gi,
    /data-(?:option|variant|value|size|sku)=["']([^"']+)["']/gi,
    /data-variant=["']([^"']+)["']/gi,
  ];
  
  for (const pattern of dataAttrPatterns) {
    const matches = html.matchAll(pattern);
    for (const match of matches) {
      const value = match[1].trim();
      if (value.length > 1 && value.length < 50) {
        const isColor = Object.keys(COLOR_MAP).some(c => value.toLowerCase().includes(c));
        if (isColor) addColor(value);
        else addOption(value);
      }
    }
  }

  // 5. Extract from swatches with images
  const swatchWithImgPatterns = [
    /<(?:button|div|span|a)[^>]*(?:swatch|color)[^>]*data-(?:value|color|variant)=["']([^"']+)["'][^>]*>[\s\S]*?<img[^>]*src=["']([^"']+)["']/gi,
    /<img[^>]*src=["']([^"']+)["'][^>]*alt=["']([^"']+)["'][^>]*>/gi,
    /<img[^>]*alt=["']([^"']+)["'][^>]*src=["']([^"']+)["'][^>]*>/gi,
  ];
  
  for (const pattern of swatchWithImgPatterns) {
    const matches = html.matchAll(pattern);
    for (const match of matches) {
      const colorOrAlt = match[1]?.trim() || match[2]?.trim();
      const imgUrl = match[2]?.trim() || match[1]?.trim();
      
      if (colorOrAlt && Object.keys(COLOR_MAP).some(c => colorOrAlt.toLowerCase().includes(c))) {
        const cleanImg = imgUrl?.startsWith('//') ? 'https:' + imgUrl : imgUrl;
        addColor(colorOrAlt, cleanImg?.startsWith('http') ? cleanImg : null);
      }
    }
  }

  // 6. Extract product images
  const imagePatterns = [
    /<img[^>]*class=["'][^"']*(?:product|gallery|main|primary|zoom)[^"']*["'][^>]*src=["']([^"']+)["']/gi,
    /<img[^>]*data-(?:src|zoom|large)=["']([^"']+)["']/gi,
    /data-image=["']([^"']+)["']/gi,
    /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/gi,
  ];
  
  for (const pattern of imagePatterns) {
    const matches = html.matchAll(pattern);
    for (const match of matches) {
      addImage(match[1]);
    }
  }

  // 7. Extract prices
  const pricePatterns = [
    /(?:price|cost|amount)[^>]*>\s*[\$€¥£]?\s*([\d,]+\.?\d*)/gi,
    /data-price=["'](\d+\.?\d*)["']/gi,
    /"price"\s*:\s*"?(\d+\.?\d*)"?/gi,
  ];
  
  for (const pattern of pricePatterns) {
    const matches = html.matchAll(pattern);
    for (const match of matches) {
      const price = parseFloat(match[1].replace(',', ''));
      if (price > 0 && price < 100000) prices.push(price);
    }
  }

  // 8. Look for color/size labels directly in text
  const colorLabelPattern = /(?:color|لون|颜色)\s*[:\-]?\s*([^<,\n]{2,30})/gi;
  const matches = html.matchAll(colorLabelPattern);
  for (const match of matches) {
    const value = match[1].trim();
    if (Object.keys(COLOR_MAP).some(c => value.toLowerCase().includes(c))) {
      addColor(value);
    }
  }

  return {
    colors: colors.slice(0, 50),
    options: options.slice(0, 50),
    images: images.slice(0, 20),
    prices: [...new Set(prices)].slice(0, 10)
  };
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

    // First, extract directly from HTML (this is most reliable)
    const directExtraction = extractFromHtml(pageContent);
    console.log('Direct extraction results - colors:', directExtraction.colors.length, 'options:', directExtraction.options.length, 'images:', directExtraction.images.length);

    // Use AI to extract basic product info (name, description)
    console.log('Using AI to extract product info...');

    // Build context from direct extraction
    const directColorsStr = directExtraction.colors.length > 0 
      ? directExtraction.colors.map(c => `${c.name} (${c.hex_code})`).join(', ')
      : 'None extracted directly';
    
    const directOptionsStr = directExtraction.options.length > 0
      ? directExtraction.options.map(o => o.name).join(', ')
      : 'None extracted directly';

    const prompt = `Extract product information from this e-commerce page. I have already extracted some data directly from the HTML, but I need you to provide complete product name and description, and verify/enhance the colors and options.

URL: ${url}
Platform: ${platform}

=== ALREADY EXTRACTED FROM HTML ===
Colors found: ${directColorsStr}
Options found: ${directOptionsStr}
Price candidates: ${directExtraction.prices.join(', ') || 'None'}

=== PAGE HTML (truncated) ===
${pageContent.substring(0, 15000)}

=== INSTRUCTIONS ===
Return a JSON object with:
{
  "name": "Product name in English",
  "name_ar": "اسم المنتج بالعربية",
  "description": "Brief description in English",
  "description_ar": "وصف موجز بالعربية",
  "price": 29.99,
  "original_price": 39.99,
  "currency": "USD",
  "additional_colors": [{"name": "ColorName", "name_ar": "اللون", "hex_code": "#HEXCODE"}],
  "additional_options": [{"name": "Option", "name_ar": "الخيار"}],
  "additional_images": ["https://image-url.jpg"]
}

IMPORTANT:
- Only add colors/options in "additional_*" fields if they are NOT already in the extracted list above
- Focus on providing accurate name and description
- Price should be a number
- Return ONLY valid JSON`;

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
            content: 'You are a product data extraction assistant. Return only valid JSON, no explanations.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
      }),
    });

    let aiProductInfo: any = {};
    
    if (aiResponse.ok) {
      try {
        const aiData = await aiResponse.json();
        const extractedText = aiData.choices[0]?.message?.content || '';
        console.log('AI response length:', extractedText.length);
        
        const jsonMatch = extractedText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          aiProductInfo = JSON.parse(jsonMatch[0]);
        }
      } catch (parseError) {
        console.error('AI response parse error:', parseError);
      }
    } else {
      console.error('AI request failed:', aiResponse.status);
    }

    // Merge direct extraction with AI results
    const finalColors = [...directExtraction.colors];
    if (aiProductInfo.additional_colors && Array.isArray(aiProductInfo.additional_colors)) {
      for (const color of aiProductInfo.additional_colors) {
        if (color.name && !finalColors.some(c => c.name.toLowerCase() === color.name.toLowerCase())) {
          finalColors.push({
            name: color.name,
            name_ar: color.name_ar || color.name,
            hex_code: color.hex_code || '#808080',
            image_url: null
          });
        }
      }
    }

    const finalOptions = [...directExtraction.options];
    if (aiProductInfo.additional_options && Array.isArray(aiProductInfo.additional_options)) {
      for (const opt of aiProductInfo.additional_options) {
        if (opt.name && !finalOptions.some(o => o.name.toLowerCase() === opt.name.toLowerCase())) {
          finalOptions.push({
            name: opt.name,
            name_ar: opt.name_ar || opt.name,
            price_adjustment: 0,
            image_url: null
          });
        }
      }
    }

    const finalImages = [...directExtraction.images];
    if (aiProductInfo.additional_images && Array.isArray(aiProductInfo.additional_images)) {
      for (const img of aiProductInfo.additional_images) {
        if (img && !finalImages.includes(img) && img.startsWith('http')) {
          finalImages.push(img);
        }
      }
    }

    const finalPrice = aiProductInfo.price || (directExtraction.prices.length > 0 ? Math.min(...directExtraction.prices) : 0);

    const productInfo = {
      name: aiProductInfo.name || 'Product',
      name_ar: aiProductInfo.name_ar || 'منتج',
      description: aiProductInfo.description || '',
      description_ar: aiProductInfo.description_ar || '',
      price: finalPrice,
      original_price: aiProductInfo.original_price || null,
      currency: aiProductInfo.currency || 'USD',
      images: finalImages.slice(0, 10),
      colors: finalColors,
      options: finalOptions
    };

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
