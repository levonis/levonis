# Live Preview للشريط الإخباري داخل الجزيرة

استبدال المعاينة الحالية البسيطة (مستطيل ملوّن) في `AdminAnnouncements` بمعاينة حية تحاكي الجزيرة (Dynamic Island) بنفس شكلها وحركتها، وتتفاعل فوراً مع تعديلات الحقول (النص، اللون، السرعة، الاتجاه، المسافة).

## ماذا سيرى المستخدم

داخل نافذة "إضافة/تعديل إعلان" بدلاً من شريط المعاينة الحالي:
- جزيرة سوداء مصغّرة بنفس الشكل (`280×40`, `radius 22`) ونفس مادة الزجاج (`island-surface`).
- النص يتحرك داخلها مع أيقونة Sparkles على اليسار.
- أي تعديل في الحقول يُطبَّق فوراً بدون حفظ:
  - تغيير **سرعة الحركة** → يتغير زمن الأنيميشن.
  - تغيير **اتجاه الحركة** → ينعكس اتجاه السحب.
  - تغيير **المسافة بين التكرارات** → يتسع/يضيق الفراغ.
  - تغيير **النص** أو **اللون** → ينعكس مباشرة (اللون يُستخدم كتوهج/borders خفيف للحفاظ على شكل الجزيرة الزجاجي).
- تسمية الحقل تتغير إلى "معاينة مباشرة داخل الجزيرة".

## التغييرات التقنية

### 1) مكوّن جديد: `src/components/admin/IslandPromoPreview.tsx`
- props: `{ message, color, speed, direction, gap }`
- يُصيّر:
  - حاوية مركزة بعرض 280px وارتفاع 40px وradius 22px باستخدام كلاس `island-surface` (نفس المادة المستخدمة في الجزيرة الفعلية).
  - بداخله نفس بنية الـ marquee: `marquee-track` + `marquee-group` بأيقونة Sparkles + نص متكرر.
  - يمرر متغيرات CSS inline تماماً مثل المكون الحقيقي:
    ```ts
    style={{
      ['--marquee-duration']: `${Math.max(4, speed)}s`,
      ['--marquee-direction']: direction === 'left' ? 'reverse' : 'normal',
      ['--marquee-gap']: `${gap}px`,
    }}
    ```
  - يستخدم `color` كتوهج خفيف (`box-shadow: 0 0 24px color/30`) ولون نقاط الفصل، دون كسر الشكل الزجاجي.
  - يحرس على تكرار النص بعدد كافٍ (مثل DynamicIsland: `Math.max(4, ceil(12/n))`).

### 2) تعديل `src/pages/AdminAnnouncements.tsx`
- استيراد `IslandPromoPreview`.
- استبدال البلوك في الأسطر ~347-357 (قسم "معاينة الإعلان") بـ:
  ```tsx
  <div className="space-y-2 pt-4 border-t border-border/50">
    <Label>معاينة مباشرة داخل الجزيرة</Label>
    <div className="flex justify-center py-3 rounded-md bg-gradient-to-b from-background to-muted/30">
      <IslandPromoPreview
        message={formData.message_ar || 'نص الإعلان'}
        color={formData.color}
        speed={formData.speed}
        direction={formData.direction as 'left' | 'right'}
        gap={formData.gap}
      />
    </div>
  </div>
  ```

### 3) لا تعديل على CSS
- متغيرات `--marquee-duration`, `--marquee-direction`, `--marquee-gap` و كلاس `island-surface` و كيframes `island-marquee` موجودة بالفعل ضمن `src/index.css` ويُعاد استخدامها مباشرة.

## الملفات المتأثرة
- `src/components/admin/IslandPromoPreview.tsx` (إنشاء)
- `src/pages/AdminAnnouncements.tsx` (تعديل بسيط في قسم المعاينة فقط)
