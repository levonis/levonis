// Local, on-device printer advisor — no external AI API. Fast and deterministic.
import { supabase } from "@/integrations/supabase/client";

const PRINTER_CATEGORY_SLUG = "printers";
const DEFAULT_USD_TO_IQD = 1410;

export interface AdvisorInput {
  budget_iqd: number;
  purposes: string[];
  experience_level: string; // beginner | intermediate | advanced
  notes?: string;
}

export interface AdvisorProduct {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  brand: string | null;
  price_iqd: number;
}

export interface AdvisorResult {
  recommended: AdvisorProduct | null;
  reasoning: string;
  key_features: string[];
  upgrade_suggestion: {
    product: AdvisorProduct;
    additional_budget_iqd: number;
    message: string;
  } | null;
  admin_rule_applied: boolean;
}

interface PrinterRow {
  id: string;
  name: string | null;
  name_ar: string | null;
  slug: string;
  price: number | null;
  price_usd: number | null;
  image_url: string | null;
  brand: string | null;
  description_ar: string | null;
  advisor_priority_boost: number | null;
  advisor_recommended: boolean | null;
  advisor_notes: string | null;
}

const toProduct = (p: PrinterRow & { _price: number }): AdvisorProduct => ({
  id: p.id,
  name: p.name_ar || p.name || "",
  slug: p.slug,
  image_url: p.image_url,
  brand: p.brand,
  price_iqd: p._price,
});

const priceIqd = (p: PrinterRow, rate: number): number => {
  const base = Number(p.price) || 0;
  if (base > 0) return base;
  const usd = Number(p.price_usd) || 0;
  return usd > 0 ? Math.round(usd * rate) : 0;
};

// Heuristic feature inference based on text + brand + price tier
function inferFeatures(p: PrinterRow & { _price: number }, input: AdvisorInput): string[] {
  const features: string[] = [];
  const text = `${p.name || ""} ${p.name_ar || ""} ${p.description_ar || ""} ${p.advisor_notes || ""}`.toLowerCase();
  const brand = (p.brand || "").toLowerCase();

  if (/bambu|p1|x1|a1|a2|p2s/i.test(text + brand)) {
    features.push("سرعة طباعة عالية وجودة ممتازة");
    features.push("نظام تسوية تلقائي للسرير");
  }
  if (/snapmaker|u1/i.test(text + brand)) {
    features.push("متعددة الوظائف (طباعة + ليزر + قص CNC)");
    features.push("هيكل معدني صلب ودقة عالية");
  }
  if (/resin|mono|elegoo|saturn|mars/i.test(text + brand)) {
    features.push("دقة فائقة لنماذج الراتنج التفصيلية");
  }
  if (/creality|ender|k1/i.test(text + brand)) {
    features.push("مجتمع دعم واسع وقطع غيار متوفرة");
  }
  if (input.experience_level === "beginner") {
    features.push("سهلة الإعداد ومناسبة للمبتدئين");
  }
  if (input.purposes.some((x) => /كبير/.test(x))) {
    features.push("منطقة طباعة واسعة");
  }
  if (input.purposes.some((x) => /ميكانيك|دقيق/.test(x))) {
    features.push("دقة أبعاد مناسبة للقطع الميكانيكية");
  }
  if (input.purposes.some((x) => /تعليم|أطفال/.test(x))) {
    features.push("آمنة وبسيطة الاستخدام للتعليم");
  }
  if (p._price >= 1_500_000) {
    features.push("استثمار طويل الأمد بمواصفات احترافية");
  } else if (p._price <= 500_000) {
    features.push("سعر مناسب لبداية رحلتك مع الطباعة ثلاثية الأبعاد");
  }
  if (p.advisor_notes) {
    features.push(p.advisor_notes);
  }

  // unique + cap 5
  return Array.from(new Set(features.map((f) => f.trim()).filter(Boolean))).slice(0, 5);
}

function buildReasoning(
  p: AdvisorProduct,
  input: AdvisorInput,
  withinBudget: boolean,
  adminRule: boolean,
): string {
  const parts: string[] = [];
  if (adminRule) {
    parts.push(`بناءً على ميزانيتك (${input.budget_iqd.toLocaleString()} د.ع)، اخترنا لك ${p.name} كأفضل خيار في هذه الفئة`);
  } else if (withinBudget) {
    parts.push(`${p.name} تقدم أفضل توازن بين السعر والأداء ضمن ميزانيتك`);
  } else {
    parts.push(`${p.name} هي الخيار الأقرب لميزانيتك مع أعلى قيمة مقابل السعر`);
  }
  if (input.purposes.length) {
    parts.push(`وتناسب الغرض المطلوب (${input.purposes.slice(0, 2).join("، ")})`);
  }
  if (input.experience_level === "beginner") {
    parts.push("كما أنها سهلة الاستخدام للمبتدئين");
  } else if (input.experience_level === "advanced") {
    parts.push("وتلبي متطلبات المستخدمين المحترفين");
  }
  return parts.join("، ") + ".";
}

