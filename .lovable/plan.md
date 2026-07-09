## المشكلة

على متصفحات الهاتف (Chrome Android / Safari iOS)، حين يبدّل المستخدم إلى تبويب آخر ثم يعود بعد ثوانٍ قليلة، الصفحة تعمل **Refresh كامل**، فتُغلق كل النوافذ المفتوحة (Dialog / Sheet / Popover) ويفقد المستخدم موضعه.

## السبب الجذري

تبويب الويب في المتصفحات الحديثة يجب أن يدخل **bfcache** (back/forward cache) لكي يبقى في الذاكرة عند التبديل ويُستأنف فوراً بدون إعادة تحميل. الاتصالات الحية التالية في المشروع **تُعطّل bfcache** فيقرر المتصفح تحرير التبويب من الذاكرة، وعند العودة يفتح الصفحة من الصفر:

1. **Supabase Realtime WebSockets** — 3 قنوات في `useCart` (`cart-items-*`, `cart-products-*`, `cart-rf-global-*`) تُبقي WebSocket مفتوحاً. أي WebSocket نشط = طرد فوري من bfcache على Chrome/Safari.
2. **`useOnlineHeartbeat`** — يرسل نبضات دورية.
3. لا يوجد تعامل مع حدث `pageshow` لاستئناف الحالة عند استرجاع bfcache حين ينجح، ولا لإعادة الاشتراك بالقنوات عند إعادة التحميل.

النافذة تختفي لأن كل حالة React (مثل `open` في Dialog) تُبنى من الصفر مع reload.

## الحل

### 1) قطع الاتصالات الحية عند إخفاء التبويب (يجعله مؤهّلاً لـ bfcache)

في `src/hooks/useCart.tsx` للقنوات الثلاث:
- الاستماع لـ `visibilitychange`: عند `document.hidden === true` → `supabase.removeChannel(ch)` وحفظ العلامة `needsResubscribe`.
- عند `visible` مجدداً → إعادة إنشاء القناة من نفس المفاتيح + `queryClient.invalidateQueries` للسلة (يعوّض أي تغييرات فاتت).

في `src/hooks/useOnlineHeartbeat.ts`:
- إيقاف مؤقت `setInterval` عند `hidden`، واستئنافه عند `visible`.

### 2) دعم استعادة bfcache صراحةً

إنشاء `src/hooks/useBFCacheRestore.ts` يستمع لحدث `pageshow`:
- إن كان `event.persisted === true` (استُرجعت الصفحة من bfcache) → `queryClient.invalidateQueries()` لتحديث البيانات الطازجة، دون تفريغ حالة الواجهة (النوافذ تبقى مفتوحة كما كانت).
- استخدامه مرة واحدة في `App.tsx`.

### 3) الحفاظ على حالة الحوارات الحرجة حين يتعذّر bfcache

بعض حالات المتصفحات (ضغط الذاكرة الشديد، iOS مع صور كبيرة) لا تسمح بـ bfcache حتى بعد الإصلاحات السابقة. للحد الأدنى من الأذى:
- إضافة دالة مساعدة صغيرة `src/lib/dialogStatePersist.ts` تحفظ في `sessionStorage` حالة (open + معرّف السياق) للنوافذ الطويلة (السلة – خطوة تأكيد الطلب، نافذة تفاصيل المنتج القادمة من deep link) لتُفتح تلقائياً عند إعادة التحميل الفوري.

### 4) التحقق

- تشغيل الموقع في مقاس موبايل مع أدوات DevTools ← Application ← Back/forward cache: التأكد من ظهور "Restored from back/forward cache" بعد الإصلاح بدل قائمة أسباب الرفض.
- سيناريو Playwright: فتح Dialog في `/cart`، تبديل التركيز عبر `page.evaluate("document.dispatchEvent(new Event('visibilitychange'))")`، محاكاة `pageshow`، والتأكد أن Dialog لا يزال مفتوحاً وأن السلة تحدّث بياناتها.

## الملفات المتأثرة

- `src/hooks/useCart.tsx` — قطع/إعادة القنوات على visibilitychange (تعديل موضعي).
- `src/hooks/useOnlineHeartbeat.ts` — إيقاف المؤقت عند إخفاء التبويب.
- `src/hooks/useBFCacheRestore.ts` — جديد.
- `src/App.tsx` — استدعاء الهوك الجديد مرة واحدة.
- (اختياري لخطوة 3) `src/lib/dialogStatePersist.ts` + استعمال في `Cart.tsx`.

## ملاحظات

- لن أعدّل الـ backend ولا الـ RLS.
- لا تغيير للتصميم أو الترجمات.
- الإصلاح متوافق تماماً مع تطبيق Android داخل Capacitor (WebView) — نفس منطق التبويب المخفي ينطبق.

هل توافق على تنفيذ الخطة؟