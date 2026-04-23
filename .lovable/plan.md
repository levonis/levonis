

## جعل خلفية بطاقة المنتج في صفحة `/category` زجاجية فقط

### الملف المعني
بطاقات المنتجات في `/category/:slug` تأتي من `src/components/FloatingProductCard.tsx` (الفرع غير-featured، السطور 115–157). هي التي تظهر في شبكة المنتجات داخل القسم — وليست `ProductCard.tsx` (التي عُدّلت سابقاً وتُستخدم في الرئيسية).

### الوضع الحالي للبطاقة (الحاوية الخارجية)
```tsx
<div className="... border border-border/30 bg-card/80 backdrop-blur-md hover:border-primary/30 transition-all duration-300">
```
+ تدرّج سفلي فوق الصورة `bg-gradient-to-t from-card to-transparent` يمتزج مع الخلفية الصلبة.
+ تكبير عند hover للصورة (`group-hover:scale-105`).

النتيجة: الخلفية ليست زجاجاً نقياً (شفافية ضعيفة + لون كرت صلب)، ويوجد إطار وتأثيرات إضافية.

### التغيير المطلوب
**ملف واحد فقط:** `src/components/FloatingProductCard.tsx` — الحاوية في الفرع العادي (السطور 117–127):

1. استبدال `border border-border/30 bg-card/80 backdrop-blur-md hover:border-primary/30 transition-all duration-300` بخلفية زجاجية نقية عبر `style`:
   - `backdropFilter: blur(20px) saturate(1.4)`
   - `background: linear-gradient(170deg, hsl(160 35% 14% / 0.3), hsl(160 30% 10% / 0.4), hsl(160 25% 8% / 0.5))`
   - بدون `border` ولا `hover` ولا transition للحدود.
2. إزالة شريط التدرّج السفلي `<div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-card to-transparent" />` لأنه يستند للون الكرت الصلب ولن يندمج مع الخلفية الزجاجية.
3. إزالة `group-hover:scale-105` من الصورة (إبقاء الـtransition بدون تكبير) للحفاظ على هدوء البطاقة كما طلب المستخدم سابقاً.

محتوى البطاقة (الصورة + الاسم + السعر + شارة الخصم) يبقى كما هو تماماً.

### خارج النطاق
- لا تغيير على الفرع `featured` (المنتج الرئيسي ثلاثي الأبعاد على المنصة).
- لا تغيير على `ProductCard.tsx` أو الرئيسية.
- لا تغييرات قاعدة بيانات.

