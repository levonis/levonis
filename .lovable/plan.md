## تطبيق تأثير Glassmorphism على نظام المحادثات بالكامل

### الهدف
تحويل كل أسطح المحادثات (الشريط العلوي، قائمة المحادثات، خلفية الرسائل، الفقاعات، شريط الإدخال، الـ ReplyPreview، فاصل التاريخ، البطاقات) من ألوان مسطحة (`bg-card`, `bg-muted`) إلى زجاج شفاف بنفس لغة `.glass-card` المستخدمة في `/profile`، مع الحفاظ على وضوح القراءة.

### الأسطح المستهدفة والتغييرات

**1. `ListingConversations.tsx`** (الحاوية الرئيسية)
- الحاوية الخارجية في وضع `embedded`: إضافة طبقة خلفية متدرّجة ناعمة (gradient + blur) بدل `bg-background` المسطّح.
- شريط جانبي للمحادثات (السطر 1041): `bg-card` → `glass-panel` مع `border-l border-white/10`.
- ترويسة الشريط الجانبي (1047) وشريط البحث (1055): `bg-muted/30` → خلفية شبه شفافة `bg-white/5 dark:bg-white/[0.03]` مع `backdrop-blur-md`.
- عناصر المحادثة (السطر 1352): hover `bg-muted/50` → `hover:bg-white/10`، النشط `bg-muted` → `bg-white/15` مع `border-l-2 border-primary`.
- منطقة الرسائل (1488): `bg-background` → خلفية متدرّجة شفافة بدون لون صلب لكي يظهر `AppBackground` خلفها.
- بطاقة "ابدأ المحادثة" (1603) وفاصل التاريخ (1614): تحويل إلى `glass-panel` مصغر.
- زر "تحميل المزيد" (1589): `bg-muted/50` → `bg-white/10 backdrop-blur-md border border-white/15`.
- بطاقة "بدء محادثة جديدة" (139): `bg-card` → `glass-panel`.

**2. `ChatTopBar.tsx` و `AdminChatTopBar.tsx` و `ChatSupportTopBar.tsx`**
- الحاوية: `bg-card shadow-sm` → `bg-white/10 dark:bg-white/[0.05] backdrop-blur-2xl saturate-[180%] border-b border-white/15 shadow-[0_4px_16px_-8px_rgba(0,0,0,0.2)]`.

**3. `ChatInputBar.tsx`** (السطر 298)
- `border-t bg-card` → `border-t border-white/15 bg-white/10 dark:bg-white/[0.05] backdrop-blur-2xl saturate-[180%]` مع inset highlight علوي خفيف.
- حقل الإدخال داخل `RichTextInput` (السطر 166): `bg-background/80` → `bg-white/15 dark:bg-white/[0.08] backdrop-blur-sm border-white/20`.

**4. فقاعات الرسائل — `TextMessage.tsx` (السطر 73-78)**
- فقاعة الآخر (`!isMe`): `bg-card border-border/50` → `bg-white/15 dark:bg-white/[0.08] backdrop-blur-md border-white/20` مع `inset 0 1px 0 rgba(255,255,255,0.2)` shadow.
- فقاعة الذات (`isMe`): الإبقاء على `bg-primary` لكن مع إضافة `backdrop-blur-sm` و gradient خفيف من `primary` إلى `primary/85` لمنح عمق زجاجي ملوّن.
- نفس المنطق على `LocationMessage.tsx` و `AddressMessage.tsx` (نفس النمط `bg-card border-border` للآخر).
- `ReplyBubble.tsx` و `ReplyPreviewBar.tsx`: تحويل إلى زجاج شفاف بنفس اللغة.

**5. البطاقات داخل الرسائل**
- `messages/ProductCard.tsx` (سطر 43, 61, 69): الإبقاء على `backdrop-blur-sm` الموجود لكن رفع شفافية الإطار وإضافة inset highlight.
- `LinkRenderer.tsx` (سطر 123): نفس الترقية.

**6. utility class جديدة في `src/index.css`**
إضافة فئة `.glass-chat-surface` تحت `@layer components` لتوحيد النمط:
```css
.glass-chat-surface {
  background: linear-gradient(180deg,
    rgb(255 255 255 / 0.12) 0%,
    rgb(255 255 255 / 0.04) 100%);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgb(255 255 255 / 0.15);
  box-shadow:
    inset 0 1px 0 0 rgb(255 255 255 / 0.18),
    0 4px 16px -8px rgb(0 0 0 / 0.18);
}
.dark .glass-chat-surface { /* tokens مظلمة */ }

.glass-bubble-other { /* فقاعة الآخر */ }
.glass-bubble-me   { /* فقاعة الذات بـ gradient على primary */ }
```
ثم استخدامها بدل تكرار classes طويلة في كل ملف.

### إمكانية الوصول والتراجع
- يرث تلقائياً `prefers-reduced-transparency` و fallback `@supports not (backdrop-filter)` المعرّفة مسبقاً عبر إعادة استخدام نفس tokens `--glass-*`.
- تباين القراءة: ضمان أن لون النص `text-foreground` يظل واضحاً على الزجاج (الـ blur 20px + saturate 180% + خلفية `AppBackground` المعتمة قليلاً يضمنان ذلك).

### الملفات المعدّلة
1. `src/index.css` — إضافة فئات `.glass-chat-surface` + `.glass-bubble-other` + `.glass-bubble-me`.
2. `src/components/marketplace/ListingConversations.tsx` — استبدال `bg-card`/`bg-muted` بالفئات الزجاجية في 8-10 مواقع.
3. `src/components/chat/ChatTopBar.tsx`
4. `src/components/chat/AdminChatTopBar.tsx`
5. `src/components/chat/ChatSupportTopBar.tsx`
6. `src/components/chat/ChatInputBar.tsx`
7. `src/components/chat/RichTextInput.tsx`
8. `src/components/chat/messages/TextMessage.tsx`
9. `src/components/chat/messages/LocationMessage.tsx`
10. `src/components/chat/messages/AddressMessage.tsx`
11. `src/components/chat/messages/ReplyBubble.tsx`
12. `src/components/chat/messages/ReplyPreviewBar.tsx`

### بدون تغييرات
- لا تعديل على منطق الـ realtime، إرسال/استقبال الرسائل، أو الـ hooks.
- لا تعديل على `ProductSelector` أو `EmojiPicker` (تظهر داخل popovers مستقلة).
- لا تأثير على صفحات أخرى خارج المحادثات.