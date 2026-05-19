# خطة إصلاح دقة وسرعة الاستخراج وشفافية السعر — `/community/auto-levo`

## التشخيص (ما اكتشفته فعلياً)

اختبرت الرابط الذي قدمته: `https://www.printables.com/model/1434993-skeleton-hand-bookstop`

1. **محرّك MakerWorld OpenAPI لا يعمل على Printables** — هو خاص بـ makerworld.com فقط، فيسقط الكود مباشرة على Firecrawl/HTML scraping.
2. **Printables تحجب طلبات curl (403)** بدون User-Agent متصفح حقيقي — لذلك `tryFetchScrape` يفشل غالباً، ويعتمد على Firecrawl + AI fallback، وهنا تحصل الأخطاء.
3. **Printables عندها GraphQL API عام مجاني** (`https://api.printables.com/graphql/`) لم يُستخدم إطلاقاً في الكود الحالي. الحقول المتاحة:
   - `print.printDuration` / `weight` / `usedMaterial` (قد تكون null لبعض النماذج)
   - `userGcodePrintDurationMin/Max` و `userGcodeWeightMin/Max` و `userGcodeMaterials` (مصفوفة IDs للمواد)
   - `mmu` (Boolean: multi-material أم لا)
   - `materials { name }` لقائمة الفلامنت
4. **سبب أخطاء "120g/3 ألوان"**: لأن المستخرج الحالي يقرأ أول رقم بـ "g" يجده في HTML (قد يكون من إعلان جانبي/profile مختلف)، ويعدّ "الألوان" بناءً على ذكر كلمات لون في الوصف لا بناءً على بيانات G-code الفعلية.
5. **شفافية السعر**: لا يوجد breakdown ظاهر للمستخدم (وزن × سعر/غ + وقت × أجرة/ساعة + هامش + تقريب)، فقط الرقم النهائي.

## الإصلاحات

### 1) محرّك Printables الرسمي عبر GraphQL (دقة الأرقام)
في `supabase/functions/print-quote-from-link/index.ts`:
- إضافة `tryPrintablesPublic(url)` يُستدعى **قبل** Firecrawl/AI لأي رابط printables.com.
- يستخرج ID النموذج من المسار (`/model/{id}-…`).
- يستعلم GraphQL ويعيد:
  - `estimatedWeight` = `print.weight` ?? متوسط(`userGcodeWeightMin/Max`) ?? null
  - `printTime` (دقائق) = `print.printDuration/60` ?? متوسط min/max
  - `colorCount` = `mmu ? max(materials.length, userGcodeMaterials.length, 2) : 1`
  - عنوان، صاحب النموذج، صورة (من `previewFile`)، tags
- `engineUsed = "printables-public"` مع `confidence: high`.
- رفع `ANALYZER_VERSION` من 4 → **5** لتجاوز الكاش القديم الخاطئ.

### 2) تحسين دقة الـ HTML fallback (للنماذج التي ليس لها بيانات في API)
- إضافة Next.js `__NEXT_DATA__` parser لـ Printables (يحوي نفس بيانات GraphQL).
- إزالة عدّ الألوان من الوصف الحر؛ الاعتماد فقط على `mmu`/materials.
- مطابقة الوزن بنمط أكثر صرامة: `/(\d{2,4})\s*g\s*(?:filament|of\s+filament|used)?/i` مع التحقق أن الرقم بين 20–10000.

### 3) تسريع الاستجابة
- تقليل عدد محاولات `fetchHtmlRotating` من 3 → 2 لـ Printables (لأن المحرّك الجديد لا يحتاجها).
- موازاة استدعاء GraphQL + جلب صفحة OG metadata (للصورة) عبر `Promise.all`.
- تقصير TTL للكاش الخاطئ: إذا كان `confidence === "low"` نخزّن لمدة 1 يوم فقط بدلاً من 7.
- إضافة timeout صريح 8 ثوانٍ لكل محرّك حتى لا يعلق Firecrawl طويلاً.

### 4) شفافية السعر (UI)
في `src/components/community/QuoteResultCard.tsx`:
- إضافة قسم قابل للطي "تفاصيل الحساب" يعرض:
  ```
  الفلامنت:   543g × 90 IQD/g  = 48,870
  وقت الطباعة: 12.1h × 1,500   = 18,150
  هامش الجودة: +10%             = 6,702
  ─────────────────────────────────
  الإجمالي قبل التقريب:        73,722
  بعد التقريب لـ 250 IQD:      73,750
  ```
- إضافة شارة "مصدر البيانات: Printables API" بجانب السعر لزيادة الثقة.
- إذا `confidence === "low"`، تظهر رسالة "قد لا تكون الأرقام دقيقة — راجع المصدر" + رابط مباشر للصفحة الأصلية.

### 5) اختبار التحقق
بعد النشر: اختبار الرابط مرة أخرى يجب أن يُعيد:
- الوزن ≈ 200–210g (أو range إن وُجد)
- الوقت ≈ 12h
- الألوان = 1 (لأن `mmu = false` في هذا النموذج)
- engine = `printables-public`

## الملفات المتأثرة
- `supabase/functions/print-quote-from-link/index.ts` (إضافة محرّك Printables، رفع version، تسريع)
- `src/components/community/QuoteResultCard.tsx` (breakdown السعر + badge المصدر + ثقة)
- `src/i18n/{ar,en,ku}.ts` (مفاتيح "تفاصيل الحساب"، "مصدر البيانات"، إلخ)

## ما لن أغيّره
- منطق التسعير نفسه (المعدلات والهامش) — فقط طريقة عرضه.
- تصميم الزجاج (glassmorphism) الحالي — يبقى كما هو.
