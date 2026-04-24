## تحويل المحادثات من نافذة منبثقة إلى صفحة كاملة

### الوضع الحالي
- المسار `/chats` يعرض `CommunityMessages.tsx` الذي يستدعي `<ListingConversations />`.
- المكوّن `ListingConversations` يلفّ كل محتواه داخل `<Dialog>` + `<DialogContent>` (السطر 1016-1027) فيظهر كنافذة عائمة بـ backdrop وحواف مدوّرة، حتى وهو على صفحته الخاصة.
- يدعم بالفعل prop باسم `embedded` (السطر 100) لكنه غير مفعّل من جهة `CommunityMessages`، ولم يُنفَّذ فعلياً داخل JSX.

### الهدف
عند زيارة `/chats` تكون المحادثات **صفحة طبيعية** ضمن تخطيط الموقع (تحت الـ AppNavBar، بعرض كامل، بدون backdrop، بدون نافذة عائمة، بدون زر إغلاق X)، مع إبقاء إمكانية الاستخدام كـ Dialog من أماكن أخرى (مثلاً عند تمرير `listingId` من بطاقة منتج).

### التغييرات

**1) `src/components/marketplace/ListingConversations.tsx`**
- تفعيل دعم `embedded` فعلياً في الـ render:
  - إذا `embedded === true`:
    - إزالة `<Dialog>` و`<DialogContent>` و`<DialogTrigger>` تماماً.
    - إرجاع نفس المحتوى الداخلي مباشرة داخل `<div>` بكلاسات: `w-full h-[calc(100dvh-var(--app-nav-h,4rem))] flex` (يملأ المساحة المتاحة تحت الـ NavBar).
    - حذف زر الإغلاق X (السطر ~1029).
    - الإبقاء على الـ Dialogs الفرعية (`PriceChangeDialog`, `CreateOrderDialog`, `MerchantOrderDialog`, `ProductSelector`, `AddToCartSheet`) كما هي — لأنها فعلاً منبثقات وظيفية.
  - إذا `embedded === false` (الوضع الافتراضي للاستخدامات الأخرى): يبقى السلوك الحالي بـ Dialog كاملة دون أي تغيير.
- عند `embedded`: أي استدعاء لـ `handleClose()` أو `setOpen(false)` لا يُغلق صفحة، بل فقط يفرّغ `selectedConversation` (للرجوع لقائمة المحادثات على الموبايل). تعديل `handleClose` ليتحقق من `embedded` قبل استدعاء `onClose`/إغلاق الديالوج.

**2) `src/pages/CommunityMessages.tsx`**
- تمرير `embedded` للمكوّن: `<ListingConversations embedded autoOpenConversationId={...} entryContext={...} />`
- إزالة أي منطق يفترض أن المكوّن يفتح نفسه كـ Dialog (مثل `externalOpen`/`onExternalOpenChange` إن وُجد).
- التأكد من أن الصفحة تُلفّ بنفس تخطيط الموقع المعتاد (الـ AppNavBar يظهر، خلفية الموقع تظهر).

**3) شريط `UnifiedChatButton` و `AppNavBar`**
- لا تغيير. زر "المحادثات" في الـ NavBar يبقى يوجّه إلى `/chats`، لكن الآن يفتح صفحة بدلاً من popup فوق الصفحة الحالية.
- `UnifiedChatButton` يبقى يخفي نفسه في `/chats` كما هو.

### السلوك الموبايل
- في عرض الموبايل (≤ md): تظهر قائمة المحادثات بكامل العرض. عند اختيار محادثة، تُستبدل القائمة بمحادثة محددة (نفس منطق master/detail الحالي) لكن داخل الصفحة لا داخل Dialog. زر الرجوع للقائمة يبقى يفرّغ `selectedConversation`.

### بدون تغيير
- جميع الاستخدامات الأخرى لـ `<ListingConversations />` التي تعتمد على Dialog (مثلاً من بطاقات منتجات أو من زر inline) تبقى تعمل بنفس الشكل لأن `embedded` افتراضياً `false`.
- منطق الـ queries، الإشعارات، الـ realtime، الـ chat commerce — لا يتغيّر شيء.
- مكوّنات الـ Dialogs الفرعية (تغيير السعر، إنشاء طلب، إلخ) تبقى كما هي.

### الملفات المعدّلة
- `src/components/marketplace/ListingConversations.tsx` (تفعيل `embedded` في الـ render + شرطية إخفاء الـ Dialog wrapper وزر X)
- `src/pages/CommunityMessages.tsx` (تمرير `embedded` وضمان أن الصفحة تُعرض ضمن تخطيط الموقع)
