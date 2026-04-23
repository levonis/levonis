

## توحيد التصميم على Glassmorphism Professional

طلبك واسع النطاق — `/category` + بقية الموقع + شريط التنقّل السفلي البيضاوي + أنميشنات التوسّع. سأنفّذ على **5 مراحل** مرتّبة حسب الأثر البصري.

---

### المرحلة 1 — إكمال `/category` (الأولوية القصوى)

**العناصر المتبقّية للتحويل:**

1. **بطاقة Hero الرئيسية** (موجودة بالفعل بنمط زجاجي — تحسين بسيط: زيادة `backdrop-blur` إلى 2xl وتوحيد التدرّج مع باقي العناصر).
2. **بطاقات المنتجات `FloatingProductCard`**:
   - رفع الزجاج من `blur(40px)` إلى صيغة موحّدة `backdrop-blur-2xl + saturate-150`.
   - إضافة `inset 0 1px 0` highlight علوي.
   - ترقية ribbon البيع المباشر إلى نمط زجاجي (شفافية + blur خفيف).
3. **رسالة "لا توجد منتجات"** (السطور 423-460): تحويل البطاقة الفارغة إلى لوحة زجاجية بنفس النمط.
4. **شبكة المنتجات**: إضافة `animate-fade-in` متتابع خفيف عند التحميل.

---

### المرحلة 2 — الشريط السفلي البيضاوي (Mobile Bottom Nav)

**الوضع الحالي:** شريط مستطيل بحدّ علوي بسيط، عرض كامل، حواف غير مدوّرة.

**الجديد:**
- **شكل بيضاوي عائم** (`rounded-full`) منفصل عن الحواف — `mx-3 mb-3` مع `bottom-0` آمن.
- خلفية زجاجية: `backdrop-blur-2xl + bg-card/50 gradient + border 0.4 + deep shadow + inner highlight`.
- العنصر النشط: حبّة بيضاوية مضيئة `bg-primary/20` مع توهّج خلفي `glow`.
- انتقالات `cubic-bezier(0.16,1,0.3,1)` 300ms للأيقونات.
- شارات الإشعارات (السلة/الرسائل) بنمط زجاجي صغير مع `ring-2 ring-background/50`.
- الحفاظ على `safe-area-inset-bottom`.

**سطح المكتب (dock):** نفس البطاقة موجودة بالفعل بـ `rounded-2xl` — ترقية إلى `rounded-full` (بيضاوي) + ترقية الزجاج لتطابق المعيار.

```text
┌──────────────────────────────────────────┐
│  ╭──────────────────────────────────╮   │  ← شكل بيضاوي زجاجي
│  │  🏠   🛒²  👥   🏆   🎮   💬   👤  │   │     عائم بهامش جانبي
│  ╰──────────────────────────────────╯   │
└──────────────────────────────────────────┘
```

---

### المرحلة 3 — معيار Popover/Dropdown موحّد عالميًا

إنشاء **مكوّن مساعد جديد** `src/components/ui/glass-popover.tsx` يغلّف `Popover` بالنمط الزجاجي الجاهز + أنميشن التوسّع للأسفل (`dropdown-in-bottom` 220ms `cubic-bezier(0.16,1,0.3,1)`).

تحديث `src/components/ui/select.tsx` و`src/components/ui/dropdown-menu.tsx` و`src/components/ui/sheet.tsx` لتطبيق نفس الزجاج تلقائيًا — هذا ينقل **كل قوائم الموقع** إلى النمط دون تعديل كل صفحة.

أنميشن التوسّع:
- `data-[state=open]:animate-[glass-expand_220ms]` — keyframe جديد: scale 0.96→1 + opacity 0→1 + translateY 8→0.
- يُضاف إلى `tailwind.config.ts` و`index.css`.

---

### المرحلة 4 — العناصر العامّة للموقع

**Top-level shells (ترقية تلقائية عبر مكوّنات shadcn):**

| المكوّن | التغيير |
|---|---|
| `Card` (ui/card.tsx) | إضافة variant `glass` افتراضي للصفحات الرئيسية |
| `Dialog` content | تطبيق نفس وصفة الزجاج + animation موحّد |
| `Sheet` content | زجاج + slide-in بـ `cubic-bezier(0.16,1,0.3,1)` |
| `Tabs` list | حاوية زجاجية بـ `rounded-full`، النشط بـ pill داخلي مضيء |
| `Button outline/ghost` | إضافة variant `glass` (شفّاف + blur + hover lift) |
| `Input` | حدّ زجاجي + focus ring بنمط primary glow |

**صفحات تحصل على ترقية بصرية مباشرة من تحديث المكوّنات:**
`/`, `/cart`, `/rewards`, `/games`, `/community`, `/profile`, `/notifications`, `/favorites`, `/my-orders`, جميع صفحات Auth.

**ملاحظة:** لن أعيد كتابة محتوى كل صفحة — فقط أرقّي مكوّنات الـ design system المشتركة، فيرث الموقع كله النمط تلقائياً. هذا يحفظ ساعات من العمل ويضمن التناسق.

---

### المرحلة 5 — تأثيرات الحركة الموحّدة

في `src/index.css`:
```css
@keyframes glass-expand { /* scale + fade + slide */ }
@keyframes glass-collapse { /* عكسي */ }
.glass-panel { /* class مساعد جاهز */ }
.glass-trigger { /* للأزرار */ }
```

ضبط `tailwind.config.ts` بـ animation keys جديدة:
- `glass-in`, `glass-out`, `glass-expand`

كل قائمة أو خيار أو drawer ينفتح يستخدم نفس التوقيت → إحساس موحّد عبر الموقع.

---

### الملفات المعدّلة

**جديدة:**
- `src/components/ui/glass-popover.tsx`

**معدّلة:**
- `src/pages/CategoryDetail.tsx` (Hero + EmptyState + grid animations)
- `src/components/FloatingProductCard.tsx` (زجاج موحّد)
- `src/components/ui/DirectSaleRibbon.tsx` (زجاج خفيف)
- `src/components/AppNavBar.tsx` (شكل بيضاوي للموبايل + سطح المكتب)
- `src/components/ui/select.tsx`, `dropdown-menu.tsx`, `sheet.tsx`, `dialog.tsx`, `card.tsx`, `tabs.tsx`, `button.tsx`, `input.tsx` (variants زجاجية)
- `src/index.css` (keyframes + utility classes)
- `tailwind.config.ts` (animation tokens)

**ذاكرة:**
- تحديث `mem://ui/styling/glassmorphism-professional-standard.md` بالوصفة الكاملة + قواعد Bottom Nav البيضاوي + keyframes الجديدة.

---

### بدون تغيير

- منطق التطبيق، البيانات، الاستعلامات، التوجيه، الترجمة.
- ألوان الـ primary/destructive.
- ترتيب "بيع مباشر أولاً".
- وظائف وعدد عناصر شريط التنقّل.

### النتيجة

موقع كامل بهوية بصرية موحّدة: زجاج، شفافية أنيقة، حركات سلسة، شريط سفلي بيضاوي عائم، وكل قائمة تنفتح بنفس الإحساس الناعم.

