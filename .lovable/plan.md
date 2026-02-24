

# خطة: دمج صور BDragon1727 Sprite Sheets في صفحة /games

## ملخص
سيتم نسخ صور الـ sprite sheets المرفوعة إلى المشروع واستخدامها كأصول حقيقية في واجهة صفحة الألعاب بدلاً من CSS فقط. سنستخدم تقنية **CSS Sprite Sheet** لقص الأيقونات والأشرطة والأنيميشن من الصور.

---

## التفاصيل التقنية

### 1. نسخ الصور إلى المشروع
نسخ جميع الصور المرفوعة إلى `src/assets/pixel-ui/`:
- `00.png` — أزرار، أشرطة صحة، نجوم، قلوب، أيقونات متنوعة
- `01.png` — شارات (badges) ملونة، أجنحة
- `02.png` — إطارات (frames) بألوان مختلفة
- `03.png` — Loading spinners (أنيميشن دائرية)
- `04.png` — أشرطة تمرير (scroll bars) بأحجام وألوان متعددة
- `05.png` — أشرطة صحة مقسمة (segmented health bars)
- `06.png` — أشرطة تحميل/صحة متنوعة الألوان والأشكال
- `07.png` — مؤشرات، خطوط، نقاط
- `All.png` — الصورة المجمعة الكاملة

### 2. إنشاء مكون PixelSprite
ملف جديد: `src/components/games/PixelSprite.tsx`

مكون يقبل:
- `sheet`: اسم الصورة (00, 01, 02, إلخ)
- `x, y, w, h`: إحداثيات القص من الـ sprite sheet
- `scale`: حجم العرض (افتراضي 2x أو 3x)
- `animate`: إذا كان sprite متحرك (عدد الإطارات + السرعة)

```text
┌────────────────────────────┐
│  PixelSprite Component     │
│                            │
│  <div style={{             │
│    width: w * scale,       │
│    height: h * scale,      │
│    backgroundImage: url(), │
│    backgroundPosition:     │
│      `-${x}px -${y}px`,   │
│    backgroundSize: ...,    │
│    imageRendering:         │
│      pixelated             │
│  }} />                     │
└────────────────────────────┘
```

للأنيميشن (مثل spinners في 03.png):
- استخدام CSS `@keyframes` مع `steps()` timing function
- تحريك `background-position` عبر الإطارات

### 3. تحديث المكونات لاستخدام الـ Sprites

#### PixelHealthBar.tsx
- استبدال الأشرطة المرسومة بـ CSS بأشرطة حقيقية من `05.png` و `06.png`
- قص إطار الشريط الخارجي + الأجزاء الداخلية الملونة

#### PixelLoadingScreen.tsx
- استخدام spinner متحرك من `03.png` (أنيميشن frame-by-frame)
- استخدام شريط تحميل حقيقي من `06.png`

#### GameCard.tsx
- استخدام إطارات بكسل من `02.png` بدلاً من CSS borders
- استخدام نجوم من `00.png` (الصف السفلي) لعرض التقييم/الجوائز
- استخدام أزرار بكسل من `00.png` (الصف العلوي) لزر PLAY

#### DifficultyBadge.tsx
- استخدام الماسات/الأحجار الملونة من `00.png` (الزاوية اليمنى العليا) بدلاً من المربعات المرسومة

#### PixelMusicRadio.tsx
- استخدام شريط التمرير الحقيقي من `04.png` لعنصر التحكم بالصوت

#### MiniGames.tsx (الصفحة الرئيسية)
- شارات (badges) من `01.png` للعنوان أو فلاتر الفئات
- إطارات ملونة من `02.png` حول البطاقات

### 4. تحديد إحداثيات الـ Sprites
إنشاء ملف `src/components/games/SpriteMap.ts` يحتوي على ثوابت:

```typescript
export const SPRITES = {
  // من 00.png
  STAR_GRAY: { sheet: '00', x: 0, y: 128, w: 16, h: 16 },
  STAR_GOLD: { sheet: '00', x: 48, y: 128, w: 16, h: 16 },
  HEART_RED: { sheet: '00', x: 80, y: 128, w: 16, h: 16 },
  BTN_BLUE: { sheet: '00', x: 0, y: 0, w: 32, h: 16 },
  DIAMOND_GREEN: { sheet: '00', x: 160, y: 48, w: 12, h: 12 },
  
  // من 03.png - Loading spinner frames
  SPINNER_FRAMES: { sheet: '03', x: 0, y: 0, w: 32, h: 32, frames: 8 },
  
  // من 05.png - Health bars
  HEALTH_BAR: { sheet: '05', x: 0, y: 0, w: 48, h: 8 },
  
  // إلخ...
} as const;
```

### 5. الملفات المتأثرة

| ملف | نوع التغيير |
|-----|------------|
| `src/assets/pixel-ui/*.png` | **جديد** — نسخ 9 صور |
| `src/components/games/PixelSprite.tsx` | **جديد** — مكون Sprite |
| `src/components/games/SpriteMap.ts` | **جديد** — إحداثيات القص |
| `src/components/games/PixelHealthBar.tsx` | **تعديل** — sprites حقيقية |
| `src/components/games/PixelLoadingScreen.tsx` | **تعديل** — spinner + bars |
| `src/components/games/GameCard.tsx` | **تعديل** — إطارات وأيقونات |
| `src/components/games/DifficultyBadge.tsx` | **تعديل** — ماسات ملونة |
| `src/components/games/PixelMusicRadio.tsx` | **تعديل** — scroll bar |
| `src/pages/MiniGames.tsx` | **تعديل** — شارات وإطارات |
| `src/index.css` | **تعديل** — keyframes للأنيميشن |

