# تقرير تدقيق الأداء — Levonis

فحصت المشروع (701 ملف ts/tsx، ~229k سطر) بدون أي تعديل. هذه أهم الاختناقات الحقيقية المرتبطة بأولوياتك: **بطء التنقل، بطء التحميل الأول، تقطّع الديالوجات/الأنيميشن، تقطّع السكرول**.

---

## 1) أهم الاختناقات المُكتشفة

### أ. Provider Tree أحادي (يسبب re-render لكل التطبيق)

`src/App.tsx` يغلّف كل شيء بسلسلة: `PersistQueryClient → TooltipProvider → LanguageProvider → AuthProvider → CartProvider → IslandProvider → PageSearchProvider → ProfileTransitionProvider`.

- `CartProvider` (`src/hooks/useCart.tsx` – 1303 سطر، 50+ استخدام `useState/useEffect/subscribe`) يحمل حالة ضخمة **وقيمة السياق غير مُقسَّمة ولا `useMemo`ة**. أي تغيير في عنصر واحد بالسلة يُعيد رندر كل شجرة التطبيق.
- `AuthProvider` يمرّر كائناً جديداً كل رندر (`{ user, session, loading, isAdmin, ... }` بدون `useMemo`).
- `LanguageProvider` `t` مُغلَّف بـ`useCallback` جيد، لكن `value` نفسها ليست `useMemo`.
- **الأثر:** كل صفحة، كل زر، كل قائمة تُعاد رندرتها عند أي تحديث سلة/جلسة realtime.

### ب. Bundle أولي مضخّم رغم وجود Lazy

- في `App.tsx` 139 استخدام `lazy()` (جيد)، لكن `PersistQueryClient` + `framer-motion` (27 ملف) + `mapbox-gl` + `recharts` + `html2canvas` + `jspdf` + `three` + `@react-three/drei` + `html5-qrcode` كلها مذكورة في dependencies. بعضها يُستورد بشكل static من صفحات lazy، لكن يجب التأكد أنها لا تدخل vendor chunk الرئيسي.
- `vite.config.ts` يستخدم `manualChunks` بسيط يضع **كل** `node_modules` في chunk واحد اسمه `vendor` → chunk واحد ضخم يُحمّل قبل أي صفحة.
- ملفات i18n ضخمة: `ar.ts` + `en.ts` + `ku.ts` = ~7200 سطر تُحمَّل كلها فوراً عبر `LanguageProvider`.

### ج. مؤقتات ومستمعون كثر

- 65 استدعاء `window/document.addEventListener` عبر المشروع.
- 31 `setInterval` (heartbeat, realtime price sync, warranty, notifications…). بعضها يعمل حتى في الخلفية.
- `ScrollRestoration` يحفظ الموقع في كل frame أثناء السكرول + `pagehide` + `visibilitychange` — سليم منطقياً لكن يضيف ضغطاً.
- `scrollPerformance.ts` يضيف 4 مستمعين capture (scroll/wheel/touchmove/touchstart) — مقبول لكنه مكرَّر مع `ScrollRestoration`.

### د. React Query مضبوط جيداً لكن بلا prefetching

- `staleTime: 10min`, `gcTime: 24h`, `refetchOnWindowFocus: false` ✅ جيد.
- لا يوجد `prefetchQuery` عند hover على روابط التنقل → الصفحة الجديدة تبدأ التحميل من الصفر عند الوصول.

### هـ. الصور

- 216 وسم `<img>`، **203 منها بلا `loading="lazy"` ولا `decoding="async"**`.
- لا يوجد استخدام واضح لـ `fetchpriority="high"` لصورة الـ LCP في الصفحة الرئيسية.
- لا يوجد `vite-imagetools` أو avif/webp variants.

### و. الديالوجات والأنيميشن

- 27 ملف يستخدم `framer-motion`. `AnimatePresence` مع `layout` animations يسبب reflows في القوائم الطويلة.
- `Glassmorphism Professional` (81 استخدام `backdrop-blur` في `index.css` وحده) — على Android/webview هذه أغلى عملية GPU. عندك بالفعل `is-scrolling` لتعطيلها أثناء السكرول (جيد)، لكنها فعّالة عند فتح كل ديالوج/قائمة.
- خطأ في console: `PopChild ref warning` من framer-motion → إصدار قديم أو استخدام غير صحيح.

### ز. Three.js

- 10 ألعاب r3f. `CrossyRoad3DScene` 1210 سطر. لا فحص لـ `frameloop="demand"` عند عدم الحاجة → GPU يعمل باستمرار حتى لو اللعبة متوقفة.

### ح. ملفات ضخمة (صيانة وأداء رندر)

`Admin.tsx` 4948، `Cart.tsx` 4276، `ListingConversations.tsx` 2603، `AdminOrders.tsx` 2344، `ProductDetail.tsx` 1577، `useCart.tsx` 1303. أي تحديث state فيها = رندر ضخم.

---

## 2) خطة التنفيذ المقترحة (على 4 دفعات آمنة)

كل دفعة قابلة للاختبار مستقلة، ولا تلمس منطق الأعمال ولا Supabase ولا التصميم.

