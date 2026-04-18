
## السبب الجذري الحقيقي (مؤكد من الموقع المباشر)

فحصت `levonisiq.com` مباشرة، الخطأ في الـ console هو:
```
TypeError: Cannot read properties of undefined (reading 'useLayoutEffect')
at vendor-three-B0qeocnV.js
```

**ليس** jspdf كما ظننا سابقاً — بل **`@react-three/fiber`** (يُستخدم في لعبة Crossy Road 3D).

## لماذا يحدث هذا

في `vite.config.ts` سطر 50:
```js
if (id.includes('three') || id.includes('@react-three')) return 'vendor-three';
```

هذا يضع **`@react-three/fiber`** (الذي يستورد React في أعلى الملف) داخل chunk `vendor-three` المنفصل عن `vendor-react`. عندما يُقيَّم `vendor-three` قبل أن يُهيّأ `React.useLayoutEffect`، يتعطل التطبيق بالكامل قبل أن يُمسك React.

التعليق الموجود في نفس الملف (سطر 61-72) يحذّر بوضوح من هذه المشكلة لـ Radix/router/إلخ — لكن `@react-three` فاتنا.

## الإصلاح (سطر واحد في `vite.config.ts`)

استبعاد `@react-three` من `vendor-three`، وإضافته لقائمة `vendor-react` مع باقي مكتبات React-dependent:

```js
// قبل
if (id.includes('three') || id.includes('@react-three')) return 'vendor-three';

// بعد — three فقط (مكتبة بدون React)
if (id.includes('node_modules/three/')) return 'vendor-three';
```

ثم في كتلة `vendor-react` (سطر 64) أضف:
```js
id.includes('@react-three') ||
```

بهذا `@react-three/fiber` يُحمَّل مع React في نفس الـ chunk، وتختفي مشكلة الترتيب نهائياً.

## التأكيد

- لا تغييرات على قاعدة البيانات
- ملف واحد فقط: `vite.config.ts`
- Service Worker kill switch الذي أضفناه سابقاً يبقى كما هو (مفيد لحماية المستخدمين القدامى)
- بعد التعديل: اضغط **Update / تحديث** في حوار النشر

## النتيجة المتوقعة

الموقع سيفتح فوراً على `levonisiq.com` في كل المتصفحات بما فيها Chrome، ولعبة Crossy Road ستستمر بالعمل (الكود الفعلي لـ three.js لم يتغير، فقط مكان تجميعه في الباندل).
