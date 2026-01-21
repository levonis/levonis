# Levonis Store Helper - Chrome Extension

إضافة Chrome لإرسال منتجات Amazon/Newegg/BestBuy إلى Levonis بضغطة واحدة.

## التثبيت (Developer Mode)

1. افتح Chrome وانتقل إلى `chrome://extensions/`
2. فعّل "Developer mode" من الزاوية العليا اليمنى
3. اضغط "Load unpacked"
4. اختر مجلد `chrome-extension` هذا

## الاستخدام

1. انتقل إلى صفحة أي منتج على Amazon أو Newegg أو BestBuy
2. سيظهر زر "إرسال إلى Levonis" في أسفل يسار الصفحة
3. اضغط على الزر لإرسال بيانات المنتج إلى Levonis

## البيانات المستخرجة

- **Amazon**: ASIN، اسم المنتج، السعر، العملة، تكلفة الشحن، الوزن، الصورة
- **Newegg**: رقم المنتج، الاسم، السعر، الشحن، الصورة
- **BestBuy**: SKU، الاسم، السعر، الصورة

## الأيقونات

يجب إضافة أيقونات للإضافة في مجلد `icons/`:
- `icon16.png` (16x16)
- `icon48.png` (48x48)
- `icon128.png` (128x128)

## الملفات

```
chrome-extension/
├── manifest.json     # إعدادات الإضافة
├── content.js        # سكريبت استخراج البيانات
├── styles.css        # تنسيق الزر
├── popup.html        # واجهة الإضافة
├── popup.js          # منطق الواجهة
├── icons/            # أيقونات الإضافة
└── README.md         # هذا الملف
```

## التطوير

لتعديل المتاجر المدعومة، عدّل الملفات التالية:
- `manifest.json`: أضف patterns جديدة في `host_permissions` و `content_scripts.matches`
- `content.js`: أضف دالة استخراج جديدة مثل `extractAmazonData()`
