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
    const { url } = await req.json();
    
    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching product page:', url);

    // Initialize Supabase client for storage uploads
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the webpage content
    const pageResponse = await fetch(url);
    if (!pageResponse.ok) {
      throw new Error(`Failed to fetch page: ${pageResponse.statusText}`);
    }

    const html = await pageResponse.text();
    console.log('Page fetched successfully, length:', html.length);

    // Extract text content from HTML with better content targeting
    let textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Prioritize main content area if it exists
    const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    const productMatch = html.match(/<div[^>]*class="[^"]*product[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    
    if (mainMatch || articleMatch || productMatch) {
      const matchContent = (mainMatch || articleMatch || productMatch)!;
      const priorityContent = matchContent[1];
      const cleanPriority = priorityContent
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      textContent = cleanPriority + ' ' + textContent;
    }
    
    // Increase limit to capture more content
    textContent = textContent.substring(0, 40000);

    // Extract image URLs from HTML
    const imageUrls: string[] = [];
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let imgMatch;
    while ((imgMatch = imgRegex.exec(html)) !== null) {
      const imgUrl = imgMatch[1];
      // Only include full URLs and exclude tiny icons/placeholders
      if (imgUrl.startsWith('http') && !imgUrl.includes('icon') && !imgUrl.includes('logo')) {
        imageUrls.push(imgUrl);
      }
    }

    console.log('Extracted text content length:', textContent.length);

    // Call Lovable AI to extract product information
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
            content: `أنت مساعد ذكاء اصطناعي متخصص في استخراج معلومات المنتجات من صفحات الويب بدقة عالية.

مهمتك:
- استخراج جميع المعلومات المتعلقة بالمنتج بدقة
- ترجمة المعلومات للعربية بشكل احترافي ودقيق
- فصل الأحجام/الخيارات عن الألوان بشكل واضح
- تجميع روابط الصور الرئيسية للمنتج فقط

مهم جداً:
- لا تستخرج معلومات السعر نهائياً
- الأحجام مثل: S, M, L, XL, 32, 34, 36, etc.
- الألوان مثل: أحمر، أزرق، أسود، أبيض، etc.
- الصور: فقط صور المنتج الرئيسية (تجاهل الأيقونات والشعارات)`
          },
          {
            role: 'user',
            content: `استخرج معلومات المنتج من المحتوى التالي:

${textContent}

الصور المتاحة في الصفحة:
${imageUrls.slice(0, 20).join('\n')}

استخرج بدقة:
1. اسم المنتج بالعربية والإنجليزية (ترجمة احترافية)
2. وصف تفصيلي شامل بالعربية والإنجليزية (ترجمة كاملة ودقيقة)
3. جميع الأحجام/الخيارات المتوفرة (مثل: S, M, L أو 32, 34, 36)
4. جميع الألوان المتوفرة مع أسمائها بالعربية والإنجليزية
5. جميع المميزات والخصائص بالعربية والإنجليزية
6. روابط الصور الرئيسية للمنتج فقط (اختر الأفضل من القائمة)`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_product_info",
              description: "استخراج معلومات المنتج من صفحة الويب بدقة وفصل الأحجام عن الألوان",
              parameters: {
                type: "object",
                properties: {
                  name_ar: { 
                    type: "string", 
                    description: "اسم المنتج بالعربية - ترجمة احترافية ودقيقة" 
                  },
                  name: { 
                    type: "string", 
                    description: "اسم المنتج بالإنجليزية" 
                  },
                  description_ar: { 
                    type: "string", 
                    description: "وصف تفصيلي وشامل للمنتج بالعربية - ترجمة احترافية كاملة" 
                  },
                  description: { 
                    type: "string", 
                    description: "وصف تفصيلي وشامل للمنتج بالإنجليزية" 
                  },
                  images: {
                    type: "array",
                    items: { type: "string" },
                    description: "روابط الصور الرئيسية للمنتج فقط (اختر الأفضل والأوضح)"
                  },
                  sizes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "الحجم بالإنجليزية (S, M, L, XL, 32, 34, etc.)" },
                        name_ar: { type: "string", description: "الحجم بالعربية (صغير، وسط، كبير، etc.)" }
                      }
                    },
                    description: "جميع الأحجام/الخيارات المتوفرة للمنتج (منفصلة عن الألوان)"
                  },
                  colors: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "اسم اللون بالإنجليزية" },
                        name_ar: { type: "string", description: "اسم اللون بالعربية" },
                        hex_code: { type: "string", description: "كود اللون hex إن وجد أو تقديره" }
                      }
                    },
                    description: "جميع الألوان المتوفرة للمنتج فقط (بدون أحجام)"
                  },
                  features: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        text: { type: "string", description: "نص الميزة بالإنجليزية" },
                        text_ar: { type: "string", description: "نص الميزة بالعربية - ترجمة دقيقة" }
                      }
                    },
                    description: "جميع مميزات وخصائص المنتج المذكورة في الصفحة"
                  }
                },
                required: [],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_product_info" } }
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'تم تجاوز الحد المسموح من الطلبات. يرجى المحاولة لاحقاً.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'يرجى إضافة رصيد إلى حساب Lovable AI الخاص بك.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await aiResponse.text();
      console.error('AI Gateway error:', aiResponse.status, errorText);
      throw new Error('فشل في الاتصال بخدمة الذكاء الاصطناعي');
    }

    const aiData = await aiResponse.json();
    console.log('AI Response received');

    // Extract the tool call result
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error('لم يتم استخراج معلومات المنتج');
    }

    const productInfo = JSON.parse(toolCall.function.arguments);
    console.log('Extracted product info:', productInfo);

    // Download and upload images to Supabase Storage
    const uploadedImageUrls: string[] = [];
    if (productInfo.images && Array.isArray(productInfo.images)) {
      console.log(`Downloading ${productInfo.images.length} images...`);
      
      for (let i = 0; i < Math.min(productInfo.images.length, 10); i++) {
        const imageUrl = productInfo.images[i];
        try {
          // Download the image
          const imageResponse = await fetch(imageUrl);
          if (!imageResponse.ok) continue;
          
          const imageBlob = await imageResponse.blob();
          const fileExt = imageUrl.split('.').pop()?.split('?')[0] || 'jpg';
          const fileName = `${Date.now()}-${i}.${fileExt}`;
          const filePath = `${fileName}`;

          // Upload to Supabase Storage
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('product-images')
            .upload(filePath, imageBlob, {
              contentType: imageResponse.headers.get('content-type') || 'image/jpeg',
              upsert: false
            });

          if (uploadError) {
            console.error('Upload error:', uploadError);
            continue;
          }

          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('product-images')
            .getPublicUrl(filePath);

          uploadedImageUrls.push(publicUrl);
          console.log(`Image ${i + 1} uploaded successfully`);
        } catch (error) {
          console.error(`Error processing image ${i}:`, error);
        }
      }
    }

    // Replace image URLs with uploaded ones
    if (uploadedImageUrls.length > 0) {
      productInfo.images = uploadedImageUrls;
      console.log(`Successfully uploaded ${uploadedImageUrls.length} images`);
    }

    return new Response(
      JSON.stringify({ success: true, productInfo }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in extract-product-info:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
        success: false 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
