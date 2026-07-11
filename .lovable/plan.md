
## الهدف
إزالة كل ما يخص بناء تطبيق Android (Capacitor) من المشروع لأنه غير مستخدم، مع الحفاظ على عمل تطبيق الويب كما هو.

## الملفات والمجلدات التي ستُحذف

**المجلدات:**
- `android/` — مشروع Android الكامل (Gradle، Java، الموارد، الأيقونات…)

**السكربتات والوثائق:**
- `scripts/android-build.mjs`
- `ANDROID_BUILD.md`
- `public/.well-known/assetlinks.json` (خاص بربط تطبيق Android)

**الإعداد:**
- `capacitor.config.ts`

**كود React الخاص بالنسخة الأصلية (Native فقط):**
- `src/components/auth/NativeAuthGate.tsx` — بوّابة تظهر فقط على Capacitor
- `src/pages/admin/AdminAppVersions.tsx` — إدارة إصدارات تطبيق الأندرويد
- `src/pages/DownloadApp.tsx` — صفحة تنزيل APK

## تغييرات مصاحبة (تنظيف مراجع)
- إزالة استخدام `NativeAuthGate` من `src/App.tsx` (أو الملف الذي يغلّف التطبيق به).
- إزالة المسار/الاستيراد الخاص بـ `AdminAppVersions` و`DownloadApp` من الراوتر.
- إزالة اعتمادات Capacitor من `package.json`:
  `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, `@capacitor/app`, `@capacitor/haptics`, `@capacitor/keyboard`, `@capacitor/local-notifications`, `@capacitor/push-notifications`, `@capacitor/splash-screen`, `@capacitor/status-bar`.
- حذف أي مرجع لـ "تحميل التطبيق/Download App" من قوائم التنقل إن وُجد.

## ما لن يُلمس
- إعدادات PWA و`manifest.json` و`sw.js` تبقى كما هي (خاصة بالويب).
- أي منطق تجاري/واجهات أخرى.

## التحقق بعد التنفيذ
- تشغيل `tsgo` للتأكد من عدم وجود استيرادات معطوبة.
- التأكد من أن البناء (`npm run build`) ينجح.

## سؤال
هل تريد أيضًا إزالة أي زر/رابط "حمّل التطبيق" من واجهة المستخدم إن وُجد؟ (سأزيله افتراضيًا ما لم تطلب الإبقاء عليه.)
