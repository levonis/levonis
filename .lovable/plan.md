# خطة تنظيف الملفات المكررة وغير المستخدمة

تم فحص المشروع بالكامل. النتائج بإيجاز:

## 1) شعارات الموقع (5 نسخ من نفس الصورة 57K!)
سيتم حذف النسخ غير المستخدمة، وإبقاء فقط ما هو مرتبط فعلياً:

**حذف:**
- `public/og-logo.png` (57K) — 0 مراجع
- `public/logo-medium.png` (57K) — 0 مراجع
- `public/logo-small.png` (15K) — 0 مراجع
- `public/logo-small.webp` (7.5K) — 0 مراجع
- `src/assets/levonis-logo.png` (57K) — 0 مراجع

**إبقاء:** `favicon.png`, `apple-touch-icon.png`, `icons/icon-192.png`, `icons/icon-512.png`, `og-image.jpg`

⚠️ ملاحظة: `src/components/Footer.tsx` يشير إلى `/logo-small.webp` — سأتحقق ثانية وأبقي الملف إذا كان مستخدماً فعلاً (التقرير قد يكون فاته هذا المرجع).

## 2) صفحات Dead Code (255KB)
صفحات غير مسجلة في `App.tsx` ولا تُستورد في أي مكان:

- `src/pages/Competitions.tsx` (77K)
- `src/pages/MyPrinters.tsx` (49K)
- `src/pages/PrinterProtection.tsx` (49K)
- `src/pages/AdminLoyaltyCardCodes.tsx` (32K)
- `src/pages/AdminCustomRequests.tsx` (13K)
- `src/pages/AdminMainSections.tsx` (6K)
- `src/pages/CommunityMerchantDashboard.tsx` (5K)
- `src/pages/MyPoints.tsx` (25K)

## 3) مكونات Dead Code
- `src/components/WavyColors.tsx`
- `src/components/IdleRoutePrefetcher.tsx`
- `src/components/PrintReputationSummary.tsx`

## 4) أصول قديمة في src/assets
- `src/assets/crossy-road-logo.jpg`
- `src/assets/stack-tower-logo.png`
- `src/assets/engine-supercharge.png`, `engine-normal.png`
- `src/assets/missile-sprite.png`, `missile-base-sprite.png`
- `src/assets/player-ship.png`
- `src/assets/ship-damage-1.png`, `ship-damage-2.png`, `ship-damage-3.png`
- `src/assets/shield-anim.png`

⚠️ **لن أحذف:** مجلد `src/assets/knife-rain/` لأنها قد تُحمَّل ديناميكياً من محرك اللعبة.

## 5) الثيم القديم في manifest
- `public/manifest.json` فيه `theme_color: #103D33` و `background_color: #103D33` (الأخضر القديم)
- **اقتراح:** تحديثهما إلى `#234d3f` (الأخضر الحالي) لمطابقة بقية الموقع

## خطوات التنفيذ
1. التحقق مرة أخيرة من كل ملف قبل الحذف (grep سريع للتأكد من 0 references).
2. حذف الملفات عبر `rm`.
3. تحديث `manifest.json` بالأخضر الجديد.
4. تشغيل build للتأكد من عدم كسر أي شيء.

**الإجمالي:** ~26 ملفاً، توفير ~596KB.

هل تريد المتابعة؟ أم تريد استبعاد فئة معينة (مثل الإبقاء على ملفات الألعاب أو الصفحات للاحتياط)؟
