

# خطة التحسينات — Crossy Road + البروفايل + المتصدرين

## 1. تحكم بالنقاط والسكور (إعدادات + DB)

### حالياً:
- `points_per_step` و `bonus_coin_points` موجودان ويؤثران على **نقاط الموقع فقط**
- سكور اللعبة يأتي خام من Canvas ولا يتأثر بالإعدادات
- `max_daily_plays` موجود (حد المحاولات)، لكن لا يوجد **حد يومي للنقاط**

### المطلوب:
- إضافة أعمدة جديدة: `score_per_step` و `score_per_coin` (للسكور المعروض في اللعبة)
- إضافة `max_daily_points` (حد يومي للنقاط — يختلف عن حد المحاولات)
- تحديث `end_crossy_road` ليحسب السكور من إعدادات منفصلة + يفرض الحد اليومي على النقاط فقط
- تحديث واجهة الإدارة لعرض الحقول الجديدة مقسمة: قسم "نقاط الموقع" وقسم "سكور اللعبة"

### Migration:
```sql
ALTER TABLE crossy_road_settings
  ADD COLUMN IF NOT EXISTS score_per_step integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS score_per_coin integer DEFAULT 5,
  ADD COLUMN IF NOT EXISTS max_daily_points integer;

ALTER TABLE crossy_road_settings
  ADD COLUMN IF NOT EXISTS season_ends_at timestamptz;

ALTER TABLE crossy_road_high_scores
  ADD COLUMN IF NOT EXISTS all_time_high_score integer DEFAULT 0;

UPDATE crossy_road_high_scores SET all_time_high_score = high_score WHERE true;
```

### تحديث `end_crossy_road`:
- حساب `game_score = (steps * score_per_step) + (coins * score_per_coin)`
- حساب `site_points = (steps * points_per_step) + (coins * bonus_coin_points)`
- فحص الحد اليومي: `SELECT COALESCE(SUM(points_awarded),0) FROM crossy_road_sessions WHERE user_id = v_user_id AND ended_at::date = CURRENT_DATE` — إذا تجاوز `max_daily_points` يعطي `site_points = 0`
- إرجاع `game_score` المحسوب بدلاً من `p_score`

### تحديث `update_crossy_road_high_score`:
- تحديث `all_time_high_score = GREATEST(all_time_high_score, p_score)` دون تصفيره عند بدء موسم جديد

### تحديث `admin_award_crossy_road_winners`:
- عدم تصفير `all_time_high_score` عند إعادة التعيين
- دعم `season_ends_at`

---

## 2. إخفاء الألعاب المعطلة من البروفايل

**الملف**: `PublicProfile.tsx`
- جلب `game_enabled` من `crossy_road_settings`, `stack_game_settings`, `knife_rain_settings`
- إخفاء قسم اللعبة إذا `game_enabled = false`

---

## 3. استخدام اليوزرنيم في روابط البروفايل

**الملف**: `PublicProfile.tsx`
- إذا لم يكن `params.userId` بصيغة UUID → البحث بـ `username`
- تحديث جميع الملفات التي تستخدم `navigate('/profile/${id}')` لاستخدام `username` إن وُجد:
  - `PlayerProfileDialog.tsx`
  - `ChatTopBar.tsx`, `AdminChatTopBar.tsx`
  - `CustomerRequestStrip.tsx`, `RequestDetailModal.tsx`
  - `AdminUsers.tsx`

---

## 4. عداد الموسم

- إضافة `season_ends_at` للإعدادات (في Migration أعلاه)
- **الإدارة** (`CrossyRoadTab.tsx`): إضافة حقل تاريخ لانتهاء الموسم + عرض عداد تنازلي
- **اللعبة** (`CrossyRoadGame.tsx`): عرض عداد تنازلي لانتهاء الموسم في القائمة الرئيسية

---

## 5. قائمة متصدرين All-Time

- إضافة `all_time_high_score` لـ `crossy_road_high_scores` (في Migration أعلاه)
- **اللعبة** (`CrossyRoadGame.tsx`): إضافة تبويب "الأفضل على الإطلاق" في المتصدرين
- **الإدارة** (`CrossyRoadTab.tsx`): عرض All-Time في تبويب المتصدرين

---

## الملفات المتأثرة
- **Migration جديد** — أعمدة + تحديث 3 دوال RPC
- `src/components/admin/CrossyRoadTab.tsx` — حقول جديدة + عداد + all-time
- `src/components/games/crossy-road/CrossyRoadGame.tsx` — all-time tab + عداد + score settings
- `src/pages/PublicProfile.tsx` — username routing + إخفاء ألعاب معطلة
- `src/components/games/PlayerProfileDialog.tsx` — username link
- `src/components/chat/ChatTopBar.tsx` — username link
- `src/components/chat/AdminChatTopBar.tsx` — username link
- `src/components/community/CustomerRequestStrip.tsx` — username link
- `src/components/community/RequestDetailModal.tsx` — username link
- `src/pages/AdminUsers.tsx` — username link

