

## تحليل مصدر التذاكر الضخمة وخطة منع الاحتيال

### النتائج من التحقيق

**مصدر التذاكر الكبيرة**: جميع الأعداد الضخمة (201، 151، 134، 100، 90 تذكرة) تم إضافتها عبر **عمليات أدمن يدوية** (`admin_adjust_tickets`) في عمليات مفردة بدون أي حد أقصى.

**ثغرة أمنية خطيرة**: دالة `purchase_tickets_with_bonus` تقبل `bonus_tickets` من **العميل مباشرة** — يمكن لأي مستخدم تمرير أي عدد من التذاكر المجانية عبر تعديل الطلب!

```text
Client → supabase.rpc('purchase_tickets_with_bonus', {
  ticket_quantity: 1,      // يشتري تذكرة واحدة
  bonus_tickets: 999999,   // يضيف مليون هدية مجاناً!
  price_per_ticket: 250
})
```

### التعديلات المطلوبة

#### 1. إصلاح ثغرة `purchase_tickets_with_bonus` — Migration
- تعديل الدالة لتتحقق من `bonus_tickets` من جدول `ticket_promotions` في قاعدة البيانات بدلاً من قبولها من العميل
- الدالة ستبحث عن العرض النشط المطابق لـ `ticket_quantity` وتأخذ `bonus_tickets` منه
- إذا لم يوجد عرض مطابق، تكون `bonus_tickets = 0`

#### 2. وضع حد أقصى لـ `admin_adjust_tickets` — Migration
- إضافة حد أقصى للإضافة الواحدة (مثلاً 50 تذكرة)
- تسجيل سبب الإضافة إلزامياً في `balance_audit_log`

#### 3. تحديث الكود العميل — `Competitions.tsx`
- إزالة إرسال `bonus_tickets` من العميل (الخادم يحسبها تلقائياً)

#### 4. إضافة حد يومي لشراء التذاكر — Migration
- إضافة فحص في `purchase_tickets` و `purchase_tickets_with_bonus` للحد من عدد التذاكر المشتراة يومياً (مثلاً 20 تذكرة/يوم)

#### 5. تحديث واجهة إدارة التذاكر — `UserTicketsManager.tsx`
- إضافة تحذير عند محاولة إضافة أكثر من 50 تذكرة
- إضافة حقل "السبب" إلزامي عند الإضافة

### الملفات المتأثرة
- Migration جديد لإصلاح `purchase_tickets_with_bonus` وإضافة حدود
- `src/pages/Competitions.tsx` — إزالة `bonus_tickets` من طلب العميل
- `src/components/UserTicketsManager.tsx` — إضافة حد أقصى وحقل السبب

