// Lightweight runtime translator for notification titles/messages
// stored in the DB as Arabic-only strings. Uses pattern replacement so
// dynamic parts (order numbers, amounts) stay intact.

type Lang = 'ar' | 'en' | 'ku';

// Exact title translations (full string match)
const TITLE_MAP: Record<string, { en: string; ku: string }> = {
  'طلب جديد': { en: 'New Order', ku: 'داواکاری نوێ' },
  'تحديث حالة الطلب': { en: 'Order Status Updated', ku: 'دۆخی داواکاری نوێکراوەتەوە' },
  'تحديث حالة طلبك 📦': { en: 'Your Order Status Updated 📦', ku: 'دۆخی داواکاریەکەت نوێکراوەتەوە 📦' },
  '🎫 حصلت على تذاكر مجانية!': { en: '🎫 You got free tickets!', ku: '🎫 بلیتی بەخۆڕاییت بەدەستهێنا!' },
  'تنبيه': { en: 'Notice', ku: 'ئاگاداری' },
  'إشعار': { en: 'Notification', ku: 'ئاگاداری' },
  'محفظتك': { en: 'Your Wallet', ku: 'جزدانەکەت' },
  'تم شحن طلبك': { en: 'Your order has been shipped', ku: 'داواکاریەکەت نێردراوە' },
  'مسابقة جديدة': { en: 'New Competition', ku: 'پێشبڕکێی نوێ' },
  'رسالة جديدة': { en: 'New Message', ku: 'نامەی نوێ' },
};

// Order status terms (used inside messages after "إلى:")
const STATUS_MAP: Record<string, { en: string; ku: string }> = {
  'ملغي': { en: 'Cancelled', ku: 'هەڵوەشاوەتەوە' },
  'تم التوصيل': { en: 'Delivered', ku: 'گەیەنرا' },
  'قيد المعالجة': { en: 'Processing', ku: 'لە پرۆسەدایە' },
  'قيد التوصيل': { en: 'Out for delivery', ku: 'لە گەیاندندایە' },
  'قيد التحضير': { en: 'Preparing', ku: 'ئامادەکردن' },
  'في الطريق': { en: 'On the way', ku: 'لە ڕێگادایە' },
  'مكتمل': { en: 'Completed', ku: 'تەواوبوو' },
  'معلق': { en: 'Pending', ku: 'هەڵواسراو' },
  'تم الشحن': { en: 'Shipped', ku: 'نێردراوە' },
  'تم التأكيد': { en: 'Confirmed', ku: 'پشتڕاستکرایەوە' },
};

// Phrase replacements (run in order). Use placeholders so we replace
// the Arabic snippet around dynamic parts without losing them.
const PHRASE_REPLACERS: Array<{
  re: RegExp;
  en: (m: RegExpMatchArray) => string;
  ku: (m: RegExpMatchArray) => string;
}> = [
  // "تم إنشاء طلب جديد رقم ORD-... بقيمة 12345.00 دينار عراقي"
  {
    re: /تم إنشاء طلب جديد رقم\s+(\S+)\s+بقيمة\s+([\d.,]+)\s+دينار عراقي/,
    en: (m) => `New order #${m[1]} created for ${m[2]} IQD`,
    ku: (m) => `داواکاری نوێ #${m[1]} بە بڕی ${m[2]} د.ع دروستکرا`,
  },
  // "تم تحديث حالة طلبك رقم ORD-... إلى: <status>"
  {
    re: /تم تحديث حالة طلبك رقم\s+(\S+)\s+إلى:\s*(.+)$/,
    en: (m) => `Your order #${m[1]} status changed to: ${translateStatus(m[2], 'en')}`,
    ku: (m) => `دۆخی داواکاریەکەت #${m[1]} گۆڕا بۆ: ${translateStatus(m[2], 'ku')}`,
  },
  // "تم إلغاء طلبك رقم ORD-..."
  {
    re: /تم إلغاء طلبك رقم\s+(\S+)/,
    en: (m) => `Your order #${m[1]} has been cancelled`,
    ku: (m) => `داواکاریەکەت #${m[1]} هەڵوەشایەوە`,
  },
  // "تم توصيل طلبك رقم ORD-... بنجاح! يرجى تأكيد الاستلام"
  {
    re: /تم توصيل طلبك رقم\s+(\S+)\s+بنجاح!?\s*يرجى تأكيد الاستلام/,
    en: (m) => `Your order #${m[1]} has been delivered! Please confirm receipt`,
    ku: (m) => `داواکاریەکەت #${m[1]} گەیەنرا! تکایە وەرگرتن پشتڕاست بکەرەوە`,
  },
  // "جاري تجهيز طلبك رقم ORD-..."
  {
    re: /جاري تجهيز طلبك رقم\s+(\S+)/,
    en: (m) => `Your order #${m[1]} is being prepared`,
    ku: (m) => `داواکاریەکەت #${m[1]} ئامادە دەکرێت`,
  },
  // "تهانينا! حصلت على N تذكرة هدية لطلبك رقم ORD-..."
  {
    re: /تهانينا!?\s*حصلت على\s+(\d+)\s+تذكرة هدية لطلبك رقم\s+(\S+)/,
    en: (m) => `Congrats! You got ${m[1]} gift ticket(s) for order #${m[2]}`,
    ku: (m) => `پیرۆزە! ${m[1]} بلیتی دیاریت بەدەستهێنا بۆ داواکاری #${m[2]}`,
  },
];

function translateStatus(s: string, lang: 'en' | 'ku'): string {
  const trimmed = s.trim();
  return STATUS_MAP[trimmed]?.[lang] || trimmed;
}

export function translateNotificationTitle(title: string | null | undefined, lang: Lang): string {
  if (!title) return '';
  if (lang === 'ar') return title;
  const exact = TITLE_MAP[title.trim()];
  if (exact) return exact[lang];
  return title;
}

export function translateNotificationMessage(message: string | null | undefined, lang: Lang): string {
  if (!message) return '';
  if (lang === 'ar') return message;
  const text = message.trim();
  for (const { re, en, ku } of PHRASE_REPLACERS) {
    const m = text.match(re);
    if (m) return lang === 'en' ? en(m) : ku(m);
  }
  // Fallback: replace just status keyword if pattern didn't match
  let out = text;
  for (const [ar, tr] of Object.entries(STATUS_MAP)) {
    if (out.includes(ar)) out = out.split(ar).join(tr[lang]);
  }
  return out;
}
