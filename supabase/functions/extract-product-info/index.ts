import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (roleError || !roleData) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { url } = await req.json();
    console.log('Processing URL:', url);

    // Extract item ID from URL
    const itemIdMatch = url.match(/[?&]id=(\d+)/);
    const itemId = itemIdMatch?.[1];
    
    // Determine platform
    const isTaobao = url.includes('taobao.com') || url.includes('tmall.com');
    const isJD = url.includes('jd.com');
    const is1688 = url.includes('1688.com');

    let html = '';
    let pageTitle = '';
    
    // Use a more reliable method to fetch the page
    const fetchWithHeaders = async (targetUrl: string) => {
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,ar;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Referer': isTaobao ? 'https://www.taobao.com/' : isJD ? 'https://www.jd.com/' : 'https://www.1688.com/',
      };
      
      try {
        const response = await fetch(targetUrl, { headers });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.text();
      } catch (e) {
        console.warn('Direct fetch failed, trying alternative...');
        return null;
      }
    };

    // Try to fetch the page
    html = await fetchWithHeaders(url) || '';
    
    if (!html || html.length < 1000) {
      console.log('Page fetch returned minimal content, using item ID for extraction');
    }

    // Extract text content from HTML
    let textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 30000);

    // Extract all image URLs from the page
    const imageUrls: string[] = [];
    const imgRegex = /<img[^>]*(?:src|data-src|data-original)=["']([^"']+)["'][^>]*>/gi;
    let match;
    while ((match = imgRegex.exec(html)) !== null) {
      let imgUrl = match[1];
      if (imgUrl.startsWith('//')) imgUrl = 'https:' + imgUrl;
      if (imgUrl.startsWith('http') && !imgUrl.includes('icon') && !imgUrl.includes('logo')) {
        // Clean Taobao image URLs - remove size suffixes
        imgUrl = imgUrl.replace(/_\d+x\d+\.[a-z]+$/i, '');
        imgUrl = imgUrl.replace(/\.(jpg|png|webp)_\d+x\d+\.jpg/i, '.$1');
        if (!imageUrls.includes(imgUrl)) imageUrls.push(imgUrl);
      }
    }

    // Also extract from background-image CSS
    const bgRegex = /background(?:-image)?\s*:\s*url\(['"]?([^'")]+)['"]?\)/gi;
    while ((match = bgRegex.exec(html)) !== null) {
      let imgUrl = match[1];
      if (imgUrl.startsWith('//')) imgUrl = 'https:' + imgUrl;
      if (imgUrl.startsWith('http') && !imageUrls.includes(imgUrl)) {
        imageUrls.push(imgUrl);
      }
    }

    // Extract SKU/variant information from JavaScript
    const skuData: any[] = [];
    
    // Look for Taobao SKU data
    const skuMapMatch = html.match(/skuMap\s*[=:]\s*(\{[\s\S]*?\})\s*[,;]/);
    const propertyPicsMatch = html.match(/propertyPics\s*[=:]\s*(\{[\s\S]*?\})\s*[,;]/);
    
    // Extract color/variant names from the page
    const colorNames: string[] = [];
    const sizeNames: string[] = [];
    
    // Look for specific patterns in Chinese e-commerce pages
    const colorPatterns = [
      /颜色[分类]*[:：]\s*([^\n<]+)/gi,
      /color[s]?\s*[:：]\s*([^\n<]+)/gi,
      /data-value="([^"]+)"/gi,
      /<li[^>]*class="[^"]*sku-[^"]*"[^>]*>([^<]+)<\/li>/gi,
    ];

    // Extract product title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i) ||
                       html.match(/data-title="([^"]+)"/i) ||
                       html.match(/class="[^"]*title[^"]*"[^>]*>([^<]+)</i);
    pageTitle = titleMatch?.[1]?.trim() || '';

    console.log(`Extracted: ${imageUrls.length} images, title: ${pageTitle?.substring(0, 50)}`);

    // Call Lovable AI to extract product information
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const systemPrompt = `You are a professional product data extractor for Chinese e-commerce platforms (Taobao, Tmall, JD.com, 1688).

Your task is to extract accurate product information and translate it professionally.

CRITICAL RULES:
1. NEVER include price information
2. Extract the FULL color/option names (e.g., "Matte Ivory White" not just "White")
3. Translate Chinese to Arabic NATURALLY (not literal translation)
4. Also provide English translations for all text
5. Extract HEX color codes based on the color names (use accurate color values)
6. Keep image URLs exactly as provided (do not modify them)
7. Separate COLORS from SIZES/OPTIONS clearly:
   - Colors: variations in color only (Red, Blue, Matte Black, etc.)
   - Sizes/Options: variations in size, material, bundle, capacity, etc.

For HEX codes, use accurate values:
- 黑色/Black: #000000
- 白色/White: #FFFFFF
- 红色/Red: #FF0000
- 蓝色/Blue: #0000FF
- 绿色/Green: #00FF00
- 黄色/Yellow: #FFFF00
- 橙色/Orange: #FFA500
- 粉色/Pink: #FFC0CB
- 紫色/Purple: #800080
- 棕色/Brown: #8B4513
- 灰色/Gray: #808080
- 米色/Beige: #F5F5DC
- 深色 (Dark): darken the base color
- 浅色 (Light): lighten the base color
- 哑光/Matte: same hex but note in name`;

    const userPrompt = `Extract product information from this Chinese e-commerce page:

Page Title: ${pageTitle}

Page Content (cleaned):
${textContent.substring(0, 20000)}

Available Image URLs:
${imageUrls.slice(0, 50).join('\n')}

Item ID: ${itemId || 'unknown'}
Platform: ${isTaobao ? 'Taobao/Tmall' : isJD ? 'JD.com' : is1688 ? '1688' : 'Unknown'}

Extract and return:
1. Product name (Arabic + English)
2. Product description (Arabic + English) - comprehensive and professional
3. Main product images (3-5 best quality images)
4. All available COLORS with:
   - Full name in English (original)
   - Full name in Arabic (translated)
   - Accurate HEX code
   - Image URL if available
5. All available SIZES/OPTIONS with:
   - Full name in English
   - Full name in Arabic
   - Image URL if available
6. Product features (Arabic + English)`;

    console.log('Calling AI for extraction...');
    
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        temperature: 0.2,
        max_tokens: 8000,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_product_info",
              description: "Extract product information from e-commerce page",
              parameters: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Product name in English" },
                  name_ar: { type: "string", description: "Product name in Arabic" },
                  description: { type: "string", description: "Product description in English" },
                  description_ar: { type: "string", description: "Product description in Arabic" },
                  images: {
                    type: "array",
                    items: { type: "string" },
                    description: "Main product image URLs (3-5 images)"
                  },
                  colors: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "Full color name in English" },
                        name_ar: { type: "string", description: "Full color name in Arabic" },
                        hex_code: { type: "string", description: "HEX color code (e.g., #FF0000)" },
                        image_url: { type: "string", description: "Color variant image URL" }
                      }
                    },
                    description: "All available colors"
                  },
                  sizes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "Full size/option name in English" },
                        name_ar: { type: "string", description: "Full size/option name in Arabic" },
                        image_url: { type: "string", description: "Size/option image URL" }
                      }
                    },
                    description: "All available sizes/options (not colors)"
                  },
                  features: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        text: { type: "string", description: "Feature in English" },
                        text_ar: { type: "string", description: "Feature in Arabic" },
                        icon: { type: "string", description: "Lucide icon name" }
                      }
                    },
                    description: "Product features"
                  }
                },
                required: ["name", "name_ar", "description", "description_ar", "images", "colors", "sizes", "features"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_product_info" } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI error:', aiResponse.status, errorText);
      throw new Error('Failed to connect to AI service');
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error('AI did not return product information');
    }

    const productInfo = JSON.parse(toolCall.function.arguments);
    console.log('AI extracted:', productInfo.name, `(${productInfo.colors?.length || 0} colors, ${productInfo.sizes?.length || 0} sizes)`);

    // Validate and clean the data
    if (!productInfo.name || !productInfo.name_ar) {
      throw new Error('Failed to extract product name');
    }

    // Clean and validate hex codes
    if (productInfo.colors && Array.isArray(productInfo.colors)) {
      productInfo.colors = productInfo.colors.map((color: any) => {
        let hex = color.hex_code || '#808080';
        if (!hex.startsWith('#')) hex = '#' + hex;
        if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) hex = '#808080';
        return { ...color, hex_code: hex };
      });
    }

    // Keep original image URLs (don't upload - they will be uploaded when product is saved)
    // This speeds up the extraction process significantly
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        productInfo,
        note: 'Images are kept as original URLs. They will be processed when the product is saved.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in extract-product-info:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
        success: false 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
