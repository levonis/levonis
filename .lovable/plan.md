
# إصلاح قسم "جوائزي" — عرض الجوائز + نقل الزر

## المشاكل

1. **الجوائز لا تظهر في صفحة الألعاب**: مكون `MyGamePrizes.tsx` يستعلم من جدول `game_prizes` الذي هو **فارغ تماماً**. الجوائز الفعلية موجودة في:
   - `stack_game_winners` (جوائز البرج)
   - `crossy_road_winners` (جوائز Crossy Road)  
   - `competition_prizes` (جوائز صندوق الغموض والمسابقات)

2. **زر "جوائزي من الألعاب" موجود في البروفايل**: يجب حذفه من `/profile` لأنه موجود أصلاً في `/games`

---

## التعديلات

### 1. إصلاح `MyGamePrizes.tsx` — الاستعلام من الجداول الصحيحة

بدلاً من الاستعلام من `game_prizes`، سيستعلم من الجداول الثلاثة الحقيقية (نفس المنطق المستخدم في Profile.tsx ولكن مع بيانات أكثر مثل `product_id` و `is_delivered`/`status`):

```ts
const [crossy, stack, comp] = await Promise.all([
  supabase.from("crossy_road_winners").select("*").eq("user_id", user.id),
  supabase.from("stack_game_winners").select("*").eq("user_id", user.id),
  supabase.from("competition_prizes").select("*").eq("user_id", user.id),
]);
```

سيتم تحويل البيانات لتنسيق موحد يشمل: `prize_name_ar`, `game_name`, `product_id`, `prize_image_url`, `is_delivered`, `created_at`

تحديث منطق "إضافة للسلة" ليبحث عن المنتج المرتبط من الجدول الصحيح (stack_game_milestones أو crossy_road_leaderboard_prizes) بدلاً من `game_prizes` فقط.

### 2. حذف زر وديالوج "جوائزي" من `Profile.tsx`

- حذف زر "جوائزي من الألعاب" (سطر 78-87)
- حذف Dialog المرتبط به (سطر 96-132)
- حذف state `prizesOpen` والاستعلام `myPrizes` غير المستخدمين

---

## الملفات المتأثرة
- `src/components/games/MyGamePrizes.tsx` — إصلاح الاستعلام
- `src/pages/Profile.tsx` — حذف زر وديالوج الجوائز
