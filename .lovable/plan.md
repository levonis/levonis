
# خطة الإصلاح

## المشكلة الأولى: زر إرسال المنتج لا يُظهر منتجات المتجر

### تشخيص المشكلة
عند فتح نافذة اختيار المنتج، يتم البحث في جدول `merchant_products` باستخدام `user.id` كـ `merchantId`. لكن جدول المنتجات يستخدم `merchant_public_profiles.id` وليس معرف المستخدم مباشرة.

```text
┌─────────────────────────────────────────────────────────────────┐
│                        الوضع الحالي                              │
├─────────────────────────────────────────────────────────────────┤
│  user.id = 2ae7972f-6d1d-40fb-b73f-9fb72941f3f3                │
│  merchant_public_profiles.id = 9fec6e0d-78f5-4ad4-b7a1-...      │
│  merchant_products.merchant_id = 9fec6e0d-78f5-4ad4-b7a1-...   │
│                                                                 │
│  ProductSelector يبحث بـ user.id → لا نتائج!                   │
└─────────────────────────────────────────────────────────────────┘
```

### الحل
1. تعديل `ListingConversations.tsx` لجلب `merchant_public_profiles.id` للمستخدم الحالي
2. تمرير هذا المعرف إلى `ProductSelector` بدلاً من `user.id`

---

## المشكلة الثانية: الإيموجي ليس حزمة WeChat

### تشخيص المشكلة
الكود الحالي يستخدم رموز Unicode العادية (😄, 👍, ❤️) وليس ملصقات WeChat الفعلية. ملصقات WeChat هي **صور مخصصة** وليست رموز نصية.

### الحل
لإضافة ملصقات WeChat الفعلية، نحتاج إلى:
1. استضافة صور الملصقات في مخزن الملفات
2. إنشاء مكون لعرض الملصقات كصور
3. إرسال الملصقات كرسائل صور

**ملاحظة:** ملصقات WeChat الأصلية محمية بحقوق النشر. يمكننا:
- خيار أ: استخدام ملصقات مفتوحة المصدر (مثل OpenMoji أو Twemoji)
- خيار ب: إنشاء ملصقات مخصصة للمنصة
- خيار ج: ترك الإيموجي الحالي مع تحسين العرض

---

## التعديلات التقنية المطلوبة

### ملف `ListingConversations.tsx`
```typescript
// جلب معرف التاجر الصحيح
const { data: currentUserMerchant } = useQuery({
  queryKey: ['current-user-merchant', user?.id],
  queryFn: async () => {
    if (!user) return null;
    const { data } = await supabase
      .from('merchant_public_profiles')
      .select('id')  // هذا هو merchant_id الصحيح
      .eq('user_id', user.id)  // البحث بـ user_id أو الربط بطريقة صحيحة
      .maybeSingle();
    return data;
  },
  enabled: !!user,
});

// تمرير المعرف الصحيح
<ProductSelector
  merchantId={currentUserMerchant?.id || ''}  // استخدام merchant profile id
  ...
/>
```

### ملف `ChatInputBar.tsx` (خيار الملصقات)
- إضافة نوع رسالة جديد للملصقات
- عرض الملصقات كصور بدلاً من نص
- تحميل مجموعة ملصقات من المخزن

---

## الأولويات

| الأولوية | المهمة | الجهد |
|---------|--------|-------|
| 1 | إصلاح merchantId في ProductSelector | منخفض |
| 2 | تحسين عرض الإيموجي الحالي | منخفض |
| 3 | إضافة ملصقات مخصصة (اختياري) | متوسط-عالي |
