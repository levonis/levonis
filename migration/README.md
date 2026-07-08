# 🚀 دليل نقل المشروع من Lovable Cloud إلى Supabase الخارجي

## ⚠️ اقرأ هذا أولاً

هذه العملية تتم في مرحلتين:
- **مرحلة A (داخل Lovable):** توليد الملفات والأدوات — *مكتملة الآن*
- **مرحلة B (تنفذها أنت خارج Lovable):** تشغيل السكربتات على مشروعك الخارجي

**المشروع الحالي:** `sajlfpygebpqwzpotrsg` (Lovable Cloud)
**المشروع الهدف:** `iwbvyyjmhrrudkjjqaks` (Supabase خارجي)

---

## 📋 قائمة تحقق قبل البدء

| # | العنصر | الحالة |
|---|--------|--------|
| 1 | Supabase CLI مثبت محلياً (`npm i -g supabase` أو `brew install supabase/tap/supabase`) | ⬜ |
| 2 | Node.js 20+ مثبت | ⬜ |
| 3 | لديك **Database Password** للمشروع الجديد | ⬜ |
| 4 | لديك **Service Role Key** الكامل (غير مقطوع) للمشروع الجديد | ⬜ |
| 5 | راسلت دعم Lovable لطلب dump من `auth.users` — أو تقبل بأن يعيد كل المستخدمون التسجيل | ⬜ |
| 6 | لديك حساب admin على Lovable Cloud (لاستدعاء export function) | ⬜ |

---

## 🅰️ ما تم توليده لك

```
migration/
├── README.md                          ← هذا الملف
├── tables.json                        ← قائمة 257 جدول بترتيب FK آمن
├── functions.txt                      ← 39 edge function للنشر
├── secrets-checklist.md               ← 15+ سر يجب ضبطها على المشروع الجديد
├── export-all.mjs                     ← تصدير كل الجداول من Lovable Cloud
├── import-all.mjs                     ← استيراد كل الجداول للمشروع الجديد
├── migrate-storage.mjs                ← نقل ملفات Storage
├── deploy-functions.sh                ← نشر كل edge functions
└── .env.migration.example             ← قالب المتغيرات
```

بالإضافة إلى edge function جديدة على Lovable Cloud:
- `supabase/functions/admin-export-table/` — تُصدّر أي جدول كـ JSON (admin فقط)

---

## 🅱️ خطوات التنفيذ (بالترتيب)

### الخطوة 1 — إعداد المشروع الجديد بالـ schema

```bash
# على جهازك
cd path/to/project
supabase link --project-ref iwbvyyjmhrrudkjjqaks
# سيطلب Database Password — أدخلها

# دفع كل 778 migration (يعيد بناء الجداول، RLS، Functions، Triggers، Enums)
supabase db push --linked
```

**تحقق:** افتح Supabase Dashboard → Database → Tables. يجب أن ترى 257 جدولاً.

### الخطوة 2 — تصدير البيانات من Lovable Cloud

```bash
cp migration/.env.migration.example migration/.env.migration
# املأ:
#   OLD_SUPABASE_URL           = https://sajlfpygebpqwzpotrsg.supabase.co
#   OLD_SUPABASE_ANON_KEY      = (من .env الحالي)
#   OLD_ADMIN_EMAIL            = بريد حسابك الadmin على Lovable Cloud
#   OLD_ADMIN_PASSWORD         = كلمة مرور حسابك
#   NEW_SUPABASE_URL           = https://iwbvyyjmhrrudkjjqaks.supabase.co
#   NEW_SUPABASE_SERVICE_KEY   = sb_secret_... (الكامل)

node migration/export-all.mjs
# ينتج مجلد migration/data/ يحتوي 257 ملف .json
```

### الخطوة 3 — استيراد البيانات للمشروع الجديد

```bash
node migration/import-all.mjs
# يدرج البيانات بترتيب آمن يحترم المفاتيح الخارجية
```

### الخطوة 4 — نقل ملفات Storage

```bash
node migration/migrate-storage.mjs
# ينسخ كل buckets والملفات من القديم إلى الجديد
```

### الخطوة 5 — نشر Edge Functions

```bash
bash migration/deploy-functions.sh
# ينشر 39 دالة على المشروع الجديد
```

### الخطوة 6 — إعداد الأسرار على المشروع الجديد

راجع `migration/secrets-checklist.md` واضبط كل سر عبر:
```bash
supabase secrets set --project-ref iwbvyyjmhrrudkjjqaks \
  TELEGRAM_BOT_TOKEN=... \
  CLOUDFLARE_API_TOKEN=... \
  # ...إلخ
```

### الخطوة 7 — إعداد Auth Providers

في Supabase Dashboard للمشروع الجديد:
- **Authentication → Providers → Google**: فعّل + أضف Client ID/Secret نفس القديم
- **Authentication → URL Configuration**: أضف `https://levonisiq.com`, `https://wayto3d.levonisiq.com`, redirect URLs
- **Authentication → Email Templates**: انسخها من المشروع القديم

### الخطوة 8 — استيراد `auth.users` (إن حصلت على dump من دعم Lovable)

```bash
# ملف auth-users.sql مرسل من دعم Lovable
psql "postgresql://postgres:PASSWORD@db.iwbvyyjmhrrudkjjqaks.supabase.co:5432/postgres" \
  -f auth-users.sql
```

بدون هذا، **كل المستخدمين سيحتاجون "نسيت كلمة المرور"** عند أول دخول.

### الخطوة 9 — تبديل التطبيق على Lovable

بعد التحقق من كل شيء أعلاه، قل لي **"جاهز — بدّل .env"** وسأقوم بـ:
1. تحديث `.env` بمفاتيح المشروع الجديد
2. تحديث `src/integrations/supabase/client.ts` إن احتاج
3. تحديث أي reference لـ `sajlfpygebpqwzpotrsg`

### الخطوة 10 — فصل Lovable Cloud

عبر Lovable UI: Project Settings → Cloud → Disconnect.

---

## 🆘 استكشاف الأخطاء

- **`permission denied for table X`**: تأكد أنك تستخدم `SERVICE_ROLE_KEY` وليس `anon`.
- **`duplicate key value violates unique constraint`**: الاستيراد آمن من الإعادة — لكن نظف البيانات أو استخدم `--truncate` flag.
- **`Foreign key violation`**: راجع ترتيب `tables.json`. عدّل اليدوي إن لزم.
- **Edge function fails after deploy**: تأكد أن كل الأسرار مضبوطة على المشروع الجديد.

---

## 🔒 ملاحظات أمنية

- **لا تضع** `SERVICE_ROLE_KEY` في أي ملف مُرفع لـ git. `.env.migration` مضاف لـ `.gitignore`.
- بعد اكتمال النقل، **أعد توليد** كل الأسرار الحساسة (Telegram bot token، إلخ) لأمان أعلى.
- احذف مجلد `migration/data/` بعد النقل — يحتوي بيانات مستخدمين حقيقية.
