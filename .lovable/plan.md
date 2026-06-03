# مكتبة ملفات الطباعة ثلاثية الأبعاد (3D Files Library)

قسم جديد داخل صفحة المجتمع `/community` يتيح للتجار الموثقين الذين يملكون **بطاقة Levo فعالة** فقط: التصفح، البحث، المعاينة، والتحميل لملفات STL/OBJ/3MF وغيرها. الأدمن يدير المكتبة بالكامل، والتجار يستطيعون رفع ملفات بانتظار الموافقة.

---

## 1. قاعدة البيانات (Migration)

### جداول جديدة
- **`stl_categories`**: `id`, `name_ar`, `name_en`, `name_ku`, `slug`, `icon`, `display_order`, `is_active`
- **`stl_files`**:
  - `id`, `uploader_id` (fk profiles), `category_id`, `status` (`pending`/`approved`/`rejected`)
  - `title_ar/en/ku`, `description_ar/en/ku`
  - `cover_image_url`, `gallery_images` (jsonb array)، `video_url` (يوتيوب/رابط)
  - `model_preview_url` (ملف STL/OBJ صغير للمعاينة 3D)
  - `download_file_path` (مسار في bucket)، `file_size_bytes`, `file_format`
  - `tags` (text[])
  - `price_type` (`free`/`paid`/`daily_limit`)، `price_points` (إن كان مدفوع)
  - `min_card_tier_id` (fk membership_cards, nullable — لتقييد ملف معين لمستوى بطاقة)
  - `downloads_count`, `views_count`, `rejection_reason`
- **`stl_file_downloads`**: `id`, `user_id`, `file_id`, `downloaded_at` — لتتبع التحميلات اليومية والإحصاء
- **`stl_card_download_limits`**: `id`, `card_id` (fk membership_cards), `daily_download_limit` (int, NULL = غير محدود)

### Storage Buckets
- `stl-files` (private) — ملفات التحميل الفعلية. RLS: SELECT للتجار المؤهلين فقط عبر signed URLs من Edge Function، INSERT للمالك في مسار `{user_id}/...`
- `stl-previews` (public) — صور الغلاف والمعرض والفيديو ثامبنيل

### RLS Policies
- `stl_files` SELECT: `status='approved'` لكل authenticated؛ أو `uploader_id = auth.uid()`؛ أو admin
- `stl_files` INSERT: authenticated فقط (يُجبر `status='pending'`)
- `stl_files` UPDATE/DELETE: المالك (إذا pending) أو admin
- `stl_file_downloads` INSERT: authenticated، `user_id = auth.uid()`
- `stl_card_download_limits` SELECT: authenticated، UPDATE/DELETE: admin

### Function أهلية ومنطق التحميل
- `can_access_stl_library(uid)` — يُرجع true إذا: التاجر معتمد (`merchant_applications.status='approved'`) **و** يملك `user_cards` فعال غير منتهي
- `request_stl_download(file_id)` RPC — يتحقق من الأهلية، يجلب حد البطاقة اليومي، يحسب التحميلات لهذا اليوم من `stl_file_downloads`، يُرجع `{allowed, remaining, reason}`. إذا مدفوع: يخصم نقاط (`add_user_points` مع رصيد سالب أو RPC مخصص).

---

## 2. Edge Function

**`stl-download`** — يتحقق من JWT والأهلية ويستدعي `request_stl_download`، ثم يولّد signed URL من `stl-files` ويسجل التحميل في `stl_file_downloads`.

---

## 3. الواجهة (Frontend)

### دخول من `CommunitySection.tsx`
زر جديد ضمن البطاقات العلوية في `/community` بعنوان «مكتبة ملفات الطباعة 3D» (أيقونة `FileBox`/`Boxes`)، يظهر لكل مستخدم لكن الدخول مقيد.

### صفحات جديدة
- **`/community/stl-library`** — التصفح
  - شريط بحث + شرائط فئات أفقية + chips للعلامات (tags)
  - شبكة بطاقات (cover image + title + uploader badge + downloads count + سعر/مجاني)
  - فلاتر: السعر/الفئة/الأحدث/الأكثر تحميلاً
  - إن لم يكن المستخدم مؤهلاً → بطاقة تشرح الشروط (تاجر معتمد + بطاقة Levo فعالة) مع زر للانتقال
