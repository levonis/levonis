
## المشكلة الجذرية

الموقع لا يفتح بسبب خطأ JavaScript في الـ production bundle:
```
TypeError: Class extends value undefined is not a constructor or null
at vendor-jspdf-DGAuUzlQ.js
```

هذا الخطأ يحدث **قبل** أن يصل React إلى `createRoot()`، فيبقى المستخدم عالقاً على شاشة التحميل الذهبية إلى الأبد — على كل الأجهزة، وحتى في وضع التصفح المتخفي. هذا ليس له علاقة بالـ cache أو الإنترنت.

## السبب

في `vite.config.ts` يتم تجميع `jspdf` + `canvg` + `pako` معاً في chunk واحد (`vendor-jspdf`):

```js
if (id.includes('jspdf') || id.includes('canvg') || id.includes('pako')) return 'vendor-jspdf';
```

المشكلتان:
1. `pako` يستخدمه `three.js` و `html2canvas` أيضاً، فيُسحب بطريقة تكسر ترتيب التهيئة
2. السلسلة `'jspdf'` تطابق أيضاً `jspdf-autotable` ومسارات فرعية، مما يخلط الـ class hierarchy
3. النتيجة: عند تنفيذ الـ chunk، يحاول كلاس داخلي أن يرث من قيمة لم تُعرَّف بعد → الخطأ

## الإصلاح

```text
vite.config.ts → دالة manualChunks
```

**التغيير** (سطر واحد فقط، آمن وحاسم):

عزل `jspdf` بدقة في chunk منفصل وعدم خلطه مع `pako`/`canvg`/`html2canvas`. الـ matching يجب أن يكون على مسار `node_modules/jspdf/` تحديداً وليس على substring.

```js
// قبل (مكسور):
if (id.includes('jspdf') || id.includes('canvg') || id.includes('pako')) return 'vendor-jspdf';

// بعد (سليم):
if (id.includes('node_modules/jspdf/') || id.includes('node_modules/jspdf-autotable/')) return 'vendor-jspdf';
if (id.includes('node_modules/canvg/')) return 'vendor-canvg';
// pako: ندعه يذهب مع vendor-misc تلقائياً (لأن three.js/html2canvas يحتاجونه قبل jspdf)
```

## الخطوات

1. تعديل `vite.config.ts`: تصحيح شرط `manualChunks` لـ jspdf (سطر 48) — فصل pako وcanvg
2. **النشر**: التغيير في الواجهة، لذا يجب الضغط على زر **Update / تحديث** في حوار النشر بعد التطبيق ليصل الإصلاح للموقع المباشر

## النتيجة المتوقعة

- الموقع سيفتح طبيعياً على levonisiq.com
- شاشة التحميل ستختفي خلال ثانية
- صفحة `/financial-drafts` ستستمر بالعمل (jsPDF لا يزال محمّلاً بشكل lazy عند الحاجة فقط)

## ملاحظة

بعد موافقتك على الخطة سأطبق التعديل وأطلب منك ضغط **Update** في حوار النشر — الإصلاح لن يصل للمستخدمين قبل ذلك.
