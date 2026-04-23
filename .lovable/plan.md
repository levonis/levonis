` format inline instead.

<lov-plan>

## تحويل أيقونة ✨ في شريط الأخبار (الجزيرة) إلى زر يدخل `/wishes`

### الموقع
في `src/island/DynamicIsland.tsx` ضمن حالة `state === "promo"` (شريط الأخبار)، حول السطر 411، توجد أيقونة `<Sparkles />` قائدة. في تخطيط RTL تظهر على **يمين** الجزيرة — وهذا هو "الإيموجي الصغير" الذي يقصده المستخدم.

### التغيير
استبدال الأيقونة الثابتة بزرّ قابل للنقر:
- `<button type="button">` يلفّ نفس أيقونة `<Sparkles />` بنفس الحجم/اللون (`h-3.5 w-3.5 text-primary`).
- يستدعي `navigate("/wishes")` عند النقر (الـ hook `useNavigate` مستورد مسبقاً).
- يضيف:
  - `aria-label="اذهب إلى الأمنيات"`، `title="الأمنيات"`.
  - `pointer-events-auto` لضمان استقبال النقر فوق طبقات الجزيرة.
  - تأثير hover خفيف: `hover:scale-110 transition-transform`.
  - `onClick` يستدعي `e.stopPropagation()` لمنع أي تعارض مع تفاعلات الجزيرة الأخرى.

### بدون تغييرات
- باقي شريط البروموش (الـ marquee، الفواصل، التنسيقات) كما هو.
- لا تأثير على حالات `search` أو `idle`.
- لا تعديل على `IslandContext` أو الراوتنغ.

### الملف المعدّل
- `src/island/DynamicIsland.tsx`

