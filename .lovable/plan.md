

## الخطة: إضافة أزرار تفعيل/تعطيل لكل نوع إشعار

### الوضع الحالي
- جدول `profiles` يحتوي بالفعل على:
  - `telegram_notifications` (JSONB): `{orders: true, wallet: true, community: true, promotions: true, competitions: true}`
  - `email_notifications_enabled` (boolean): للتحكم بإشعارات الموقع بشكل عام
- مفاتيح الترجمة موجودة مسبقاً (orders, wallet, promotions, support)
- لكن الصفحة لا تعرض أي checkboxes للتحكم بهذه الإعدادات

### التعديلات المطلوبة

#### 1. إضافة عمود `site_notifications` (JSONB) لقاعدة البيانات
- إضافة عمود جديد مشابه لـ `telegram_notifications` للتحكم بإشعارات الموقع بشكل تفصيلي
- القيمة الافتراضية: `{"orders": true, "wallet": true, "community": true, "promotions": true, "competitions": true}`

#### 2. تعديل `NotificationSettings.tsx`
- **قسم إشعارات الموقع**: إضافة قائمة checkboxes لكل نوع (طلبات، محفظة، مجتمع، عروض، مسابقات)
- **قسم تليجرام**: إضافة نفس القائمة من الـ checkboxes تحت حقل الـ Chat ID
- كل checkbox يحفظ تلقائياً عند التغيير (بدون زر حفظ منفصل)
- استخدام مكون `Checkbox` من shadcn/ui مع تصميم زجاجي متناسق

#### 3. الشكل النهائي لكل قسم
```
☑ الطلبات - تحديثات حالة الطلبات والشحن
☑ المحفظة - الإيداعات والسحوبات وتغييرات الرصيد  
☑ المجتمع - إشعارات المجتمع والطلبات المخصصة
☑ العروض - عروض وخصومات حصرية
☑ المسابقات - إشعارات المسابقات والجوائز
```

- الحفظ يتم فوراً عند تغيير أي checkbox مع إظهار toast للتأكيد
- قراءة القيم الحالية من `telegram_notifications` و `site_notifications` عند تحميل الصفحة

