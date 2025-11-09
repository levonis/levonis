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
    const { url } = await req.json();
    
    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching product page:', url);

    // Fetch the webpage content
    const pageResponse = await fetch(url);
    if (!pageResponse.ok) {
      throw new Error(`Failed to fetch page: ${pageResponse.statusText}`);
    }

    const html = await pageResponse.text();
    console.log('Page fetched successfully, length:', html.length);

    // Extract text content from HTML (simple extraction)
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 15000); // Limit to first 15k chars to stay within token limits

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
            content: 'أنت مساعد متخصص في استخراج معلومات المنتجات من صفحات الويب. قم باستخراج جميع التفاصيل المتاحة بدقة.'
          },
          {
            role: 'user',
            content: `استخرج معلومات المنتج التالية من محتوى الصفحة. إذا لم تكن متأكداً من معلومة معينة، اتركها فارغة.

محتوى الصفحة:
${textContent}

قم باستخراج المعلومات بدقة وإرجاعها.`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_product_info",
              description: "استخراج معلومات المنتج من صفحة الويب",
              parameters: {
                type: "object",
                properties: {
                  name_ar: { 
                    type: "string", 
                    description: "اسم المنتج بالعربية" 
                  },
                  name: { 
                    type: "string", 
                    description: "اسم المنتج بالإنجليزية" 
                  },
                  description_ar: { 
                    type: "string", 
                    description: "وصف تفصيلي للمنتج بالعربية" 
                  },
                  description: { 
                    type: "string", 
                    description: "وصف تفصيلي للمنتج بالإنجليزية" 
                  },
                  price: { 
                    type: "number", 
                    description: "السعر الحالي للمنتج (رقم فقط بدون رمز العملة)" 
                  },
                  original_price: { 
                    type: "number", 
                    description: "السعر الأصلي قبل الخصم إن وجد" 
                  },
                  currency: { 
                    type: "string", 
                    description: "العملة المستخدمة (مثل: دولار، ريال، دينار)" 
                  },
                  images: {
                    type: "array",
                    items: { type: "string" },
                    description: "روابط صور المنتج"
                  },
                  colors: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        name_ar: { type: "string" },
                        hex_code: { type: "string" }
                      }
                    },
                    description: "الألوان المتوفرة للمنتج"
                  },
                  features: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        text: { type: "string" },
                        text_ar: { type: "string" }
                      }
                    },
                    description: "مميزات المنتج"
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
