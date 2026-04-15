

# ترجمة المنتجات والموقع بالكامل إلى الإنجليزية والكردية

## الوضع الحالي
- قاعدة البيانات تحتوي بالفعل على أعمدة `name_en`, `name_ku`, `description_en`, `description_ku` في جدول `products` — لكنها **فارغة وغير مستخدمة**
- نظام i18n موجود (ar/en/ku) للنصوص الثابتة في الواجهة (أزرار، قوائم، إلخ) — يعمل جيداً
- المنتجات تعرض دائماً `name_ar` و `description_ar` بغض النظر عن لغة المستخدم
- العديد من المكونات تحتوي على نصوص عربية مبرمجة مباشرة (ProfileQuickActions, GamesData, إلخ)

## الخطة

### 1) إنشاء Edge Function `translate-product`
- تستقبل نص عربي (اسم + وصف)
- تترجم إلى الإنجليزية والكردية السورانية باستخدام Lovable AI
- ترجع `{ name_en, name_ku, description_en, description_ku }`

### 2) ربط الترجمة التلقائية عند حفظ المنتج
- في `Admin.tsx`: بعد `createProduct` أو `updateProduct` بنجاح، استدعاء `translate-product`
- تحديث الأعمدة `name_en`, `name_ku`, `description_en`, `description_ku` تلقائياً
- عرض toast "جارٍ الترجمة..." ثم "تم الترجمة"

### 3) إنشاء Hook `useLocalizedProduct`
```typescript
function useLocalizedProduct(product) {
  const { language } = useLanguage();
  return {
    name: language === 'en' ? (product.name_en || product.name_ar) 
        : language === 'ku' ? (product.name_ku || product.name_ar)
        : product.name_ar,
    description: // نفس المنطق
  };
}
```

### 4) تحديث عرض المنتجات حسب اللغة
الملفات المتأثرة:
- `ProductCard.tsx` — عرض الاسم المترجم
- `ProductDetail.tsx` — العنوان والوصف بالنسخة المترجمة
- `Products.tsx` — تمرير البيانات المترجمة
- `CategoryDetail.tsx` — نفس التحديث
- `Favorites.tsx` — عرض الاسم حسب اللغة
- `FloatingProductCard.tsx` — نفس التحديث
- `Home.tsx` — الأقسام (موجود جزئياً، توسيعه)

### 5) ترجمة النصوص المبرمجة المتبقية
- `ProfileQuickActions.tsx` — استخدام مفاتيح i18n بدل النص العربي
- `GamesData.ts` — إضافة مفاتيح ترجمة لأسماء الألعاب
- `TicketProductBadges.tsx` — استخدام i18n
- باقي المكونات التي تحتوي نصوص عربية ثابتة

### 6) إضافة مفاتيح ترجمة جديدة
إضافة مفاتيح في `types.ts`, `ar.ts`, `en.ts`, `ku.ts` للنصوص الثابتة المتبقية

---

## الملفات المتأثرة

| ملف | عملية |
|-----|-------|
| `supabase/functions/translate-product/index.ts` | إنشاء |
| `src/hooks/useLocalizedProduct.ts` | إنشاء |
| `src/pages/Admin.tsx` | تعديل (ربط الترجمة) |
| `src/components/ProductCard.tsx` | تعديل |
| `src/pages/ProductDetail.tsx` | تعديل |
| `src/pages/Products.tsx` | تعديل |
| `src/pages/CategoryDetail.tsx` | تعديل |
| `src/pages/Favorites.tsx` | تعديل |
| `src/components/FloatingProductCard.tsx` | تعديل |
| `src/components/profile/ProfileQuickActions.tsx` | تعديل |
| `src/components/games/GamesData.ts` | تعديل |
| `src/lib/i18n/types.ts` | تعديل |
| `src/lib/i18n/ar.ts` | تعديل |
| `src/lib/i18n/en.ts` | تعديل |
| `src/lib/i18n/ku.ts` | تعديل |

## ملاحظات
- الترجمة التلقائية تعمل بشكل غير متزامن (non-blocking) — المنتج يُنشر فوراً ثم تُضاف الترجمة
- إذا فشلت الترجمة، يعود النظام للنص العربي كـ fallback
- كل المنتجات الحالية بدون ترجمة — سنحتاج لاحقاً batch لترجمتها

