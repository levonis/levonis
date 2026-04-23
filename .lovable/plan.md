

# Dynamic Island — توسّع ذكي وانسيابي للبحث (Apple-style)

تحويل الجزيرة من تغيّر حجم بسيط إلى **كائن حي واحد** يتنفّس ويتمدّد تدريجيًا حسب محتوى البحث: من كبسولة → حقل → اقتراحات → لوحة نتائج، مع morphing سلس وglass متواصل.

## المراحل الأربع للبحث

| المرحلة | الحجم | المحتوى |
|---|---|---|
| `idle` (عند الضغط على البحث) | 360 × 52 ، radius 26 | حقل بحث فارغ + أيقونة + ⌘K |
| `typing` (المستخدم يكتب) | 420 × 60 ، radius 26 | الحقل + زر مسح + شريط hint رفيع |
| `suggestions` (كلمات مقترحة) | 480 × 180 ، radius 28 | الحقل + قائمة 4-6 كلمات (تاريخ + اقتراحات حية) |
| `results` (نتائج منتجات) | 520 × 380 ، radius 30 | الحقل + شبكة 3-5 منتجات مصغّرة (صورة + اسم + سعر) + "عرض الكل" |

الانتقال بين المراحل يتم تلقائيًا داخل نفس الـ `motion.div` (نفس العنصر، لا swap)، فيشعر المستخدم بأنّ الجزيرة تتنفّس.

## السلوك التفاعلي

- **فتح**: نقر زر البحث أو الحقل → squash خفيف (scale 0.96) ثم expand بـ spring ناعم.
- **كتابة**: مع أول حرف → ينتقل تلقائيًا من `idle` → `typing` (ارتفاع +8px).
- **debounce 250ms**: بعد التوقّف عن الكتابة → `suggestions` تظهر بـ stagger بسيط (40ms بين العناصر).
- **عند توفّر نتائج فعلية من DB**: يرتقي إلى `results` تدريجيًا (الارتفاع يكبر، الاقتراحات تتلاشى مع slide-up خفيف، المنتجات تدخل بـ fade+slide).
- **مسح النص (X)**: يرجع إلى `idle` بسلاسة عكسية.
- **Esc / blur خارج الجزيرة / Escape**: تنطوي إلى الحالة الافتراضية للصفحة (`promo`/`category`/`product`).
- **اختيار اقتراح أو منتج**: morph قصير (squash) ثم navigate.

## مواصفات الحركة

- **Spring واحد موحّد**: `stiffness: 260, damping: 28, mass: 0.95` — ناعم بدون ارتداد.
- **Squash قبل التوسّع**: `scale` يبدأ من 0.97 لـ 80ms ثم يعود إلى 1 مع توسّع width/height — يحاكي تنفّس الجزيرة.
- **Animation متزامن**: `width` + `height` + `borderRadius` كلها داخل نفس `animate={}` بـ نفس `transition`.
- **المحتوى الداخلي**: بدلًا من `AnimatePresence mode="wait"` (يسبّب swap حاد للبحث)، نستخدم **layout** حقيقي مع `layout` prop لكل قسم داخلي (input, suggestions, results) — كل قسم يدخل/يخرج بـ `opacity` + `y: 6→0` خلال 220ms.
- **glass continuity**: الخلفية `island-surface` تبقى نفسها — لا تنفصل أبدًا. نستخدم `layoutId="island-shell"` للحفاظ على الاستمرارية البصرية.
- **Stagger**: العناصر داخل القوائم تتأخّر 35ms بين عنصر وآخر للحصول على cascade ناعم.

## مصادر البيانات

- **Suggestions**:
  1. آخر 5 عمليات بحث محلية من `localStorage` (`island_recent_searches`).
  2. أهم 4 منتجات مطابقة (اسم) من `products` بـ `ilike` على `name`/`name_ar` (limit 4).
- **Results**: 5 منتجات من نفس الاستعلام مع `image_url`, `name`/`name_ar`, `price` — مع احترام `scope` (في القسم: نرشّح بـ `category_id`؛ في المجتمع: نستعلم من `community_products`).
- استخدام `useQuery` بـ `enabled: query.length >= 2` و `staleTime: 30s`.

## الملفات المتأثّرة

| الملف | التعديل |
|---|---|
| `src/island/DynamicIsland.tsx` | إعادة بناء حالة `search` بأربع مراحل داخلية، morph موحّد، إضافة قوائم suggestions + results داخل نفس الـ motion shell. |
| `src/island/IslandContext.tsx` | لا تغيير وظيفي. (state يبقى `search`؛ المراحل الفرعية محلية في الكومبوننت.) |
| `src/island/useIslandSearch.ts` (جديد) | hook مخصّص: query state, debounce, recent searches, fetch suggestions + results عبر supabase حسب scope. |
| `src/index.css` | إضافة فئة `.island-search-row` و `.island-result-thumb` لتنسيق القوائم الداخلية بـ glass خفيف، وضمان `overflow: hidden` مع `border-radius` متغيّر. |
| `src/lib/i18n/types.ts` + `ar/en/ku.ts` | 5 مفاتيح: `island_recent`, `island_suggestions`, `island_results`, `island_view_all`, `island_no_results`. |

## ملاحظات تقنية

- **حساب الأحجام ديناميكيًا**: دالة `searchShape(stage, query, resultsCount)` ترجع `{width, height, radius}` بدلًا من جداول ثابتة، مع `clamp` على عرض الشاشة (`maxWidth: calc(100vw - 16px)`).
- **منع تجاوز الشاشة**: على الموبايل، `width` يصبح `min(calc(100vw - 24px), targetWidth)`.
- **إغلاق خارجي**: `useEffect` يستمع لـ `mousedown` خارج الـ ref + مفتاح `Escape`.
- **Accessibility**: `role="combobox"`, `aria-expanded`, `aria-controls` للحقل؛ `role="listbox"` للاقتراحات؛ تنقّل بالأسهم ↑↓ + Enter.
- **أداء**: المنتجات تُحمّل lazy؛ الصور بحجم 40×40 بـ `loading="lazy"`؛ debounce يمنع spam على Supabase.
- **التراجع عن السلوك القديم**: حالة `search` في `category`/`product` (زر العدسة) تفتح نفس الجزيرة الموسّعة بدلًا من توجيه فوري — تجربة موحّدة في كل الصفحات.

