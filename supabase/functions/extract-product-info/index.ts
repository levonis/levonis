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
        temperature: 0.1,
        messages: [
          {
            role: 'system',
            content: `أنت مساعد ذكاء اصطناعي متخصص في استخراج معلومات المنتجات من صفحات الويب بدقة عالية جداً.

مهمتك الأساسية:
1. استخراج جميع المعلومات المتعلقة بالمنتج بدقة متناهية
2. ترجمة المعلومات للعربية بشكل احترافي ودقيق (يجب أن تكون الترجمة طبيعية وليست حرفية)
3. فصل الأحجام/الخيارات عن الألوان بشكل واضح ومنطقي
4. تحديد بدقة ما إذا كانت الصورة تابعة للون أم لخيار/حجم
5. تحليل صور الألوان واستخراج درجة اللون الدقيقة (hex code) من الصورة نفسها
6. التأكد من صحة جميع الروابط والمعلومات المستخرجة

قواعد صارمة يجب اتباعها:
- لا تستخرج معلومات السعر نهائياً تحت أي ظرف
- كن دقيقاً ومتسقاً في استخراج المعلومات - يجب أن تكون النتائج متطابقة في كل مرة
- الأحجام/الخيارات: يجب استخراج الاسم الكامل مع جميع الأرقام والتفاصيل (مثل: "X1C AMS 2 Pro Combo" وليس "Combo"، "1kg Refill Spool" وليس "Refill")
- الألوان: يجب استخراج الاسم الكامل للون مع جميع الصفات والأرقام (مثل: "Matte Ivory White" وليس "White"، "Bambu PLA Matte Lemon Yellow" وليس "Yellow")
- عند استخراج الألوان: قم بتحليل الصورة بدقة واستخراج اللون السائد الفعلي وحدد hex code دقيق له
- لا تخمن أو تفترض معلومات غير موجودة في الصفحة

التمييز بين صور الألوان وصور الخيارات:
- صورة اللون: تُظهر نفس المنتج لكن بلون مختلف (نفس الشكل والتصميم، فقط اللون يختلف)
- صورة الخيار/الحجم: قد تُظهر نفس المنتج بزاوية مختلفة، أو نوع مختلف من القماش، أو أي تفاصيل أخرى غير اللون

مثال:
- إذا كان لديك قميص بألوان مختلفة (أحمر، أزرق، أخضر)، فكل لون له صورة تظهر القميص بهذا اللون → صور ألوان
- إذا كان لديك نفس القميص بأحجام مختلفة (S, M, L) وكل حجم له صورة خاصة → صور خيارات
- إذا كان المنتج متوفر بخامات مختلفة (قطن، حرير) وكل خامة لها صورة → صور خيارات

استخراج درجة اللون:
- انظر إلى الصورة وحدد اللون السائد في المنتج
- استخرج hex code دقيق يمثل هذا اللون (مثال: #FF0000 للأحمر، #0000FF للأزرق)
- إذا كان اللون غامق أو فاتح، اعكس ذلك في hex code

الصور: فقط صور المنتج الرئيسية (تجاهل الأيقونات والشعارات والإعلانات)

أهم قاعدة: يجب استخراج الاسم الكامل للألوان والخيارات مع جميع التفاصيل والأرقام!`
          },
          {
            role: 'user',
            content: `استخرج معلومات المنتج من المحتوى التالي:

${textContent}

الصور المتاحة في الصفحة:
${imageUrls.slice(0, 20).join('\n')}

استخرج المعلومات التالية بدقة تامة واتساق كامل:

1. اسم المنتج:
   - بالعربية: ترجمة احترافية طبيعية (ليست حرفية)
   - بالإنجليزية: الاسم الأصلي من الصفحة

2. وصف المنتج:
   - بالعربية: ترجمة شاملة ومفصلة واحترافية لجميع التفاصيل
   - بالإنجليزية: الوصف الكامل من الصفحة

3. الأحجام/الخيارات:
   - استخرج فقط الخيارات المتوفرة فعلياً
   - يجب استخراج الاسم الكامل مع جميع الأرقام والتفاصيل (مثال: "X1C AMS 2 Pro Combo" وليس فقط "Combo")
   - أضف صورة لكل خيار إن وجدت (يجب أن تختلف في التفاصيل وليس اللون فقط)
   - أمثلة: "1kg Refill Spool", "X1C Combo", "Standard Bundle with Hub"

4. الألوان المتوفرة (كل لون يجب أن يحتوي على):
   - اسم اللون الكامل بالعربية مع جميع الصفات (مثال: "أبيض عاجي مطفأ" وليس فقط "أبيض")
   - اسم اللون الكامل بالإنجليزية من الصفحة (مثال: "Matte Ivory White" وليس فقط "White")
   - صورة واضحة تظهر المنتج بهذا اللون بالتحديد
   - hex code دقيق جداً مستخرج من تحليل الصورة (يطابق اللون الفعلي 100%)

5. المميزات والخصائص:
   - استخرج جميع المميزات المذكورة
   - ترجمها للعربية بشكل دقيق ومفهوم

6. الصور الرئيسية:
   - اختر أفضل 3-5 صور واضحة للمنتج
   - تأكد من جودتها العالية
   - تجنب الأيقونات والشعارات

مهم جداً - التمييز بين الصور:
- صور الألوان: يجب أن تُظهر نفس المنتج بلون مختلف فقط
- صور الخيارات: تُظهر المنتج بتفاصيل أو زوايا أو خامات مختلفة (وليس مجرد لون مختلف)
- إذا كانت الصفحة تحتوي فقط على ألوان، لا تضع أي شيء في الخيارات
- إذا كانت الصفحة تحتوي فقط على خيارات/أحجام، لا تضع أي شيء في الألوان

مهم جداً - استخراج درجة اللون:
- لكل لون، قم بتحليل صورة المنتج بهذا اللون
- استخرج hex code دقيق يمثل اللون السائد في المنتج (مثل: #FF0000، #1E90FF، #32CD32)
- تأكد من أن hex code يعكس الدرجة الفعلية للون (فاتح/غامق)`
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
                    description: "اسم المنتج بالعربية - ترجمة احترافية طبيعية وليست حرفية، يجب أن تكون واضحة ومفهومة" 
                  },
                  name: { 
                    type: "string", 
                    description: "اسم المنتج بالإنجليزية - الاسم الأصلي من الصفحة بالضبط" 
                  },
                  description_ar: { 
                    type: "string", 
                    description: "وصف تفصيلي وشامل للمنتج بالعربية - ترجمة احترافية كاملة لجميع التفاصيل المهمة، يجب أن تكون الترجمة طبيعية ومفهومة" 
                  },
                  description: { 
                    type: "string", 
                    description: "وصف تفصيلي وشامل للمنتج بالإنجليزية - النص الأصلي الكامل من الصفحة" 
                  },
                  images: {
                    type: "array",
                    items: { type: "string" },
                    description: "روابط الصور الرئيسية للمنتج فقط - اختر من 3 إلى 5 صور واضحة وعالية الجودة تظهر المنتج بشكل كامل. تجنب الأيقونات والشعارات والإعلانات"
                  },
                  sizes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "الحجم/الخيار بالإنجليزية - يجب استخراج الاسم الكامل مع جميع الأرقام والتفاصيل (أمثلة: 'X1C AMS 2 Pro Combo' وليس 'Combo'، '1kg Refill Spool' وليس 'Spool'، 'Standard Bundle with Hub' وليس 'Bundle')" },
                        name_ar: { type: "string", description: "الحجم/الخيار بالعربية - ترجمة كاملة لجميع التفاصيل (أمثلة: 'حزمة X1C AMS 2 Pro'، 'خيوط إعادة تعبئة 1 كيلوجرام'، 'حزمة قياسية مع موزع')" },
                        image_url: { type: "string", description: "رابط صورة خاصة بهذا الخيار/الحجم إن وجدت فقط - يجب أن تكون الصورة مختلفة في التفاصيل أو الزاوية أو الخامة وليس مجرد لون مختلف. إذا لم توجد صورة خاصة، لا تضع شيئاً" }
                      }
                    },
                    description: "جميع الأحجام/الخيارات المتوفرة للمنتج - منفصلة تماماً عن الألوان. يجب استخراج الاسم الكامل مع جميع التفاصيل والأرقام. استخدم هذا فقط للخيارات التي ليست ألواناً (مثل: أحجام، أوزان، خامات، أنواع، حزم). إذا لم توجد خيارات، أرجع مصفوفة فارغة []"
                  },
                  colors: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "اسم اللون الكامل بالإنجليزية مع جميع الصفات والأرقام - الاسم الأصلي من الصفحة (أمثلة: 'Matte Ivory White' وليس 'White'، 'Bambu PLA Matte Lemon Yellow' وليس 'Yellow'، 'Matte Dark Red' وليس 'Red')" },
                        name_ar: { type: "string", description: "اسم اللون الكامل بالعربية مع جميع الصفات - ترجمة كاملة طبيعية (أمثلة: 'أبيض عاجي مطفأ' وليس 'أبيض'، 'بامبو بي إل إيه أصفر ليموني مطفأ' وليس 'أصفر'، 'أحمر داكن مطفأ' وليس 'أحمر')" },
                        hex_code: { type: "string", description: "كود اللون hex مستخرج بدقة فائقة من تحليل الصورة - يجب أن يطابق بدقة 100% اللون الفعلي الظاهر في المنتج (وليس الخلفية). يجب أن يكون صالحاً ويبدأ بـ # ومكون من 6 أحرف (مثال: #FF0000 للأحمر الساطع، #8B0000 للأحمر الداكن، #FFB6C1 للوردي الفاتح، #1E90FF للأزرق الدودجر). احلل الصورة بعناية فائقة لاستخراج اللون الدقيق" },
                        image_url: { type: "string", description: "رابط صورة واضحة تظهر نفس المنتج بالضبط بهذا اللون المحدد - يجب أن يكون نفس الشكل والتصميم مع اختلاف اللون فقط (وليس اختلافات في التفاصيل أو الزاوية). استخدم هذه الصورة لاستخراج hex code الدقيق بتحليلها بعناية" }
                      }
                    },
                    description: "جميع الألوان المتوفرة للمنتج مع صورة ودرجة لون دقيقة لكل لون. يجب استخراج الاسم الكامل للون مع جميع الصفات. استخدم هذا فقط للألوان الفعلية وليس للأحجام أو أي خيارات أخرى. كل لون يجب أن يكون له صورة واضحة و hex code دقيق. إذا لم توجد ألوان، أرجع مصفوفة فارغة []"
                  },
                  features: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        text: { type: "string", description: "نص الميزة بالإنجليزية - النص الأصلي من الصفحة" },
                        text_ar: { type: "string", description: "نص الميزة بالعربية - ترجمة طبيعية ودقيقة ومفهومة" }
                      }
                    },
                    description: "جميع مميزات وخصائص المنتج المذكورة بوضوح في الصفحة. استخرج فقط المميزات الواضحة والمحددة"
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

    // Helper function to upload an image
    const uploadImage = async (imageUrl: string, prefix: string): Promise<string | null> => {
      try {
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) return null;
        
        const imageBlob = await imageResponse.blob();
        const fileExt = imageUrl.split('.').pop()?.split('?')[0] || 'jpg';
        const fileName = `${prefix}-${Date.now()}-${Math.random()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(fileName, imageBlob, {
            contentType: imageResponse.headers.get('content-type') || 'image/jpeg',
            upsert: false
          });
        
        if (uploadError) {
          console.error('Upload error:', uploadError);
          return null;
        }
        
        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(fileName);
        
        return publicUrl;
      } catch (error) {
        console.error('Error uploading image:', error);
        return null;
      }
    };

    // Validate extracted data
    if (!productInfo.name || !productInfo.name_ar) {
      throw new Error('فشل في استخراج اسم المنتج');
    }

    // Download and upload main product images
    const uploadedImageUrls: string[] = [];
    if (productInfo.images && Array.isArray(productInfo.images)) {
      console.log(`Downloading ${productInfo.images.length} main images...`);
      
      // Limit to 6 main images for better performance
      for (let i = 0; i < Math.min(productInfo.images.length, 6); i++) {
        const publicUrl = await uploadImage(productInfo.images[i], 'main');
        if (publicUrl) {
          uploadedImageUrls.push(publicUrl);
          console.log(`Main image ${i + 1} uploaded successfully`);
        }
      }
    }

    // Replace main image URLs with uploaded ones
    if (uploadedImageUrls.length > 0) {
      productInfo.images = uploadedImageUrls;
      console.log(`Successfully uploaded ${uploadedImageUrls.length} main images`);
    }

    // Upload images for sizes/options
    if (productInfo.sizes && Array.isArray(productInfo.sizes)) {
      console.log(`Processing ${productInfo.sizes.length} size images...`);
      for (let i = 0; i < productInfo.sizes.length; i++) {
        const size = productInfo.sizes[i];
        if (size.image_url) {
          const publicUrl = await uploadImage(size.image_url, `size-${i}`);
          if (publicUrl) {
            productInfo.sizes[i].image_url = publicUrl;
            console.log(`Size ${size.name_ar} image uploaded successfully`);
          } else {
            delete productInfo.sizes[i].image_url;
          }
        }
      }
    }

    // Upload images for colors and validate hex codes
    if (productInfo.colors && Array.isArray(productInfo.colors)) {
      console.log(`Processing ${productInfo.colors.length} color images...`);
      for (let i = 0; i < productInfo.colors.length; i++) {
        const color = productInfo.colors[i];
        
        // Validate hex code format
        if (color.hex_code && !/^#[0-9A-Fa-f]{6}$/.test(color.hex_code)) {
          console.warn(`Invalid hex code for color ${color.name_ar}: ${color.hex_code}`);
          // Set a default if invalid
          color.hex_code = '#808080';
        }
        
        if (color.image_url) {
          const publicUrl = await uploadImage(color.image_url, `color-${i}`);
          if (publicUrl) {
            productInfo.colors[i].image_url = publicUrl;
            console.log(`Color ${color.name_ar} image uploaded successfully`);
          } else {
            console.warn(`Failed to upload image for color ${color.name_ar}`);
            delete productInfo.colors[i].image_url;
          }
        }
      }
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
