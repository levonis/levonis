
## خطة: عداد الموسم + الأفضل على الإطلاق لكل الألعاب

### الوضع الحالي
- **Crossy Road**: يحتوي بالفعل على `season_ends_at` + عدّاد + تبويب "الموسم/الأفضل على الإطلاق" (`all_time_high_score`) ✅
- **Stack Tower**: عمود `season` موجود في `stack_game_high_scores`، لكن **لا يوجد**: `season_ends_at`، `season_name`، حقل all-time، عدّاد في الواجهة، تبويب "الأفضل على الإطلاق"
- **Knife Rain**: **لا يوجد**: `season`, `season_ends_at`, `season_name`, all-time، عدّاد، تبويب
- **MyReferral.tsx**: خطأ بناء — العمود الصحيح `phone_number` وليس `phone`

### التنفيذ

**1. إصلاح خطأ البناء في `MyReferral.tsx`**
- تغيير `select("username, full_name, phone")` → `select("username, full_name, phone_number")`
- استخدام `profile?.phone_number` في رسالة التليكرام

**2. Migration: توحيد حقول الموسم**
أضف لكل من `stack_game_settings`، `knife_rain_settings`، `crossy_road_settings`:
- `season_starts_at TIMESTAMPTZ` (موعد بدء الموسم)
- `season_name TEXT DEFAULT 'الموسم الأول'`
- (`crossy_road_settings.season_ends_at` موجود؛ نضيفها لـ Stack/KnifeRain أيضاً)
- `season_ends_at TIMESTAMPTZ` لـ Stack/KnifeRain

أضف لـ `stack_game_high_scores` و `knife_rain_high_scores`:
- `all_time_high_score INTEGER DEFAULT 0` (يُحدَّث عند تسجيل نتيجة ≥ السابقة)
- لـ knife: عمود `season INTEGER DEFAULT 1` أيضاً

Trigger يُحدِّث `all_time_high_score = GREATEST(OLD.all_time_high_score, NEW.high_score)` تلقائياً عند UPDATE/INSERT.

**3. إعدادات الأدمن (`StackGameTab`, `KnifeRainTab`, `CrossyRoadTab`)**
أضف حقول قابلة للتحرير:
- اسم الموسم (مثل "الموسم الثاني")
- تاريخ بدء الموسم (datetime-local)
- تاريخ انتهاء الموسم (datetime-local)
حفظ في الجداول المعنية.

**4. واجهة اللعبة (`StackGame.tsx`, `KnifeRainGame.tsx`)**
أضف لكل لعبة في تبويب "المتصدرين":
- مكوّن `SeasonHeader` يعرض: اسم الموسم + موعد البدء + عدّاد تنازلي حيّ لانتهاء الموسم
- شريط تبديل "الموسم الحالي / الأفضل على الإطلاق" (مثل Crossy Road)
- استعلام إضافي يجلب أعلى 10 على `all_time_high_score`
- عند `lbView === "alltime"` نعرض `all_time_high_score` بدل `high_score`

**5. Crossy Road**
- إضافة عرض **اسم الموسم** و **موعد البدء** بجانب العدّاد الموجود (تحديث `SeasonCountdownBanner`).

### الملفات المتأثرة
- `src/pages/MyReferral.tsx` (إصلاح phone)
- `supabase/migrations/...` (جديد)
- `src/components/admin/StackGameTab.tsx`, `KnifeRainTab.tsx`, `CrossyRoadTab.tsx`
- `src/components/games/stack-game/StackGame.tsx`
- `src/components/games/knife-rain/KnifeRainGame.tsx`
- `src/components/games/crossy-road/CrossyRoadGame.tsx`

### النتيجة
كل لعبة (Stack، Knife Rain، Crossy Road) ستعرض في قائمة المتصدرين:
- اسم الموسم + موعد البدء + عدّاد تنازلي للانتهاء
- تبديل بين "الموسم الحالي" و "الأفضل على الإطلاق"
- الأدمن يتحكم بكل شيء من لوحة الإدارة
