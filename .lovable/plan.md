
## خطة: تحسين تحميل الصفحة الرئيسية

### 1. إضافة شاشة تحميل فورية في `index.html`
- إضافة CSS مضمّن (inline) داخل `<head>` يعرض شاشة تحميل بسيطة بخلفية داكنة وشعار LEVONIS قبل تحميل JavaScript
- الشاشة تختفي تلقائياً عندما يبدأ React بالعرض (عبر إزالة عنصر `#initial-loader` من `main.tsx`)
- يحل مشكلة الشاشة الخضراء/الفارغة في متصفح Instagram المدمج وأي اتصال بطيء

### 2. ترقية Instance الـBackend
- ترقية Instance تتم من واجهة المستخدم (Backend → Advanced settings → Upgrade instance)
- لا أستطيع تنفيذها برمجياً، لكن سأوفر زر مباشر يفتح صفحة الـBackend

### الملفات المتأثرة
- `index.html` — إضافة `<style>` و `<div id="initial-loader">` داخل `<body>`
- `src/main.tsx` — إزالة `#initial-loader` من DOM بعد render

### النتيجة
- لا مزيد من شاشة فارغة/خضراء عند فتح الموقع
- أداء backend أفضل بعد الترقية اليدوية
