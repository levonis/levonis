## Goal
عند انتهاء فترة الضمان: يجب أن تظهر للمستخدم حالة **"منتهي"** بوضوح، وتُلغى تلقائياً كل المزايا الشهرية المرتبطة بالضمان (الخصم + الشحن المجاني)، مع توصية واضحة بترقية إلى **بطاقة تأمين / Protection Plan** للحفاظ على الحماية والمزايا.

## الوضع الحالي
- دالة `get_active_warranty_benefits_for_user` بالفعل تستثني الطابعات المنتهية (`sp.expiry_date > now()`) ⇒ المزايا تتوقف فعلياً في السلة. الآن نحتاج فقط على الواجهة:
  - عرض حالة "منتهي" بشكل بارز.
  - رسالة نصح بالاشتراك بـ Protection Plan.
  - منع ظهور بطاقة `WarrantyBenefitsCard` للمنتهية (تتم تلقائياً لأن الـ RPC يخفيها).

## التغييرات

### 1) RPC جديد بسيط: `get_expired_warranties_for_user`
ترجع الطابعات المنتهية (`expiry_date <= now()`) لاستخدامها في عرض البطاقات المنتهية وإظهار CTA.
- الحقول: `user_printer_id`, `store_printer_id`, `model_name_ar`, `serial_number`, `activation_date`, `expiry_date`, `has_active_subscription` (boolean من `printer_subscriptions`).

### 2) `WarrantyDashboard.tsx`
- عند `isExpired = true`:
  - إخفاء `<WarrantyBenefitsCard />` (تختفي تلقائياً، لكن نضيف شارة "تم إيقاف المزايا").
  - استبدال شارة `bg-destructive/20` بشريط أحمر بارز يحوي: عنوان "انتهى الضمان", شرح أن المزايا الشهرية (الخصم + الشحن المجاني) أصبحت غير مفعّلة، وزر CTA رئيسي "اشترك في بطاقة تأمين الآن" يوجّه إلى `/printer-protection`.
  - إخفاء قسم Quick Actions الخاص بالصيانة وقطع الغيار إن لم يوجد `subscription` نشط (لتجنّب الإيهام).

### 3) `MyPrintersPanel.tsx` (داخل /rewards)
- جلب `expiry_date` من `store_printers` ضمن نفس الكويري.
- شارة جديدة بجانب اسم الطابعة:
  - `expired && !activeSub` ⇒ Badge أحمر "ضمان منتهي" + بطاقة تنبيه أسفل: "لقد انتهى ضمان طابعتك. فعّل بطاقة تأمين للاستفادة من خصم شهري + توصيل مجاني + خصومات صيانة" + زر "تفعيل بطاقة تأمين" ⇒ `/printer-protection`.
  - `expired && activeSub` ⇒ تبقى شارة "محمي" (الـ Protection Plan فعّال).

### 4) `WarrantyBenefitsCard.tsx`
- لا تغيير منطقي (الـ RPC يخفي المنتهية)، لكن نضيف بانر منفصل أعلى البطاقات يستخدم RPC جديد للمنتهية ⇒ بانر صغير: "هناك طابعات انتهى ضمانها — استفد من بطاقات التأمين".
  - بديل أبسط: إضافة هذا البانر فقط داخل `WarrantyDashboard` (لتقليل الضوضاء). سنختار هذا البديل لأنه أوضح سياقاً.

### 5) i18n (ar/en/ku)
مفاتيح جديدة:
- `warranty_expired_title` = "انتهى الضمان"
- `warranty_expired_benefits_disabled` = "تم إيقاف الخصم الشهري والشحن المجاني المرتبطين بالضمان."
- `warranty_expired_cta` = "اشترك في بطاقة تأمين الآن"
- `warranty_expired_short_badge` = "ضمان منتهي"
- `warranty_expired_panel_desc` = "فعّل بطاقة تأمين لتستعيد الخصم الشهري والتوصيل المجاني وخصومات الصيانة."

### 6) Memory update
تحديث `mem://features/hardware/warranty-loyalty-benefits` لتوثيق: "بعد انتهاء الضمان تتوقف المزايا تلقائياً (RPC يفلتر `expiry_date > now()`) وتظهر حالة منتهي + CTA لبطاقة تأمين في WarrantyDashboard وMyPrintersPanel."

## ملاحظات تقنية
- لا تغيير في جداول البيانات.
- migration واحدة فقط لـ `get_expired_warranties_for_user` (SECURITY DEFINER, يفلتر `auth.uid()` أو يأخذ `p_user_id`).
- لا تغيير في حساب السلة — الحماية موجودة على مستوى الـ RPC القائم.
