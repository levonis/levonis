import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PRINTER_CATEGORY_SLUG = "printers";

interface ReqBody {
  budget_iqd?: number;
  purposes?: string[];
  experience_level?: string;
  notes?: string;
}

function priceIqd(p: any, rate: number): number {
  const base = Number(p.price) || 0;
  if (base > 0) return base;
  const usd = Number(p.price_usd) || 0;
  return usd > 0 ? Math.round(usd * rate) : 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Require authenticated user to prevent anonymous AI credit abuse
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    {
      const authClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsErr } = await authClient.auth.getClaims(token);
      if (claimsErr || !claimsData?.claims) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body: ReqBody = await req.json().catch(() => ({}));
    const budget = Math.max(0, Math.min(Number(body.budget_iqd) || 0, 1_000_000_000));
    const purposes = Array.isArray(body.purposes)
      ? body.purposes.filter((s) => typeof s === "string").slice(0, 10).map((s) => s.slice(0, 80))
      : [];
    const experience = typeof body.experience_level === "string" ? body.experience_level.slice(0, 40) : "";
    const notes = typeof body.notes === "string" ? body.notes.slice(0, 500) : "";

    if (budget <= 0) {
      return new Response(JSON.stringify({ error: "يرجى إدخال ميزانية صالحة" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!
    );

    // USD->IQD rate
    const { data: rateRow } = await supabase
      .from("default_settings")
      .select("setting_value")
      .eq("setting_key", "usd_to_iqd_rate")
      .maybeSingle();
    const usdToIqd = Number(rateRow?.setting_value) || 1410;

    // Printer category
    const { data: cat } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", PRINTER_CATEGORY_SLUG)
      .maybeSingle();
    if (!cat?.id) {
      return new Response(JSON.stringify({ error: "تصنيف الطابعات غير موجود" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Printers
    const { data: products, error: prodErr } = await supabase
      .from("products")
      .select(
        "id, name, name_ar, slug, price, price_usd, image_url, brand, description_ar, advisor_priority_boost, advisor_recommended, advisor_notes"
      )
      .eq("category_id", cat.id);
    if (prodErr) throw prodErr;

    const enriched = (products || [])
      .map((p) => ({ ...p, _price_iqd: priceIqd(p, usdToIqd) }))
      .filter((p) => p._price_iqd > 0);

    if (enriched.length === 0) {
      return new Response(JSON.stringify({ error: "لا توجد طابعات متاحة حالياً" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Budget rules
    const { data: rules } = await supabase
      .from("printer_advisor_budget_rules")
      .select("*")
      .eq("is_active", true)
      .lte("min_budget_iqd", budget)
      .gte("max_budget_iqd", budget)
      .order("priority", { ascending: false })
      .limit(1);
    const rule = rules?.[0];

    const findProd = (id: string | null | undefined) =>
      id ? enriched.find((p) => p.id === id) : undefined;

    const ruleRecommended = findProd(rule?.recommended_product_id);
    const ruleUpgrade = findProd(rule?.upgrade_suggestion_product_id);

    // Build catalog for AI (sorted by boost+recommended)
    const catalog = enriched
      .slice()
      .sort(
        (a, b) =>
          (b.advisor_priority_boost || 0) - (a.advisor_priority_boost || 0) ||
          (Number(b.advisor_recommended) - Number(a.advisor_recommended))
      )
      .map((p) => ({
        id: p.id,
        name: p.name_ar || p.name,
        brand: p.brand || "",
        price_iqd: p._price_iqd,
        recommended: !!p.advisor_recommended,
        boost: p.advisor_priority_boost || 0,
        admin_notes: p.advisor_notes || "",
      }));

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `أنت مستشار طابعات ثلاثية الأبعاد لمنصة LEVONIS العراقية.
مهمتك: اختر الطابعة الأنسب من القائمة المعطاة فقط، اعتماداً على ميزانية المستخدم والغرض ومستوى الخبرة.

قواعد:
- استخدم فقط الطابعات الموجودة في القائمة (لا تخترع).
- فضّل الطابعات التي لديها recommended=true أو boost أعلى عند تساوي المناسبة.
- إذا كانت طابعة أفضل بقليل خارج الميزانية (حتى +25%)، اقترحها في upgrade_suggestion مع المبلغ الإضافي.
- اكتب الشرح والمميزات بالعربية الفصحى البسيطة، بأسلوب ودود.
- 3 إلى 5 مميزات قصيرة وواضحة.
- أعِد JSON فقط بالشكل المطلوب، بدون أي نص خارج JSON.

شكل الإجابة المطلوب:
{
  "recommended_product_id": "<id>",
  "reasoning": "<شرح قصير 2-3 جمل لماذا هي الأنسب>",
  "key_features": ["ميزة 1", "ميزة 2", "ميزة 3"],
  "upgrade_suggestion": {
    "product_id": "<id أو null>",
    "additional_budget_iqd": <رقم>,
    "message": "<نص قصير ينصح بتزويد الميزانية>"
  }
}
إذا لا توجد ترقية مناسبة، اجعل upgrade_suggestion = null.`;

    const userPrompt = `ميزانية المستخدم: ${budget.toLocaleString()} د.ع
الغرض: ${purposes.join("، ") || "غير محدد"}
مستوى الخبرة: ${experience || "غير محدد"}
ملاحظات: ${notes || "لا يوجد"}

${rule ? `تفضيل إداري لهذه الميزانية:
- الطابعة الموصى بها: ${ruleRecommended?.name_ar || ruleRecommended?.name || rule.recommended_product_id}
${ruleUpgrade ? `- اقتراح ترقية: ${ruleUpgrade.name_ar || ruleUpgrade.name}` : ""}
${rule.message_ar ? `- رسالة الأدمن: ${rule.message_ar}` : ""}

التزم بهذا التفضيل ما لم يكن غير مناسب تماماً للغرض.
` : ""}
قائمة الطابعات المتاحة (JSON):
${JSON.stringify(catalog, null, 2)}`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "تم تجاوز حد الطلبات، حاول لاحقاً" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "الرصيد غير كافٍ للذكاء الاصطناعي" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("AI error:", aiResp.status, await aiResp.text());
      throw new Error("AI gateway error");
    }

    const aiData = await aiResp.json();
    const content = aiData.choices?.[0]?.message?.content || "{}";
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = {};
    }

    const recId = parsed.recommended_product_id;
    let chosen = findProd(recId);
    // Fallback: cheapest within budget, prioritised
    if (!chosen) {
      chosen =
        enriched
          .filter((p) => p._price_iqd <= budget)
          .sort(
            (a, b) =>
              (b.advisor_priority_boost || 0) - (a.advisor_priority_boost || 0) ||
              b._price_iqd - a._price_iqd
          )[0] || enriched.sort((a, b) => a._price_iqd - b._price_iqd)[0];
    }

    const upgradeId = parsed.upgrade_suggestion?.product_id;
    const upgrade = findProd(upgradeId);

    const stripProd = (p: any) =>
      p
        ? {
            id: p.id,
            name: p.name_ar || p.name,
            slug: p.slug,
            image_url: p.image_url,
            brand: p.brand,
            price_iqd: p._price_iqd,
          }
        : null;

    return new Response(
      JSON.stringify({
        recommended: stripProd(chosen),
        reasoning: String(parsed.reasoning || "").slice(0, 600),
        key_features: Array.isArray(parsed.key_features)
          ? parsed.key_features.slice(0, 6).map((f: any) => String(f).slice(0, 140))
          : [],
        upgrade_suggestion: upgrade
          ? {
              product: stripProd(upgrade),
              additional_budget_iqd: Math.max(0, Number(parsed.upgrade_suggestion?.additional_budget_iqd) || (upgrade._price_iqd - budget)),
              message: String(parsed.upgrade_suggestion?.message || "").slice(0, 300),
            }
          : null,
        admin_rule_applied: !!rule,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("suggest-printer error:", e instanceof Error ? e.message : "Unknown");
    return new Response(JSON.stringify({ error: "حدث خطأ، حاول مجدداً" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
