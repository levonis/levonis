# قائمة الأسرار المطلوبة على المشروع الجديد

انسخ القيم من Lovable Cloud (أو ولّد جديدة) واضبطها على المشروع الجديد.

## أوامر الضبط

```bash
supabase link --project-ref iwbvyyjmhrrudkjjqaks

# اضبط كل سر (استبدل القيم):
supabase secrets set --project-ref iwbvyyjmhrrudkjjqaks \
  TELEGRAM_BOT_TOKEN="..." \
  TELEGRAM_CHAT_ID="..." \
  RESEND_API_KEY="..." \
  CLOUDFLARE_ACCOUNT_ID="..." \
  CLOUDFLARE_API_TOKEN="..." \
  CLOUDFLARE_ZONE_ID="..." \
  META_CAPI_ACCESS_TOKEN="..." \
  MAPBOX_PUBLIC_TOKEN="..." \
  ADSTERRA_API_TOKEN="..." \
  THINGIVERSE_API_TOKEN="..." \
  TWILIO_ACCOUNT_SID="..." \
  TWILIO_AUTH_TOKEN="..." \
  TWILIO_PHONE_NUMBER="..." \
  QUEST_VERIFY_SECRET="..." \
  CRON_SECRET="$(openssl rand -hex 32)"
```

## قائمة كاملة (من Lovable Cloud الحالي)

| السر | الاستخدام | ملاحظات |
|------|-----------|---------|
| `TELEGRAM_BOT_TOKEN` | إشعارات Telegram | من @BotFather |
| `TELEGRAM_CHAT_ID` | قناة/مجموعة الإشعارات | |
| `RESEND_API_KEY` | إرسال الإيميلات | يمكن إنشاء جديد |
| `CLOUDFLARE_ACCOUNT_ID` | إدارة Cloudflare | |
| `CLOUDFLARE_API_TOKEN` | نفس السبب | |
| `CLOUDFLARE_ZONE_ID` | نفس السبب | |
| `META_CAPI_ACCESS_TOKEN` | Meta Conversion API | |
| `MAPBOX_PUBLIC_TOKEN` | خرائط العنوان | عام (يمكن كشفه) |
| `ADSTERRA_API_TOKEN` | إعلانات | |
| `THINGIVERSE_API_TOKEN` | Thingiverse scraping | |
| `TWILIO_ACCOUNT_SID` | SMS تحقق | |
| `TWILIO_AUTH_TOKEN` | نفس السبب | |
| `TWILIO_PHONE_NUMBER` | نفس السبب | |
| `QUEST_VERIFY_SECRET` | quest-callback | |
| `CRON_SECRET` | تشغيل cron functions | ولّد جديد |

## أسرار *لن* تُنقل (خاصة بـ Lovable Cloud)

- ❌ `LOVABLE_API_KEY` — يعمل فقط على Lovable Cloud. **ستفقد Lovable AI Gateway**. البدائل:
  - استخدم OpenAI/Anthropic/Google APIs مباشرة (أضف مفتاحك الخاص)
  - الدوال المتأثرة: `levo-assistant-chat`, `translate-product`, `extract-product-info`, `suggest-printer`
- ❌ `FIRECRAWL_API_KEY` (managed by connector) — احصل عليه من [firecrawl.dev](https://firecrawl.dev)

## Auth secrets (تُضبط عبر Dashboard وليس CLI)

في **Authentication → Providers**:
- Google OAuth: Client ID + Client Secret
- Email templates: انسخ من المشروع القديم
- Site URL: `https://levonisiq.com`
- Redirect URLs: `https://levonisiq.com/**`, `https://wayto3d.levonisiq.com/**`, `http://localhost:8080/**`
