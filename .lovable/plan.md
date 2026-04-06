

## تحسين قسم المنتج المميز — وصف مختصر + تخطيط ثابت

### المشكلة
1. الوصف يظهر كاملاً بدون تحديد — المطلوب سطرين كحد أقصى مع زر "عرض المزيد"
2. التخطيط يتغير حسب حجم الشاشة — المطلوب الصورة/المنصة دائماً على **اليمين** والنص على **اليسار**

### التعديلات — `src/pages/CategoryDetail.tsx`

**1. تخطيط ثابت (صورة يمين، نص يسار) لجميع الأجهزة:**
- تغيير `flex-col md:flex-row-reverse` إلى `flex-col-reverse md:flex-row` بحيث:
  - على الموبايل: النص فوق والصورة تحت (أفضل تجربة)
  - على الشاشات الكبيرة: الصورة يمين والنص يسار
- ضبط محاذاة النص لتكون `text-right` دائماً بدل `text-center md:text-right`

**2. وصف مختصر مع "عرض المزيد":**
- إضافة state: `const [showFullDesc, setShowFullDesc] = useState(false)`
- تطبيق `line-clamp-2` على الوصف عندما `!showFullDesc`
- إضافة زر "عرض المزيد" / "عرض أقل" أسفل الوصف

```tsx
// الشكل المقترح
<div className="flex flex-col-reverse md:flex-row items-center md:items-start gap-8 md:gap-16">
  {/* النص — يسار */}
  <div className="flex-1 text-right pt-4 md:pt-12">
    <h1 className="...">{featuredProduct.name_ar}</h1>
    {featuredProduct.description_ar && (
      <div>
        <p className={`... ${!showFullDesc ? 'line-clamp-2' : ''}`}>
          {featuredProduct.description_ar}
        </p>
        <button onClick={() => setShowFullDesc(!showFullDesc)}>
          {showFullDesc ? 'عرض أقل' : 'عرض المزيد'}
        </button>
      </div>
    )}
  </div>

  {/* الصورة — يمين */}
  <div className="flex-shrink-0 w-full max-w-sm">
    <FloatingProductCard ... featured />
  </div>
</div>
```

### الملفات المتأثرة
- `src/pages/CategoryDetail.tsx` — ملف واحد فقط

