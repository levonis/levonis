import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

const MAX_MESSAGE_LENGTH = 4000;
const MAX_MESSAGES = 10;

interface ChatMessage {
  role: string;
  content: string;
}

function validateMessages(messages: unknown): ChatMessage[] | null {
  if (!Array.isArray(messages)) return null;
  
  const validated: ChatMessage[] = [];
  for (const msg of messages.slice(-MAX_MESSAGES)) {
    if (
      typeof msg !== 'object' || msg === null ||
      typeof msg.role !== 'string' || typeof msg.content !== 'string' ||
      !['user', 'assistant'].includes(msg.role) ||
      msg.content.length > MAX_MESSAGE_LENGTH ||
      msg.content.trim().length === 0
    ) {
      continue; // skip invalid messages
    }
    validated.push({ role: msg.role, content: msg.content.slice(0, MAX_MESSAGE_LENGTH) });
  }
  
  return validated.length > 0 ? validated : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'مطلوب تسجيل الدخول' }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'غير مصرح' }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    // Parse and validate input
    const body = await req.json();
    const messages = validateMessages(body.messages);
    if (!messages) {
      return new Response(JSON.stringify({ error: 'بيانات غير صحيحة' }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
          ...messages,
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
      console.error("AI gateway error:", response.status);
      return new Response(JSON.stringify({ error: "حدث خطأ في الخادم" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("levo-assistant-chat error:", e instanceof Error ? e.message : "Unknown error");
    return new Response(JSON.stringify({ error: "حدث خطأ في الخادم" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
