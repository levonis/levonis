

# إصلاح: أعمدة مفقودة في crossy_road_settings و crossy_road_high_scores

## المشكلة
الـ migration السابق أعاد إنشاء الدوال فقط ولم يضف الأعمدة الجديدة المطلوبة للجداول.

## الحل
إنشاء migration جديد يضيف الأعمدة المفقودة:

```sql
-- crossy_road_settings
ALTER TABLE crossy_road_settings
  ADD COLUMN IF NOT EXISTS score_per_step integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS score_per_coin integer DEFAULT 5,
  ADD COLUMN IF NOT EXISTS max_daily_points integer,
  ADD COLUMN IF NOT EXISTS season_ends_at timestamptz;

-- crossy_road_high_scores
ALTER TABLE crossy_road_high_scores
  ADD COLUMN IF NOT EXISTS all_time_high_score integer DEFAULT 0;

UPDATE crossy_road_high_scores SET all_time_high_score = high_score WHERE true;
```

## الملفات المتأثرة
- **Migration جديد** فقط — لا تغييرات على الكود

