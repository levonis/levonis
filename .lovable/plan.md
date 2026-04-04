

# خطة تطوير شاملة: خصومات البطاقات + البروفايل + الثيمات

---

## الملخص

تنفيذ 6 محاور رئيسية: عرض خصومات البطاقة على المنتجات، تحسين السلة، إعادة بناء صفحة البروفايل العام، دمج البروفايل مع لوحة المتصدرين، إضافة خلفية بروفايل قابلة للتغيير، ونظام ثيمات ثلاثي.

---

## 1. عرض خصم البطاقة على بطاقات المنتجات

**الهدف**: عندما يمتلك المستخدم بطاقة ولاء نشطة، يظهر السعر المخفّض على كل منتج مؤهل مباشرة في الكتالوج.

- إنشاء hook جديد `useProductCardDiscount` يجلب بطاقة المستخدم النشطة ويحسب الخصم لكل منتج بناءً على `card_discounts` JSON.
- تعديل `ProductCard.tsx` لعرض السعر المخفّض بخط مشطوب على السعر الأصلي + أنيميشن بريق ذهبي (shimmer/sparkle) مع أيقونة البطاقة.
- تعديل `CompactProductCard` و`CommunityProductCard` بنفس المنطق.
- أنيميشن: إضافة keyframe `card-discount-shine` في `tailwind.config.ts` - تأثير خط ضوئي يتحرك عبر شريط الخصم.

## 2. تحسين شكل الخصم في السلة

- تعديل `GroupedCartItem.tsx` لإظهار شريط خصم البطاقة بتصميم glassmorphism مع أيقونة البطاقة واسم المستوى.
- إضافة سطر خصم البطاقة في ملخص السلة (`Cart.tsx`) بتأثير متحرك وأيقونة ✨.

## 3. خلفية البروفايل القابلة للتغيير

- إضافة عمود `cover_image_url` إلى جدول `profiles` عبر migration.
- تعديل `UserInfoProfileCard.tsx` لإضافة زر تغيير الخلفية فوق البانر.
- رفع الصورة إلى storage bucket `avatars` (أو إنشاء bucket جديد `covers`).
- عرض الخلفية المخصصة في `ProfileHeader.tsx` و`PublicProfile.tsx`.

## 4. إعادة بناء صفحة البروفايل العام (`PublicProfile.tsx`)

**التصميم الجديد:**

```text
┌─────────────────────────────┐
│  صورة خلفية البروفايل       │
│  ┌──────┐                   │
│  │ صورة │ الاسم + @يوزر    │
│  │+إطار │ المستوى + العضوية │
│  └──────┘                   │
├─────────────────────────────┤
│  [🎮 الألعاب] [👥 المجتمع]  │  ← تبويبات
├─────────────────────────────┤
│  قسم الألعاب (افتراضي إذا   │
│  دخل من صفحة لعبة):         │
│  - أعلى سكور لكل لعبة       │
│  - عدد المرات + وقت اللعب   │
│  - إحصائيات البرج            │
│                              │
│  قسم المجتمع:                │
│  - معلومات التاجر/العميل     │
│  - شريط السمعة               │
│  - زر تواصل                  │
└─────────────────────────────┘
```

- إضافة query param `?tab=games` للفتح على تبويب الألعاب تلقائياً.
- جلب إحصائيات الألعاب من `stack_game_high_scores` و`knife_rain_high_scores`.
- عرض بطاقة المستخدم (اسم + يوزر + صورة + خلفية + مستوى + عضوية) بتصميم premium.

## 5. دمج البروفايل مع لوحة المتصدرين

- تعديل `StackGame.tsx` و`KnifeRainGame.tsx`: في قائمة المتصدرين، إضافة صورة المستخدم (avatar) بجانب الاسم.
- جعل كل صف في المتصدرين قابلاً للنقر → يفتح `/profile/{userId}?tab=games`.
- جلب `avatar_url` ضمن `get_public_profiles` RPC الموجود.

## 6. نظام الثيمات الثلاثي

**الثيمات:**
1. **اللون الأساسي** (الحالي): أخضر داكن + ذهبي
2. **أبيض باهت**: أبيض طافي + ذهبي + زيتوني
3. **أسود ليلي**: أسود عميق + زيتوني + ذهبي

**التنفيذ:**
- إضافة CSS variables لكل ثيم في `index.css` تحت classes: `.theme-light`, `.theme-dark`, `:root` (default).
- إنشاء `ThemeProvider` context + hook `useTheme` يحفظ الاختيار في `localStorage`.
- إضافة زر تبديل الثيم في البروفايل/الإعدادات (3 دوائر ملونة).
- تطبيق class الثيم على `<html>` element.

---

## التعديلات على قاعدة البيانات

1. **Migration**: إضافة `cover_image_url TEXT` إلى `profiles`
2. **Migration**: إضافة جدول `game_play_stats` (اختياري) أو الاعتماد على الجداول الموجودة

## الملفات المتأثرة

| ملف | تعديل |
|------|--------|
| `src/components/ProductCard.tsx` | عرض خصم البطاقة |
| `src/components/merchant/CompactProductCard.tsx` | عرض خصم البطاقة |
| `src/components/GroupedCartItem.tsx` | تحسين شكل الخصم |
| `src/pages/Cart.tsx` | تحسين ملخص الخصم |
| `src/pages/PublicProfile.tsx` | إعادة بناء كاملة |
| `src/components/profile/ProfileHeader.tsx` | خلفية مخصصة |
| `src/components/user-info/UserInfoProfileCard.tsx` | رفع خلفية |
| `src/components/games/stack-game/StackGame.tsx` | متصدرين + بروفايل |
| `src/components/games/knife-rain/KnifeRainGame.tsx` | متصدرين + بروفايل |
| `src/hooks/useProductCardDiscount.ts` | hook جديد |
| `src/hooks/useTheme.ts` | hook جديد |
| `src/components/ThemeProvider.tsx` | جديد |
| `src/index.css` | ثيمات جديدة |
| `tailwind.config.ts` | أنيميشن جديدة |

