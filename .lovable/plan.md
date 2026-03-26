

# تحديث نظام المخزون - مسودات الشراء وسير عمل الشحنات

## ملخص
تحويل نظام المخزون الحالي من نموذج "شحنة مباشرة" إلى سير عمل كامل: **مسودات شراء → شحنات معلقة → استلام ودمج في المخزون**، مع دعم الألوان/الخيارات في المسودات، وتصميم Glassmorphism ثلاثي الأبعاد مع sidebar عائم.

---

## قاعدة البيانات

### جدول جديد: `purchase_drafts`
```sql
CREATE TABLE purchase_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  status TEXT DEFAULT 'draft', -- 'draft' | 'converted'
  items JSONB DEFAULT '[]',
  -- items: [{product_id, product_name, color, option, quantity, unit_cost, line_total}]
  total_value NUMERIC DEFAULT 0,
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### تعديل `future_shipments`
إضافة عمود `draft_id` (اختياري) لربط الشحنة بالمسودة المصدرية، وعمود `items JSONB` لتخزين تفاصيل الألوان/الخيارات.

```sql
ALTER TABLE future_shipments 
  ADD COLUMN draft_id UUID REFERENCES purchase_drafts(id),
  ADD COLUMN items JSONB DEFAULT '[]';
```

---

## الملفات

### 1. إعادة كتابة `src/pages/AdminInventory.tsx` بالكامل

**الهيكل الجديد:** بدلاً من Tabs، يستخدم sidebar عائم (بدون shadcn Sidebar - مبني يدوياً بتصميم glass) مع 4 أقسام:

#### أ. Dashboard (لوحة التحكم)
- نفس البطاقات الإحصائية الحالية + بطاقة "المسودات النشطة"
- المخططات البيانية الحالية تبقى كما هي

#### ب. Drafts (مسودات الشراء) - **جديد بالكامل**
- زر "مسودة جديدة" يفتح نموذج إنشاء
- كل مسودة تحتوي على:
  - عنوان المسودة
  - جدول عناصر ديناميكي: اختيار منتج → لون (اختياري) → خيار (اختياري) → تكلفة الوحدة → الكمية → المجموع التلقائي
  - الألوان والخيارات تُجلب من بيانات المنتج (colors JSONB) عند اختياره
  - Grand Total يتحدث تلقائياً
  - زر **"تحويل لشحنة معلقة"** → ينشئ سجل في `future_shipments` بالعناصر ويغير حالة المسودة إلى `converted`

#### ج. Shipments (الشحنات المستقبلية) - **تحديث**
- نفس القائمة الحالية مع عرض تفاصيل العناصر (ألوان/خيارات)
- زر **"تم الاستلام"** (بدلاً من "إضافة للمخزون"):
  1. يضيف الكمية الإجمالية إلى `products.direct_stock`
  2. يضيف التكلفة إلى إجمالي تكلفة المخزون (عبر inventory_movements)
  3. يحسب متوسط تكلفة الوحدة الجديد = التكلفة الكلية / الكمية الكلية
  4. يغير حالة الشحنة إلى `merged`

#### د. Live Inventory (المخزون المباشر)
- نفس جدول المنتجات الحالي مع التعديل المباشر

---

## التصميم البصري

### Floating Sidebar
- عمود جانبي ثابت (w-16 مطوي / w-56 مفتوح) بتصميم glass
- `backdrop-blur-2xl bg-white/[0.03] border-l border-white/10`
- أيقونات مع labels تظهر عند التوسيع
- تأثير hover بنيون على العنصر النشط

### Framer Motion (إن كان متوفراً في المشروع)
- `AnimatePresence` للتبديل بين الأقسام
- تأثيرات scale/opacity على البطاقات
- إن لم يكن متوفراً: استخدام CSS transitions بدلاً منه

### ألوان نيون
- Teal (`hsl(175 100% 45%)`) للأزرار الرئيسية
- Purple (`hsl(270 100% 65%)`) للمسودات
- Blue (`hsl(210 100% 60%)`) للشحنات
- Emerald للمتوفر، Red للنفاذ

---

## منطق الأعمال

### تحويل مسودة → شحنة
```
Draft (items[]) → future_shipments (status: pending, items: draft.items, total_cost: sum)
Draft.status → 'converted'
```

### استلام شحنة → تحديث المخزون
```
product.direct_stock += shipment.quantity
log inventory_movement (inbound)
shipment.status → 'merged'
Average Unit Cost = Σ(all costs) / Σ(all stock)
```

### الإيرادات
```
Revenue = Σ orders.subtotal (where order_type in ['direct','auto'] and status != 'cancelled')
// يستثني رسوم التوصيل
```

---

## الخطوات
1. إنشاء migration: جدول `purchase_drafts` + تعديل `future_shipments`
2. إعادة كتابة `AdminInventory.tsx` بالكامل مع sidebar + 4 أقسام
3. تحديث types.ts تلقائياً بعد migration

