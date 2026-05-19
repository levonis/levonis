
# محرك تسعير 3D Printing بمستوى صناعي

## 1) قاعدة البيانات (Migration واحدة)

### أ. توسيع `community_settings.value` لمفتاح `quote_pricing`
JSON موحّد (source of truth) يحتوي الإعدادات العامة + override لكل تقنية:

```json
{
  "base": {
    "electricity_kwh_iqd": 250,
    "depreciation_pct": 0.05,
    "labor_per_hour_iqd": 3000,
    "packaging_iqd": 1500,
    "shipping_default_iqd": 5000,
    "platform_fee_pct": 0.017,
    "profit_margin_pct": 0.15,
    "min_range_pct": 0.90,
    "max_range_pct": 1.15,
    "min_order_iqd": 5000,
    "round_to_iqd": 250
  },
  "risk": {
    "complexity_mult": { "easy": 1.0, "medium": 1.5, "hard": 2.2 },
    "overhang_mult_per_10pct": 0.08,
    "large_model_threshold_cm3": 200,
    "large_model_mult": 1.15,
    "multipart_labor_per_part_iqd": 1500
  },
  "rush": {
    "standard": { "mult": 1.0, "days": 7 },
    "fast":     { "mult": 1.25, "days": 3 },
    "rush":     { "mult": 1.6,  "days": 1 }
  },
  "bulk_tiers": [
    { "min_qty": 5,  "discount_pct": 0.05 },
    { "min_qty": 10, "discount_pct": 0.10 },
    { "min_qty": 25, "discount_pct": 0.18 }
  ],
  "load_balancing": {
    "enabled": true,
    "queue_low_mult": 0.95,
    "queue_high_mult": 1.10,
    "high_threshold_pending": 5
  },
  "processes": {
    "fdm": {
      "enabled": true,
      "machine_kw": 0.15,
      "failure_rate_pct": 0.05,
      "support_mult": 1.0,
      "post_processing_min": 5
    },
    "resin": {
      "enabled": true,
      "machine_kw": 0.06,
      "failure_rate_pct": 0.08,
      "support_mult": 1.2,
      "post_processing_min": 20,
      "wash_cure_iqd": 2000,
      "resin_waste_pct": 0.15
    },
    "sls": {
      "enabled": true,
      "machine_kw": 3.5,
      "failure_rate_pct": 0.03,
      "support_mult": 1.0,
      "post_processing_min": 15,
      "powder_refresh_pct": 0.30,
      "packing_density": 0.08
    }
  }
}
```

### ب. عمود `process_type` على `print_materials`
`text NOT NULL DEFAULT 'fdm'` + CHECK in ('fdm','resin','sls'). Seed المواد الحالية كـ fdm + إضافة 2 راتنج + 1 SLS (PA12) كنماذج.

### ج. عمود `process_type` على `print_machine_profiles`
نفس القيد. + عمود `current_queue_count int default 0` (سيُملأ من print_requests pending).

### د. جدول `print_quotations`
لتخزين كل تسعيرة معتمدة كفاتورة قابلة للتنزيل:
- `id, user_id, quote_number, source ('file'|'url'), input_payload jsonb, breakdown jsonb, final_iqd, currency, status ('draft'|'accepted'|'converted'), pdf_url text NULL, print_request_id uuid NULL, rush_tier, qty int default 1, created_at`
- RLS: المستخدم يرى ملفه، الأدمن يرى الكل.

## 2) Edge Function: إعادة كتابة `price-3d-model`

cascade التسعير الجديد:

1. **اختيار التقنية** من `material.process_type` (FDM/Resin/SLS).
2. **حساب الوزن والوقت** حسب المعادلة المناسبة:
   - FDM: مثل الحالي (extrusion + travel)
   - Resin: `cure_time = layers * cure_sec_per_layer + post_cure_min`، الوزن = volume * density * (1 + resin_waste_pct)
   - SLS: `print_time = (bbox_z / build_rate) + cooling_min`، تكلفة المسحوق = `(weight + powder_refresh * unused_volume) * cost_per_kg`
3. **التكاليف الأساسية** (8 مكونات):
   - filament/resin/powder
   - machine runtime
   - electricity = `kwh * hours * electricity_kwh_iqd`
   - supports = `support_mult * support_volume_estimate * material_cost`
   - failure_risk = `subtotal * failure_rate_pct`
   - depreciation = `machine_cost * depreciation_pct`
   - labor = `(post_processing_min + multipart_extra) / 60 * labor_per_hour_iqd`
   - packaging
