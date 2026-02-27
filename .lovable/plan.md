# خطة: صفحة الأمنيات (Wishlist)

## قاعدة البيانات

### جدول `wishes`

```sql
CREATE TABLE public.wishes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  image_url text,
  status text DEFAULT 'pending', -- pending, approved, rejected
  price numeric,
  likes_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### جدول `wish_likes`

```sql
CREATE TABLE public.wish_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wish_id uuid REFERENCES public.wishes(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(wish_id, user_id)
);
```

### RLS Policies

- `wishes`: الكل يقرأ الأمنيات المعتمدة (`status = 'approved'`)، المستخدم يقرأ/يعدل/يحذف أمنياته الخاصة، الأدمن يعدل الكل
- `wish_likes`: المستخدم المسجل يضيف/يحذف إعجابه، الكل يقرأ

### Trigger

- تحديث `likes_count` تلقائياً عند إضافة/حذف إعجاب
- تحديث `updated_at` عند التعديل

---

## الواجهة الأمامية

### 1. رابط في الصفحة الرئيسية (فوق البنر)

- إضافة شريط صغير في `Home.tsx` فوق `BannerCarousel` يحتوي على رابط "الأمنيات ✨" يوجه إلى `/wishes`
  تصميم انيق واحترافي وعميق مناسب مع ثيم الموقع 

### 2. صفحة `src/pages/Wishes.tsx`

- عرض الأمنيات المعتمدة (`status = 'approved'`) مع السعر وعدد الإعجابات
- **في الأعلى**: أمنية المستخدم الحالي (إن وجدت) مثبتة مع إمكانية التعديل قبل موافقه الادمن
- زر "تمنّى أمنية" يفتح Dialog لإضافة أمنية جديدة (عنوان + وصف + صورة اختيارية)
- زر إعجاب ❤️ لكل أمنية (toggle)
- عرض السعر المحدد من الأدمن + badge "معتمدة"

### 3. صفحة إدارة `src/pages/AdminWishes.tsx`

- عرض جميع الأمنيات (معلقة/معتمدة/مرفوضة)
- فلتر بالحالة
- زر موافقة مع حقل لتحديد السعر
- زر رفض
- تعديل الوصف والعنوان والصوره 
- اضافه سعر ( سوف يكون بهذا السعر بالبيع المباشر)

### 4. Route جديد

- `/wishes` → `Wishes.tsx`
- `/admin/wishes` → `AdminWishes.tsx` (محمي بـ AdminRoute)

---

## الملفات المتأثرة

- `src/App.tsx` — إضافة routes جديدة
- `src/pages/Home.tsx` — شريط رابط فوق البنر
- `src/pages/Wishes.tsx` — **جديد**
- `src/pages/AdminWishes.tsx` — **جديد**
- Migration SQL للجداول والسياسات