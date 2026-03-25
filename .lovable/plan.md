

# خطة إضافة ميزة المسودات (Drafts) إلى صفحة التقارير المالية

## ملخص
إضافة ميزة تتيح للأدمن إنشاء مسودات مالية تشبه جداول Excel مع أعمدة قابلة للتخصيص، وحفظها واسترجاعها من صفحة مخصصة.

## ما سيتم بناؤه

### 1. جدول قاعدة بيانات جديد: `financial_drafts`
- `id` (UUID, primary key)
- `title` (نص - اسم المسودة)
- `columns` (JSONB - تعريف الأعمدة: الاسم والنوع)
- `rows` (JSONB - بيانات الصفوف)
- `created_by` (UUID - مرجع المستخدم)
- `created_at`, `updated_at`
- سياسات RLS للأدمن فقط

### 2. صفحة جديدة: `AdminFinancialDrafts`
- **عرض المسودات المحفوظة**: قائمة بطاقات تعرض اسم المسودة وتاريخ الإنشاء وعدد الأعمدة/الصفوف
- **إنشاء مسودة جديدة**: زر لإنشاء مسودة فارغة مع إدخال اسمها
- **حذف المسودات**

### 3. محرر المسودة (داخل نفس الصفحة أو كعرض منفصل)
- جدول تفاعلي يشبه Excel
- **إضافة أعمدة**: زر لإضافة عمود جديد مع تسميته
- **تعديل اسم العمود**: نقر مزدوج لتعديل اسم العمود
- **حذف أعمدة**
- **إضافة صفوف**: زر لإضافة صف جديد
- **تحرير الخلايا**: نقر على الخلية لتحريرها مباشرة
- **حذف صفوف**
- **حفظ تلقائي** أو زر حفظ

### 4. ربط الصفحة بالتطبيق
- إضافة مسار جديد: `${ADMIN_BASE_PATH}/financial-drafts`
- إضافة زر "المسودات" في صفحة `/financials` للانتقال لصفحة المسودات

## التفاصيل التقنية

### قاعدة البيانات
```sql
CREATE TABLE financial_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT 'مسودة جديدة',
  columns JSONB NOT NULL DEFAULT '[]',
  rows JSONB NOT NULL DEFAULT '[]',
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
-- RLS: admin only via has_role function
```

### هيكل البيانات (JSONB)
- **columns**: `[{ "id": "col_1", "name": "اسم العمود" }, ...]`
- **rows**: `[{ "id": "row_1", "col_1": "قيمة", "col_2": "قيمة" }, ...]`

### الملفات
| ملف | وصف |
|------|------|
| `src/pages/AdminFinancialDrafts.tsx` | صفحة عرض/إنشاء المسودات + محرر المسودة |
| `src/pages/AdminFinancials.tsx` | إضافة زر للانتقال لصفحة المسودات |
| `src/config/adminConfig.ts` | إضافة مسار `financialDrafts` |
| `src/App.tsx` | إضافة Route جديد |