4. **مضاعفات ديناميكية**:
   - complexity_mult (من difficulty heuristic)
   - overhang_mult: `1 + (overhang_pct * 10) * overhang_mult_per_10pct`
   - large_model_mult إذا volume > threshold
5. **rush** × **load_balancing** × **bulk_discount** (حسب qty)
6. **platform_fee + profit_margin → final**
7. **min_order_iqd** floor + round250
8. **خرج**: `{ price_min, price_max, recommended, breakdown[], difficulty_score (1-10 heuristic), process, rush_options[], bulk_tiers_preview[] }`

heuristic لـ difficulty 1-10:
`score = clamp(round(complexity/10 + overhang_pct*30 + non_manifold_pct*10 + thin_wall?1:0), 1, 10)`

## 3) Edge Function جديدة: `generate-quotation-pdf`
- POST بـ quotation_id → يولّد HTML احترافي (شعار، breakdown table، شروط، RTL) → يرفع PDF إلى bucket `quotations` → يرجع `pdf_url`.
- يُستخدم نفس نمط `AdminPrinterInvoices` (html2canvas+jsPDF موجودين فعليًا في الواجهة، نُكرر النهج للقوام الإحترافي).

## 4) صفحة أدمن: `/admin/print-materials` (توسعة)
تبويبات داخلية بدل صفحة جديدة (يحقق "توسيع الجدول الحالي"):
- **المواد**: الحالي + عمود process_type
- **الماكينات**: الحالي + process_type + queue
- **محرك التسعير**: 6 أقسام (Base, Risk, Rush, Bulk, Load Balancing, Per-Process Overrides)
- **معاينة حية**: حقول test (volume, bbox, overhang, qty, rush) → تعرض breakdown فوريًا بنداء `price-3d-model` بدون حفظ.

## 5) UI المستخدم
- `QuoteResultCard`: إضافة قسم Breakdown Table قابل للطي (8 مكونات + المضاعفات + المجموع)
- شارات: difficulty_score 1-10 ملوّنة، process badge (FDM/Resin/SLS)
- مفاتيح: rush tier (3 خيارات بالأسعار)، qty stepper (يحدّث bulk discount مباشرة)
- زرّ "تنزيل عرض السعر PDF" → ينشئ quotation ويفتح PDF
- زرّ "اعتماد وتحويل لطلب" → ينشئ `print_requests` ويربط `print_request_id` بالـ quotation

## 6) i18n
كل النصوص الجديدة في `src/lib/i18n/{ar,en,ku}.ts` تحت namespace `pricing.engine.*`.

## 7) أمان
- RLS على print_quotations
- Zod validation في الـ edge function لكل المدخلات (qty 1-1000, rush in enum, process in enum)
- الأدمن فقط يحرّر community_settings (السياسة موجودة)
- لا تغيير على عقد JWT verify الحالي للدالة

## تفاصيل تقنية
```text
ملفات جديدة:
  supabase/migrations/<ts>_pricing_engine.sql
  supabase/functions/generate-quotation-pdf/index.ts
  src/components/community/PricingBreakdownTable.tsx
  src/components/community/RushAndQtyControls.tsx
  src/components/admin/pricing/PricingEngineTab.tsx
  src/components/admin/pricing/LivePricingPreview.tsx

ملفات معدّلة:
  supabase/functions/price-3d-model/index.ts        (إعادة كتابة كاملة)
  src/pages/AdminPrintMaterials.tsx                 (Tabs + قسم محرك التسعير)
  src/components/community/QuoteResultCard.tsx      (breakdown + rush/qty + PDF)
  src/components/community/MaterialPicker.tsx       (فلترة حسب process)
  src/lib/i18n/{ar,en,ku}.ts                        (pricing.engine.*)
  src/integrations/supabase/types.ts                (auto)
```

## خارج النطاق (الآن)
- Multi-currency display (IQD فقط)
- إشعارات telegram للتسعيرات (موجودة لـprint_requests فقط)
- Slicer حقيقي (نعتمد heuristic الموجودة)
- تكامل دفع/خصم محفظة للتسعيرة (تتم عند تحويلها لـ print_request)
