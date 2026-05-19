
# نظام استخراج بيانات النماذج ثلاثية الأبعاد من الروابط

## نظرة عامة
تطوير `print-quote-from-link` الحالية إلى نظام إنتاجي شامل يستخرج بيانات النموذج من MakerWorld/Printables/Thingiverse، يحسب التسعير في نفس النداء، مع كاش وتحليلات أدمن.

## 1) المنصات المدعومة وأنماط الروابط
- MakerWorld: `makerworld.com/{lang}/models/{id}` — سيُجرَّب OpenAPI الرسمي أولاً (إن توفر مفتاح)
- Printables: `printables.com/{lang}/model/{id}-{slug}`
- Thingiverse: `thingiverse.com/thing:{id}`
- روابط أخرى → تُمرَّر مباشرة لـ Firecrawl كـ generic

## 2) منطق الاستخراج الهجين (Cascade 3 مستويات)

```text
┌──────────────────────────────────────────┐
│ POST /functions/v1/print-quote-from-link │
└────────────┬─────────────────────────────┘
             ↓
   [1] فحص الكاش (print_url_cache, age < 7d, url_hash=sha256)
             ↓ miss
   [2] MakerWorld OpenAPI (إن كان مكرويرلد + مفتاح موجود)
             ↓ fail/skip
   [3] Firecrawl scrape (formats: markdown + json schema + screenshot)
             ↓ fail/blocked
   [4] fetch + Cheerio (HTML parsing مع rotating headers)
             ↓ low-confidence
   [5] AI fallback (Lovable AI: google/gemini-3-flash-preview)
             ↓
   [6] احتساب التسعير (print_materials + machine_profiles + quote_pricing)
             ↓
   [7] حفظ في الكاش + إدراج analytics row
             ↓
   إرجاع JSON موحّد
```

كل مستوى يضيف للحقول الموجودة ولا يستبدلها. `confidenceLevel` يُحسب من عدد الحقول المؤكدة:
- `high` (≥85%): OpenAPI أو Firecrawl JSON كامل
- `medium` (50–84%): scraping ناجح لكن ينقص filament/printTime
- `low` (<50%): AI تقدير فقط

## 3) شكل الـ JSON الموحّد

```json
{
  "sourcePlatform": "makerworld|printables|thingiverse|other",
  "title": "string",
  "creator": { "name": "string", "url": "string" },
  "description": "string (markdown, max 4000 chars)",
  "images": ["url1","url2"],
  "thumbnail": "url",
  "tags": ["..."],
  "category": "string",
  "stats": { "downloads": 0, "likes": 0, "prints": 0 },
  "printProfiles": [
    { "name": "0.20mm Standard", "filamentG": 42.5, "printMinutes": 215, "layerHeight": 0.2, "infill": 15, "supports": false, "ams": false }
  ],
  "bambuCompatible": true,
  "estimatedWeight": 42.5,
  "printTime": 215,
  "complexityScore": 67,
  "confidenceLevel": "high|medium|low",
  "source": { "engine": "firecrawl|openapi|fetch|ai", "scrapedAt": "ISO" },
  "pricing": {
    "materialCode": "PLA",
    "weightG": 42.5,
    "basePriceIqd": 8000,
    "platformFeeIqd": 136,
    "finalPriceIqd": 8250,
    "currency": "IQD"
  }
}
```

## 4) قاعدة البيانات (Migration)

### `print_url_cache` (تحديث للجدول الموجود)
```text
id uuid pk
url_hash text unique (sha256 الرابط بعد التطبيع)
source_url text
platform text  (makerworld|printables|thingiverse|other)
analysis_payload jsonb  (الـ JSON الكامل أعلاه)
extraction_engine text  (openapi|firecrawl|fetch|ai)
confidence_level text
cached_until timestamptz  (NOW + 7 days)
created_at, updated_at
```
RLS: قراءة عامة (anon)، كتابة service_role فقط (تتم من الـ edge function).

### `print_url_analytics` (جديد)
```text
id uuid pk
url_hash text  (FK soft to cache)
source_url text
platform text
user_id uuid nullable  (auth.uid)
engine_used text
confidence_level text
cache_hit boolean
duration_ms int
converted_to_request boolean default false  (true لو أنشأ طلب طباعة بعدها)
created_at timestamptz
```
RLS: insert من المستخدمين المصادَقين، select للأدمن فقط.

### Index على `(platform, created_at desc)` و `(url_hash, created_at desc)` للوحة التحليلات.

## 5) Edge Functions

### تحديث `print-quote-from-link/index.ts`
- استقبال `{ url, materialCode? }`
- توحيد الرابط (إزالة UTM/تطبيع language locale)
- حساب `url_hash`
- تنفيذ الـ cascade أعلاه
- استدعاء داخلي لمنطق التسعير (إعادة استخدام كود `price-3d-model`)
- كتابة الكاش + analytics
- إرجاع JSON الموحّد + `cacheHit: true|false`

