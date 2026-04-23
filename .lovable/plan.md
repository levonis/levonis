

## توحيد كامل لتجربة فتح/إغلاق النوافذ الثلاث عبر `OriginExpandShell`

النوافذ الثلاث (المحفظة، التوفير، الكوبونات) تستخدم بالفعل `OriginExpandShell` لكن المحتوى الداخلي مختلف الخلفية/الحدود/الـ scroll، فيظهر تباين بصري. الهدف: كل ما تراه (الـ backdrop، الحاوية، الهيدر، التذييل، الانتقالات) يأتي من الشل الموحّد، والـ popups تمرّر **محتوى فقط**.

### 1) ترقية `src/components/profile/OriginExpandShell.tsx`
توسيع الـ shell ليحمل الـ chrome الكامل وبخيارات اختيارية:
- `title?: string` و`icon?: ReactNode` و`subtitle?: ReactNode` لرأس موحّد.
- `footer?: ReactNode` لتذييل ثابت اختياري.
- `size?: "default" | "lg"` (الافتراضي `default`).
- بنية داخلية موحّدة:
  - `backdrop`: `fixed inset-0 bg-black/55 backdrop-blur-md` مع fade منفصل (200ms).
  - `container`: مركزة، `max-w-md` / `lg:max-w-lg`، `max-h-[85vh]`، `glass-card` + `overflow-hidden`.
  - `header`: شريط أعلى مع الأيقونة، العنوان، وزر إغلاق X (يستخدم `glass-card-inner` للأيقونة وزر الإغلاق).
  - `body`: `overflow-y-auto` بـ padding ثابت + `scrollbar-thin`.
  - `footer`: حدود علوية رفيعة (`border-white/10`) إن وُجد.
- نفس spring الحالي (`stiffness: 320, damping: 32, mass: 0.9`) و`transformOrigin` المحسوب من `originRect`.
- احترام `prefers-reduced-motion` (موجود مسبقاً يبقى).
- إضافة `role="dialog"` و`aria-modal="true"` و`aria-labelledby` مرتبط بالـ title.

### 2) تبسيط `SavingsPopup.tsx`
حذف الهيدر/زر الإغلاق المكرر داخل المكوّن. تمرير:
- `title={t('savings_title')}`, `icon={<TrendingUp />}` للشل.
- المحتوى = الإجمالي + التفصيل + القائمة فقط (بدون أي backdrop/border/blur خارجي).
- الكروت الفرعية داخل المحتوى تستخدم `glass-card-inner` لاتساق مع الهيدر.

### 3) تبسيط `CouponsPopup.tsx`
- نفس الشيء: `title={t('coupons_title')}`, `icon={<Ticket />}`.
- إزالة أي حاوية `rounded-3xl bg-* backdrop-*` من جذر المحتوى.
- الـ `Sheet` الداخلي لتفاصيل الخصم يبقى كما هو.

### 4) تبسيط `WalletDialog.tsx`
- تمرير `title={t('wallet_title')}`, `icon={<Wallet />}`, و`size="lg"` (لأنه أكبر محتوى).
- نقل أزرار "إيداع/سحب" الرئيسية إلى `footer` ليبقى الـ tabs قابلة للتمرير دونها.
- إزالة الهيدر اليدوي القديم؛ الإغلاق فقط من زر X في الـ shell.

### النتيجة المرئية
- نفس الـ backdrop (نفس درجة الإعتام والضبابية) في النوافذ الثلاث.
- نفس زاوية التدوير، نفس الظل، نفس التباعد، نفس مكان زر X، نفس حجم العنوان.
- نفس انيميشن الفتح من الزر والانكماش إليه.

### بدون تغييرات
- إحداثيات `originRect` ومنطق التقاطها في `ProfileHeader`.
- منطق البيانات (queries/mutations) في الـ popups.
- صفحات/مكوّنات أخرى تستخدم الـ shell (لا توجد حالياً غير هذه الثلاث).

### الملفات المعدّلة
- `src/components/profile/OriginExpandShell.tsx` (توسيع API)
- `src/components/profile/SavingsPopup.tsx`
- `src/components/profile/CouponsPopup.tsx`
- `src/components/WalletDialog.tsx`

