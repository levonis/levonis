## نظرة عامة

بناء تدفق كامل لطلب بطاقة ليفو الفيزيائية: منع الخلط مع منتجات أخرى، جمع بيانات المستخدم في السلة، إرسال الطلب للأدمن، وعند الموافقة تخصيص أول بطاقة متاحة تلقائيًا + إنشاء فاتورة + إرسال البيانات كاملة عبر الإيميل.

---

## 1) قاعدة البيانات

**Migration جديد يضيف:**

- جدول `levo_card_orders`:
  - `id, user_id, order_id (nullable, يُملأ عند الدفع), status ('pending_payment' | 'paid_pending_approval' | 'approved' | 'rejected')`
  - `full_name_triple TEXT` (الاسم الثلاثي)
  - `birth_date DATE`
  - `email TEXT`
  - `assigned_card_id UUID` (يُملأ عند الموافقة)
  - `admin_notes TEXT, rejection_reason TEXT`
  - `approved_at, approved_by, created_at, updated_at`
  - RLS: مالك يقرأ/ينشئ الخاص به فقط، أدمن يقرأ/يعدل الكل
  - GRANT authenticated + service_role

- RPC `submit_levo_card_order(p_full_name, p_birth_date, p_email)`:
  - يتحقق أن السلة تحتوي فقط منتج البطاقة الفيزيائية
  - يُنشئ سجل بحالة `pending_payment` مرتبط بالمستخدم
  - يُرجع `order_id` للربط عند الـ checkout

- RPC `approve_levo_card_order(p_order_id, p_admin_notes)`:
  - `SECURITY DEFINER`، أدمن فقط
  - يُقفل أول `levo_physical_cards` بحالة `available` (`FOR UPDATE SKIP LOCKED`)
  - يستدعي منطق تخصيص البطاقة الموجود (نفس منطق `levo_activate_card` لكن يدويًا من الأدمن)
  - يُنشئ سجل في `saved_invoices` تلقائيًا
  - يستدعي edge function `send-levo-card-email` لإرسال البيانات
  - يُحدّث الحالة إلى `approved`

- RPC `reject_levo_card_order(p_order_id, p_reason)` مع استرداد المبلغ للمحفظة

- Trigger على `orders` عند الدفع: يُحدّث `levo_card_orders.status → 'paid_pending_approval'` وربط `order_id`

---

## 2) Edge Function

**`send-levo-card-email`** جديدة:
- تستخدم `send-transactional-email` الحالية مع قالب جديد `levo-card-activation`
- المدخلات: `card_number, pin_plaintext, qr_token, nfc_token, user_name, expiry_date`
- القالب يعرض: رقم البطاقة، PIN، QR كصورة (data URL)، NFC token، تعليمات التفعيل

**قالب جديد** في `supabase/functions/_shared/transactional-email-templates/levo-card-activation.tsx`

---

## 3) واجهة المستخدم

### أ. صفحة منتج البطاقة / زر "اطلب بطاقتك"
- `OrderLevoCardCta.tsx` الموجود: قبل إضافة البطاقة للسلة، يتحقق أن السلة فارغة تمامًا
- إذا كانت هناك منتجات: **حوار تحذير** "لا يمكن إضافة البطاقة مع منتجات أخرى" مع زرين: (تفريغ السلة والمتابعة) أو (إلغاء)

### ب. في السلة (Cart.tsx)
- كشف أن السلة تحتوي منتج البطاقة → عرض بطاقة "بيانات طلب البطاقة" (`LevoCardOrderForm.tsx` جديد)
- الحقول:
  - **الاسم الثلاثي** (3 حقول: الأول، الأب، الجد) — إلزامي، تُدمج
  - **تاريخ الميلاد** — Date picker إلزامي
  - **الإيميل** — إلزامي (prefill من `auth.user.email`)
- Validation بـ Zod (اسم كل جزء ≥ 2 حروف، عمر ≥ 10 سنوات)
- Checkbox: "أؤكد صحة البيانات — لا يمكن التعديل بعد الدفع"
- زر الـ Checkout معطّل حتى تُملأ البيانات وتُؤكّد
- عند الـ checkout يُستدعى `submit_levo_card_order` قبل إنشاء الـ order

### ج. حماية الخلط (CartContext)
- قاعدة مطلقة في `addToCart`: إذا كان المنتج المُضاف هو منتج البطاقة الفيزيائية → السلة يجب أن تكون فارغة، والعكس صحيح (لا يُسمح بإضافة منتج آخر لسلة فيها بطاقة). تندمج مع منطق `mutually-exclusive-categories` الحالي كفئة جديدة `levo_physical_card`.

### د. صفحة "بطاقاتي" (CardsSection)
- إذا كان للمستخدم طلب `pending_payment` / `paid_pending_approval` → بطاقة حالة "طلبك قيد المراجعة"
- إذا `rejected` → عرض السبب مع زر إعادة الطلب

---

## 4) لوحة الأدمن — قسم جديد في الولاء

**صفحة جديدة `AdminLevoCardOrders.tsx`** في مسار `${ADMIN_BASE_PATH}/loyalty/card-orders`:

- Tabs: قيد المراجعة / موافَق / مرفوض
- كل صف يعرض:
  - اسم المستخدم + إيميل الحساب
  - **بيانات الطلب**: الاسم الثلاثي، تاريخ الميلاد، الإيميل المُدخل
  - حالة الدفع + رقم الطلب المرتبط
  - أزرار: **موافقة** (تستدعي `approve_levo_card_order` → تعرض toast بالبطاقة المُخصصة) / **رفض** (dialog لسبب الرفض)
- إضافة كارت اختصار في صفحة إدارة الولاء الرئيسية

**تسجيل الصفحة** في `App.tsx` + إضافة رابط في قائمة أدمن الولاء الحالية.

---

## 5) ملفات ستُنشأ / تُعدّل

**جديد:**
- `supabase/migrations/{ts}_levo_card_orders.sql`
- `supabase/functions/send-levo-card-email/index.ts`
- `supabase/functions/_shared/transactional-email-templates/levo-card-activation.tsx` + تسجيل في registry
- `src/components/rewards/LevoCardOrderForm.tsx`
- `src/pages/AdminLevoCardOrders.tsx`

**تعديل:**
- `src/components/rewards/OrderLevoCardCta.tsx` — تحقق السلة الفارغة + حوار التحذير
- `src/context/CartContext.tsx` (أو ما يعادله) — قاعدة الحصرية
- `src/pages/Cart.tsx` — عرض النموذج + منع checkout حتى الاكتمال
- `src/components/rewards/CardsSection.tsx` — عرض حالة الطلب
- `src/App.tsx` — تسجيل route الأدمن الجديد
- صفحة أدمن الولاء الرئيسية — رابط للقسم الجديد

---

## 6) قرارات مُثبَّتة (من الإجابات)

- الدفع أولاً ثم موافقة الأدمن → الحالة تنتقل تلقائيًا عبر trigger على `orders`
- تخصيص تلقائي لأول بطاقة `available` عند الموافقة
- الإيميل يحتوي: رقم البطاقة الكامل + PIN + QR + NFC
- بيانات الطلب (اسم ثلاثي، تاريخ ميلاد، إيميل) تُحفظ في `levo_card_orders` فقط ولا تُغيّر `profiles`

## 7) خارج النطاق

- لا تعديل على `membership_cards` أو أسعار البطاقة (تُدار من الشاشة الحالية)
- لا تغيير على منطق `validate_coupon_with_rate_limit` الحالي
