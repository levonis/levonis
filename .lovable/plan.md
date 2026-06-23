
## تحليل التقرير

التقرير يفرّق بين 3 طبقات. ما يمكن إصلاحه من داخل المشروع هو **رؤوس الأمان فقط**:

| البند | الخطورة | قابل للإصلاح هنا؟ |
|---|---|---|
| CSP غير مُكوَّن | Medium | ✅ نعم — `public/_headers` |
| X-Frame-Options مفقود | Medium | ✅ نعم |
| HSTS غير مفعّل | Medium | ✅ نعم |
| Referrer-Policy / Permissions-Policy / X-Content-Type-Options | Low | ✅ إضافة وقائية |
| Cache-Control review | Low | ✅ موجود جزئياً، نضيف `no-store` للـ HTML |
| HttpOnly / SameSite على الكوكيز | Low-Med | ❌ Supabase Auth يستخدم localStorage لا كوكيز — لا ينطبق |
| OpenSSL CCS (CVE-2014-0224) | High | ❌ بنية تحتية لـ Lovable/Cloudflare — ليست في الكود |
| TLS 1.2 CBC ciphers / renegotiation | Medium | ❌ بنية تحتية |
| OCSP Must-Staple | Info | ❌ شهادة المنصة |
| Timestamp / comments disclosure | Low | معلوماتي، Vite يحقن hashes طبيعياً |

> ملاحظة: SQLi/XSS/CSRF/Path Traversal/Upload = **NOT FOUND**. لا تغييرات على كود التطبيق مطلوبة.

## الخطة

### تعديل واحد: `public/_headers`

أضف كتلة رؤوس عامة `/*` قبل قواعد التخزين المؤقت الحالية:

```text
/*
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  X-Frame-Options: SAMEORIGIN
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(self), microphone=(), geolocation=(self), payment=()
  Cross-Origin-Opener-Policy: same-origin-allow-popups
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.supabase.co https://ai.gateway.lovable.dev https://*.lovable.app https://*.lovable.dev https://connect.facebook.net https://www.googletagmanager.com https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; media-src 'self' blob: https:; connect-src 'self' https: wss:; frame-src 'self' https://challenges.cloudflare.com https://www.facebook.com; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'; upgrade-insecure-requests
```

وتقوية تخزين HTML المؤقت:

```text
/*.html
  Cache-Control: no-store, must-revalidate
/
  Cache-Control: no-store, must-revalidate
```

### لماذا CSP بهذا الشكل
- `'unsafe-inline'` + `'unsafe-eval'` ضروريان لتطبيق Vite/React والمكتبات (Three.js, html2canvas).
- `connect-src https: wss:` لأنّ التطبيق ينادي Supabase + Lovable AI + Realtime + Cloudflare proxy + Meta CAPI.
- `img-src https:` مرن لأن الصور تأتي من CDNات متعددة (Lovable assets, Supabase storage, Taobao/Bambu).
- `frame-ancestors 'self'` يكمّل X-Frame-Options.

### خارج نطاق الإصلاح
- ثغرات OpenSSL/TLS والـ ciphers: تخصّ خوادم Lovable/Cloudflare؛ تُرفع للمنصة لا للمشروع.
- كوكيز HttpOnly: لا ينطبق — جلسات Supabase في localStorage بحسب الإعداد الحالي.

### التحقق بعد النشر
1. `curl -I https://levonisiq.com` يُظهر الرؤوس الجديدة.
2. فتح الصفحة ومراقبة Console لأي انتهاكات CSP (سنخفّفها إن ظهرت بدل تعطيلها).
