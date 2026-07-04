# Playwright Smoke Tests

اختبارات دخانية سريعة للتحقق من التدفقات الحرجة قبل النشر. تعمل ضد `http://localhost:8080` (dev server).

## المتطلبات
- Python 3 + `playwright` (متوفران في بيئة Lovable sandbox جاهزين)
- خارج البيئة: `pip install playwright && playwright install chromium`

## تشغيل الكل
```bash
python3 tests/smoke/run_all.py
```

## تشغيل سيناريو واحد
```bash
python3 tests/smoke/scenarios/01_home_browse.py
```

## متغيرات البيئة (اختيارية)
- `SMOKE_BASE_URL` — افتراضي `http://localhost:8080`
- `SMOKE_USER_EMAIL` / `SMOKE_USER_PASSWORD` — لسيناريو تسجيل الدخول والدفع
- `SMOKE_HEADLESS` — `0` لفتح المتصفح مرئياً

## السيناريوهات الخمسة
1. **01_home_browse** — تحميل الرئيسية، ظهور البانر، التنقل لفئة/منتج
2. **02_login** — فتح صفحة الدخول، إدخال بيانات، تحقق من الجلسة
3. **03_add_to_cart** — دخول منتج، إضافة للسلة، تأكيد ظهور العدّاد
4. **04_levo_card_order** — فتح `/rewards`، بدء طلب بطاقة LEVO، وصولها للسلة
5. **05_checkout** — من السلة إلى صفحة الدفع، التحقق من ملخص الطلب

## المخرجات
لقطات شاشة تُحفظ تحت `/tmp/browser/smoke/<scenario>/`.
كل سيناريو يخرج بكود 0 عند النجاح، ≠0 عند الفشل.
