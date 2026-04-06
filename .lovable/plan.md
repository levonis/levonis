

## تحسين بطاقات المنتجات + نقل شارة الخصم للمنصة

### الملف: `src/components/FloatingProductCard.tsx`

**1. المنتج المميز (featured) — نقل شارة الخصم إلى المنصة:**
- إزالة شارة الخصم من أعلى الصورة (سطر 34-37)
- إضافة شارة الخصم داخل الواجهة الأمامية للمنصة (`cube-front-featured`) بحيث تظهر محفورة في المنصة
- الشارة ستكون بتصميم "محفور" باستخدام `text-shadow` داخلي وشفافية لتبدو جزءاً من سطح المنصة
- وضعها في div جديد يلف `cube-front-featured` مع `position: relative` والنص بداخله `absolute` في المنتصف

```tsx
{/* Front face with engraved discount */}
<div className="cube-front-featured relative">
  {discount > 0 && (
    <div className="absolute inset-0 flex items-center justify-center z-10">
      <span className="text-lg md:text-xl font-black tracking-wider"
        style={{
          color: 'hsl(155 50% 35% / 0.6)',
          textShadow: '0 1px 2px hsl(160 20% 5% / 0.8), 0 -1px 1px hsl(155 40% 30% / 0.3)',
        }}>
        -{discount}%
      </span>
    </div>
  )}
</div>
```

**2. البطاقات العادية (product-card-green) — تحسينات بصرية:**
- إضافة تأثير `backdrop-blur` خفيف للبطاقة
- تحسين ظل الصورة الداخلي لإضافة عمق
- إضافة خط فاصل متدرج أفضل بين الصورة والمعلومات
- تكبير حجم الخط للسعر قليلاً لوضوح أكبر

### الملف: `src/index.css`
- تعديل `.cube-front-featured` لإضافة `position: relative` و `overflow: hidden` لدعم النص المحفور بداخله

### الملفات المتأثرة
- `src/components/FloatingProductCard.tsx`
- `src/index.css`

