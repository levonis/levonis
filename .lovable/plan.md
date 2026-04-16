

# إصلاح عدم تفريغ السلة بعد إتمام الطلب (بيع مباشر)

## السبب
في `Cart.tsx`، دالة `handleDirectSaleCheckout` (سطر 802-1033) لا تستدعي `clearCart()` بعد نجاح الطلب. بينما `handleCheckout` (الطلب المسبق) يستدعيها في سطر 1443.

## الإصلاح

### `src/pages/Cart.tsx`
إضافة `await clearCart()` في `handleDirectSaleCheckout` قبل سطر 1024 (`setShowDirectSaleDialog(false)`):

```typescript
// بعد نجاح إنشاء الطلب، قبل setShowDirectSaleDialog(false)
await clearCart();
setShowDirectSaleDialog(false);
setSuccessOrderNumber(orderResult.order_number);
setShowOrderSuccess(true);
```

ملف واحد فقط، سطر واحد مضاف.

