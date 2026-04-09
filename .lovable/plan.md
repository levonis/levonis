

# خطة بناء لعبة "اعبر الطريق" (Cross the Road)

## ملخص
بناء لعبة Crossy Road كاملة باستخدام HTML5 Canvas (2D top-down style) مع استخدام الأصوات والصور من مستودع GitHub الأصلي، وربطها بالكامل بأنظمة النقاط والتذاكر والمتصدرين والجوائز والإعدادات الموجودة.

---

## المرحلة 1: قاعدة البيانات

إنشاء الجداول التالية (نفس نمط knife_rain):

- **crossy_road_settings** -- إعدادات اللعبة (game_enabled, entry_fee_tickets, points_per_step, max_daily_plays, bonus_coin_points, total_plays, total_points_distributed)
- **crossy_road_sessions** -- جلسات اللعب (user_id, session_token, status, score, steps_taken, coins_collected, points_awarded, started_at, ended_at)
- **crossy_road_high_scores** -- أعلى نتائج (user_id, high_score, best_steps, season)
- **crossy_road_milestones** -- جوائز النقاط (target_score, prize_name, product_id, selected_color, selected_option_id, stock, claimed_count, is_active)
- **crossy_road_milestone_claims** -- سجل المطالبات
- **crossy_road_leaderboard_prizes** -- جوائز المتصدرين (position, prize_name, product_id, etc.)
- **crossy_road_winners** -- الفائزون

إنشاء RPCs:
- **start_crossy_road** -- بدء جلسة (خصم تذكرة، تحقق VIP)
- **end_crossy_road** -- إنهاء جلسة (منح نقاط)
- **update_crossy_road_high_score** -- تحديث أعلى نتيجة
- **check_crossy_road_milestone** -- فحص الجوائز أثناء اللعب
- **claim_crossy_road_prize_to_cart** -- إضافة جائزة للسلة
- **admin_award_crossy_road_winners** -- توزيع جوائز المتصدرين

---

## المرحلة 2: أصول اللعبة من GitHub

تحميل الملفات التالية من `https://raw.githubusercontent.com/EvanBacon/Expo-Crossy-Road/master/assets/` إلى مجلد `public/games/crossy-road/`:

**الصوت:**
- `audio/buck1.wav` - `buck12.wav` (أصوات الحركة/القفز)
- `audio/car-horn.wav`, `audio/carhit.mp3` (أصوات السيارات)
- `audio/Train_Alarm.wav`, `audio/train_pass_shorter.wav` (القطار)
- `audio/chickendeath.wav` (الموت)
- `audio/Get Coin 73 wav.mp3` (جمع العملات)
- `audio/watersplashlow.mp3` (السقوط في الماء)

**الصور:**
- `images/title.png` (شعار اللعبة)
- `images/buttons/` (أزرار واجهة المستخدم)
- `images/hand/` (إرشاد اللمس)

---

## المرحلة 3: محرك اللعبة (Canvas 2D)

إنشاء `src/components/games/crossy-road/`:

### CrossyRoadCanvas.tsx
- لعبة top-down/isometric مبسطة على Canvas
- **اللاعب**: دجاجة بكسل تتحرك على شبكة
- **الصفوف**: عشب آمن، طريق (سيارات)، سكة حديد (قطارات)، نهر (جذوع أشجار)
- **التحكم**: سحب/ضغط للأعلى/أسفل/يمين/يسار + أزرار لوحة المفاتيح
- **التسجيل**: كل خطوة للأمام = نقطة، عملات إضافية متناثرة
- **الموت**: اصطدام بسيارة/قطار أو سقوط في الماء
- **الأصوات**: من ملفات GitHub عبر Web Audio API

### CrossyRoadAudio.ts
- تحميل وتشغيل أصوات الخطوات (buck1-12)، السيارات، القطارات، الموت، العملات

### CrossyRoadGame.tsx
- واجهة القائمة/اللعب/انتهاء اللعبة (نفس نمط KnifeRainGame)
- عرض التذاكر، التكلفة، أعلى نتيجة، المتصدرين، الجوائز
- استدعاء RPCs للبدء والانتهاء

---

## المرحلة 4: لوحة الإدارة

### CrossyRoadTab.tsx
إضافة تبويب جديد في صفحة إعدادات الألعاب (`AdminGamesSettings.tsx`):
- تفعيل/إيقاف اللعبة
- تكلفة الدخول (تذاكر)
- نقاط لكل خطوة / عملة
- الحد اليومي
- إدارة جوائز النقاط (Milestones) مع ربط المنتجات
- إدارة جوائز المتصدرين
- إحصائيات (إجمالي اللعب والنقاط)

---

## المرحلة 5: التكامل

1. إضافة `crossy_road` إلى `GAME_NODES` في `GamesData.ts` (status: LIVE)
2. إضافة lazy import في `MiniGames.tsx` + عرضه عند `activeGame === 'crossy_road'`
3. إضافة فحص `crossy_road_settings.game_enabled` في MiniGames
4. إضافة التبويب في `AdminGamesSettings.tsx`
5. دعم VIP free play لـ `crossy_road`

---

## التفاصيل التقنية

```text
src/components/games/crossy-road/
├── CrossyRoadGame.tsx      ← Menu/Play/GameOver wrapper (like KnifeRainGame)
├── CrossyRoadCanvas.tsx    ← Canvas game engine
└── CrossyRoadAudio.ts      ← Sound manager using GitHub assets

src/components/admin/CrossyRoadTab.tsx  ← Admin settings tab

public/games/crossy-road/audio/        ← Audio files from GitHub
public/games/crossy-road/images/       ← Image files from GitHub

Database: 7 tables + 6 RPCs (mirroring knife_rain pattern)
```

### ميكانيكا اللعبة
- شبكة صفوف لانهائية تتولد أثناء التقدم
- أنواع الصفوف: عشب (آمن)، طريق (سيارات بسرعات مختلفة)، سكة حديد (قطارات سريعة مع تحذير)، نهر (جذوع متحركة يجب القفز عليها)
- كاميرا تتبع اللاعب عمودياً
- صعوبة تتزايد تدريجياً (سرعة + كثافة المركبات)
- عملات ذهبية عشوائية = نقاط إضافية

