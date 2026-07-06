## ميزة استبدال الطابعات القديمة (Trade-In)

### نظرة عامة
يقدم المستخدم طلب استبدال طابعته القديمة بطابعة جديدة من قائمة يحددها الأدمن. النظام يحسب كوبون خصم تلقائياً حسب حالة الطابعة، ثم يراجع الأدمن ويفحص فعلياً قبل إصدار الكوبون النهائي المرتبط بشراء طابعة جديدة محددة.

### قاعدة البيانات

**جدول `trade_in_eligible_printers`** — الطابعات المسموح باستبدالها (يديرها الأدمن):
- `printer_model` (اسم موديل الطابعة القديمة)
- `brand`, `base_trade_in_value` (القيمة الأساسية بالدينار)
- `max_operating_hours` (بعدها يُرفض الطلب أو تنخفض القيمة كثيراً)
- `is_active`

**جدول `trade_in_valuation_rules`** — عوامل الحساب التلقائي (يديرها الأدمن):
- ساعات التشغيل: شرائح (0-500h = 100%, 500-1500 = 80%, ...)
- حالة الكرتون الأصلي: +5%
- خدوش/كسر: -10% إلى -30%
- عطل/عيب: -20% إلى -50%
- وجود وصل شراء: +5%

**جدول `trade_in_requests`** — طلبات المستخدمين:
- `user_id`, `eligible_printer_id`, `target_new_product_id` (الطابعة الجديدة المطلوبة)
- بيانات الفحص: `operating_hours`, `printer_brand`, `printer_model`, `purchase_source`, `has_original_box`, `has_scratches`, `has_defects`, `notes`
- `receipt_image_url`, `photos` (jsonb array من روابط الصور)
- `estimated_coupon_value` (حساب تلقائي أولي)
- `final_coupon_value` (بعد الفحص الفعلي)
- `status` (`pending_review` | `approved_pending_inspection` | `inspection_scheduled` | `inspected_adjusted` | `coupon_issued` | `rejected` | `cancelled`)
- `admin_notes`, `rejection_reason`, `issued_coupon_id`
- RLS: المستخدم يرى/ينشئ طلباته فقط، الأدمن يدير الكل

**Storage bucket**: `trade-in-uploads` (خاص، RLS scoped بـ `user_id/*`)

### صيغة الحساب التلقائي (`src/lib/tradeInPricing.ts`)
```
base = eligible_printer.base_trade_in_value
hoursMultiplier = getTierMultiplier(operating_hours)  // من valuation_rules
conditionAdjust = box(+5%) + scratches(-X%) + defects(-Y%) + receipt(+5%)
estimated = round(base × hoursMultiplier × (1 + conditionAdjust), 250 IQD)
```
تُعرض للمستخدم قبل الإرسال كتقدير غير نهائي.

### واجهة المستخدم

**1. صفحة تفاصيل الطابعة الجديدة (`ProductShop.tsx` أو مكوّن `ProductDetails`)**
- بانر أخضر: "استبدل طابعتك القديمة واحصل على خصم" — يظهر فقط إذا كانت الطابعة الجديدة ضمن الفئات المدعومة
- زر يفتح `TradeInRequestDialog`

**2. `TradeInRequestDialog.tsx` — نموذج متعدد الخطوات:**
- **الخطوة 1**: اختيار الطابعة القديمة من قائمة `trade_in_eligible_printers` (أو "غير موجودة" → رفض مبكر)
- **الخطوة 2**: بيانات الطابعة (ساعات تشغيل، براند، موديل مُكتشف، مصدر الشراء)
- **الخطوة 3**: الحالة (كرتون؟ خدوش؟ عطل؟ ملاحظات)
- **الخطوة 4**: رفع الصور (4-6 صور شاملة + صورة وصل الشراء اختيارية)
- **الخطوة 5**: عرض التقدير المحسوب تلقائياً + تنويه "القيمة النهائية تُحدد بعد الفحص الفعلي" + إرسال

**3. `MyTradeInRequests.tsx` — صفحة المستخدم لمتابعة طلباته:**
- قائمة الطلبات مع الحالة والتقدير الأولي/النهائي
- عند `coupon_issued`: زر "اذهب لشراء الطابعة" مع الكوبون معروضاً

**4. زر ثابت في `MyPrintersPanel.tsx`**: "استبدل هذه الطابعة" إذا كانت ضمن `trade_in_eligible_printers`

### لوحة الإدارة

**`AdminTradeInPrinters.tsx`** (`/admin/trade-in-printers`)
- CRUD للطابعات المؤهلة + قيمها الأساسية + max hours
- تحرير شرائح ساعات التشغيل ونسب الحالة (verify-and-rollback)

**`AdminTradeInRequests.tsx`** (`/admin/trade-in-requests`)
- قائمة الطلبات مع فلترة بالحالة
- تفاصيل الطلب: جميع الصور، البيانات، التقدير الأولي
- إجراءات:
  - **موافقة مبدئية** → status = `approved_pending_inspection` + رسالة للمستخدم مع تعليمات جلب الطابعة
  - **تسجيل نتيجة الفحص الفعلي**: تعديل القيمة النهائية + ملاحظات → status = `inspected_adjusted`
  - **إصدار الكوبون**: يولّد صف في `coupons` مربوط بـ `target_new_product_id` (product_id restriction، one-time use، expires 30 days) → status = `coupon_issued`، ويُخطر المستخدم
  - **رفض** مع سبب

### التكامل مع الكوبونات الحالية
- الكوبون المُصدر يستخدم جدول `coupons` الحالي مع:
  - `discount_type = 'fixed_iqd'`
  - `discount_value = final_coupon_value`
  - `product_restriction = target_new_product_id`
  - `usage_limit = 1`, `user_id = requester`
- عند الشراء، نظام الكوبونات يتحقق من المنتج تلقائياً

### الملفات

**جديدة:**
- migration واحدة تشمل: 3 جداول + Storage bucket + RLS + GRANTs + seed rules افتراضية
- `src/lib/tradeInPricing.ts` + tests
- `src/components/tradein/TradeInRequestDialog.tsx`
- `src/pages/MyTradeInRequests.tsx`
- `src/pages/AdminTradeInPrinters.tsx`
- `src/pages/AdminTradeInRequests.tsx`
- `src/hooks/useTradeInEligibility.ts`

**معدلة:**
- `src/App.tsx` — routes الجديدة
- `src/pages/ProductShop.tsx` (أو تفاصيل المنتج) — بانر Trade-In
- `src/components/rewards/panels/MyPrintersPanel.tsx` — زر استبدال
- `src/lib/i18n/{ar,en,ku}.ts` + `types.ts` — مفاتيح ترجمة
- Admin Hub — روابط الصفحتين الجديدتين

### التفاصيل التقنية
- الصور تُرفع لـ `trade-in-uploads/{user_id}/{request_id}/*`
- إشعارات: عند تغيير الحالة يُرسل notification للمستخدم
- التقدير التلقائي محسوب عميلاً + سيرفراً (RPC `estimate_trade_in_value`) لمنع التلاعب
- إصدار الكوبون عبر RPC `admin_issue_trade_in_coupon` (SECURITY DEFINER، admin-only) لضمان الاتساق
- كل حقول الأسعار بالدينار العراقي، تقريب لأقرب 250 IQD