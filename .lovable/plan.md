

## إزالة الخلفية الثانوية في `/community`

### المشكلة
صفحة `CommunityHome` تضيف طبقة `bg-background/95 backdrop-blur-sm` فوق خلفية الموقع الرئيسية (`AppBackground`)، فتظهر "خلفية ثانية" تطمس الأصلية.

### التغيير
ملف `src/pages/CommunityHome.tsx` — السطر 8:
- استبدال:
  ```
  <div className="min-h-screen bg-background/95 backdrop-blur-sm">
  ```
- بـ:
  ```
  <div className="min-h-screen">
  ```

بذلك تختفي طبقة الخلفية والـ blur، وتظهر خلفية الموقع الرئيسية كما هي خلف محتوى المجتمع، دون تأثير على التخطيط أو المحتوى.

### بدون تغييرات
- `CommunitySection` و`CommunityGiftsButton` و`Footer` تبقى كما هي.
- لا تعديل على الراوتر أو `AppBackground`.

### الملف المعدّل
- `src/pages/CommunityHome.tsx`

