# خطة: إضافة دور "مساعد الأدمن" (Admin Assistant)

## نظرة عامة
إضافة دور جديد `assistant` للنظام يمنح المستخدم وصولاً إلى لوحة التحكم بصلاحيات محدودة وآمنة، مع إخفاء كامل للبيانات المالية الحساسة (الربح، التكلفة، تكلفة الشحن، عمولة، breakdown الدفع).

---

## 1. قاعدة البيانات (Migration)

### أ. توسيع `app_role` enum
```sql
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'assistant';
```

### ب. دوال صلاحيات جديدة
- `is_assistant_or_admin(_user_id uuid) → boolean` — يعيد true إذا كان admin أو assistant.
- `is_admin_strict(_user_id uuid) → boolean` — admin فقط (للحقول الحساسة).

### ج. تحديث RLS Policies
- `orders` / `order_items` / `products` / `product_offers`: السماح للمساعد بـ SELECT/UPDATE على الأعمدة غير الحساسة.
- منع المساعد من DELETE على `orders` و`products`.
- منع UPDATE على أعمدة السعر/الخصم في `orders` (cart_total, discount_amount, wallet_used, cod_amount).

### د. Views محدودة للمساعد
- `orders_assistant` — يستثني: profit, cost, commission, shipping_cost, wallet breakdown, cod breakdown.
- `order_items_assistant` — يستثني: cost, profit.
- `products_assistant` — يستثني: cost, commission, shipping_cost, profit_margin.
- `product_offers_assistant` — يستثني: cost_price.

### هـ. RPC مقيدة
- `assistant_update_order_status(_order_id, _status)` — تحديث الحالة فقط.
- `assistant_update_product(_product_id, _updates jsonb)` — تتحقق من الحقول المسموحة فقط (name, description, images, colors, options, base price, original_price). ترفض أي حقل حساس.

### و. إدارة المساعدين
- جدول جديد للأذونات ليس مطلوباً — نستخدم `user_roles` الموجود.
- RPC: `admin_add_assistant_by_email(_email text)` — يبحث في `profiles` بالإيميل، يضيف صف `('user_id', 'assistant')` في `user_roles`. service_role/admin فقط.
- RPC: `admin_remove_assistant(_user_id uuid)` — حذف الصف.
- RPC: `admin_list_assistants()` — يعيد قائمة المساعدين مع إيميلاتهم وأسمائهم.

---

## 2. الواجهة الأمامية

### أ. تحديث `useAuth`
- إضافة `isAssistant: boolean` و`isAdminOrAssistant: boolean` بجانب `isAdmin`.
- جلب الدور من `user_roles` كما هو الحال.

### ب. تحديث `AdminRoute`
- السماح بالدخول لـ admin و assistant.
- إضافة prop جديد: `requireFullAdmin?: boolean` — لو true، يسمح فقط للأدمن الكامل.

### ج. مكون جديد: `AssistantRoute`
- مثل `AdminRoute` لكن يقبل assistant.

### د. تعديل الراوتر (`App.tsx`)
- الصفحات التالية تُغلَّف بـ `AssistantRoute` (متاحة للمساعد):
  - Orders, Notifications, Announcements (الشريط), Coupons, ProductBundles, CustomRequests, DefaultSettings, PointsSettings, LoyaltyLevels, LoyaltyCardCodes, Wallet, WalletSettings, Chats, SavedInvoices, Donations, PartialPaymentSettings, Competitions, ProductOffers, OfferPurchases, PrinterProtection, ShippingSettings, LevoCommunity (+children), Users, Stories, GamesSettings, PriceMatch, Wishes, Reviews, PriceProtection, Winners, RandomFilament, Print3DPricing.
- الصفحات التالية تبقى محصورة على الأدمن فقط (`requireFullAdmin`):
  - Financials, FinancialDrafts, Inventory (التكلفة), Dashboard المالي، إدارة المساعدين، RotateKeys، إلخ.

### هـ. صفحة جديدة: `AdminAssistants.tsx`
- المسار: `${ADMIN_BASE_PATH}/assistants` (admin فقط).
- نموذج: حقل إيميل + زر "إضافة مساعد" → ينادي `admin_add_assistant_by_email`.
- قائمة المساعدين الحاليين مع زر "إزالة".

### و. تعديل صفحات الطلبات والمنتجات للمساعد
- `AdminOrders` / `OrderDetailsDialog`: لو `isAssistant && !isAdmin`:
  - يستعلم من `orders_assistant` / `order_items_assistant` بدلاً من الجداول الأصلية.
  - يخفي بطاقات: الأرباح، التكلفة، Wallet/COD breakdown، تعديل السعر، حذف الطلب.
  - يبقي: العنوان، المنتجات، الكمية، الحالة، تحديث الحالة.
- `AdminProducts` / `ProductsTable` / `EditProductDialog`:
  - استعلام من `products_assistant`.
  - يخفي حقول: cost, commission, shipping_cost, profit.
  - يعطل: زر الحذف، زر الإنشاء الجديد.
  - يبقي: تعديل name/description/images/colors/options/price/original_price فقط.

### ز. لوحة التحكم الجانبية (Sidebar)
- إخفاء روابط الأقسام المالية الحساسة وزر "حذف الطلب" و"إنشاء منتج جديد" عند `isAssistant && !isAdmin`.
- إخفاء رابط "المساعدين" من لوحة المساعد.

---

## 3. الأمان (مهم جداً)

- جميع التحققات تتم على **مستوى قاعدة البيانات** عبر RLS + Views + RPC، وليس على مستوى الواجهة فقط.
- الواجهة تخفي العناصر لتحسين UX، لكن حتى لو حاول المساعد استدعاء API مباشر، سيرفضه الـ RLS/Views.
- الـ Views تعتمد `WITH (security_invoker=on)` لتطبيق RLS.
- `admin_add_assistant_by_email` تتحقق `has_role(auth.uid(), 'admin')` قبل التنفيذ.

---

## 4. التفاصيل التقنية

```text
الملفات الجديدة:
- src/components/AssistantRoute.tsx
- src/pages/AdminAssistants.tsx

الملفات المعدلة:
- src/hooks/useAuth.tsx (إضافة isAssistant)
- src/App.tsx (لف المسارات المسموحة بـ AssistantRoute)
- src/config/adminConfig.ts (إضافة مسار assistants)
- src/components/admin/AdminSidebar (أو ما يعادله) (إخفاء عناصر)
- src/pages/AdminOrders.tsx + OrderDetailsDialog (استعلام مشروط)
- src/pages/Admin (products page) + ProductsTable + EditProductDialog (استعلام/إخفاء مشروط)

Migration واحدة تشمل:
- ALTER TYPE app_role
- security definer functions
- views (orders_assistant, order_items_assistant, products_assistant, product_offers_assistant)
- RPCs (assistant_update_order_status, assistant_update_product, admin_add_assistant_by_email, admin_remove_assistant, admin_list_assistants)
- GRANT على الـ views للـ authenticated
- تحديث RLS على orders/products للسماح للمساعد بالقراءة
```

---

## 5. خارج النطاق (لاحقاً عند الطلب)
- صلاحيات أدق لكل قسم (الآن: متطابقة مع الأدمن في الأقسام الإدارية المذكورة).
- سجل تدقيق لتعديلات المساعد (audit log).
