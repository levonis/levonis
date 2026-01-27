
# خطة الإصلاح - مكتمل ✅

## المشكلة الأولى: زر إرسال المنتج لا يُظهر منتجات المتجر ✅

### التشخيص
- `ProductSelector` كان يستخدم `user.id` للبحث في `merchant_products`
- لكن `merchant_products.merchant_id` يشير إلى `merchant_applications.id` وليس `user.id`

### الحل المطبق
```text
العلاقة الصحيحة:
user.id → merchant_applications.user_id → merchant_applications.id → merchant_products.merchant_id

التغييرات:
1. تحديث useQuery لجلب merchant_applications.id باستخدام user_id
2. تمرير currentUserMerchant?.id إلى ProductSelector بدلاً من user?.id
```

---

## المشكلة الثانية: الإيموجي ليس حزمة WeChat

### الحالة الحالية
الكود يستخدم رموز Unicode (😄, 👍, ❤️) مع تحسينات WeChat-style:
- شبكة 8 أعمدة
- تبويبات بأيقونات
- تأثيرات تفاعلية

### ملاحظة
ملصقات WeChat الأصلية محمية بحقوق النشر. الخيارات المتاحة:
- خيار أ: استخدام ملصقات مفتوحة المصدر (OpenMoji/Twemoji)
- خيار ب: إنشاء ملصقات مخصصة للمنصة
- خيار ج: الإبقاء على الإيموجي الحالي (الحالي)

---

## ملخص التغييرات

| الملف | التغيير |
|-------|---------|
| `ListingConversations.tsx` | إصلاح استعلام currentUserMerchant لاستخدام merchant_applications |
| `ListingConversations.tsx` | تمرير currentUserMerchant?.id لـ ProductSelector |
