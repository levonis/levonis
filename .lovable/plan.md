

# إصلاح مشكلة عدم فتح المنتجات

## السبب
خطأ `ReferenceError: language is not defined` في `ProductDetail.tsx` السطر 791.

المكوّن يستخدم `const { t } = useLanguage()` في السطر 64 لكنه يستخدم متغير `language` في السطر 791 بدون استخراجه من الـ hook.

## الإصلاح

### `src/pages/ProductDetail.tsx`
- **السطر 64**: تغيير `const { t } = useLanguage()` إلى `const { t, language } = useLanguage()`

هذا إصلاح سطر واحد فقط يحل المشكلة بالكامل.

