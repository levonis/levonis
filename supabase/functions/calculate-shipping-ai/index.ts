import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Fetch USD to IQD rate from settings
    let usdToIqdRate = 1410;
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const { data: settingData } = await supabase
        .from('shipping_settings')
        .select('setting_value')
        .eq('setting_key', 'usd_to_iqd_rate')
        .single();
      
      if (settingData?.setting_value) {
        usdToIqdRate = Number(settingData.setting_value);
      }
    } catch (e) {
      console.log('Could not fetch USD rate, using default:', e);
    }

    console.log('Searching for product specs:', productName, 'USD rate:', usdToIqdRate);

    const prompt = `ابحث عن مواصفات المنتج التالي واستخرج الأبعاد والوزن والسعر بدقة.

اسم المنتج: ${productName}
${optionName ? `الخيار المحدد: ${optionName}` : ''}
${productUrl ? `رابط المنتج: ${productUrl}` : ''}

أحتاج منك:
1. البحث عن أبعاد المنتج الدقيقة (الطول × العرض × الارتفاع) بالسنتيمتر
2. البحث عن وزن المنتج بالكيلوغرام
3. البحث عن سعر المنتج بالدولار الأمريكي (USD)
4. إذا لم تجد معلومات دقيقة، قدّر بناءً على نوع المنتج

أرجع JSON فقط بالشكل التالي:
{
  "dimensions": {
    "length": 30,
    "width": 20,
    "height": 10
  },
  "weight": 1.5,
  "price_usd": 150,
  "estimated": true,
  "source": "تقدير بناءً على منتجات مشابهة",
  "notes": "ملاحظات إضافية"
}

ملاحظات:
- الأبعاد بالسنتيمتر (cm)
- الوزن بالكيلوغرام (kg)
- السعر بالدولار الأمريكي (USD)
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
            content: 'أنت خبير في مواصفات المنتجات والشحن الدولي. ابحث عن أبعاد ووزن وسعر المنتجات بدقة عالية. إذا لم تجد معلومات دقيقة، قدم تقديراً معقولاً بناءً على نوع المنتج. أرجع JSON صحيح فقط.' 
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
    
    // Calculate price in IQD
    let priceIqd: number | null = null;
    if (specs.price_usd && specs.price_usd > 0) {
      priceIqd = Math.round(specs.price_usd * usdToIqdRate);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: {
          dimensions: specs.dimensions,
          weight: specs.weight,
          price_usd: specs.price_usd,
          price_iqd: priceIqd,
          usd_to_iqd_rate: usdToIqdRate,
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