### الدفعة 1 — مكاسب سريعة عالية الأثر (منخفضة المخاطر)

1. **تحسين `manualChunks**` في `vite.config.ts`: فصل `react-vendor`, `radix`, `framer-motion`, `three`, `mapbox`, `recharts`, `jspdf+html2canvas`, `supabase` إلى chunks مستقلة → التحميل الأول ينزل bundle واحد صغير فقط.
2. **useMemo لقيم Contexts**: تغليف `value` في `AuthProvider` و`LanguageProvider` و`CartProvider` بـ`useMemo` — يمنع re-renders غير ضرورية بدون أي تغيير سلوك.
3. `**loading="lazy" decoding="async"**` على كل `<img>` غير LCP (203 عنصر) عبر codemod آمن.
4. `**fetchpriority="high"**` لصورة الهيرو في `Home.tsx`.

**الأثر المتوقع:** −30–45% JS أولي، −20–30% وقت التنقل، تحسّن ملموس في السكرول على الصفحات الغنية بالصور.

### الدفعة 2 — تحسين التنقل (متوسطة المخاطر)

1. **Route prefetch on hover/visible link** عبر hook خفيف يستدعي `import()` للـchunk المطابق للـpath عند hover/focus.
2. **تقسيم `LanguageProvider**`: تحميل ملف اللغة الحالية فقط ديناميكياً بدل الثلاثة (ar/en/ku) → توفير ~150KB.
3. **Suspense fallback موحّد** بدل مزيج `null` و`Loading...` — يمنع flash أثناء الانتقال.

**الأثر المتوقع:** التنقل بين الصفحات يصبح شبه فوري بعد أول hover.

### الدفعة 3 — Cart/Auth Context Split (متوسطة–عالية المخاطر، تحت اختبار)

1. تقسيم `CartContext` إلى `CartDataContext` (العناصر) و`CartActionsContext` (الدوال) — الأزرار التي تستدعي الدوال فقط لن تُعاد رندرتها عند تغيّر العناصر.
2. نفس النمط لـ`AuthContext` (`{user,session}` منفصل عن `{isAdmin,isAssistant}` عن `{signOut}`).
3. إضافة `React.memo` للمكوّنات القائمة الطويلة (كروت المنتجات، صفوف السلة، صفوف الرسائل).

**الأثر المتوقع:** تخفيف re-renders الكاسحة عند تحديثات realtime.

### الدفعة 4 — أنيميشن، Three.js، صيانة (اختيارية)

1. `frameloop="demand"` على Canvas الألعاب عند pause/تركيز خارج اللعبة.
2. مراجعة `AnimatePresence layout` — استبدال `layout` animations بـ `transform`-only حيث لا يظهر فرق بصري.
3. تقليل نطاق `backdrop-blur` في القوائم الطويلة (استخدام blur خفيف + شبه شفافية على العناصر النائبة).
4. تقسيم `Admin.tsx` (4948) و`Cart.tsx` (4276) إلى ملفات منطقية — بدون تغيير سلوك.

---

## 3) القسم التقني (للمرجع)

- QueryClient defaults: staleTime 10m/gcTime 24h جيد، لا يحتاج تغيير.
- `useAuth.tsx`: hard-timeout 3s وإعادة تعيين localStorage عند فشل الجلسة — إبقاؤه.
- `ScrollRestoration.tsx`: منطق سليم، فقط استبدال `requestAnimationFrame` المتكرر بـ throttled save كل 150ms.
- Vite: `sourcemap: true` في production — قد يُبطئ البناء، بدون أثر runtime.

---

## 4) ما لن أفعله

- لا تغيير UI أو ألوان أو hero.
- لا تغيير في `useCart` logic (فقط تغليف القيمة).
- لا لمس `supabase/client.ts` أو `types.ts` أو `.env`.
- لا إزالة أنيميشن مرئي للمستخدم.

---

## اقتراحي هو

## الخطة التي أوصي بها

بدلاً من 4 دفعات، أقترح 5 مراحل مرتبة حسب العائد مقابل المخاطرة:

### المرحلة 1 (عائد مرتفع جدًا - مخاطرة منخفضة)

- تحسين `manualChunks`.
- `useMemo` لقيم جميع الـ Contexts.
- Lazy loading و`decoding="async"` للصور.
- تحميل ملف اللغة الحالي فقط.
- إصلاح الـ LCP.

### المرحلة 2

- استخدام `React.memo`.
- تحسين `useCallback`.
- تحسين `useMemo` داخل الصفحات الكبيرة.
- إزالة إعادة الرندر غير الضرورية.

### المرحلة 3

- تطبيق Virtualization على القوائم الطويلة.
- تحسين التنقل مع Prefetch ذكي.
- تحسين `Suspense`.

### المرحلة 4

- تحسين Framer Motion.
- تحسين Three.js.
- مراجعة أحداث `scroll` و`resize`.
- إصلاح أي Layout Thrashing.

### المرحلة 5

- تقسيم `CartContext`.
- تقسيم `AuthContext`.
- إعادة هيكلة الملفات الكبيرة.