# خطة: تفعيل كوبون البطاقة + منتج البطاقة + دُفعات محسّنة

## 1) كوبونات `applies_to_levo_card_only`

### قاعدة البيانات
- `ALTER TABLE coupons ADD COLUMN applies_to_levo_card_only BOOLEAN NOT NULL DEFAULT false`.
- `ALTER TABLE default_settings ADD COLUMN levo_physical_card_product_id UUID` (مرجع للمنتج المحجوز).
- تحديث RPC التحقق من الكوبون (`validate_coupon` أو ما يعادلها) ليضيف:
  - إذا `applies_to_levo_card_only = true`: يُرفض الكوبون ما لم تكن السلة تحتوي **حصريًا** منتج البطاقة الفيزيائية (`product_id = levo_physical_card_product_id`). أي منتج آخر في السلة → رفض بخطأ واضح `COUPON_LEVO_ONLY`.
  - إذا `applies_to_levo_card_only = false`: يُرفض الكوبون إذا كانت السلة **تحتوي** منتج البطاقة (منع الكوبونات العادية على البطاقة نهائيًا).
- الخصم يُحسب فقط على سطر البطاقة (subtotal = سعر البطاقة).

### UI الأدمن
- في نموذج إنشاء/تعديل الكوبون: Switch جديد **"حصري لبطاقة ليفو"** يخفي/يعطّل بقية شروط المنتجات/الفئات عند تفعيله.

### UI السلة
- عند إدخال كوبون على منتج البطاقة، يظهر شارة "خصم بطاقة ليفو".

## 2) منتج البطاقة الفيزيائية (System-Reserved Single)

### Migration
- إنشاء المنتج تلقائيًا داخل migration بـ UUID ثابت + `is_system_reserved = true` (عمود جديد boolean على `products`) + سعر افتراضي 25,000 IQD + name/description ثلاثي اللغة + slug `levo-card`.
- إضافة عمود `is_system_reserved` مع policy تمنع الحذف (trigger `BEFORE DELETE` يُلقي exception إذا `is_system_reserved = true`).
- تخزين UUID المنتج في `default_settings.levo_physical_card_product_id`.
- إعدادات: `stock_type='unlimited'`، `category` جديدة `levo_cards` أو استخدام "ملحقات".

### واجهة الأدمن
- زر بارز في `AdminLevoCards`: **"إدارة منتج البطاقة"** يفتح dialog للتعديل السريع (سعر IQD، صور، وصف ar/en/ku). الحذف مخفي.
- في `AdminProductsTab`: منتج البطاقة يظهر بـ badge "منتج نظام" وزر الحذف مخفي.

### صفحة المنتج
- تستخدم صفحة `ProductShop` القياسية (لا تغيير). إضافة زر CTA بارز "اطلب بطاقة ليفو" في `LevoCardManager` عندما لا توجد بطاقة، يضيفها للسلة كأي منتج (شحن للمنزل بأي طريقة توصيل).

## 3) دُفعات البطاقات: QR + PIN + NFC

### توسيع جدول `levo_physical_cards`
- `pin_code` TEXT NOT NULL — 4 أرقام.
- `pin_hash` TEXT NOT NULL — bcrypt/sha256 للتحقق الآمن.
- `qr_payload` TEXT NOT NULL — JSON مُوقّع يحوي `{card:16digits, nonce}` مشفّر (base64url + HMAC بمفتاح سري في vault). QR ≠ الرقم الخام.
- `nfc_payload` TEXT NOT NULL — نفس صيغة `qr_payload` (يُكتب على شريحة NFC عند الطباعة، مستقل عن QR لدعم تدوير كل واحد بشكل منفصل).
- الرقم الخام 16 لا يُخزَّن (يبقى `card_number_hash` + `card_number_last4` فقط للعرض) — Admin يراه مرة عند الإنشاء ثم يختفي.

### PIN — إجباري في كل طرق التفعيل
- تحديث `levo_activate_card` ليأخذ `p_pin TEXT` بجانب `p_card_number` / `p_qr_payload` / `p_nfc_payload`. يتحقق من `pin_hash` قبل الربط.
- **Rate limiting**: 5 محاولات خاطئة خلال 15 دقيقة تُقفل البطاقة مؤقتًا (`locked_until` timestamp على البطاقة).

### RPC `admin_generate_levo_cards`
- يولّد لكل بطاقة: 16 رقم فريد (Luhn) + PIN عشوائي 4 أرقام + QR payload موقّع + NFC payload موقّع.
- يعيد للأدمن CSV/JSON بكل الحقول للطباعة **مرة واحدة فقط** (لا يمكن استرجاعها لاحقًا).

### واجهة الأدمن — `AdminLevoCards`
- بعد إنشاء الدُفعة: عرض جدول بكل بطاقة (رقم | PIN | QR كصورة `qrcode.react` | NFC payload) مع أزرار:
  - **طباعة كل البطاقات** (تخطيط A4 مع 8 بطاقات/صفحة، كل بطاقة تُظهر الرقم مقسّم + QR + PIN مطبوع + مساحة NFC).
  - **تصدير CSV** (مشفّر كامل).
  - **تصدير NFC** (ملف JSON مخصص لبرنامج نسخ NFC).
- تحذير بارز: "احفظ هذه المعلومات الآن، لن تظهر مرة أخرى".

### تحديث `LevoCardActivator`
- 3 تبويبات: **رقم يدوي** (16 خانة + PIN 4 خانات) / **QR** (يقرأ payload → يستخرج الرقم + يطلب PIN) / **NFC** (`NDEFReader` يقرأ payload → يطلب PIN).
- كل مسار يستدعي نفس `levo_activate_card` مع `p_pin`.

## 4) اختبار (Vitest)

سيناريوهات إضافية:
- كوبون `levo_only` على سلة بها منتج البطاقة فقط → نجاح.
- كوبون `levo_only` على سلة مختلطة → رفض `COUPON_LEVO_ONLY`.
- كوبون عادي على سلة بها منتج البطاقة → رفض.
- تفعيل ببطاقة صحيحة + PIN خاطئ → رفض + تسجيل محاولة.
- 5 محاولات PIN خاطئة → قفل 15 دقيقة.
- تفعيل عبر QR بدون PIN → رفض.
- محاولة حذف منتج البطاقة من `AdminProductsTab` → رفض من الـ trigger.

## الملفات المتأثرة
- **جديد**: migration واحد يشمل الأعمدة + المنتج المحجوز + trigger الحذف + تعديل RPCs (`admin_generate_levo_cards`, `levo_activate_card`, `validate_coupon`).
- **تعديل**: `AdminLevoCards.tsx` (إضافة PIN/QR/NFC + طباعة + إدارة المنتج)، `LevoCardActivator.tsx` (حقل PIN + قراءة payload)، `CouponForm` في الأدمن (Switch جديد)، منطق حساب الكوبون في السلة (`useCartPricing` أو ما يعادله).
- **بدون تعديل**: `ProductShop`, `CartContext` الأساسي (يعمل تلقائيًا).
