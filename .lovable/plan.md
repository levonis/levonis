

## إصلاح اختفاء المنتجات في لوحة الإدارة

### السبب
إضافة عمود `featured_product_id` في جدول `categories` أنشأ علاقة ثانية (FK) بين `products` و `categories`. الآن PostgREST لا يستطيع تحديد أي علاقة يستخدم عند كتابة `categories(name_ar)` في الاستعلام، فيرجع خطأ **PGRST201** بدلاً من البيانات.

### الحل — `src/pages/Admin.tsx`
تعديل سطر 296 لتحديد العلاقة الصحيحة بشكل صريح:

```typescript
// قبل
.select('*, categories(name_ar), product_options(...)')

// بعد  
.select('*, categories!products_category_id_fkey(name_ar), product_options(...)')
```

تغيير سطر واحد فقط. باقي الاستعلامات في المشروع إما لا تتأثر أو مُحدَّدة مسبقاً (مثل `AdminInventory.tsx`).