export async function suggestPrinterLocal(input: AdvisorInput): Promise<AdvisorResult> {
  const budget = Math.max(0, Number(input.budget_iqd) || 0);
  if (budget <= 0) throw new Error("يرجى إدخال ميزانية صالحة");

  // Get USD->IQD rate
  let rate = DEFAULT_USD_TO_IQD;
  try {
    const { data: rateRow } = await supabase
      .from("default_settings")
      .select("setting_value")
      .eq("setting_key", "usd_to_iqd_rate")
      .maybeSingle();
    const n = Number((rateRow as any)?.setting_value);
    if (n > 0) rate = n;
  } catch {}

  // Category id
  const { data: cat } = await supabase
    .from("categories")
    .select("id")
    .eq("slug", PRINTER_CATEGORY_SLUG)
    .maybeSingle();
  if (!cat?.id) throw new Error("تصنيف الطابعات غير موجود");

  // Products
  const { data: products, error: prodErr } = await supabase
    .from("products")
    .select(
      "id, name, name_ar, slug, price, price_usd, image_url, brand, description_ar, advisor_priority_boost, advisor_recommended, advisor_notes",
    )
    .eq("category_id", cat.id);
  if (prodErr) throw prodErr;

  const enriched = (products || [])
    .map((p: any) => ({ ...p, _price: priceIqd(p, rate) }))
    .filter((p) => p._price > 0) as Array<PrinterRow & { _price: number }>;

  if (enriched.length === 0) throw new Error("لا توجد طابعات متاحة حالياً");

  // Admin budget rule
  const { data: rules } = await supabase
    .from("printer_advisor_budget_rules")
    .select("*")
    .eq("is_active", true)
    .lte("min_budget_iqd", budget)
    .gte("max_budget_iqd", budget)
    .order("priority", { ascending: false })
    .limit(1);
  const rule: any = rules?.[0];

  const findById = (id?: string | null) => enriched.find((p) => p.id === id);

  let chosen: (PrinterRow & { _price: number }) | undefined;
  let upgrade: (PrinterRow & { _price: number }) | undefined;
  let upgradeMessage = "";
  let adminRule = false;

  if (rule) {
    chosen = findById(rule.recommended_product_id);
    upgrade = findById(rule.upgrade_suggestion_product_id);
    upgradeMessage = rule.message_ar || "";
    adminRule = !!chosen;
  }

  // Local scoring fallback
  if (!chosen) {
    const purposesText = input.purposes.join(" ").toLowerCase();
    const scored = enriched
      .map((p) => {
        let score = 0;
        const withinBudget = p._price <= budget;
        const overBudgetRatio = p._price / Math.max(1, budget);

        if (withinBudget) {
          // Reward using as much of the budget as possible
          score += (p._price / budget) * 60;
        } else {
          // Penalize over-budget products heavily, but allow slight overspend (up to 25%)
          if (overBudgetRatio <= 1.25) score += 30 - (overBudgetRatio - 1) * 100;
          else score -= 100;
        }
        score += (p.advisor_priority_boost || 0);
        if (p.advisor_recommended) score += 25;

        const text = `${p.name || ""} ${p.name_ar || ""} ${p.description_ar || ""} ${p.advisor_notes || ""}`.toLowerCase();
        if (purposesText && text) {
          if (/تعليم|أطفال/.test(purposesText) && /سهل|مبتدئ|تعليم/.test(text)) score += 8;
          if (/ميكانيك|دقيق/.test(purposesText) && /دقة|دقيق|metal/.test(text)) score += 8;
          if (/كبير/.test(purposesText) && /كبير|large|xl/.test(text)) score += 10;
          if (/احتراف|تجاري/.test(purposesText) && p._price >= 1_000_000) score += 10;
        }

        if (input.experience_level === "beginner" && /bambu|a1|ender|easy|سهل/.test(text)) score += 8;
        if (input.experience_level === "advanced" && /snapmaker|x1|pro|متقدم/.test(text)) score += 8;

        return { p, score, withinBudget };
      })
      .sort((a, b) => b.score - a.score);

    chosen = scored[0]?.p;

    // Upgrade suggestion: best higher-priced printer within +25% of budget
    if (chosen) {
      const upgradeCandidates = enriched
        .filter((p) => p.id !== chosen!.id && p._price > chosen!._price && p._price > budget && p._price <= budget * 1.4)
        .sort((a, b) => {
          const scoreA = (a.advisor_priority_boost || 0) + (a.advisor_recommended ? 20 : 0) - (a._price - budget) / 10000;
          const scoreB = (b.advisor_priority_boost || 0) + (b.advisor_recommended ? 20 : 0) - (b._price - budget) / 10000;
          return scoreB - scoreA;
        });
      upgrade = upgradeCandidates[0];
    }
  }

  if (!chosen) {
    // Last resort: cheapest
    chosen = enriched.sort((a, b) => a._price - b._price)[0];
  }

  const chosenProduct = toProduct(chosen);
  const withinBudget = chosen._price <= budget;

  const result: AdvisorResult = {
    recommended: chosenProduct,
    reasoning: buildReasoning(chosenProduct, input, withinBudget, adminRule),
    key_features: inferFeatures(chosen, input),
    upgrade_suggestion: upgrade
      ? {
          product: toProduct(upgrade),
          additional_budget_iqd: Math.max(0, upgrade._price - budget),
          message:
            upgradeMessage ||
            `بزيادة ${Math.max(0, upgrade._price - budget).toLocaleString()} د.ع فقط تحصل على ${toProduct(upgrade).name} بمواصفات أعلى وأداء أفضل`,
        }
      : null,
    admin_rule_applied: adminRule,
  };

  return result;
}
