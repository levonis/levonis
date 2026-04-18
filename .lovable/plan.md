

The user wants to convert the existing web app into native Android (APK / AAB for Google Play) and iOS (for App Store) apps. This requires Capacitor since the project is React/Vite. PWA alone won't get them into the stores.

Current state: The project already has PWA setup (manifest.json, service worker, icons). No Capacitor yet.

## الخطة: تحويل الموقع إلى تطبيق جوال للنشر على Google Play و App Store

سنستخدم **Capacitor** (من شركة Ionic) لتغليف الموقع الحالي كتطبيق أصلي (Native) لنظامي Android و iOS، مع الحفاظ على نفس الكود.

### ما سيتم تنفيذه في Lovable

**1. تثبيت حزم Capacitor الأساسية**
- `@capacitor/core` و `@capacitor/cli`
- `@capacitor/android` (لـ Google Play)
- `@capacitor/ios` (لـ App Store)
- `@capacitor/splash-screen` و `@capacitor/status-bar` و `@capacitor/app` (تجربة أصلية أفضل)
- `@capacitor/push-notifications` (لتفعيل الإشعارات الأصلية لاحقاً، بديلاً عن إشعارات الويب)

**2. إنشاء ملف `capacitor.config.ts`** بالإعدادات التالية:
- `appId`: `app.lovable.eae9743ef7d4438dbfb8c27f25184241`
- `appName`: `LEVONIS`
- شاشة بداية (Splash) بنفس لون الموقع `#103d33` مع الشعار الذهبي
- شريط الحالة (Status Bar) بلون `#16a34a`
- اتجاه RTL مدعوم
- `server.url` يشير إلى رابط Lovable للسماح بالتحديث الفوري أثناء التطوير (Hot Reload)، مع إمكانية إزالته للنشر النهائي

**3. تحسين الواجهة للأجهزة الأصلية**
- إضافة `safe-area-inset` لدعم iPhone notch
- إخفاء عناصر التثبيت كـ PWA (`InstallPrompt`) عند التشغيل داخل التطبيق الأصلي (نكتشف ذلك عبر `Capacitor.isNativePlatform()`)
- التأكد أن زر الرجوع في Android يعمل بشكل صحيح مع React Router

**4. إعداد الأيقونات وشاشة البداية**
- استخدام الأيقونات الموجودة (`/icons/icon-512.png`) كمصدر
- توليد الأحجام المطلوبة لكل من Android و iOS

### ما يجب على المستخدم تنفيذه (لا يمكن تنفيذه داخل Lovable)

> **مهم**: بناء ملف APK/AAB للنشر يتطلب أدوات تطوير محلية (Android Studio و Xcode). Lovable لا يستطيع توليد الملف النهائي مباشرة.

**خطوات البناء:**
1. تصدير المشروع إلى GitHub عبر زر "Export to Github"
2. استنساخ المشروع محلياً: `git clone <repo>`
3. تثبيت الحزم: `npm install`
4. إضافة المنصات: `npx cap add android` و `npx cap add ios`
5. بناء الموقع: `npm run build`
6. مزامنة مع Capacitor: `npx cap sync`
7. فتح المشروع في الأداة الأصلية:
   - Android: `npx cap open android` ← يفتح Android Studio لبناء APK/AAB
   - iOS: `npx cap open ios` ← يفتح Xcode (يتطلب جهاز Mac)

**للنشر على المتاجر:**
- **Google Play**: حساب Google Play Developer ($25 لمرة واحدة) + ملف AAB موقّع رقمياً
- **Apple App Store**: حساب Apple Developer ($99/سنة) + جهاز Mac لاستخدام Xcode

### ملاحظات تقنية

- التطبيق الأصلي سيستخدم نفس الـ Backend (Lovable Cloud / Supabase) بدون تغيير
- المصادقة (Auth) ستحتاج تعديلاً بسيطاً لـ OAuth لاحقاً (Deep Links) — يمكن إضافته لاحقاً عند الحاجة
- خيار بديل أبسط: إذا كان الهدف فقط جعل التطبيق "قابل للتثبيت" دون الحاجة لمتاجر التطبيقات، فالموقع يدعم بالفعل PWA ويمكن تثبيته من المتصفح مباشرة

### الملفات التي ستتم إضافتها/تعديلها

- `capacitor.config.ts` (جديد)
- `package.json` (إضافة الحزم)
- `src/main.tsx` (تهيئة Capacitor plugins)
- `src/components/pwa/InstallPrompt.tsx` (إخفاؤه على المنصات الأصلية)
- `src/index.css` (دعم safe-area)

