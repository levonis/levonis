

# Fix: رسالة الخطأ "Taobao يحظر الوصول" المضللة

## المشكلة

عند فشل استخراج معلومات المنتج، يظهر دائماً "Taobao يحظر الوصول. استخدم الإدخال اليدوي." حتى لو كان الخطأ لسبب آخر (مثل خطأ شبكة، أو edge function أرجعت خطأ مع بيانات مفيدة).

## السبب

في `src/pages/Admin.tsx` سطر 754-755:
```ts
if (response.error) {
  throw new Error(response.error.message || 'فشل في استخراج المعلومات');
}
```

عندما الـ edge function ترجع status غير 200 (مثل 400 أو 500)، `supabase.functions.invoke` يضع `response.error` — لكن `response.data` لا يزال يحتوي على البيانات المفيدة مثل `requiresManualInput` و `message` و `item_id`. لكن الكود يعمل `throw` مباشرة بدون قراءة `response.data`.

النتيجة: الـ catch block (سطر 790-793) يعرض دائماً الرسالة المضللة "Taobao يحظر الوصول".

## الحل

تعديل `src/pages/Admin.tsx` في دالة `handleExtractProductInfo`:

1. **قبل throw، محاولة قراءة `response.data`** — إذا فيها `requiresManualInput` أو `error` أو `message`، نستخدمها بدل throw
2. **تغيير رسالة الـ catch** — من "Taobao يحظر الوصول" إلى رسالة عامة مثل "حدث خطأ أثناء الاستخراج - استخدم الإدخال اليدوي" مع عرض تفاصيل الخطأ الفعلي

```ts
// بدل:
if (response.error) {
  throw new Error(response.error.message || 'فشل في استخراج المعلومات');
}

// يصبح:
if (response.error) {
  // Try to read data even on error - edge function may return useful info
  const data = response.data;
  if (data?.requiresManualInput) {
    setExtractionItemId(data.item_id || '');
    setExtractionPlatform(data.platform || 'taobao');
    setShowManualInput(true);
    toast.info(data.message || 'يرجى إدخال البيانات يدوياً', { duration: 5000 });
    return;
  }
  if (data?.error) {
    setShowManualInput(true);
    toast.error(data.error);
    return;
  }
  throw new Error(response.error.message || 'فشل في استخراج المعلومات');
}
```

3. **تحديث رسالة catch العامة**:
```ts
catch (error) {
  console.error('Error extracting product info:', error);
  setShowManualInput(true);
  toast.error(error instanceof Error ? error.message : 'حدث خطأ أثناء الاستخراج - استخدم الإدخال اليدوي');
}
```

## الملف المتأثر
- `src/pages/Admin.tsx` — تعديل دالة `handleExtractProductInfo` (سطر 749-796)

