

## تحويل /profile إلى Glassmorphism وإزالة الخلفية الثانوية

### المشكلة
`ProfileExpansionShell` يرسم طبقة معتمة `hsl(var(--background))` فوق الصفحة، فتظهر "خلفية ثانوية" تخفي الخلفية الرئيسية للموقع وراءها.

### الحل
استبدال الطبقة المعتمة بسطح زجاجي شفاف (Glassmorphism) يسمح برؤية الخلفية الرئيسية للموقع من خلاله.

### التغييرات (`src/components/ProfileExpansionShell.tsx`)

1. **استبدال خلفية `profile-shell`**:
   - حذف `background: "hsl(var(--background))"` المعتم.
   - استخدام تدرج شفاف:
     ```
     linear-gradient(135deg, hsl(var(--background) / 0.55), hsl(var(--background) / 0.35))
     ```
   - إضافة `backdrop-filter: blur(22px) saturate(1.4)` (مع `-webkit-` prefix) لتغبيش ما خلف القرص.
   - تحديث `boxShadow` لإطار زجاجي ناعم: `inset 0 1px 0 white/18%` + ring خفيف للـ primary.

2. **تخفيف الـ backdrop دون إزالته**:
   - الطبقة `profile-shell-backdrop` الحالية (`bg-background/40`) تُخفض إلى `hsl(var(--background) / 0.18)` كي لا تُشكّل خلفية بديلة، فقط dim لطيف.

3. **مسار `prefers-reduced-motion`**:
   - تطبيق نفس الـ glassBg + backdropFilter على نسخة الـ fade المباشر، بدل الـ background المعتم.

### بدون تغييرات
- بنية الـ clip-path الدائري ونوابض الانفتاح/الانكماش وترتيب ظهور المحتوى تبقى كما هي.
- `Profile.tsx` لا يحتاج تعديل (ليس له خلفية خاصة).
- `AppBackground` العام يبقى كما هو ويظهر الآن خلف القرص الزجاجي.

### الملف المعدّل
- `src/components/ProfileExpansionShell.tsx`

