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

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { url } = await req.json();
    console.log('Processing URL:', url);

    // Extract item ID from URL
    const itemIdMatch = url.match(/[?&]id=(\d+)/) || url.match(/\/(\d{10,})\.html/);
    const itemId = itemIdMatch?.[1];
    
    if (!itemId) {
      return new Response(
        JSON.stringify({ error: 'Could not extract item ID from URL', success: false }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Item ID:', itemId);

    // Determine platform
    const isTmall = url.includes('tmall.com');
    const isJD = url.includes('jd.com');
    const is1688 = url.includes('1688.com');
    const platform = isTmall ? 'tmall' : isJD ? 'jd' : is1688 ? '1688' : 'taobao';

    // Try multiple methods to get product data
    let productData: any = null;
    let method = '';

    // Method 1: Try mobile API endpoint (often less restricted)
    try {
      console.log('Trying mobile API...');
      const mobileApiUrl = `https://h5api.m.taobao.com/h5/mtop.taobao.detail.getdetail/6.0/?data=${encodeURIComponent(JSON.stringify({ itemNumId: itemId }))}`;
      
      const mobileResponse = await fetch(mobileApiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
          'Referer': 'https://m.taobao.com/',
        }
      });
      
      if (mobileResponse.ok) {
        const text = await mobileResponse.text();
        // Try to parse JSONP response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const data = JSON.parse(jsonMatch[0]);
          if (data.data?.item) {
            productData = data.data.item;
            method = 'mobile_api';
            console.log('Mobile API success');
          }
        }
      }
    } catch (e) {
      console.log('Mobile API failed:', e);
    }

    // Method 2: Fetch the mobile page directly
    if (!productData) {
      try {
        console.log('Trying mobile page...');
        const mobilePageUrl = `https://h5.m.taobao.com/awp/core/detail.htm?id=${itemId}`;
        
        const pageResponse = await fetch(mobilePageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
            'Accept': 'text/html,application/xhtml+xml,application/xml',
            'Accept-Language': 'zh-CN,zh;q=0.9',
          }
        });
        
        if (pageResponse.ok) {
          const html = await pageResponse.text();
          console.log('Mobile page fetched, length:', html.length);
          
          // Extract data from the page
          const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
          const title = titleMatch?.[1]?.replace(/-淘宝网.*$/, '').trim() || '';
          
          // Extract images
          const images: string[] = [];
          const imgRegex = /(?:src|data-src)=["']([^"']*(?:alicdn|taobaocdn)[^"']*\.(?:jpg|png|webp))[^"']*/gi;
          let imgMatch;
          while ((imgMatch = imgRegex.exec(html)) !== null && images.length < 10) {
            let img = imgMatch[1];
            if (img.startsWith('//')) img = 'https:' + img;
            // Get larger version
            img = img.replace(/_\d+x\d+\.[a-z]+$/i, '');
            if (!images.includes(img)) images.push(img);
          }

          // Look for SKU data in scripts
          const skuColors: any[] = [];
          const skuSizes: any[] = [];
          
          // Pattern for SKU data
          const skuMatch = html.match(/skuInfo["\s]*:["\s]*(\{[\s\S]*?\})\s*[,}]/);
          if (skuMatch) {
            try {
              const skuData = JSON.parse(skuMatch[1]);
              console.log('Found SKU data');
            } catch (e) {}
          }

          // Extract color options from common patterns
          const colorPatterns = [
            /颜色[分类]*[:：]\s*([^\n<]+)/gi,
            /"颜色[分类]*":\s*\[([^\]]+)\]/gi,
          ];
          
          if (title || images.length > 0) {
            productData = { title, images };
            method = 'mobile_page';
            console.log('Mobile page partial success:', title?.substring(0, 50));
          }
        }
      } catch (e) {
        console.log('Mobile page failed:', e);
      }
    }

    // Method 3: Use AI with the URL and item ID to generate reasonable product info
    // Since direct scraping is blocked, we'll use AI to help based on any data we got
    console.log('Using AI for product extraction...');
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Build context from what we found
    let context = `Product URL: ${url}\nItem ID: ${itemId}\nPlatform: ${platform}\n`;
    if (productData?.title) {
      context += `Title found: ${productData.title}\n`;
    }
    if (productData?.images?.length) {
      context += `Images found: ${productData.images.slice(0, 5).join('\n')}\n`;
    }

    const systemPrompt = `You are a product data extraction assistant for Chinese e-commerce products.

CRITICAL RULES:
1. If title is provided, use it and translate it professionally
2. If no title is provided, return an error - DO NOT make up product names
3. Only use images that were actually found on the page
4. Translate Chinese to Arabic naturally (not literally)
5. Provide English translations for all text
6. Never include prices
7. For colors, extract full color names and accurate HEX codes
8. Keep all image URLs exactly as provided

If you cannot find enough real product information, indicate that in your response.`;

    const userPrompt = `Extract product information from this Chinese e-commerce product:

${context}

If a title was found, translate and structure it. If no title was found, return an error response.

Return structured data with:
- name (English) and name_ar (Arabic)
- description (English) and description_ar (Arabic) - based on product type
- images array (only from URLs actually found)
- colors array (if any found) with name, name_ar, hex_code, image_url
- sizes/options array (if any found) with name, name_ar, image_url
- features array with text, text_ar, icon (lucide icon name)`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        temperature: 0.1,
        max_tokens: 4000,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_product_info",
              description: "Extract and structure product information",
              parameters: {
                type: "object",
                properties: {
                  error: { type: "string", description: "Error message if extraction failed" },
                  name: { type: "string", description: "Product name in English" },
                  name_ar: { type: "string", description: "Product name in Arabic" },
                  description: { type: "string", description: "Product description in English" },
                  description_ar: { type: "string", description: "Product description in Arabic" },
                  images: {
                    type: "array",
                    items: { type: "string" },
                    description: "Product image URLs"
                  },
                  colors: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        name_ar: { type: "string" },
                        hex_code: { type: "string" },
                        image_url: { type: "string" }
                      }
                    }
                  },
                  sizes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        name_ar: { type: "string" },
                        image_url: { type: "string" }
                      }
                    }
                  },
                  features: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        text: { type: "string" },
                        text_ar: { type: "string" },
                        icon: { type: "string" }
                      }
                    }
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
      throw new Error('AI service error');
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error('AI did not return product information');
    }

    const productInfo = JSON.parse(toolCall.function.arguments);
    
    // Check if AI returned an error
    if (productInfo.error) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: productInfo.error || 'Could not extract product information. Taobao may be blocking access.',
          hint: 'Try copying the product title and images manually from the Taobao page.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Extraction complete:', productInfo.name);

    // Validate hex codes
    if (productInfo.colors && Array.isArray(productInfo.colors)) {
      productInfo.colors = productInfo.colors.map((color: any) => {
        let hex = color.hex_code || '#808080';
        if (!hex.startsWith('#')) hex = '#' + hex;
        if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) hex = '#808080';
        return { ...color, hex_code: hex };
      });
    }

    // Ensure images array exists and has proper URLs
    if (!productInfo.images) productInfo.images = [];
    if (productData?.images) {
      // Add any images we found from the page
      for (const img of productData.images) {
        if (!productInfo.images.includes(img)) {
          productInfo.images.push(img);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        productInfo,
        extraction_method: method || 'ai_only',
        item_id: itemId,
        platform
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An error occurred',
        success: false,
        hint: 'Taobao may be blocking automated access. Try copying product details manually.'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
