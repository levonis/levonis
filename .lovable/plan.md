

## ترقية احترافية لتأثير الـ Glassmorphism على بطاقات `/profile`

### الهدف
الفئة الحالية `.glass-card` تعمل لكنها مسطّحة بصرياً. الترقية تضيف **عمق وطبقات ضوء واقعية** بمستوى تصميم Apple/visionOS، مع الإبقاء على نفس الـ API (لا تغيير على ملفات البطاقات).

### التغييرات البصرية
1. **خلفية متدرّجة بدل لون مسطّح** — تدرّج قطري خفيف من أعلى-اليمين (شفافية أعلى) إلى أسفل-اليسار (شفافية أقل) يعطي إحساس زجاج حقيقي يعكس الضوء.
2. **حد مزدوج (Double border)** — حد خارجي خفيف + خط داخلي مضيء (`inset 0 1px 0 rgba(255,255,255,0.18)`) يحاكي حافة الكريستال.
3. **ظل متعدد الطبقات** — ظل قريب صغير + ظل بعيد أنعم + ظل داخلي للعمق.
4. **Specular highlight علوي** — طبقة `::before` بـ `linear-gradient` شفاف من الأعلى تعطي وميض زجاجي.
5. **Noise/grain خفيف اختياري** عبر `::after` بـ SVG inline لإزالة أي banding في الـ blur.
6. **زيادة saturation إلى 180%** + رفع الـ blur لـ 24px لزجاج أنقى.
7. **انتقال hover ناعم** — رفع طفيف للظل وزيادة سطوع الحد عند hover (للبطاقات التفاعلية فقط عبر `.glass-card-interactive`).

### الـ Tokens المُحدّثة (light/dark)
```text
Light:
  --glass-bg-from:   rgba(255,255,255,0.22)
  --glass-bg-to:     rgba(255,255,255,0.08)
  --glass-border:    rgba(255,255,255,0.35)
  --glass-highlight: rgba(255,255,255,0.45)
  --glass-blur:      24px
  --glass-saturation:180%
  --glass-shadow:    0 1px 0 rgba(255,255,255,0.18) inset,
                     0 8px 24px -8px rgba(0,0,0,0.18),
                     0 24px 48px -16px rgba(0,0,0,0.22)

Dark:
  --glass-bg-from:   rgba(255,255,255,0.10)
  --glass-bg-to:     rgba(255,255,255,0.02)
  --glass-border:    rgba(255,255,255,0.14)
  --glass-highlight: rgba(255,255,255,0.22)
  --glass-shadow:    0 1px 0 rgba(255,255,255,0.08) inset,
                     0 8px 24px -8px rgba(0,0,0,0.45),
                     0 24px 56px -20px rgba(0,0,0,0.55)
```

### بنية الفئة الجديدة
```text
.glass-card {
  background: linear-gradient(135deg, var(--glass-bg-from), var(--glass-bg-to));
  border: 1px solid var(--glass-border);
  backdrop-filter: blur(24px) saturate(180%);
  box-shadow: var(--glass-shadow);
  border-radius: 1.5rem;
  position: relative;
  overflow: hidden;
  isolation: isolate;
}
.glass-card::before {  /* specular highlight */
  content: ""; position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(180deg, var(--glass-highlight) 0%, transparent 35%);
  opacity: 0.6; mix-blend-mode: overlay;
}
.glass-card-interactive:hover {
  transform: translateY(-1px);
  box-shadow: <stronger shadow>;
  transition: all 240ms cubic-bezier(0.16,1,0.3,1);
}
```

### Fallbacks محفوظة
- `@supports not (backdrop-filter)` → خلفية صلبة 90%.
- `@media (prefers-reduced-transparency)` → blur=10px وشفافية أعلى.
- `@media (prefers-reduced-motion)` → إلغاء انتقال hover.

### الملفات المعدّلة
- `src/index.css` فقط — تحديث tokens الـ glass (السطور 2419-2463) وإضافة `::before` و `.glass-card-interactive`.

### بدون تغييرات
- لا تعديل على أي مكوّن في `src/components/profile/*` — الفئة `.glass-card` تبقى نفسها.
- لا تأثير على `.glass-panel` (مستخدمة في `Card` العام).
- لا تأثير على صفحات أخرى.