- **`/community/stl-library/:id`** — تفاصيل الملف
  - معرض صور (carousel)، فيديو شرح مضمّن
  - وصف، علامات، فئة، الرافع، حجم الملف، عدد التحميلات
  - زر **تحميل** يستدعي `stl-download` ويعرض المتبقي اليومي
  - أسفل الصفحة: عارض 3D للملف عبر `Model3DViewer` (موجود في المشروع) باستخدام `model_preview_url`
- **`/community/stl-library/upload`** — رفع ملف (للتجار المؤهلين فقط)
  - نموذج: عنوان+وصف بـ3 لغات، فئة، علامات، صورة غلاف، معرض، فيديو، ملف STL/OBJ للمعاينة، ملف التحميل الفعلي (TUS resumable حتى 10GB)
  - حالة الإرسال = `pending`

### صفحة الأدمن
- **`/stl-library-admin`** (تحت `ADMIN_BASE_PATH`)
  - تبويب «الفئات»: CRUD لـ `stl_categories`
  - تبويب «الملفات»: قائمة بكل الملفات مع فلتر حالة، إجراءات Approve/Reject/Edit/Delete
  - تبويب «حدود البطاقات»: لكل `membership_card` يحدد الأدمن `daily_download_limit` (فارغ = لا حد)
  - تبويب «رفع ملف»: نفس نموذج التاجر لكن يُعتمد فورًا
- رابط داخل لوحة الأدمن الرئيسية

### Hooks جديدة
- `useStlLibraryAccess()` — يجمع تحقق التاجر + `useActiveLevoCard` + حد البطاقة اليومي
- `useStlFiles({ search, category, tag, sort })`
- `useStlDownload(fileId)` — يستدعي edge function

### i18n
إضافة مفاتيح في `ar.ts`/`en.ts`/`ku.ts` + `types.ts` لكل النصوص (عناوين، فلاتر، رسائل أهلية، رسائل الحد اليومي، حالات الموافقة).

---

## 4. القواعد والقيود

- **الأهلية**: تاجر `merchant_applications.status='approved'` **و** بطاقة `user_cards` فعالة وغير منتهية. غير ذلك = عرض القسم لكن منع التحميل/الرفع.
- **سياسة السعر**:
  - `free` → يخضع فقط للحد اليومي للبطاقة
  - `paid` → خصم نقاط من رصيد المستخدم
  - `daily_limit` → ضمن `stl_card_download_limits` فقط
- **الحجم**: حتى 10GB لكل ملف عبر TUS resumable upload (`@supabase/storage-js`). صور المعرض ≤ 5MB، الفيديو يفضل رابط YouTube/Vimeo لتفادي تخزين كبير، أو ملف ≤ 100MB.
- **UI Style**: Glassmorphism Professional (نفس معيار المشروع — `.glass-panel`, Dialogs بـ `!overflow-hidden !max-h-none`).
- **عارض 3D**: إعادة استخدام `Model3DViewer` الموجود.
- **Side-effects**: تسجيل التحميل وإشعار الرافع non-blocking try/catch.
- **Memory update**: إضافة memory جديد `features/community/stl-library` بعد التنفيذ.

---

## 5. الملفات المتأثرة

**جديدة**
- `src/pages/StlLibrary.tsx`, `src/pages/StlFileDetails.tsx`, `src/pages/StlLibraryUpload.tsx`, `src/pages/AdminStlLibrary.tsx`
- `src/components/stl/StlFileCard.tsx`, `StlCategoryStrip.tsx`, `StlAccessGate.tsx`, `StlUploadForm.tsx`, `StlFileGallery.tsx`
- `src/hooks/useStlLibraryAccess.ts`, `useStlFiles.ts`, `useStlDownload.ts`
- `supabase/functions/stl-download/index.ts`
- Migration: الجداول + RLS + buckets + RPCs

**معدّلة**
- `src/components/community/CommunitySection.tsx` (زر دخول جديد)
- `src/App.tsx` (المسارات الجديدة)
- `src/lib/i18n/ar.ts`, `en.ts`, `ku.ts`, `types.ts`
- صفحة لوحة الأدمن الرئيسية (رابط `/stl-library-admin`)
