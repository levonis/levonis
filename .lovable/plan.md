

The user wants:
1. A direct "Download APK" button on the website
2. Any website update reflects immediately in the app (no rebuild needed)

For #2 — that's already handled by the current `capacitor.config.ts` which uses `server.url` pointing to the Lovable preview URL. Any code change updates instantly because the app loads the live web version.

For #1 — Lovable can't compile an APK file. APK building requires Android Studio + Java + Gradle on a local machine. But we can:
- Create a `/download-app` page with a styled download button
- Host the APK file (user uploads it to Supabase Storage after building it once locally)
- The button serves the APK link

I should ask the user a clarifying question because there are two paths and they have different implications.

## الخطة: زر تحميل APK + تحديثات فورية

### الجزء الأول: التحديث الفوري (جاهز بالفعل ✅)
ملف `capacitor.config.ts` الحالي يحتوي على:
```ts
server: {
  url: 'https://eae9743e-f7d4-438d-bfb8-c27f25184241.lovableproject.com?forceHideBadge=true',
  cleartext: true,
}
```
هذا يعني أن التطبيق **يحمّل الموقع المباشر**، فأي تعديل في Lovable يظهر فوراً في التطبيق بدون إعادة بناء. ✅

⚠️ **ملاحظة مهمة**: للنشر النهائي على Google Play، سيتم تغيير الرابط لرابط الإنتاج (`levonisiq.com`) بدلاً من رابط المعاينة، حتى يبقى التطبيق يعمل حتى لو حُذفت معاينة Lovable.

### الجزء الثاني: زر تحميل APK من الموقع

**القيد التقني**: Lovable لا يستطيع توليد ملف APK مباشرة (يحتاج Android Studio + Gradle محلياً). الحل عملي بخطوتين:

#### ما سأنفذه في Lovable:
1. **صفحة جديدة** `/download-app` بتصميم احترافي:
   - شعار LEVONIS الذهبي
   - عنوان "حمّل تطبيق LEVONIS"
   - زر تحميل APK كبير (للأندرويد)
   - زر App Store (يُفعّل لاحقاً عند توفر النسخة)
   - تعليمات التثبيت بالعربية (تفعيل "السماح من مصادر غير معروفة")
   - رقم الإصدار + تاريخ آخر تحديث
2. **زر مختصر** في الـ Header / القائمة الجانبية: "تحميل التطبيق 📱"
3. **اكتشاف ذكي**: إذا كان المستخدم على Android Chrome → يظهر الزر بوضوح. إذا كان iOS → يظهر زر App Store. إذا كان داخل التطبيق فعلاً → يُخفى الزر تلقائياً.
4. **رابط APK**: سيُحفظ في **Lovable Cloud Storage** (bucket باسم `app-releases`) ليتمكن المستخدم من رفع نسخ جديدة بسهولة.
5. **جدول `app_versions`** بسيط في قاعدة البيانات لتتبع الإصدارات (رقم الإصدار، الرابط، ملاحظات التحديث، التاريخ) — يسمح بإظهار "آخر إصدار" تلقائياً.

#### ما تحتاج تنفيذه مرة واحدة فقط:
1. تصدير المشروع لـ GitHub
2. تشغيل `npx cap add android` ثم `npx cap sync` ثم بناء APK من Android Studio (أو استخدام GitHub Actions لبناء آلي)
3. رفع ملف `app-release.apk` لزر "إدارة الإصدارات" في الموقع

**بعد ذلك**: لن تحتاج لبناء APK جديد إلا نادراً، لأن التطبيق يحمّل الموقع المباشر — كل تحديثاتك تصل فوراً للمستخدمين بدون APK جديد. ستحتاج APK جديد فقط لو:
- غيّرت الأيقونة أو شاشة البداية
- أضفت Plugin أصلي جديد (كاميرا، إشعارات Push، إلخ)

### خيار بديل (تلقائي بالكامل): GitHub Actions
يمكن إعداد GitHub Action يبني APK تلقائياً عند كل تحديث ويرفعه على الموقع. لكن يحتاج إعداد أولي محلي + متغيرات توقيع. أنصح بتأجيله للمرحلة التالية.

### الملفات التي ستُنشأ/تُعدّل:
- `src/pages/DownloadApp.tsx` (جديد)
- `src/App.tsx` (إضافة المسار)
- `src/components/Header.tsx` (زر مختصر)
- Migration: جدول `app_versions` + bucket `app-releases`
- لوحة إدارة بسيطة لرفع APK (للأدمن فقط)

