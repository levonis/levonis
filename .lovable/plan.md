
## خطة: إصلاح "الأفضل على الإطلاق" في لعبة THE TOWER

### المشكلة
لوحة "الأفضل على الإطلاق" لا تعرض اللاعبين القدامى لأن العمود `all_time_high_score` يساوي 0 لجميع السجلات في `stack_game_high_scores`. السبب أن إعادة تصفير الموسم (Season Reset) صفّرت `high_score` قبل أن يقوم الـ trigger بنقل القيم إلى `all_time_high_score`، فضاعت قمم اللاعبين القدامى من اللوحة (لكنها ما زالت محفوظة في `stack_game_sessions`).

نفس المشكلة محتملة في:
- `knife_rain_high_scores` (نفس بنية الـ trigger).
- `crossy_road_high_scores` (إن وُجد جدول runs مماثل).

### الحل (3 خطوات عبر migration واحد)

**1. ترحيل (Backfill) القيم التاريخية من جداول الجلسات**
   - `stack_game_high_scores.all_time_high_score` ← `MAX(score)` لكل user_id من `stack_game_sessions`.
   - تحديث فقط إذا كانت القيمة الجديدة أكبر من الحالية.
   - إدراج صفوف ناقصة لأي مستخدم له جلسات لكن بلا سجل high_score.
   - تطبيق نفس المنطق على `knife_rain_high_scores` من جدول جلسات Knife Rain (إن وُجد) و`crossy_road_high_scores` من `crossy_road_sessions` (إن وُجد).

**2. تحصين منطق إعادة تصفير الموسم**
   - تعديل أي دالة/كود يقوم بـ season reset (مثل `reset_stack_season` أو UPDATE في `StackGameTab.tsx`) لتضمن:
     `all_time_high_score = GREATEST(all_time_high_score, high_score)` **قبل** تصفير `high_score = 0`.
   - فحص المهاجرات (migrations) والكود الإداري (`StackGameTab.tsx`, `KnifeRainTab.tsx`, `CrossyRoadTab.tsx`) للعثور على نقاط التصفير وتعديلها.

**3. تحسين الـ trigger ليكون مقاوماً للتصفير المباشر**
   - تعديل `update_all_time_high_score()`: إذا كانت `NEW.high_score < OLD.high_score` (تصفير)، نأخذ `OLD.high_score` بعين الاعتبار في حساب القمة قبل التصفير. يضمن هذا أن أي تصفير مستقبلي لن يفقد القمة.

### الملفات/المكونات المتأثرة
- migration جديد:
  - Backfill `all_time_high_score` من `stack_game_sessions` / `knife_rain_sessions` / `crossy_road_sessions` (إن وُجدت).
  - تحديث دالة الـ trigger `update_all_time_high_score`.
- `src/components/admin/StackGameTab.tsx` و`KnifeRainTab.tsx` و`CrossyRoadTab.tsx`: مراجعة منطق "Season Reset" لضمان حفظ القمم قبل التصفير.

### النتيجة
- لوحة "الأفضل على الإطلاق" في THE TOWER (وKnife Rain/Crossy Road) ستعرض جميع اللاعبين القدامى بقممهم الحقيقية المستردّة من الجلسات.
- لن تتكرر الكارثة عند أي تصفير موسم مستقبلي.
