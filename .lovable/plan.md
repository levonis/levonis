
# Fix: خطأ "Edge Function returned a non-2xx status code" عند إرسال رمز التحقق

## المشكلة

عند تغيير كلمة المرور من صفحة الملف الشخصي (`UserInfo.tsx`)، يتم إرسال `type: 'password_change'` إلى دالة `send-verification-code`، لكن الدالة تسمح فقط بـ `['password_reset', 'signup']` — فترفض الطلب بـ status 400، ويظهر الخطأ العام "Edge Function returned a non-2xx status code".

أيضاً، دالة `verify-code` تسمح بأنواع أكثر (`signup`, `password_reset`, `password_change`, `email_change`) لكن `send-verification-code` لا تسمح بها — فلا يمكن إنشاء رمز تحقق لهذه الأنواع أصلاً.

## الحل

### 1) توسيع الأنواع المسموحة في `send-verification-code`
في `supabase/functions/send-verification-code/index.ts` سطر 218:
```ts
// من:
const allowedTypes = ['password_reset', 'signup'];
// إلى:
const allowedTypes = ['password_reset', 'signup', 'password_change', 'email_change'];
```

### 2) تحسين رسائل الخطأ في الواجهة
في `EmailVerificationDialog.tsx` و `Step3Verification.tsx` و `Auth.tsx`:
- عند وجود `error` من `supabase.functions.invoke`، محاولة قراءة `error.context?.body` أو `data` للحصول على الرسالة الفعلية بدل الرسالة العامة.

## الملفات المتأثرة
1. `supabase/functions/send-verification-code/index.ts` — إضافة `password_change` و `email_change` للأنواع المسموحة
2. إعادة نشر الدالة
