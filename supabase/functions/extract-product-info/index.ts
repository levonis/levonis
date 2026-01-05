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

// Extract hints from HTML for colors and options
function extractHintsFromHtml(html: string): { colorHints: string[], optionHints: string[], priceHints: string[], imageColorPairs: Array<{color: string, image: string}> } {
  const colorHints: string[] = [];
  const optionHints: string[] = [];
  const priceHints: string[] = [];
  const imageColorPairs: Array<{color: string, image: string}> = [];

  // Extract from data attributes
  const dataColorMatches = html.matchAll(/data-(?:color|variant|option|value)[^=]*=["']([^"']+)["']/gi);
  for (const match of dataColorMatches) {
    colorHints.push(match[1]);
  }

  // Extract from select options with value
  const selectMatches = html.matchAll(/<option[^>]*value=["']([^"']+)["'][^>]*>([^<]*)<\/option>/gi);
  for (const match of selectMatches) {
    const value = match[1].trim();
    const text = match[2].trim();
    if (value && value.length < 50) optionHints.push(value);
    if (text && text.length < 50) optionHints.push(text);
  }

  // Extract from swatch/color buttons with images
  const swatchWithImgMatches = html.matchAll(/<(?:button|div|span|a)[^>]*(?:swatch|color|variant)[^>]*>[\s\S]*?<img[^>]*src=["']([^"']+)["'][^>]*>[\s\S]*?<\/(?:button|div|span|a)>/gi);
  for (const match of swatchWithImgMatches) {
    const img = match[1];
    const colorMatch = match[0].match(/(?:data-value|data-color|aria-label|title)=["']([^"']+)["']/i);
    if (colorMatch && img) {
      imageColorPairs.push({ color: colorMatch[1], image: img.startsWith('//') ? 'https:' + img : img });
    }
  }

  // Extract from image alt texts that might be colors
  const imgAltMatches = html.matchAll(/<img[^>]*alt=["']([^"']+)["'][^>]*src=["']([^"']+)["'][^>]*>/gi);
  for (const match of imgAltMatches) {
    const alt = match[1].toLowerCase();
    const src = match[2];
    const colorKeywords = ['black', 'white', 'red', 'blue', 'green', 'yellow', 'pink', 'purple', 'orange', 'gray', 'grey', 'brown', 'gold', 'silver', 'navy', 'beige', 'cream'];
    if (colorKeywords.some(c => alt.includes(c))) {
      imageColorPairs.push({ color: match[1], image: src.startsWith('//') ? 'https:' + src : src });
    }
  }

  // Also try reverse order: src before alt
  const imgSrcAltMatches = html.matchAll(/<img[^>]*src=["']([^"']+)["'][^>]*alt=["']([^"']+)["'][^>]*>/gi);
  for (const match of imgSrcAltMatches) {
    const src = match[1];
    const alt = match[2].toLowerCase();
    const colorKeywords = ['black', 'white', 'red', 'blue', 'green', 'yellow', 'pink', 'purple', 'orange', 'gray', 'grey', 'brown', 'gold', 'silver', 'navy', 'beige', 'cream'];
    if (colorKeywords.some(c => alt.includes(c))) {
      imageColorPairs.push({ color: match[2], image: src.startsWith('//') ? 'https:' + src : src });
    }
  }

  // Extract from swatch labels
  const swatchMatches = html.matchAll(/(?:swatch|color|variant)[^>]*>([^<]{2,30})</gi);
  for (const match of swatchMatches) {
    colorHints.push(match[1].trim());
  }

  // Extract from aria-labels
  const ariaMatches = html.matchAll(/aria-label=["']([^"']+)["']/gi);
  for (const match of ariaMatches) {
    const label = match[1];
    const labelLower = label.toLowerCase();
    if (labelLower.includes('color') || labelLower.includes('size') || labelLower.includes('variant')) {
      optionHints.push(label);
    }
    // Check if it's a color name directly
    const colorKeywords = ['black', 'white', 'red', 'blue', 'green', 'yellow', 'pink', 'purple', 'orange', 'gray', 'grey', 'brown', 'gold', 'silver'];
    if (colorKeywords.some(c => labelLower.includes(c))) {
      colorHints.push(label);
    }
  }

  // Extract from JSON-LD
  const jsonLdMatches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of jsonLdMatches) {
    try {
      const data = JSON.parse(match[1]);
      if (data.offers?.price) priceHints.push(String(data.offers.price));
      if (data.offers?.priceCurrency) priceHints.push(data.offers.priceCurrency);
      if (Array.isArray(data.offers)) {
        for (const offer of data.offers) {
          if (offer.name) optionHints.push(offer.name);
          if (offer.price) priceHints.push(String(offer.price));
        }
      }
      // Check for product variants in JSON-LD
      if (data.hasVariant && Array.isArray(data.hasVariant)) {
        for (const variant of data.hasVariant) {
          if (variant.name) optionHints.push(variant.name);
          if (variant.color) colorHints.push(variant.color);
          if (variant.size) optionHints.push(variant.size);
        }
      }
    } catch {}
  }

  // Extract from Shopify-style product JSON
  const shopifyJsonMatch = html.match(/var\s+(?:meta|product)\s*=\s*(\{[\s\S]*?\});/);
  if (shopifyJsonMatch) {
    try {
      const data = JSON.parse(shopifyJsonMatch[1]);
      if (data.product?.variants) {
        for (const v of data.product.variants) {
          if (v.option1) colorHints.push(v.option1);
          if (v.option2) optionHints.push(v.option2);
          if (v.featured_image?.src) {
            imageColorPairs.push({ color: v.option1 || v.title, image: v.featured_image.src });
          }
        }
      }
    } catch {}
  }

  // Extract price from common patterns
  const priceMatches = html.matchAll(/(?:price|cost|amount)[^>]*>\s*[\$€¥£]?\s*([\d,]+\.?\d*)/gi);
  for (const match of priceMatches) {
    priceHints.push(match[1]);
  }

  // Extract from title attributes
  const titleMatches = html.matchAll(/title=["']([^"']+)["']/gi);
  for (const match of titleMatches) {
    const title = match[1];
    const colorKeywords = ['black', 'white', 'red', 'blue', 'green', 'yellow', 'pink', 'purple', 'orange', 'gray', 'grey', 'brown', 'gold', 'silver'];
    if (colorKeywords.some(c => title.toLowerCase().includes(c))) {
      colorHints.push(title);
    }
  }

  return {
    colorHints: [...new Set(colorHints)].slice(0, 100),
    optionHints: [...new Set(optionHints)].slice(0, 100),
    priceHints: [...new Set(priceHints)].slice(0, 20),
    imageColorPairs: imageColorPairs.slice(0, 50)
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

    // Extract hints from HTML
    const { colorHints, optionHints, priceHints, imageColorPairs } = extractHintsFromHtml(pageContent);
    console.log('Found hints - colors:', colorHints.length, 'options:', optionHints.length, 'prices:', priceHints.length, 'imageColorPairs:', imageColorPairs.length);

    // Use AI to extract product info from the page content
    console.log('Using AI to extract product info...');

    // Build color pairs string for prompt
    const colorPairsStr = imageColorPairs.length > 0 
      ? imageColorPairs.map(p => `${p.color}: ${p.image}`).join('\n')
      : 'None found';

    const prompt = `You are a product data extraction expert. Extract ALL product information from this e-commerce page.

URL: ${url}
Platform: ${platform}
Item ID: ${itemId || 'Unknown'}

=== CRITICAL: COLOR HINTS FOUND (USE THESE!) ===
${colorHints.length > 0 ? colorHints.join(', ') : 'No color hints found - check the HTML for color options'}

=== COLOR-IMAGE PAIRS FOUND ===
${colorPairsStr}

=== OPTION HINTS FOUND ===
${optionHints.length > 0 ? optionHints.join(', ') : 'No option hints found'}

=== PRICE HINTS ===
${priceHints.join(', ') || 'None'}

=== PAGE HTML (truncated) ===
${pageContent.substring(0, 18000)}

=== INSTRUCTIONS ===
Extract and return a JSON object with this EXACT structure:
{
  "name": "Product name in English",
  "name_ar": "اسم المنتج بالعربية",
  "description": "Detailed description in English (2-3 sentences)",
  "description_ar": "وصف مفصل بالعربية (2-3 جمل)",
  "price": 29.99,
  "original_price": 39.99,
  "currency": "USD",
  "images": ["https://full-image-url-1.jpg", "https://full-image-url-2.jpg"],
  "colors": [
    {
      "name": "Black",
      "name_ar": "أسود",
      "image_url": "https://color-swatch-or-product-image.jpg",
      "hex_code": "#000000"
    }
  ],
  "options": [
    {
      "name": "Size M",
      "name_ar": "مقاس M",
      "price_adjustment": 0,
      "image_url": null
    }
  ]
}

CRITICAL REQUIREMENTS:
1. USE THE COLOR HINTS PROVIDED ABOVE - they are extracted from the page and are accurate!
2. If colorHints or imageColorPairs are provided, you MUST include them in the colors array
3. Extract EVERY color variant - look in swatches, dropdowns, buttons, data attributes
4. Extract EVERY size/option variant - look in select dropdowns, radio buttons, variant selectors
5. For colors: provide hex codes based on color names (Black=#000000, White=#FFFFFF, Red=#FF0000, Blue=#0000FF, Green=#008000, Yellow=#FFFF00, Pink=#FFC0CB, Purple=#800080, Orange=#FFA500, Gray=#808080, Brown=#A52A2A, Gold=#FFD700, Silver=#C0C0C0, Navy=#000080, Beige=#F5F5DC)
6. Make sure ALL image URLs are complete (start with https://)
7. Translate all names to Arabic accurately
8. Price should be a number, not a string
9. Return ONLY the JSON object, no other text or explanation
10. DO NOT return empty colors array if color hints were provided above!`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          {
            role: 'system',
            content: `You are a product data extraction expert. Your job is to extract ALL product information including colors and options.

CRITICAL RULES:
- If color hints are provided in the prompt, you MUST include them in your response
- Never return empty colors array if colorHints were found
- Always extract complete data from the page
- Return ONLY valid JSON, nothing else`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      
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

    console.log('AI response received, length:', extractedText.length);

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
      productInfo.images = productInfo.images
        .map((img: string) => {
          if (!img) return null;
          if (img.startsWith('//')) return 'https:' + img;
          if (!img.startsWith('http')) return null;
          return img;
        })
        .filter(Boolean);
    }

    if (productInfo.colors) {
      productInfo.colors = productInfo.colors.map((color: any) => ({
        ...color,
        image_url: color.image_url 
          ? (color.image_url.startsWith('//') ? 'https:' + color.image_url : color.image_url)
          : null
      }));
    }

    if (productInfo.options) {
      productInfo.options = productInfo.options.map((opt: any) => ({
        ...opt,
        image_url: opt.image_url 
          ? (opt.image_url.startsWith('//') ? 'https:' + opt.image_url : opt.image_url)
          : null,
        price_adjustment: opt.price_adjustment || 0
      }));
    }

    // Ensure arrays exist
    productInfo.colors = productInfo.colors || [];
    productInfo.options = productInfo.options || [];
    productInfo.images = productInfo.images || [];

    console.log('Product info extracted - colors:', productInfo.colors.length, 'options:', productInfo.options.length, 'images:', productInfo.images.length);

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
