

# خطة: تحسين صفحة الأمنيات بشكل جذري + رفع صور بدل روابط

## 1. Storage Bucket للصور
إنشاء bucket `wish-images` عام مع RLS policies للرفع (مستخدم مسجل فقط) والقراءة (الكل).

```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('wish-images', 'wish-images', true);
-- RLS: authenticated users upload, public read
```

## 2. إعادة كتابة `src/pages/Wishes.tsx` بالكامل
- **رفع صورة**: استبدال حقل رابط الصورة بمنطقة رفع (drag & drop / click) مع معاينة فورية
- Upload إلى `wish-images` bucket ثم تخزين الـ public URL في `image_url`
- **UI جديد بالكامل**:
  - Header مع خلفية gradient وأيقونة متحركة (animate-fade-in + floating sparkles)
  - بطاقة "أمنيتك" المثبتة بتأثير glassmorphism مع حدود متوهجة (glow border animation)
  - زر "تمنّى أمنية" بتأثير pulse و hover scale
  - بطاقات الأمنيات بتصميم grid ثنائي الأعمدة على الموبايل مع:
    - صورة كبيرة في الأعلى
    - عنوان + وصف
    - سعر بـ badge ذهبي
    - زر إعجاب متحرك (scale animation عند الضغط)
    - عداد الإعجابات
  - Staggered fade-in animation لكل بطاقة
  - Skeleton loading بدل Loader2
  - حالة فارغة بتصميم جميل

## 3. تحسين زر الأمنيات في `src/pages/Home.tsx`
- تحويله من رابط بسيط إلى بنر أنيق مع:
  - خلفية gradient متحركة
  - أيقونة نجمة متحركة (animate-pulse)
  - سهم يمين متحرك
  - تأثير hover مع scale و glow

## 4. تحديث `src/pages/AdminWishes.tsx`
- استبدال حقل رابط الصورة في Dialog التعديل بعنصر رفع صورة + معاينة

## الملفات المتأثرة
- Migration SQL — bucket + storage policies
- `src/pages/Wishes.tsx` — إعادة كتابة كاملة
- `src/pages/Home.tsx` — تحسين زر الأمنيات (سطور 105-113)
- `src/pages/AdminWishes.tsx` — إضافة رفع صورة في التعديل

