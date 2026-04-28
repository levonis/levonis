# فصل بطاقات الولاء عن مستويات الحساب

## المشكلة الجذرية

حالياً يوجد جدول واحد `loyalty_levels` يخدم مفهومين مختلفين تماماً:

1. **مستوى الحساب**: 100 سجل (level_1 ... level_100) يمثلون تقدم المستخدم بناءً على XP/النقاط. يُحسبون من `user_points.level`.
2. **بطاقات الولاء المشتراة**: نفس الجدول، لكن بعض السجلات معلّمة بـ `is_purchasable=true` و`is_vip_plus=true` لتعمل كمنتجات قابلة للشراء بخصومات وامتيازات.

النتيجة:
- `user_cards.level_id` يشير إلى نفس المستويات التي تُمثّل التقدم.
- شارة المستوى (`LevelBadge`) تتحول إلى "VIP+" بسبب البطاقة بدلاً من إظهار الرقم الحقيقي.
- المنطق ملتبس في جميع المكونات (`ProfileHeader`, `CardsSection`, `useVipPlus`, `useCartCardDiscount`, إلخ).

## الحل: جدول `membership_cards` مستقل

```text
loyalty_levels (التقدم فقط)        membership_cards (المنتجات)
├── level_key, name, color         ├── card_key, name, color
├── min_points, xp_required        ├── price_points, wallet_price
└── display_order                  ├── duration_days
                                   ├── is_vip_plus
                                   ├── discount_percentage (+ caps)
                                   ├── free_shipping (+ rules)
                                   ├── frame_url, special_name_style
                                   └── benefits (jsonb)

user_points.level → loyalty_levels.level_key   (مستوى الحساب)
user_cards.card_id → membership_cards.id        (البطاقة المشتراة)
```

## الخطوات

### 1) قاعدة البيانات (Migration)

- إنشاء جدول جديد `membership_cards` يحوي كل الأعمدة المتعلقة بالبطاقات (السعر، VIP+، الخصومات، الإطارات، الامتيازات، التواريخ).
- إنشاء جدول `card_discounts` (مرتبط بـ `membership_cards.id` بدل `level_id` للمنتجات) — أو إعادة تسمية العمود.
- إعادة تسمية `user_cards.level_id` → `card_id` مع FK إلى `membership_cards`.
- **حذف جميع سجلات `user_cards` الموجودة** (تنفيذ "إعادة تعيين" حسب اختيارك).
- إزالة الأعمدة المخصصة للبطاقات من `loyalty_levels` (purchase_price_points, wallet_price, duration_days, is_purchasable, is_vip_plus, discount_percentage, free_shipping_*, frame_url, special_name_style, monthly_free_shipping, free_daily_games, wholesale_discount_enabled, investment_enabled, priority_*, exclusive_products, early_access, vip_support, card_discounts_enabled, free_tickets_monthly, discount_percentage_max_amount).
- نقل البطاقات الـ4 الحالية القابلة للشراء (level_1..level_4) كسجلات أولية في `membership_cards`.
- تحديث جميع دوال SQL المعنية (`get_user_card_*`, `purchase_card_*`, RPC الخصومات، إلخ) لاستخدام الجدول الجديد.
- تحديث RLS على `membership_cards` (قراءة عامة، كتابة admin فقط) و`user_cards` (المالك + admin).

### 2) الكود الأمامي

تحديث جميع المراجع للتمييز بين المستوى والبطاقة:

| الملف | التغيير |
|------|--------|
| `src/components/LevelBadge.tsx` | إزالة استعلام `user_cards`/`is_vip_plus`. الشارة تعرض رقم المستوى من XP فقط بدون أي تأثير من البطاقة. |
| `src/components/profile/ProfileHeader.tsx` | فصل الإطار/VIP+ عن لون المستوى. الإطار من البطاقة، رقم المستوى من XP. |
| `src/hooks/useVipPlus.ts` | استعلام `user_cards → membership_cards` بدل `loyalty_levels`. |
| `src/hooks/useProductCardDiscount.ts` | نفس الشيء. |
| `src/hooks/useCartCardDiscount.tsx` | نفس الشيء. |
| `src/hooks/useUserCardFrame.ts` | الإطار من `membership_cards.frame_url`. |
| `src/components/rewards/CardsSection.tsx` | عرض البطاقات من `membership_cards`. |
| `src/components/rewards/PointsSection.tsx` | عرض المستوى من `loyalty_levels` فقط، عرض البطاقة من `membership_cards`. |
| `src/components/rewards/panels/LoyaltyLevelsPanel.tsx` | تقسيم لـ panel للمستويات وآخر للبطاقات (أو فصل العرض داخل نفس الـpanel). |
| `src/pages/MyPoints.tsx` | المستوى من `loyalty_levels` فقط. |
| `src/pages/AdminUsers.tsx`, `AdminUserDetailsDialog`, `AdminPointsAuditTab`, `AdminLevelPrizesTab`, `AdminPendingOrdersSheet`, `AdminChats` | تحديث الاستعلامات. |
| `src/pages/Admin.tsx` + `AdminLoyaltyLevels.tsx` | فصل صفحة إدارة البطاقات (`AdminMembershipCards`) عن صفحة إدارة المستويات. |
| `src/components/ProductRewardsSection.tsx` | استخدام `membership_cards` للخصومات المعروضة. |

### 3) صفحة إدارة جديدة

إنشاء `src/pages/AdminMembershipCards.tsx` لإدارة جدول `membership_cards` (إنشاء، تعديل، تفعيل، خصومات، VIP+، إطار، مدة، سعر). صفحة `AdminLoyaltyLevels` تبقى لإدارة المستويات (XP، رقم، لون، اسم) فقط.

### 4) ذاكرة المشروع

تحديث memory برابط جديد: "Membership Cards Separated From Levels" يوضح الفصل المعماري ويمنع إعادة الدمج مستقبلاً.

## ملاحظات مهمة

- **حذف بيانات**: جميع `user_cards` الحالية ستُمسح (حسب اختيارك "إعادة تعيين البطاقات"). المستخدمون سيبدؤون بدون بطاقات نشطة.
- **مستويات XP لا تتأثر**: `user_points` يبقى كما هو، فلا يفقد أي مستخدم تقدمه.
- **الترجمة**: مفاتيح i18n جديدة لـ "البطاقة" مقابل "المستوى" في ar/en/ku.
- **شارة المستوى**: ستعرض دائماً "مستوى N" المحسوب من XP فقط، بغض النظر عن أي بطاقة.
- بعد التطبيق سنحتاج إعادة إعداد الـ4 بطاقات (برونزي 1-4) من شاشة الإدارة الجديدة، أو يتم نقلها تلقائياً ضمن الـmigration كقيم افتراضية.
