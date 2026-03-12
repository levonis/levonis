
هدف التنفيذ:
إصلاح شريط Mystery Case ليكون Infinite فعليًا بدون نهاية مرئية (قبل اللف/أثناء السحب/أثناء اللف)، مع منع اختفاء الجوائز وضمان توقف الجائزة الفائزة تحت المؤشر مثل CS:GO.

1) تشخيص سريع للمشاكل الحالية
- الشريط يعتمد على 3 نسخ فقط + normalize modulo؛ هذا قد يسبب قفزات مرئية عند الحدود ويظهر إحساس “النهاية”.
- أثناء spin يتم إعادة بناء strip بالكامل في نفس اللحظة، ما قد ينتج frame فارغ/اختفاء على الأجهزة الضعيفة.
- منطق السحب الحالي قد ينهي السحب مبكرًا (pointer leave) ويُظهر سلوك غير مستقر عند الأطراف.
- رغم أن 0% موجودة نظريًا في العرض، نحتاج تثبيت فصل واضح بين visual pool وwinning pool حتى لا تختفي بصريًا مع أي إعادة بناء.

2) خطة التعديل (Frontend)
A) إعادة بناء ReelSpinner كـ “Loop Engine” ثابت
- إنشاء baseStrip بصري (80–120 عنصر) من جميع العناصر النشطة (بما فيها 0%).
- عمل renderStrip = baseStrip مكرر 5 مرات (بدل 3) لتوسيع مساحة الحركة.
- البدء دائمًا من النسخة الوسطى (middle segment) لتفادي الوصول لأي طرف.
- إضافة wrap/recenter logic بدل normalize القافز:
  - إذا خرج virtualX عن نافذة آمنة، نضيف/نطرح segmentWidth لإرجاعه للوسط بدون أي فرق بصري.
- إبقاء DOM للشريط mounted دائمًا (لا clear/reset للعناصر).

B) تثبيت idle + drag + inertia بدون اختفاء
- idle animation مستمر عبر requestAnimationFrame + translate3d.
- drag بالـ pointer/touch مع momentum، مع إلغاء إنهاء السحب على pointerLeave والاعتماد على pointer capture + up/cancel.
- كل frame: تحديث virtualX ثم applyTransform ثم wrapIfNeeded.

C) Spin flow احترافي بدون فراغ
- عند الضغط على لف:
  1) إيقاف idle فقط (بدون إزالة العناصر).
  2) استلام winner من السيرفر.
  3) بناء spinStrip جديد مع إدراج winner في stop slot بعيد داخل النسخة الوسطى/اللاحقة.
  4) تشغيل 3 مراحل الحركة (accel → cruise → decel) 3.5–4.5s.
  5) إنهاء بمحاذاة دقيقة للمؤشر المركزي.
- منع أي لحظة تكون فيها repeated strip فارغة.

D) استقرار البيانات في MysteryCase
- تمرير winner بالـ id (أو index محسوب من snapshot ثابت) لتفادي mismatch عند أي refetch.
- تثبيت visual items أثناء spin (عدم تبديل source list في منتصف الحركة).

3) ضمان ظهور عناصر 0%
- واجهة الشريط (visual strip): جميع rewards النشطة بما فيها drop_chance=0.
- الفوز الفعلي: يظل كما هو سيرفر-سايد من winningPool (>0 فقط).
- لا تغييرات قاعدة بيانات مطلوبة لهذه النقطة (المنطق السيرفري الحالي صحيح، فقط سنضمن عدم إسقاطها بصريًا في البناء الأمامي).

4) الملفات التي سيتم تعديلها
- src/components/games/mystery-case/ReelSpinner.tsx
  - refactor كامل لمحرك الحركة اللانهائية + السحب + spin targeting.
- src/components/games/mystery-case/MysteryCase.tsx
  - تثبيت تدفق winner/visual items أثناء spin ومنع أي إعادة مزامنة تربك الشريط.

5) تفاصيل تقنية مختصرة
```text
state refs:
virtualX, segmentWidth, mode(idle/drag/inertia/spin), velocity

render:
transform: translate3d(displayX, 0, 0)
displayX مشتق من virtualX مع wrap آمن (بدون قفزة مودولو مرئية)

spin target:
targetX = centerOffset - (winnerGlobalIndex * CELL)
ثم نضيف عدد لفات كافٍ لضمان مسافة حركة كبيرة قبل التوقف
```

6) معايير القبول (QA)
- قبل اللف: الشريط يتحرك ببطء بلا توقف لمدة 60 ثانية دون نهاية أو فراغ.
- سحب يدوي يمين/يسار بشكل متكرر: لا اختفاء عناصر عند أي طرف.
- أثناء اللف: لا يحدث blank frame، والعناصر تبقى مرئية دائمًا.
- التوقف النهائي: الجائزة الفائزة تحت المؤشر بدقة.
- عناصر 0% تظهر بصريًا داخل الشريط، لكنها لا تُختار كفائز من السيرفر.