أدوات داخلية في نفس الملف:
- `parseMakerWorldOpenApi(id)` — لو `MAKERWORLD_API_KEY` موجود
- `scrapeWithFirecrawl(url)` — يطلب formats: `markdown`, `json` (مع schema للحقول المطلوبة), `screenshot`
- `scrapeWithFetch(url, platform)` — rotating User-Agent من قائمة 8 متصفحات، retry 3 مرات مع backoff، cheerio selectors لكل منصة
- `aiEstimate(partialData, url)` — Lovable AI لتعبئة الفجوات (وزن/زمن/تعقيد فقط، لا يخترع عنوان)
- `computeComplexity({ printMinutes, filamentG, tagCount, supports })`

### مفاتيح مطلوبة (يطلبها الأدمن لاحقاً عند الحاجة)
- `FIRECRAWL_API_KEY` — موجود مسبقاً عبر الـ connector، نتأكد منه
- `MAKERWORLD_API_KEY` — اختياري؛ لو ناقص يتم تخطي المستوى 2 بصمت

## 6) لوحة التحليلات للأدمن

### صفحة جديدة: `src/pages/AdminUrlAnalytics.tsx`
- مسار: `${ADMIN_BASE_PATH}/url-analytics` (تسجيل في `App.tsx` + `adminConfig.ts` + `Admin.tsx`)
- بطاقات KPIs: إجمالي التحليلات، Cache Hit Rate، متوسط الزمن، Conversion Rate (تحليل → طلب طباعة)
- جدول "أكثر النماذج تحليلاً" (group by url_hash, count desc)
- مخطط Pie/Bar لتوزيع المنصات
- مخطط Line آخر 30 يوم
- فلاتر: المنصة، نطاق التاريخ، مستوى الثقة

كل البيانات عبر `supabase.rpc('get_url_analytics_summary', {...})` للأداء.

### تتبع التحويل (Conversion)
- عند إنشاء طلب طباعة من نتيجة تحليل، يُرسل العميل `url_hash` المرتبط
- edge function تُحدّث `converted_to_request=true` في آخر سطر analytics لنفس `(user_id, url_hash)`

## 7) واجهة المستخدم (تعديل بسيط فقط)

تعديل `src/pages/CommunityQuoteFromLink.tsx` و `QuoteResultCard.tsx`:
- إضافة شارة `confidenceLevel` (high/medium/low) باللون الأخضر/الأصفر/الأحمر مع tooltip
- عرض `creator.name` + `stats.downloads` + `stats.likes` بشكل خفيف فوق العنوان
- عرض dropdown `printProfiles` لو وُجد أكثر من واحد لإعادة احتساب السعر
- شارة "محفوظ من الكاش" خفيفة لو `cacheHit=true`
- لا تغيير على تبويب "ملف" (Web Worker) الموجود

## 8) الحماية من إساءة الاستخدام
- التحقق من JWT في الـ edge function (Lovable Cloud verify_jwt = true)
- ضغط في الذاكرة: Map داخل الـ edge function (TTL 30s) لمنع نفس المستخدم من ضرب نفس الـ URL أكثر من مرة في 30 ثانية
- Zod validation لـ `{ url: z.string().url().max(2048), materialCode: z.string().regex(/^[A-Z]{2,8}$/).optional() }`

## 9) خارج النطاق
- تشغيل Puppeteer/Playwright فعلي (لا يعمل في Edge Functions؛ نستبدله بـ Firecrawl وهو نفس الجودة بدون بنية تحتية)
- استخراج ملفات STL من الرابط مباشرة (الإستخدام يبقى للروابط فقط، الملف للتبويب الثاني)
- تخزين الصور محلياً (نستخدم روابط CDN الأصلية)

## 10) خطة التنفيذ بالتسلسل
1. Migration لـ `print_url_cache` (update) + `print_url_analytics` (new) + RPC `get_url_analytics_summary`
2. تحديث `supabase/functions/print-quote-from-link/index.ts` بالـ cascade الكامل
3. تعديل خفيف على `CommunityQuoteFromLink.tsx` + `QuoteResultCard.tsx` لشارات الثقة والمنشئ
4. صفحة `AdminUrlAnalytics.tsx` + تسجيلها في الراوتر والـ admin nav
5. ربط `converted_to_request` بعد إنشاء طلب الطباعة

## أسئلة معلّقة (يمكن الإجابة بعد الموافقة)
1. هل تريد لوحة التحليلات الآن أم لاحقاً (لتقليل حجم هذه المرحلة)؟
2. هل لديك بالفعل `MAKERWORLD_API_KEY` لإضافته كـ secret، أم نتخطى مستوى OpenAPI ونعتمد Firecrawl فقط؟
