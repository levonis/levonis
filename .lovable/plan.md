

## فقاعة "تخفيضات" فوق السعر تلقائياً عند وجود خصم

### النطاق
- `src/components/ProductCard.tsx` (بطاقة الشبكة الرئيسية).
- `src/components/ProductListItem.tsx` (بطاقة القائمة الأفقية).

شرط الظهور التلقائي موجود مسبقاً في كلا الملفين:
```ts
const hasSale = originalPrice && originalPrice > price;
```

### الشكل
فقاعة كلام صغيرة (speech bubble) فوق سعر المنتج مباشرة:
- خلفية `bg-primary` متدرّجة لـ `accent`، نص `text-primary-foreground`.
- نص: **"تخفيضات"**.
- زاوية مدوّرة + ذيل صغير أسفل-وسط الفقاعة (مثلث CSS عبر `::after` أو `<span>` مدوَّر).
- حركة: `animate-fade-in` + `pulse` خفيف لجذب الانتباه.
- الحجم: `text-[9px]` في الشبكة، `text-[11px]` في القائمة.

### التغييرات

**`ProductCard.tsx`** — قبل الـ `<div className="flex items-center justify-between gap-1">` (السطر 187):
```tsx
{hasSale && (
  <div className="mb-1 flex justify-start">
    <span className="relative inline-flex items-center gap-0.5 rounded-md bg-gradient-to-b from-primary to-accent px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground shadow-sm animate-fade-in">
      تخفيضات
      <span aria-hidden className="absolute -bottom-1 right-3 h-2 w-2 rotate-45 bg-accent" />
    </span>
  </div>
)}
```

**`ProductListItem.tsx`** — قبل `<div className="flex items-baseline gap-1.5">` (السطر 141):
```tsx
{hasSale && (
  <div className="mb-1 flex">
    <span className="relative inline-flex items-center rounded-md bg-gradient-to-b from-primary to-accent px-2 py-0.5 text-[11px] font-bold text-primary-foreground shadow-sm animate-fade-in">
      تخفيضات
      <span aria-hidden className="absolute -bottom-1 right-3 h-2 w-2 rotate-45 bg-accent" />
    </span>
  </div>
)}
```

### بدون تغييرات
- منطق الخصم نفسه (`hasSale`) دون تعديل.
- شارة "تخفيضات" الموجودة فوق الصورة في `ProductListItem` تبقى — هذه فقاعة جديدة فوق السعر.
- لا تأثير على بطاقات لا يوجد عليها خصم (لا تظهر الفقاعة).

### الملفات المعدّلة
- `src/components/ProductCard.tsx`
- `src/components/ProductListItem.tsx`

