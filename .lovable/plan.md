# تفعيل bfcache بإزالة موانع الاسترجاع

## السياق
بعد فحص المشروع، **مانع bfcache الوحيد** هو `beforeunload` listener في `src/pages/Admin.tsx` (السطر 479–488). يُسجَّل فقط عندما يكون حوار تعديل المنتج (productDialogOpen) مفتوحاً، لتحذير الأدمن قبل إغلاق التبويب بفقدان مسودة المنتج.

وجود `beforeunload` (حتى لو لم يستدعي `preventDefault`) **يُعطّل bfcache في Chrome/Edge تلقائياً** — أي ضغطة "رجوع" تُعيد بناء الصفحة بدل استرجاعها فورياً.

باقي المشروع نظيف:
- `ScrollRestoration.tsx` يستخدم `pagehide` و`visibilitychange` فقط (متوافقة مع bfcache).
- لا يوجد `unload`/`onunload` في أي مكان.
- `sw.js` لا يحتوي أي تعارض مع bfcache.

## التعديل الوحيد
**File:** `src/pages/Admin.tsx` (داخل useEffect حوار المنتج، السطور 477–488)

استبدال `beforeunload` بـ `pagehide` (وهو متوافق مع bfcache ويعمل بنفس الفعالية لحفظ المسودة):

```ts
snapshot();
const id = window.setInterval(snapshot, 1500);
const onPageHide = () => { snapshot(); };
window.addEventListener('pagehide', onPageHide);
return () => {
  window.clearInterval(id);
  window.removeEventListener('pagehide', onPageHide);
};
```

### لماذا هذا آمن
- المسودة تُحفظ كل 1500ms في `localStorage`، فلا حاجة لتحذير المتصفح.
- `pagehide` يضمن snapshot أخيرة قبل التنقل/الإغلاق بدون تعطيل bfcache.
- يُحذف صندوق "هل تريد الخروج؟" — لكن المسودة محفوظة فعلياً، ويُعاد تحميلها عند فتح الحوار من جديد (المنطق الموجود مسبقاً).

## النتيجة المتوقعة
- زر "رجوع/تقديم" يُعيد الصفحة فوراً (instant restoration) بدل إعادة التحميل.
- التطبيق يصبح مماثلاً لسلوك Amazon/Bambulab في التنقل داخل الموقع.
- لا تغيير على أي وظيفة أخرى.

## خارج النطاق
- التنقل بين نطاقات مختلفة (levonisiq.com ↔ bambulab.com) يبقى reload كاملاً بحكم same-origin policy — لا يمكن تجنبه.
- service worker، التوجيه، والكاش بدون تغيير.
