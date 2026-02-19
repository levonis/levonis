import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `أنت "مساعد ليفو" — المساعد الذكي لمنصة LEVONIS (ليفو)، منصة عراقية للتجارة الإلكترونية والطباعة ثلاثية الأبعاد.

**معلومات المنصة:**
- LEVONIS هي منصة عراقية لبيع الإلكترونيات والأجهزة الذكية مع مجتمع للطباعة ثلاثية الأبعاد
- العملة المستخدمة: الدينار العراقي (د.ع)
- التوصيل متاح لجميع أنحاء العراق

**الأقسام الرئيسية:**
1. **المتجر**: منتجات إلكترونية وأجهزة ذكية بأسعار منافسة وضمان رسمي
2. **مجتمع ليفو**: سوق يجمع العملاء مع تجار الطباعة ثلاثية الأبعاد المعتمدين
3. **مركز المكافآت**: نظام نقاط وتذاكر ومسابقات وبطاقات عضوية
4. **المحفظة**: شحن رصيد والدفع الإلكتروني

**نظام المكافآت:**
- النقاط: تُكسب من الشراء والمهام اليومية، تُستبدل بمنتجات وخصومات
- التذاكر: للمشاركة في المسابقات والسحوبات
- العضوية: 4 مستويات (فضي، ذهبي، ماسي، زمردي) بخصومات تصاعدية
- المسابقات: سحوبات عشوائية، أول فائز، جمع أحرف، فريقية

**مجتمع ليفو:**
- العملاء يرسلون طلبات طباعة (عنوان، وصف، ألوان، حجم، كمية، صور)
- التجار المعتمدون يقدمون عروض أسعار
- العميل يقارن ويختار الأنسب
- نظام ضمان يحمي الأموال حتى تأكيد الاستلام
- تقييم ومراجعات بعد الاكتمال

**قواعدك:**
1. أجب بالعربية دائماً بأسلوب ودود ومختصر
2. أجب فقط عن أسئلة تتعلق بمنصة ليفو وخدماتها
3. إذا سُئلت عن شيء خارج نطاق المنصة، اعتذر بلطف وأرشد للسؤال المناسب
4. لا تخترع معلومات — إذا لم تكن متأكداً، قل ذلك واقترح التواصل مع الدعم
5. كن مختصراً ومباشراً (3-5 جمل كحد أقصى)
6. استخدم إيموجي باعتدال لإضفاء الحيوية`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages.slice(-10), // Keep last 10 messages for context
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "تم تجاوز حد الطلبات، حاول مجدداً بعد قليل." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "يرجى إعادة شحن الرصيد." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "حدث خطأ في الخادم" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("levo-assistant-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
