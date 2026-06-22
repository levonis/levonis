## المشكلة
عند الضغط على "حفظ" في نموذج تعديل المنتج (Admin أو Assistant)، تفشل عملية الحفظ بالخطأ:
`admin_update_product: product id is required for single-arg overload`.

السبب: في `src/lib/adminMutations.ts` نُرسل
```ts
_updates: { id: productId, ...updates }
```
الـ spread يأتي **بعد** `id`، فإذا كان `updates` يحوي مفتاح `id` بقيمة `undefined` (وهذا يحدث لأن النموذج يحتفظ بحقل id غير مُعرَّف)، يُلغى الـ id من JSON ويصل للقاعدة بدون معرّف.

## الإصلاح

### 1) `src/lib/adminMutations.ts`
- تبسيط `adminUpdateProduct`: إرسال نداء واحد فقط عبر التوقيع ذي المعامل الواحد `_updates` لإزالة لبس PostgREST مع الـ overloads، مع وضع `id` و `product_id` **بعد** الـ spread حتى لا يُلغيهما الحقل الفارغ من النموذج، والتحقق المسبق من `productId`.
```ts
export const adminUpdateProduct = async (productId: string, updates: Record<string, any>) => {
  if (!productId) throw new Error('adminUpdateProduct: productId is required');
  const payload = { ...updates, id: productId, product_id: productId };
  const { error } = await (supabase as any).rpc('admin_update_product', { _updates: payload });
  if (error) throw error;
};
```

### 2) رسالة خطأ أوضح في القاعدة (هجرة صغيرة)
تحسين رسالة `RAISE` لتشمل ملخص المفاتيح المُستلمة (للمساعدة في التشخيص المستقبلي فقط)، وقبول مفتاح `id` حتى لو وصل كسلسلة فارغة → ترميه كرسالة "id is invalid" بدلاً من "is required".

### 3) لا تغييرات أخرى
- لا تغيير في `Admin.tsx` ولا في توقيع `admin_update_product` ذو المعاملين (يبقى للاستخدام الداخلي عبر `PERFORM`).
- لا تغيير في صلاحيات/RLS — المساعد له صلاحية فعلاً.

## ملفات تتأثر
- تعديل: `src/lib/adminMutations.ts`
- هجرة قاعدة بيانات: تحسين رسائل الـ overload ذي المعامل الواحد فقط.

## التحقق بعد التطبيق
- حفظ منتج موجود كـ Admin → نجاح.
- حفظ منتج موجود كـ Assistant → نجاح.
- تبديلات سريعة من جدول المنتجات (إظهار/مميز/تحديث السعر) → تستمر بالعمل لأنها تمرّ بنفس `adminUpdateProduct`.
