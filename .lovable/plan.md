# تحسين أداء `StoreBackgroundLayer`

## الأهداف
1. منع إعادة الرندر غير الضرورية عندما يعيد الأب الرندر بنفس الـ props.
2. تحميل صور الخلفية بكفاءة (decoding غير متزامن + lazy) لتجنّب توقّف الـ paint.
3. ضمان عدم وجود تسرّب ذاكرة عند تبديل الخلفيات بسرعة (إلغاء طلبات `Image` المعلّقة).

## التغييرات (ملف واحد فقط: `src/components/merchant/StoreBackgroundLayer.tsx`)

### 1. تغليف المكوّن بـ `React.memo`
نقل المنطق إلى `StoreBackgroundLayerImpl` ثم تصدير `memo(StoreBackgroundLayerImpl)`.
الأب (`CommunityMerchantStorePage`) يعيد الرندر كثيراً بسبب `useQuery` و `useState`؛ مع `memo` لن يُعاد رندر طبقة الخلفية ما لم تتغير `type`/`value`/`blur` فعلياً.

### 2. تحويل بناء الستايل إلى `useMemo`
حالياً ينشئ `bgStyle` و كائنات الـ `style` عند كل رندر، مما يكسر مرجعية الكائن ويُعيد تطبيق الـ inline style. سيتم:
- `useMemo` لـ `bgStyle` (يعتمد على `type`, `value`, `decodedUrl`).
- `useMemo` لـ `veilStyle` (يعتمد على `safeBlur` فقط).
- `useMemo` لـ `vignetteStyle` (ثابت — يُحسب مرة).
- نقل ثابتي `GLASS_DEFAULT_BG` و `VIGNETTE_BG` خارج المكوّن (module scope) لمنع إعادة بنائهم.

### 3. تحسين الـ vignette
استبدال كلاس Tailwind المُولِّد لقيمة `bg-[radial-gradient(...)]` بـ inline style ثابت، لتفادي توليد كلاس عشوائي عند كل تغيير viewport.

### 4. إضافة `will-change: backdrop-filter` للطبقة الزجاجية
تضمن لطبقة الـ blur أن تُرفع إلى compositor layer مستقلة بدلاً من إعادة طلائها عند كل scroll/animation للأب.

### 5. تحميل ذكي للصور عبر hook جديد `useDecodedImage`
- يستخدم `Image` خارج DOM مع `decoding="async"` و `loading="lazy"` و `img.decode()` لفك ترميز الصورة خارج الـ main thread.
- لا يطبّق `backgroundImage` على DOM إلا بعد نجاح الـ decode → لا يحدث paint blocking.
- يحتفظ بآخر URL في `useRef` ليتخطى العمل عندما يعيد الأب الرندر بنفس الـ URL.
- في `cleanup`: يضع علم `cancelled = true` ويُفرغ `img.src = ""` ويُصفّر الـ handlers لإلغاء الطلب وتحرير البتماب من الذاكرة فوراً عند:
  - فك تركيب المكوّن.
  - تغيير الـ URL أثناء التحميل (مهم: عندما يجرّب التاجر صور متعددة بسرعة من معاينة الإعدادات).
- أثناء فك ترميز الصورة الجديدة، يبقي الخلفية الزجاجية الافتراضية لتجنّب وميض/فراغ.

### 6. تجاهل الـ effect عند عدم الحاجة
يتم تمرير `null` للـ hook عندما `type !== "image"` بحيث لا يبدأ أي تحميل في وضع color/gradient/glass.

## النتائج المتوقّعة
- صفر إعادات رندر للطبقة عند تنقّل المستخدم/فتح ديالوجات في صفحة المتجر.
- صفر paint كبير عند تبديل صورة الخلفية (الـ decode يحصل قبل التطبيق).
- صفر تسرّب ذاكرة عند تجربة عدة صور بسرعة من إعدادات المتجر.
- أنعم scroll لأن الـ blur layer أصبحت compositor layer مستقلة.

## ملاحظات
- لا تغييرات على API المكوّن — نفس الـ props ونفس الاستخدام في `CommunityMerchantStorePage` و `StoreProfileEditor`.
- لا حاجة لتغييرات على قاعدة البيانات أو ملفات أخرى.
