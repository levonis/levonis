# حذف شاشة التحميل الأولية بالكامل

الشاشة الخضراء التي تراها في الصورة هي خلفية `html, body` الخضراء + عنصر `#initial-loader` المضمَّن في `index.html`. سأحذف الفكرة كاملة.

## التغييرات في `index.html`

1. **خلفية html/body**: تغيير `background-color: hsl(160, 38%, 22%)` (الأخضر) إلى `#000000` (أسود) ليطابق `AppBackground.tsx` الفعلي للتطبيق — بدون أي وميض أخضر.

2. **حذف CSS الخاص بالـ loader** (الأسطر ~195–216):
   - `#initial-loader { ... }`
   - `#initial-loader.show`, `#initial-loader.fade-out`
   - `#il-recover { ... }`, `#il-recover p`, `#il-recover button`, `#il-recover button:active`

3. **حذف HTML markup** (الأسطر 274–279):
   ```html
   <div id="initial-loader">
     <div id="il-recover">...</div>
   </div>
   ```

4. **تبسيط سكربت `showRecovery`** (السطر ~382): إزالة الإشارات إلى `initial-loader` و `il-recover` (تصبح no-op لأن العناصر محذوفة)، مع إبقاء `__levoMounted` و `__levoRecover` (يستدعيهما كود آخر).

5. **theme-color**: تغيير `#234d3f` إلى `#000000` ليطابق ثيم التطبيق الحقيقي ويمنع شريط المتصفح الأخضر.

6. **manifest.json**: تغيير `background_color` و `theme_color` من `#234d3f` إلى `#000000`.

## ما سيبقى كما هو
- مُبلّغ أخطاء الـ chunks (`__levoReportError`)
- مستمع `levo:mounted`
- `__levoRecover` (للاستخدام اليدوي إن لزم)
- Service worker و Meta Pixel وغيرها

## النتيجة المتوقعة
خلفية سوداء فقط في أول ثوانٍ التحميل قبل ظهور React، بدون أي مستطيل أخضر، بدون أي UI تحميل أو "إعادة المحاولة".
