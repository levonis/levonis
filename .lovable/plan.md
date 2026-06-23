## السبب الجذري للمشكلتين

### 1) `adminUpdateProduct: product id is required` (يحدث حتى عند إنشاء منتج جديد)
المسودة التلقائية (autosave كل 1.5 ثانية) في `src/pages/Admin.tsx` تحفظ:
```ts
const mergedEditing = { ...(editingProduct || {}), ...effectiveValues };
draft.editingProduct = mergedEditing;
```
عند إنشاء منتج جديد `editingProduct=null`، لكن `mergedEditing` يصبح **كائن قيم النموذج بدون `id`**. ثم عند فتح نافذة المنتج مرة أخرى تُستعاد المسودة:
```ts
setEditingProduct(draft.editingProduct ?? null);  // كائن بلا id
```
فيتحوّل المنتج الجديد إلى «تحرير منتج موجود» (لأن `editingProduct` صار truthy) وعند الحفظ:
```ts
if (editingProduct) { await updateProduct.mutateAsync({ id: editingProduct.id /* undefined */, values }); }
```
فيرمي الحارس في `adminUpdateProduct` خطأ `productId is required`. وعلى التحرير الفعلي يحدث نفس الأمر إذا كانت المسودة القديمة قد دهست id.

### 2) `new row violates row-level security policy` على رفع `*.webp`
الرفع في `Admin.tsx` يستعمل `bucket = product-images` بمسار جذري (`manual-...webp`). سياسة INSERT الوحيدة على هذا البكت هي:
```
Admins can upload product images: WITH CHECK (bucket_id='product-images' AND has_role(uid,'admin'))
```
لا تشمل دور `assistant`، فيُرفض الرفع عند المساعد. (وحتى الأدمن يفشل إذا لم يكن لديه صف `admin` في `user_roles` — وهذا ما يفسّر فشل الاثنين عند بعض الحسابات).

---

## الحل

### أ) إصلاح مسودة المنتج (Frontend) — `src/pages/Admin.tsx`
- في autosave (سطر ~445): **لا تحفظ `editingProduct` في المسودة إلا إذا كان له `id` حقيقي**. إذا لم يكن — أرسل `null`، واحتفظ بقيم النموذج فقط في `formValues`.
- في استرجاع المسودة (سطر ~407): إذا كان `draft.editingProduct` كائناً بدون `id` صالح، عامله كـ `null` (إنشاء جديد).
- إضافة حارس داخل `handleProductSubmit` (سطر ~2076): إذا كان `editingProduct && !editingProduct.id` → اعتبره إنشاء جديد (`adminCreateProduct`) بدل المحاولة الفاشلة.

### ب) إصلاح RLS لرفع صور المنتج (Migration)
- إضافة سياسات Storage `INSERT/UPDATE/DELETE` على `bucket_id='product-images'` تسمح أيضاً لأدوار `admin` و `assistant` (تكرار السياسات الحالية مع إضافة `OR has_role(uid,'assistant')`).
- إبقاء سياسات المستخدمين العاديين (avatars/chat/print-requests) كما هي دون تغيير.

### ج) تحسين رسائل الخطأ (موجودة مسبقاً)
- `formatSupabaseError` يعرض الخطأ الكامل في Toast — لا تغيير إضافي.

---

## الملفات المتأثرة
- تعديل: `src/pages/Admin.tsx` (autosave + restore + handleProductSubmit guard).
- هجرة قاعدة بيانات: إضافة سياسات Storage لـ `product-images` تشمل المساعد.

## التحقق بعد التطبيق
- فتح «إضافة منتج جديد» بعد وجود مسودة قديمة → يبدأ كإنشاء، يحفظ بنجاح.
- تحرير منتج موجود (Admin وAssistant) → يحفظ بنجاح.
- رفع صورة `.webp` بحساب Assistant داخل نموذج المنتج → ينجح.
- التبديلات السريعة في جدول المنتجات (إظهار/مميز) → تستمر بالعمل.
