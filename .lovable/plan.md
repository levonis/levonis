## التشخيص

من إجاباتك (يفتح أحياناً + بدأت بعد آخر نشر + خطأ "تعذّر الاتصال") + سجلات الـ console التي تُظهر `TypeError: Importing a module script failed` → السبب الجذري هو **مشكلة Stale Chunks بعد النشر**:

1. الـ Service Worker القديم يخزّن نسخة قديمة من `index.html` تحيل إلى ملفات JS بأسماء hash قديمة (`index-D8_-YdmW.js`...).
2. بعد آخر نشر، تلك الملفات لم تعد موجودة على CDN.
3. عند فتح الموقع: المتصفح يجلب HTML من cache الـ SW → يحاول تحميل chunk قديم → فشل تحميل → شاشة فارغة أو "تعذّر الاتصال".
4. آلية الاسترداد الموجودة في `main.tsx` تعمل **فقط لو نجح تحميل `main.tsx` نفسه**. إذا فشل تحميل entry chunk → لا يوجد JS مُحمَّل → لا يعمل أي استرداد → المستخدم عالق.
5. متصفحات in-app (Instagram/Facebook/TikTok) أسوأ لأن لها cache منفصل لا يُمسح بسهولة، ولأنها قد تُسقط طلبات module preload.

## الحل المقترح

ثلاث طبقات حماية:

### 1) معالج خطأ مبكّر داخل `index.html` (الأهم)
إضافة سكربت inline في `<head>` **قبل** أي `<script type="module">`، يلتقط أخطاء تحميل modules مبكراً ويقوم بـ:
- إلغاء تسجيل كل Service Workers
- مسح كل caches
- إعادة تحميل قسري مع `?_swkill=1` (لمنع SW من التدخل)
- حماية من loop عبر `sessionStorage` مع timeout 30 ثانية

هذا يلتقط الفشل قبل أن يصل لـ `main.tsx`.

### 2) تشديد سياسة الـ Service Worker لـ HTML
في `public/sw.js`:
- زيادة version إلى `v20` لإجبار activate فوري.
- في `networkFirstHtml`: إذا فشل network، فقط استخدم cache لو **عمر الـ entry أقل من ساعة** (بدلاً من غير محدود). يمنع تقديم HTML قديم جداً.
- إضافة response header check: لو الـ cached HTML لا يحتوي على نفس الـ chunk المطلوب → تجاهله.

### 3) دعم متصفحات in-app المُقيَّدة
- إضافة تنبيه بسيط (banner علوي) للمستخدمين الذين يفتحون من Instagram/FB/TikTok WebView يقترح "افتح في المتصفح" مع زر يحاول فتح خارجي عبر `intent://` على Android أو رسالة إرشادية على iOS.
- يظهر فقط عند اكتشاف UA المعروف لمتصفحات in-app.

## الملفات المتأثرة

```text
index.html            ← إضافة معالج خطأ inline في <head>
public/sw.js          ← v20 + TTL على HTML cache + تحقق من تطابق الـ chunks
src/components/InAppBrowserNotice.tsx (جديد)  ← تنبيه للـ WebView
src/App.tsx           ← mount للتنبيه
```

## التفاصيل التقنية

**Inline error handler (مبسّط):**
```html
<script>
(function(){
  var KEY='__levo_chunk_recover_v2';
  function isStale(e){
    var m=String(e&&(e.message||e.reason&&e.reason.message)||'');
    return /Importing a module script failed|Failed to fetch dynamically imported module|Loading chunk \d+ failed|ChunkLoadError/i.test(m);
  }
  function recover(){
    try{
      var last=+sessionStorage.getItem(KEY)||0;
      if(Date.now()-last<30000) return;
      sessionStorage.setItem(KEY,String(Date.now()));
    }catch(e){}
    Promise.resolve()
      .then(function(){return navigator.serviceWorker&&navigator.serviceWorker.getRegistrations().then(function(rs){return Promise.all(rs.map(function(r){return r.unregister();}));});})
      .then(function(){return window.caches&&caches.keys().then(function(ks){return Promise.all(ks.map(function(k){return caches.delete(k);}));});})
      .finally(function(){location.replace(location.pathname+'?_swkill=1&_r='+Date.now());});
  }
  window.addEventListener('error',function(e){if(isStale(e))recover();},true);
  window.addEventListener('unhandledrejection',function(e){if(isStale(e))recover();});
})();
</script>
```

**SW HTML cache TTL:** تخزين timestamp في cache metadata وتجاهل الـ cached HTML إذا تجاوز ساعة.

**In-App detection:** UA يحتوي `Instagram|FBAN|FBAV|FB_IAB|TikTok` → عرض banner مع رابط `intent://...#Intent;scheme=https;package=com.android.chrome;end` للأندرويد، ورسالة "اضغط ⋯ ثم افتح في Safari" لـ iOS.

## ما لن أغيّره
- لن أعدّل `vite.config.ts` modulePreload (يعمل بشكل صحيح).
- لن أغيّر بنية الـ chunks (يسبّب regressions أخرى).
- لن ألمس routing أو DNS — Cloudflare يخدم الموقع 200 OK بشكل صحيح.

هل أتابع التنفيذ؟