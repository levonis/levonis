# إصلاح فشل البناء المحلي – العودة إلى lightningcss

## المشكلة
عند تشغيل `npm run build` محلياً يظهر:
```
[plugin vite:css-post]
Cannot find package 'esbuild' imported from .../node_modules/vite/dist/node/chunks/node.js
```

## السبب الجذري
- المشروع المحلي يستخدم **Rolldown-Vite** (واضح من المسار `node_modules/rolldown/...` في الـ stack trace).
- Rolldown-Vite **لا يتضمن حزمة `esbuild`** كاعتماد افتراضي.
- في رسالة سابقة أضفنا `cssMinify: 'esbuild'` لتفادي خطأ `Invalid empty selector` في lightningcss، فأصبح Vite يحاول استيراد حزمة غير موجودة.
- أما خطأ lightningcss الأصلي فكان سببه كتلة `@media (prefers-reduced-transparency: reduce)` وقد **تم حذفها بالفعل** من `src/index.css` في رسائل سابقة، فلم يعد هناك سبب لتجنب lightningcss.

## التغيير المطلوب
ملف واحد فقط:

### `vite.config.ts`
حذف السطر:
```ts
cssMinify: 'esbuild',
```
وترك بقية إعدادات `build` كما هي. النتيجة: Vite يستخدم lightningcss الافتراضي المضمَّن مع Rolldown-Vite، بدون أي اعتمادات إضافية، وبدون تغيير `package.json`.

## التحقق بعد الموافقة
1. سيتم تطبيق التعديل على `vite.config.ts` فقط.
2. شغّل محلياً: `npm run build`
3. المتوقع: نجاح البناء بدون أخطاء.

## ملاحظة
لا حاجة لأي تعديلات أخرى — `src/index.css` نظيف فعلاً من الكتلة المسببة لخطأ lightningcss السابق.