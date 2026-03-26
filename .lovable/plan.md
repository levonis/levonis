

# نظام إدارة المخزون - Inventory Management System

## ملخص
إنشاء نظام متكامل لإدارة المخزون بتصميم Glassmorphism 3D احترافي، يُضاف كصفحة جديدة يمكن الوصول إليها من زر في صفحة `/financials`.

---

## الهيكل العام

النظام يعتمد على بيانات جدول `products` الموجود فعلاً (direct_stock, pre_order_stock, colors/option_stocks, cost_price, price, category_id, etc.) بدون إنشاء جداول جديدة للمنتجات. سيتم إنشاء جدول واحد جديد لتتبع حركات المخزون.

---

## قاعدة البيانات

### جدول جديد: `inventory_movements`
```sql
CREATE TABLE inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL, -- 'inbound' | 'outbound'
  quantity INTEGER NOT NULL,
  color_name TEXT,
  option_name TEXT,
  stock_field TEXT DEFAULT 'direct_stock', -- 'direct_stock' | 'pre_order_stock'
  note TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```
مع سياسات RLS للمسؤولين فقط.

---

## الملفات

### 1. `src/pages/AdminInventory.tsx` (جديد)
الصفحة الرئيسية تحتوي على 4 أقسام بتبويبات:

**أ. لوحة المعلومات (Dashboard)**
- 4 بطاقات إحصائية: إجمالي المنتجات، منتجات منخفضة المخزون (≤5)، إجمالي قيمة المخزون، حركات اليوم
- مخطط بياني (Recharts BarChart) لمستويات المخزون حسب الفئة
- قائمة تنبيهات المخزون المنخفض

**ب. إدارة المنتجات (Product Grid)**
- جدول يعرض: الصورة، الاسم، الفئة، السعر، المخزون المباشر، مخزون الطلب المسبق، الحالة
- بحث فوري وفلترة حسب الفئة والحالة (في المخزون/نفذ/منخفض)
- تعديل المخزون مباشرة من الجدول (inline editing)

**ج. حركات المخزون (Stock Movements)**
- نموذج لإضافة حركة واردة (Inbound) أو صادرة (Outbound)
- اختيار المنتج → اللون → الخيار → الكمية → ملاحظة
- تحديث المخزون تلقائياً في جدول products
- سجل الحركات مع فلترة بالتاريخ والنوع

**د. التقارير والتحليلات (Analytics)**
- تقييم المخزون الإجمالي (الكمية × سعر التكلفة)
- اتجاهات شهرية للحركات
- أكثر المنتجات حركة

### 2. `src/config/adminConfig.ts` (تعديل)
إضافة route: `inventory: \`${ADMIN_BASE_PATH}/inventory\``

### 3. `src/App.tsx` (تعديل)
إضافة lazy import و Route للصفحة الجديدة

### 4. `src/pages/AdminFinancials.tsx` (تعديل)
إضافة زر "إدارة المخزون" بجانب أزرار المسودات

---

## التصميم (Glassmorphism 3D)

- خلفية: تدرجات mesh gradient بألوان داكنة (navy/charcoal)
- البطاقات: `backdrop-blur-xl bg-white/5 border border-white/10 shadow-2xl`
- تأثيرات 3D: `transform perspective-1000 hover:rotate-y-1` على البطاقات
- ألوان نيون: Cyan للأزرار الرئيسية، Emerald للمخزون المتوفر، Purple للتنبيهات، Red للنفاذ
- شريط بحث عائم بتأثير زجاجي
- انتقالات سلسة وتأثيرات hover على جميع العناصر التفاعلية
- تصميم متجاوب بالكامل (responsive)

---

## التفاصيل التقنية

- React + TypeScript + Tailwind CSS + Lucide React icons
- Recharts للمخططات البيانية (موجود في المشروع)
- React Query للبيانات مع التحديث التلقائي
- تحديث المخزون عبر Supabase mutations مع toast notifications
- RTL layout مع نصوص عربية

