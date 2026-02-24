

# خطة: مكون Level Badge ديناميكي مع أنيميشن متقدم

## ملخص
إنشاء مكون `GameLevelBadge` جديد بأسلوب بكسل متوافق مع نظام الألعاب الحالي. المكون يعرض شارة مستوى مع أنيميشن تقدم متعدد الخطوات، رقم المستوى المحفور، وتوهج حسب الرتبة.

---

## هيكل الملفات

| ملف | نوع |
|-----|------|
| `src/components/games/GameLevelBadge.tsx` | **جديد** — المكون الرئيسي |
| `src/components/games/levelBadgeStyles.css` | **جديد** — أنيميشن CSS مخصص |
| `src/pages/MiniGames.tsx` | **تعديل** — عرض الشارة في الهيدر |

---

## التفاصيل التقنية

### 1. تعريف الرتب (Tiers)

```text
Bronze   → Level 0–10   → لون نحاسي (#CD7F32) + توهج برتقالي
Platinum → Level 11–25  → لون فضي/بلاتيني (#E5E4E2) + توهج أبيض
Diamond  → Level 26–30  → لون أزرق سماوي (#B9F2FF) + توهج سيان
Emerald  → Level 31+    → لون زمردي (#50C878) + توهج أخضر
```

### 2. هيكل المكون البصري

```text
┌──────────────────────────┐
│  ┌──┐                    │
│  │V │ ═══ Bar 1 ═══════  │  ← شريط أفقي أول
│  │E │ ═══ Bar 2 ═══════  │  ← شريط أفقي ثاني
│  │R │ ══ [  15  ] ═════  │  ← شريط ثالث + رقم محفور
│  │T │                    │
│  └──┘                    │
│     ▲ Shield center      │
└──────────────────────────┘
```

العناصر:
- **Shield**: أيقونة درع مركزية (من sprite sheet 01.png `SPRITE_BADGES`)
- **Horizontal Bars**: 3 أشرطة أفقية متراصة تظهر تتابعياً
- **Vertical Bar**: شريط عمودي على اليسار يظهر عند 50% تقدم
- **Level Number**: رقم المستوى محفور بتأثير inner shadow

### 3. تسلسل الأنيميشن (Animation Sequence)

```text
t=0ms     → Bar 1: scaleX(0→1) slide-in        [300ms]
t=300ms   → Bar 2: scaleX(0→1) slide-in        [300ms]
t=600ms   → Level Number: opacity(0→1) + scale  [400ms]
t=∞       → عند progress ≥ 50%:
              Vertical bar slides down behind bars
              then merges as Bar 3 (scaleX expansion)
              Level number gets engraved effect on Bar 3
```

### 4. تفاصيل CSS الأنيميشن

ملف `levelBadgeStyles.css`:

- `@keyframes bar-slide-in`: `transform: scaleX(0) → scaleX(1)` مع `transform-origin: right`
- `@keyframes level-engrave`: `opacity: 0, scale(0.5) → opacity: 1, scale(1)` مع `text-shadow` محفور
- `@keyframes vertical-merge`: الشريط العمودي ينزلق من أعلى لأسفل ثم يتحول أفقياً
- `@keyframes tier-glow-pulse`: نبض توهج خفيف حسب لون الرتبة
- `@keyframes level-up-burst`: تأثير scale(1→1.2→1) عند تغيير المستوى

تأثير الحفر (Engraved):
```css
text-shadow:
  0 1px 0 rgba(255,255,255,0.15),   /* highlight above */
  0 -1px 1px rgba(0,0,0,0.6);       /* shadow below */
color: transparent + background-clip: text
```

### 5. واجهة المكون (API)

```typescript
interface GameLevelBadgeProps {
  level: number;           // 0-99
  progressPercent: number; // 0-100 (تقدم نحو المستوى التالي)
  size?: "sm" | "md" | "lg";
  animate?: boolean;       // تشغيل أنيميشن الدخول
  className?: string;
}
```

دالة `getTier(level)` تحدد الرتبة والألوان تلقائياً.

### 6. استخدام Sprite Assets

- **Shield icon**: `SPRITE_BADGES.SHIELD_GOLD / SHIELD_SILVER / SHIELD_BLUE / SHIELD_GREEN` حسب الرتبة
- **Progress bars**: ألوان CSS متدرجة بأسلوب بكسل (لا sprites — أشرطة مخصصة أدق)
- **Glow effect**: `box-shadow` ديناميكي بلون الرتبة

### 7. تكامل مع الصفحة

في `MiniGames.tsx` — عرض `GameLevelBadge` بجانب عداد النقاط في الهيدر:

```text
┌─────────────────────────────────┐
│  [BACK]     [LevelBadge] [🪙 500] │
└─────────────────────────────────┘
```

المستوى والتقدم يُحسبان من `userPoints` الموجودة أصلاً.

### 8. حساب المستوى من النقاط

```typescript
// كل 100 نقطة = مستوى واحد (قابل للتعديل)
const POINTS_PER_LEVEL = 100;
const level = Math.floor(points / POINTS_PER_LEVEL);
const progressPercent = (points % POINTS_PER_LEVEL);
```

### 9. الاستجابة (Responsive)

| الحجم | الأبعاد | الاستخدام |
|-------|---------|----------|
| sm    | 32×32px | داخل البطاقات |
| md    | 48×48px | الهيدر |
| lg    | 72×72px | الملف الشخصي |

