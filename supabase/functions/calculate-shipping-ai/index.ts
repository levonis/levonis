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
    const { productName, productUrl, optionName, sourceCountry, shippingType } = await req.json();

    if (!productName && !productUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'يجب إدخال اسم المنتج أو الرابط' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build search query
    const searchQuery = optionName 
      ? `${productName} ${optionName} dimensions weight specifications`
      : `${productName} dimensions weight specifications`;

    console.log('Searching for product specs:', searchQuery);

    const prompt = `ابحث عن مواصفات المنتج التالي واستخرج الأبعاد والوزن بدقة.

اسم المنتج: ${productName}
${optionName ? `الخيار المحدد: ${optionName}` : ''}
${productUrl ? `رابط المنتج: ${productUrl}` : ''}

أحتاج منك:
1. البحث عن أبعاد المنتج الدقيقة (الطول × العرض × الارتفاع) بالسنتيمتر
2. البحث عن وزن المنتج بالكيلوغرام
3. إذا لم تجد أبعاد دقيقة، قدّر الأبعاد بناءً على نوع المنتج

أرجع JSON فقط بالشكل التالي:
{
  "dimensions": {
    "length": 30,
    "width": 20,
    "height": 10
  },
  "weight": 1.5,
  "estimated": true,
  "source": "تقدير بناءً على منتجات مشابهة",
  "notes": "ملاحظات إضافية"
}

ملاحظات:
- الأبعاد بالسنتيمتر (cm)
- الوزن بالكيلوغرام (kg)
- estimated = true إذا كانت قيم تقديرية، false إذا كانت دقيقة
- أضف ملاحظات مفيدة عن التغليف المتوقع

أرجع JSON فقط بدون أي نص إضافي.`;

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
            content: 'أنت خبير في مواصفات المنتجات والشحن الدولي. ابحث عن أبعاد ووزن المنتجات بدقة عالية. إذا لم تجد معلومات دقيقة، قدم تقديراً معقولاً بناءً على نوع المنتج. أرجع JSON صحيح فقط.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
      }),
    });

    if (!aiResponse.ok) {
      console.error('AI error:', aiResponse.status);
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'تم تجاوز حد الطلبات، حاول لاحقاً' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ success: false, error: 'فشل في الحصول على المواصفات' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const text = aiData.choices[0]?.message?.content || '';
    console.log('AI response:', text);

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return new Response(
        JSON.stringify({ success: false, error: 'لم يتم العثور على مواصفات' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const specs = JSON.parse(jsonMatch[0]);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: {
          dimensions: specs.dimensions,
          weight: specs.weight,
          estimated: specs.estimated ?? true,
          source: specs.source,
          notes: specs.notes
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'خطأ غير معروف' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
