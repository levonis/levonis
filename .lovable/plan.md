

## فتح/إغلاق النوافذ كأنها توسعة من الزر (Origin-Expand Animation)

بدلاً من ظهور النوافذ المنبثقة في وسط الشاشة بشكل مفاجئ، ستفتح كأنها تنمو من البطاقة المضغوطة في الـ Header (التوفير، المحفظة، الكوبونات)، وتنكمش للعودة إليها عند الإغلاق — تأثير مشابه لـ Dynamic Island / iOS App Open.

### الفكرة التقنية
- التقاط إحداثيات الزر المضغوط (`getBoundingClientRect`) لحظة النقر، وتمريرها للنافذة كـ "نقطة أصل".
- استبدال `Dialog` (Radix) في الـ popups الثلاثة بطبقة `motion.div` (framer-motion موجود مسبقاً في المشروع) مع `transform-origin` محسوب وانيميشن `scale` + `opacity`.
- عند الفتح: تبدأ النافذة من حجم/موقع الزر الصغير (`scale ~0.15`، `x/y` للـ origin) وتنمو إلى الحجم الطبيعي مع opacity من 0 → 1.
- عند الإغلاق: العملية العكسية فينكمش النافذة للزر نفسه قبل أن تختفي.
- Backdrop ضبابي يتلاشى بسلاسة (fade) متزامناً.
- المحتوى الداخلي (rendered كما هو) يتلاشى/يكبر مع الحاوية.

### الملفات المعدّلة

**1. مكوّن جديد: `src/components/profile/OriginExpandShell.tsx`**
- يستقبل `open`, `onOpenChange`, `originRect` (DOMRect أو null), `children`, `title?`.
- يرندر:
  - `AnimatePresence` + backdrop (fixed inset-0, bg-black/40 backdrop-blur-sm, fade in/out).
  - حاوية النافذة (fixed، centered، max-w-md، rounded-3xl، glass) مع:
    - `initial`: `{ opacity: 0, scale: originScale, x: originX - centerX, y: originY - centerY }`
    - `animate`: `{ opacity: 1, scale: 1, x: 0, y: 0 }`
    - `exit`: نفس الـ initial
    - `transition`: spring ناعم (`stiffness: 320, damping: 32, mass: 0.9`).
  - زر إغلاق (X) في الزاوية.
  - حاوية scrollable للمحتوى.
- يحسب `transformOrigin` ديناميكياً من `originRect` ليبدو كأن النافذة تخرج من الزر فعلاً.
- يدعم إغلاق بالنقر على الـ backdrop وبزر Escape.

**2. `src/components/profile/ProfileHeader.tsx`**
- إضافة `useRef<HTMLButtonElement>` لكل زر من الأزرار الأربعة في `stats`.
- إضافة `originRect` state يلتقط `rect` الزر عند النقر، ويُمرَّر للـ popup.
- تمرير `originRect` إلى:
  - `<WalletDialog ... originRect={walletOrigin} />`
  - `<SavingsPopup ... originRect={savingsOrigin} />`
  - `<CouponsPopup ... originRect={couponsOrigin} />`

**3. `src/components/profile/SavingsPopup.tsx`**
- استبدال `<Dialog><DialogContent>` بـ `<OriginExpandShell originRect={originRect} title="التوفير الخاص بك">`.
- نقل المحتوى الحالي (الإجمالي، التفصيل، القائمة) داخل الـ shell كما هو.

**4. `src/components/profile/CouponsPopup.tsx`**
- نفس استبدال `Dialog` بـ `OriginExpandShell`.
- الاحتفاظ بـ `Sheet` الداخلي للـ Discount Detail كما هو (ليس المقصود في الطلب).

**5. `src/components/WalletDialog.tsx`**
- استبدال الـ `Dialog` الخارجي فقط بـ `OriginExpandShell` مع تمرير `originRect`.
- باقي محتوى المحفظة (Tabs، Forms، إلخ) يبقى كما هو.

### تفاصيل الانيميشن
- المدّة الكلية ~280ms للفتح، ~220ms للإغلاق (spring tuned).
- `transformOrigin` يُحسب كنسبة مئوية من حدود النافذة بناءً على موقع الزر، ليبدو النمو طبيعياً (إذا كان الزر يسار أسفل، النافذة تنمو من زاويتها اليسرى السفلية).
- backdrop ينتقل بـ fade منفصل (200ms ease-out) لتجنب وميض.
- `prefers-reduced-motion`: تعطيل الـ scale ويُستبدل بـ fade بسيط.

### بدون تغييرات
- زر النقاط (Points) لا يفتح Popup أصلاً (ينتقل إلى `/rewards`)، لا تعديل عليه.
- منطق البيانات (queries, mutations) في الـ popups دون تعديل.
- Sheet داخلي في `CouponsPopup` (تفاصيل الخصم) يبقى كما هو.
- لا تغيير على ProfileExpansionShell أو الـ Orb transition الحالي.

