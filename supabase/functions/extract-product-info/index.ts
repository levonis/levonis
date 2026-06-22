const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_AI_MODEL = 'google/gemini-3.1-pro-preview';

const buildLovableAiHeaders = (lovableApiKey: string) => ({
  'Lovable-API-Key': lovableApiKey,
  'X-Lovable-AIG-SDK': 'vercel-ai-sdk',
  'Content-Type': 'application/json',
});

// Short URL patterns that need to be followed to get the real URL
const SHORT_URL_PATTERNS = [
  /https?:\/\/e\.tb\.cn\/[^\s]+/i,
  /https?:\/\/m\.tb\.cn\/[^\s]+/i,
  /https?:\/\/s\.click\.taobao\.com\/[^\s]+/i,
];

// Follow short URL to get the real URL with item ID
async function followShortUrl(url: string): Promise<string> {
  try {
    console.log('Following short URL:', url);
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    });
    const finalUrl = response.url;
    console.log('Resolved to:', finalUrl);
    return finalUrl;
  } catch (e) {
    console.log('Error following short URL, trying GET:', e);
    // Try with GET request
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        }
      });
      return response.url;
    } catch (e2) {
      console.log('GET also failed:', e2);
      return url;
    }
  }
}

// Check if URL is a short URL that needs to be followed
function isShortUrl(url: string): boolean {
  return SHORT_URL_PATTERNS.some(pattern => pattern.test(url));
}

// Detect platform from URL and extract item ID
function detectPlatform(url: string): { platform: string; itemId: string | null } {
  const urlLower = url.toLowerCase();
  
  if (urlLower.includes('taobao.com') || urlLower.includes('m.tb.cn') || urlLower.includes('e.tb.cn')) {
    const idMatch = url.match(/[?&]id=(\d+)/);
    return { platform: 'taobao', itemId: idMatch?.[1] || null };
  }
  
  if (urlLower.includes('tmall.com')) {
    const idMatch = url.match(/[?&]id=(\d+)/);
    return { platform: 'tmall', itemId: idMatch?.[1] || null };
  }
  
  if (urlLower.includes('1688.com')) {
    const idMatch = url.match(/offer\/(\d+)/);
    return { platform: '1688', itemId: idMatch?.[1] || null };
  }
  
  if (urlLower.includes('jd.com')) {
    const idMatch = url.match(/\/(\d+)\.html/);
    return { platform: 'jd', itemId: idMatch?.[1] || null };
  }
  
  if (urlLower.includes('aliexpress.com') || urlLower.includes('aliexpress.ru')) {
    const idMatch = url.match(/\/item\/(\d+)/) || url.match(/\/(\d+)\.html/);
    return { platform: 'aliexpress', itemId: idMatch?.[1] || null };
  }
  
  if (urlLower.includes('amazon.')) {
    const asinMatch = url.match(/\/dp\/([A-Z0-9]{10})/) || url.match(/\/product\/([A-Z0-9]{10})/);
    return { platform: 'amazon', itemId: asinMatch?.[1] || null };
  }
  
  if (urlLower.includes('shein.com')) {
    const idMatch = url.match(/-p-(\d+)/);
    return { platform: 'shein', itemId: idMatch?.[1] || null };
  }
  
  if (urlLower.includes('bambulab.com')) {
    return { platform: 'bambulab', itemId: null };
  }
  
  if (urlLower.includes('/products/')) {
    return { platform: 'shopify', itemId: null };
  }
  
  return { platform: 'other', itemId: null };
}

// Build canonical URL from item ID and platform
function buildCanonicalUrl(itemId: string, platform: string): string {
  switch (platform) {
    case 'taobao':
      return `https://item.taobao.com/item.htm?id=${itemId}`;
    case 'tmall':
      return `https://detail.tmall.com/item.htm?id=${itemId}`;
    case 'jd':
      return `https://item.jd.com/${itemId}.html`;
    case '1688':
      return `https://detail.1688.com/offer/${itemId}.html`;
    default:
      return `https://item.taobao.com/item.htm?id=${itemId}`;
  }
}

// ===== Shopify products.json structured extraction =====
// Detects which option axis represents colors (by name or by value content)
// and maps the other axes to "options". Variant images are matched per value.
const COLOR_KEYWORDS = [
  'black','white','red','blue','green','yellow','pink','purple','orange','gray','grey',
  'brown','gold','silver','navy','beige','cyan','magenta','maroon','olive','teal','lime',
  'coral','salmon','turquoise','ivory','khaki','lavender','charcoal','cream','rose',
  'mint','peach','sand','burgundy','champagne','graphite','midnight','transparent','clear',
  'glacier','frost','frostbite','aqua','violet','indigo','crimson','scarlet','amber'
];

function looksLikeColorValue(v: string): boolean {
  const s = String(v || '').toLowerCase();
  if (!s) return false;
  for (const k of COLOR_KEYWORDS) {
    const re = new RegExp(`(^|[^a-z])${k}([^a-z]|$)`, 'i');
    if (re.test(s)) return true;
  }
  // Chinese color words
  for (const cn of Object.keys({ '黑色':1,'白色':1,'红色':1,'蓝色':1,'绿色':1,'黄色':1,'粉色':1,'紫色':1,'橙色':1,'灰色':1,'棕色':1,'金色':1,'银色':1 })) {
    if (s.includes(cn)) return true;
  }
  return false;
}

function looksLikeColorOptionName(name: string): boolean {
  const s = String(name || '').toLowerCase().trim();
  return s === 'color' || s === 'colour' || s.includes('颜色') || s.includes('لون');
}

function pickColorForValue(value: string): { hex: string; ar: string } {
  const v = String(value || '').toLowerCase();
  for (const [en, info] of Object.entries(COLOR_MAP)) {
    const re = new RegExp(`(^|[^a-z])${en}([^a-z]|$)`, 'i');
    if (re.test(v)) return { hex: info.hex, ar: info.ar };
  }
  for (const [cn, info] of Object.entries(CHINESE_COLOR_MAP)) {
    if (v.includes(cn)) return { hex: info.hex, ar: info.ar };
  }
  return { hex: '#808080', ar: value };
}

async function fetchShopifyProduct(productUrl: string): Promise<any | null> {
  try {
    const u = new URL(productUrl);
    const pathMatch = u.pathname.match(/\/products\/([^/?#]+)/);
    if (!pathMatch) return null;
    const handle = pathMatch[1];
    const jsonUrl = `${u.origin}/products/${handle}.json`;
    console.log('Trying Shopify products.json:', jsonUrl);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    const resp = await fetch(jsonUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: ctrl.signal,
    }).finally(() => clearTimeout(t));
    if (!resp.ok) {
      console.log('Shopify .json status:', resp.status);
      return null;
    }
    const data = await resp.json();
    return data?.product || null;
  } catch (e) {
    console.log('Shopify .json fetch failed:', (e as Error).message);
    return null;
  }
}

interface ShopifyExtracted {
  colors: Array<{ name: string; name_ar: string; hex_code: string; image_url: string | null }>;
  options: Array<{ name: string; name_ar: string; image_url: string | null; price_adjustment: number }>;
  images: string[];
}

function extractShopifyVariants(product: any): ShopifyExtracted | null {
  if (!product || !Array.isArray(product.options) || !Array.isArray(product.variants)) return null;
  const options: any[] = product.options;
  const variants: any[] = product.variants;
  const images: any[] = Array.isArray(product.images) ? product.images : [];
  const imageById = new Map<number, string>();
  for (const img of images) {
    if (img?.id && img?.src) imageById.set(img.id, img.src);
  }

  // Decide which axis is "colors": prefer name match, otherwise the axis whose
  // values most often look like color names.
  let colorAxisIdx = -1;
  for (let i = 0; i < options.length; i++) {
    if (looksLikeColorOptionName(options[i]?.name)) { colorAxisIdx = i; break; }
  }
  if (colorAxisIdx === -1) {
    let bestScore = 0;
    for (let i = 0; i < options.length; i++) {
      const vals = options[i]?.values || [];
      const score = vals.filter((v: string) => looksLikeColorValue(v)).length;
      if (score > bestScore && score >= Math.ceil(vals.length / 2)) {
        bestScore = score;
        colorAxisIdx = i;
      }
    }
  }

  const findVariantImage = (axisIdx: number, value: string): string | null => {
    const key = `option${axisIdx + 1}`;
    const v = variants.find((x) => x?.[key] === value && x?.image_id);
    if (v && imageById.has(v.image_id)) return imageById.get(v.image_id)!;
    return null;
  };

  const result: ShopifyExtracted = { colors: [], options: [], images: images.map((i) => i?.src).filter(Boolean) };

  for (let i = 0; i < options.length; i++) {
    const opt = options[i];
    const values: string[] = Array.isArray(opt?.values) ? opt.values : [];
    if (i === colorAxisIdx) {
      for (const val of values) {
        const meta = pickColorForValue(val);
        result.colors.push({
          name: val,
          name_ar: meta.ar,
          hex_code: meta.hex,
          image_url: findVariantImage(i, val),
        });
      }
    } else {
      for (const val of values) {
        // Prefix with option name when there are multiple non-color axes for clarity
        const label = options.length > 2 ? `${opt?.name}: ${val}` : String(val);
        result.options.push({
          name: label,
          name_ar: label,
          image_url: findVariantImage(i, val),
          price_adjustment: 0,
        });
      }
    }
  }
  return result;
}


// Color mapping with more colors
const COLOR_MAP: Record<string, { ar: string; hex: string }> = {
  'black': { ar: 'أسود', hex: '#000000' },
  'white': { ar: 'أبيض', hex: '#FFFFFF' },
  'red': { ar: 'أحمر', hex: '#FF0000' },
  'blue': { ar: 'أزرق', hex: '#0000FF' },
  'green': { ar: 'أخضر', hex: '#008000' },
  'yellow': { ar: 'أصفر', hex: '#FFFF00' },
  'pink': { ar: 'وردي', hex: '#FFC0CB' },
  'purple': { ar: 'بنفسجي', hex: '#800080' },
  'orange': { ar: 'برتقالي', hex: '#FFA500' },
  'gray': { ar: 'رمادي', hex: '#808080' },
  'grey': { ar: 'رمادي', hex: '#808080' },
  'brown': { ar: 'بني', hex: '#A52A2A' },
  'gold': { ar: 'ذهبي', hex: '#FFD700' },
  'silver': { ar: 'فضي', hex: '#C0C0C0' },
  'navy': { ar: 'كحلي', hex: '#000080' },
  'beige': { ar: 'بيج', hex: '#F5F5DC' },
  'cyan': { ar: 'سماوي', hex: '#00FFFF' },
  'magenta': { ar: 'أرجواني', hex: '#FF00FF' },
  'maroon': { ar: 'خمري', hex: '#800000' },
  'olive': { ar: 'زيتي', hex: '#808000' },
  'teal': { ar: 'أزرق مخضر', hex: '#008080' },
  'lime': { ar: 'ليموني', hex: '#00FF00' },
  'coral': { ar: 'مرجاني', hex: '#FF7F50' },
  'salmon': { ar: 'سلموني', hex: '#FA8072' },
  'turquoise': { ar: 'فيروزي', hex: '#40E0D0' },
  'ivory': { ar: 'عاجي', hex: '#FFFFF0' },
  'khaki': { ar: 'كاكي', hex: '#F0E68C' },
  'lavender': { ar: 'لافندر', hex: '#E6E6FA' },
  'charcoal': { ar: 'فحمي', hex: '#36454F' },
  'cream': { ar: 'كريمي', hex: '#FFFDD0' },
  'rose': { ar: 'وردي فاتح', hex: '#FF007F' },
  'mint': { ar: 'نعناعي', hex: '#98FB98' },
  'peach': { ar: 'خوخي', hex: '#FFDAB9' },
  'sand': { ar: 'رملي', hex: '#C2B280' },
  'burgundy': { ar: 'نبيذي', hex: '#800020' },
  'champagne': { ar: 'شامبانيا', hex: '#F7E7CE' },
  'graphite': { ar: 'جرافيت', hex: '#474A51' },
  'midnight': { ar: 'أزرق داكن', hex: '#191970' },
};

// Chinese color names mapping
const CHINESE_COLOR_MAP: Record<string, { en: string; ar: string; hex: string }> = {
  '黑色': { en: 'Black', ar: 'أسود', hex: '#000000' },
  '白色': { en: 'White', ar: 'أبيض', hex: '#FFFFFF' },
  '红色': { en: 'Red', ar: 'أحمر', hex: '#FF0000' },
  '蓝色': { en: 'Blue', ar: 'أزرق', hex: '#0000FF' },
  '绿色': { en: 'Green', ar: 'أخضر', hex: '#008000' },
  '黄色': { en: 'Yellow', ar: 'أصفر', hex: '#FFFF00' },
  '粉色': { en: 'Pink', ar: 'وردي', hex: '#FFC0CB' },
  '粉红': { en: 'Pink', ar: 'وردي', hex: '#FFC0CB' },
  '紫色': { en: 'Purple', ar: 'بنفسجي', hex: '#800080' },
  '橙色': { en: 'Orange', ar: 'برتقالي', hex: '#FFA500' },
  '灰色': { en: 'Gray', ar: 'رمادي', hex: '#808080' },
  '棕色': { en: 'Brown', ar: 'بني', hex: '#A52A2A' },
  '金色': { en: 'Gold', ar: 'ذهبي', hex: '#FFD700' },
  '银色': { en: 'Silver', ar: 'فضي', hex: '#C0C0C0' },
  '深蓝': { en: 'Navy', ar: 'كحلي', hex: '#000080' },
  '米色': { en: 'Beige', ar: 'بيج', hex: '#F5F5DC' },
  '卡其': { en: 'Khaki', ar: 'كاكي', hex: '#F0E68C' },
  '驼色': { en: 'Camel', ar: 'جملي', hex: '#C19A6B' },
  '酒红': { en: 'Wine Red', ar: 'خمري', hex: '#800000' },
  '藏青': { en: 'Navy Blue', ar: 'أزرق داكن', hex: '#000080' },
  '深灰': { en: 'Dark Gray', ar: 'رمادي غامق', hex: '#404040' },
  '浅灰': { en: 'Light Gray', ar: 'رمادي فاتح', hex: '#C0C0C0' },
  '墨绿': { en: 'Dark Green', ar: 'أخضر غامق', hex: '#004400' },
  '天蓝': { en: 'Sky Blue', ar: 'سماوي', hex: '#87CEEB' },
  '玫红': { en: 'Rose', ar: 'وردي', hex: '#FF007F' },
  '透明': { en: 'Transparent', ar: 'شفاف', hex: '#FFFFFF' },
  '彩色': { en: 'Colorful', ar: 'متعدد الألوان', hex: '#FF00FF' },
  '原色': { en: 'Natural', ar: 'طبيعي', hex: '#E8D4A8' },
};

// Feature icon mapping based on keywords
const FEATURE_ICON_MAP: Array<[string, string]> = [
  ['fast', 'Zap'], ['speed', 'Zap'], ['quick', 'Zap'], ['سريع', 'Zap'], ['سرعة', 'Zap'],
  ['performance', 'TrendingUp'], ['أداء', 'TrendingUp'],
  ['quality', 'Award'], ['premium', 'Crown'], ['جودة', 'Award'], ['ممتاز', 'Crown'], ['فاخر', 'Crown'],
  ['original', 'Shield'], ['أصلي', 'Shield'], ['genuine', 'Shield'],
  ['memory', 'Cpu'], ['ram', 'Cpu'], ['ذاكرة', 'Cpu'], ['storage', 'Disc'], ['تخزين', 'Disc'],
  ['gb', 'Cpu'], ['tb', 'Disc'], ['ssd', 'Disc'], ['hdd', 'Disc'],
  ['battery', 'Battery'], ['بطارية', 'Battery'], ['power', 'Battery'], ['طاقة', 'Battery'], ['mah', 'Battery'], ['charge', 'Battery'],
  ['display', 'Monitor'], ['screen', 'Monitor'], ['شاشة', 'Monitor'], ['amoled', 'Monitor'], ['lcd', 'Monitor'], ['oled', 'Monitor'], ['hd', 'Monitor'], ['4k', 'Monitor'],
  ['camera', 'Camera'], ['كاميرا', 'Camera'], ['photo', 'Image'], ['صورة', 'Image'], ['megapixel', 'Camera'], ['lens', 'Camera'], ['عدسة', 'Camera'],
  ['wifi', 'Wifi'], ['bluetooth', 'Wifi'], ['واي فاي', 'Wifi'], ['wireless', 'Wifi'], ['لاسلكي', 'Wifi'], ['5g', 'Wifi'], ['4g', 'Wifi'], ['lte', 'Wifi'],
  ['audio', 'Volume2'], ['sound', 'Volume2'], ['صوت', 'Volume2'], ['speaker', 'Volume2'], ['سماعة', 'Headphones'], ['headphone', 'Headphones'], ['music', 'Music'], ['موسيقى', 'Music'],
  ['protect', 'Shield'], ['حماية', 'Shield'], ['secure', 'Lock'], ['آمن', 'Lock'], ['waterproof', 'Droplet'], ['مقاوم', 'Shield'], ['water', 'Droplet'], ['ماء', 'Droplet'],
  ['shipping', 'Truck'], ['delivery', 'Truck'], ['توصيل', 'Truck'], ['free_shipping', 'Truck'],
  ['warranty', 'Shield'], ['ضمان', 'Shield'], ['guarantee', 'Shield'], ['كفالة', 'Shield'],
  ['weight', 'Feather'], ['وزن', 'Feather'], ['light', 'Feather'], ['خفيف', 'Feather'], ['size', 'Package'], ['حجم', 'Package'], ['dimension', 'Package'],
  ['metal', 'Gem'], ['معدن', 'Gem'], ['aluminum', 'Gem'], ['ألومنيوم', 'Gem'], ['steel', 'Gem'], ['فولاذ', 'Gem'], ['leather', 'Sparkles'], ['جلد', 'Sparkles'],
  ['smart', 'Sparkles'], ['ذكي', 'Sparkles'], ['ai', 'Sparkles'], ['intelligent', 'Sparkles'], ['tech', 'Cpu'], ['تقنية', 'Cpu'],
  ['nozzle', 'Target'], ['mm', 'Target'], ['فوهة', 'Target'],
  ['feature', 'Check'], ['ميزة', 'Check'],
];

// Get appropriate icon for a feature
function getFeatureIcon(text: string): string {
  const textLower = text.toLowerCase();
  for (const [keyword, icon] of FEATURE_ICON_MAP) {
    if (textLower.includes(keyword)) {
      return icon;
    }
  }
  return 'Check';
}

// Validate color name
function isValidColorName(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  const nameLower = name.toLowerCase().trim();
  if (nameLower.length < 1 || nameLower.length > 50) return false;
  if (/<|>|\[|\]|\{|\}|\\|http|class=|style=|function|var |const |let |import|export/.test(nameLower)) return false;
  if (/^(select|choose|pick|اختر|option|default|standard|normal|none|null|undefined)$/i.test(nameLower)) return false;
  return true;
}

// Validate option name
function isValidOptionName(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  const nameTrimmed = name.trim();
  if (nameTrimmed.length < 1 || nameTrimmed.length > 50) return false;
  if (/<|>|\{|\}|\\|function|var |const |let /.test(nameTrimmed)) return false;
  if (/^(select|choose|pick|اختر|option|color|اللون|please select|الرجاء الاختيار)$/i.test(nameTrimmed)) return false;
  return true;
}

// Normalize image URL
function normalizeImageUrl(url: string): string {
  let cleanUrl = url.trim();
  if (cleanUrl.startsWith('//')) cleanUrl = 'https:' + cleanUrl;
  try {
    const urlObj = new URL(cleanUrl);
    const essentialParams = ['id', 'format', 'w', 'h', 'width', 'height'];
    const newParams = new URLSearchParams();
    for (const key of essentialParams) {
      if (urlObj.searchParams.has(key)) {
        newParams.set(key, urlObj.searchParams.get(key)!);
      }
    }
    urlObj.search = newParams.toString();
    return urlObj.toString();
  } catch {
    return cleanUrl;
  }
}

// Extract base image URL for deduplication
function getImageBaseUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.origin + urlObj.pathname;
  } catch {
    return url;
  }
}

function cleanExtractedText(value: unknown): string {
  if (typeof value !== 'string') return '';
  let s = value;
  s = s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  s = s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
  s = s.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  const named: Record<string, string> = {
    '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>',
    '&nbsp;': ' ', '&ndash;': '-', '&mdash;': '-', '&hellip;': '…',
  };
  s = s.replace(/&[a-zA-Z]+;/g, (m) => named[m.toLowerCase()] ?? m);
  s = s.replace(/<[^>]*>/g, ' ');
  s = s.replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/[\u00A0\s]+/g, ' ').trim();
  return s;
}

function normalizeSeoText(value: unknown): string {
  const s = cleanExtractedText(value).slice(0, 200);
  if (!s || /^\.{2,}$/.test(s) || /^(placeholder|null|undefined|n\/a)$/i.test(s)) return '';
  return s;
}

function parseAiJsonObject(text: string): any {
  let cleaned = String(text || '')
    .replace(/```json\s*/gi, '')
    .replace(/```/g, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new Error('No JSON object found in AI response');
  cleaned = cleaned.slice(start, end + 1);
  try {
    return JSON.parse(cleaned);
  } catch (_) {
    const repaired = cleaned
      .replace(/,\s*}/g, '}')
      .replace(/,\s*]/g, ']')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    return JSON.parse(repaired);
  }
}

function hasTriLangValue(value: any): boolean {
  return Boolean(normalizeSeoText(value?.ar) && normalizeSeoText(value?.en) && normalizeSeoText(value?.ku));
}

function buildFallbackSearchableTags(...values: unknown[]): string[] {
  const stop = new Set(['the', 'and', 'with', 'for', 'من', 'في', 'على', 'الى', 'إلى', 'هذا', 'هذه', 'المنتج']);
  const tokens = values
    .map(cleanExtractedText)
    .join(' ')
    .split(/[\s,،/|_+()\[\]{}:;]+/)
    .map((token) => token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').trim())
    .filter((token) => token.length >= 2 && !stop.has(token.toLowerCase()));
  return Array.from(new Set(tokens)).slice(0, 12);
}

function buildFallbackAIContent(input: {
  nameAr?: unknown;
  nameEn?: unknown;
  descriptionAr?: unknown;
  descriptionEn?: unknown;
  dimensions?: any;
  weightKg?: unknown;
}) {
  const nameAr = cleanExtractedText(input.nameAr) || cleanExtractedText(input.nameEn) || 'المنتج';
  const nameEn = cleanExtractedText(input.nameEn) || cleanExtractedText(input.nameAr) || 'Product';
  const dimensionsText = input.dimensions?.length_cm && input.dimensions?.width_cm && input.dimensions?.height_cm
    ? `${input.dimensions.length_cm}×${input.dimensions.width_cm}×${input.dimensions.height_cm} cm`
    : '';
  const weightText = input.weightKg ? `${input.weightKg} kg` : '';

  return {
    problem_solved: {
      ar: `${nameAr} يساعد المستخدم على الحصول على أداء عملي ونتيجة موثوقة بدون تعقيد.`,
      en: `${nameEn} helps users get practical performance and reliable results without unnecessary complexity.`,
      ku: `${nameAr} یارمەتی بەکارهێنەر دەدات ئەنجامی پشتپێبەستراو و بەکارهێنانی ئاسان بەدەست بهێنێت.`,
    },
    target_audience: {
      ar: `مناسب للمستخدمين الذين يبحثون عن ${nameAr} بجودة جيدة وتجربة استخدام واضحة.`,
      en: `Suitable for users looking for ${nameEn} with dependable quality and a clear everyday experience.`,
      ku: `گونجاوە بۆ ئەو بەکارهێنەرانەی بەدوای ${nameAr} بە کوالێتی باش و ئەزموونی ڕووندا دەگەڕێن.`,
    },
    benefits: [
      {
        ar: 'يوفر تجربة استخدام مستقرة وسهلة للمستخدم اليومي.',
        en: 'Provides a stable and easy experience for everyday use.',
        ku: 'ئەزموونێکی جێگیر و ئاسان بۆ بەکارهێنانی ڕۆژانە دابین دەکات.',
      },
      {
        ar: 'يساعد على إنجاز المهام بسرعة وبنتائج أكثر موثوقية.',
        en: 'Helps complete tasks faster with more dependable results.',
        ku: 'یارمەتی تەواوکردنی کارەکان بە خێرایی و ئەنجامی پشتپێبەستراوتر دەدات.',
      },
      {
        ar: 'اختيار عملي لمن يريد منتجاً واضح المواصفات وسهل الاعتماد عليه.',
        en: 'A practical choice for anyone who needs clear specs and dependable use.',
        ku: 'هەڵبژاردنێکی کردارییە بۆ کەسێک کە پێویستی بە تایبەتمەندی ڕوون و بەکارهێنانی پشتپێبەستراوە.',
      },
    ],
    usage: [
      {
        ar: 'راجع المواصفات والصور للتأكد من ملاءمة المنتج لاحتياجك.',
        en: 'Review the specifications and images to confirm it fits your needs.',
        ku: 'تایبەتمەندی و وێنەکان بپشکنە بۆ دڵنیابوون لە گونجاوی بۆ پێویستیت.',
      },
      {
        ar: 'اختر اللون أو الخيار المناسب ثم أضفه إلى السلة.',
        en: 'Choose the suitable color or option, then add it to your cart.',
        ku: 'ڕەنگ یان هەڵبژاردەی گونجاو دیاری بکە و زیاد بکە بۆ سەبەتەکەت.',
      },
    ],
    specifications: [
      { key: { ar: 'اسم المنتج', en: 'Product name', ku: 'ناوی بەرهەم' }, value: { ar: nameAr, en: nameEn, ku: nameAr } },
      { key: { ar: 'الاستخدام', en: 'Use case', ku: 'بەکارهێنان' }, value: { ar: 'استخدام يومي وعملي', en: 'Practical everyday use', ku: 'بەکارهێنانی ڕۆژانە و کرداری' } },
      ...(dimensionsText ? [{ key: { ar: 'الأبعاد التقريبية', en: 'Approx. dimensions', ku: 'قەبارەی نزیکەیی' }, value: { ar: dimensionsText, en: dimensionsText, ku: dimensionsText } }] : []),
      ...(weightText ? [{ key: { ar: 'الوزن التقريبي', en: 'Approx. weight', ku: 'کێشی نزیکەیی' }, value: { ar: weightText, en: weightText, ku: weightText } }] : []),
    ].slice(0, 6),
  };
}

function isUsefulProductName(value: string): boolean {
  const s = cleanExtractedText(value);
  if (s.length < 3 || s.length > 220) return false;
  if (/^(product|منتج|home|shop|store|cart|login|undefined|null)$/i.test(s)) return false;
  if (/404|not found|access denied|captcha|enable javascript/i.test(s)) return false;
  return true;
}

function firstUsefulNameFromObject(value: unknown, depth = 0): string {
  if (!value || depth > 4) return '';
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstUsefulNameFromObject(item, depth + 1);
      if (found) return found;
    }
    return '';
  }
  if (typeof value !== 'object') return '';
  const obj = value as Record<string, unknown>;
  const keys = ['productName', 'product_name', 'spuName', 'goodsName', 'title', 'name'];
  for (const key of keys) {
    const candidate = cleanExtractedText(obj[key]);
    if (isUsefulProductName(candidate)) return candidate;
  }
  for (const child of Object.values(obj)) {
    const found = firstUsefulNameFromObject(child, depth + 1);
    if (found) return found;
  }
  return '';
}

function extractDirectProductName(html: string, platformApiData?: unknown, nextData?: unknown): string {
  const jsonLdMatches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of jsonLdMatches) {
    try {
      const parsed = JSON.parse(match[1]);
      for (const product of collectJsonLdProducts(parsed)) {
        const name = cleanExtractedText(product.name);
        if (isUsefulProductName(name)) return name;
      }
    } catch {}
  }

  const metaPatterns = [
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
    /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:title["']/i,
    /<meta[^>]+name=["']title["'][^>]+content=["']([^"']+)["']/i,
    /<title[^>]*>([\s\S]*?)<\/title>/i,
  ];
  for (const pattern of metaPatterns) {
    const raw = html.match(pattern)?.[1] || '';
    const name = cleanExtractedText(raw).split(/\s+[|]\s+/)[0]?.trim() || '';
    if (isUsefulProductName(name)) return name;
  }

  return firstUsefulNameFromObject(platformApiData) || firstUsefulNameFromObject(nextData);
}

// Extract product images
function extractImages(html: string): string[] {
  const seenBases = new Set<string>();
  const images: string[] = [];

  const addImage = (url: string) => {
    if (!url) return;
    let cleanUrl = normalizeImageUrl(url);
    if (!cleanUrl.startsWith('http')) return;
    if (/data:image|placeholder|icon|logo|avatar|consent|trustarc|\.svg|favicon|pixel|tracking|badge|button|banner-ad|sprite/i.test(cleanUrl)) return;
    if (cleanUrl.length < 30) return;
    if (/\b(16|24|32|48|64)x\1\b/.test(cleanUrl)) return;
    const base = getImageBaseUrl(cleanUrl);
    if (seenBases.has(base)) return;
    seenBases.add(base);
    images.push(cleanUrl);
  };

  const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
  if (ogMatch) addImage(ogMatch[1]);

  const jsonLdMatches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of jsonLdMatches) {
    try {
      const data = JSON.parse(match[1]);
      if (data['@type'] === 'Product' && data.image) {
        const imgs = Array.isArray(data.image) ? data.image : [data.image];
        imgs.forEach(addImage);
      }
    } catch {}
  }

  const galleryPatterns = [
    /data-(?:large-)?src=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi,
    /data-zoom-image=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi,
    /<img[^>]*class=["'][^"']*(?:product|gallery|main|hero)[^"']*["'][^>]*src=["']([^"']+)["']/gi,
    /<img[^>]*src=["']([^"']+(?:store\.bblcdn|cdn\.shopify|cdn\.)|[^"']+\.(?:jpg|jpeg|png|webp))["']/gi,
  ];
  
  for (const pattern of galleryPatterns) {
    const matches = html.matchAll(pattern);
    for (const match of matches) addImage(match[1]);
  }

  return images.slice(0, 10);
}

// Extract SKU data from Chinese e-commerce pages (Taobao, 1688, JD, Tmall)
function extractSkuData(html: string): { colors: any[], options: any[] } {
  const colors: any[] = [];
  const options: any[] = [];
  const seenColors = new Set<string>();
  const seenOptions = new Set<string>();

  // Method 1: Look for SKU property data in script tags
  const skuPatterns = [
    // Taobao/Tmall pattern
    /"skuProps":\s*(\[[\s\S]*?\])/g,
    /skuList\s*[=:]\s*(\[[\s\S]*?\])/g,
    /"propertyType"\s*:\s*"color"[\s\S]*?"values"\s*:\s*(\[[\s\S]*?\])/g,
    // 1688 pattern
    /"skuProps"\s*:\s*(\{[\s\S]*?\})/g,
    /skuInfoMap\s*[=:]\s*(\{[\s\S]*?\})/g,
    // General patterns
    /"sku"\s*:\s*(\[[\s\S]*?\])/g,
    /propertyMeaning\s*[=:]\s*(\{[\s\S]*?\})/g,
  ];

  for (const pattern of skuPatterns) {
    const matches = html.matchAll(pattern);
    for (const match of matches) {
      try {
        const data = JSON.parse(match[1]);
        if (Array.isArray(data)) {
          for (const item of data) {
            // Check if it's a color property
            if (item.prop === '颜色' || item.prop === '颜色分类' || item.name?.includes('颜色') || item.label?.includes('Color')) {
              const values = item.values || item.value || [];
              for (const v of values) {
                const name = v.name || v.text || v.value || '';
                if (name && !seenColors.has(name.toLowerCase())) {
                  seenColors.add(name.toLowerCase());
                  const chineseInfo = CHINESE_COLOR_MAP[name] || null;
                  const englishInfo = Object.entries(COLOR_MAP).find(([k]) => name.toLowerCase().includes(k));
                  colors.push({
                    name: chineseInfo?.en || englishInfo?.[0] || name,
                    name_ar: chineseInfo?.ar || englishInfo?.[1]?.ar || name,
                    hex_code: chineseInfo?.hex || englishInfo?.[1]?.hex || '#808080',
                    image_url: v.image || v.img || v.imageUrl || null,
                  });
                }
              }
            }
            // Check if it's a size/option property
            else if (item.prop === '尺寸' || item.prop === '规格' || item.prop === '型号' || item.name?.includes('尺') || item.name?.includes('规格')) {
              const values = item.values || item.value || [];
              for (const v of values) {
                const name = v.name || v.text || v.value || '';
                if (name && !seenOptions.has(name.toLowerCase())) {
                  seenOptions.add(name.toLowerCase());
                  options.push({
                    name: name,
                    name_ar: name,
                    image_url: v.image || v.img || v.imageUrl || null,
                  });
                }
              }
            }
          }
        }
      } catch {}
    }
  }

  // Method 2: Look for SKU items in HTML
  const skuItemPattern = /<(?:li|div|span)[^>]*(?:class|data)[^>]*(?:sku|color|variant|option)[^>]*>[\s\S]*?<\/(?:li|div|span)>/gi;
  const skuItems = html.matchAll(skuItemPattern);
  for (const item of skuItems) {
    const itemHtml = item[0];
    
    // Extract image
    const imgMatch = itemHtml.match(/(?:data-)?(?:img|image|src)=["']([^"']+)["']/i);
    const imageUrl = imgMatch ? normalizeImageUrl(imgMatch[1]) : null;
    
    // Extract name
    const nameMatch = itemHtml.match(/(?:title|alt|data-name|data-value)=["']([^"']+)["']/i);
    const name = nameMatch ? nameMatch[1].trim() : null;
    
    if (name && isValidColorName(name)) {
      // Check if it looks like a color
      const chineseInfo = CHINESE_COLOR_MAP[name] || null;
      const englishInfo = Object.entries(COLOR_MAP).find(([k]) => name.toLowerCase().includes(k));
      const isColor = chineseInfo || englishInfo || /color|颜色|色/i.test(itemHtml);
      
      if (isColor && !seenColors.has(name.toLowerCase())) {
        seenColors.add(name.toLowerCase());
        colors.push({
          name: chineseInfo?.en || englishInfo?.[0] || name,
          name_ar: chineseInfo?.ar || englishInfo?.[1]?.ar || name,
          hex_code: chineseInfo?.hex || englishInfo?.[1]?.hex || '#808080',
          image_url: imageUrl,
        });
      } else if (!isColor && !seenOptions.has(name.toLowerCase())) {
        seenOptions.add(name.toLowerCase());
        options.push({
          name: name,
          name_ar: name,
          image_url: imageUrl,
        });
      }
    }
  }

  // Method 3: Look for data-value or data-skuid attributes
  const dataValuePattern = /data-(?:value|sku(?:id)?|prop)=["']([^"']+)["'][^>]*(?:data-img|style[^>]*url\()=?["']?([^"')\s]+)/gi;
  const dataValueItems = html.matchAll(dataValuePattern);
  for (const item of dataValueItems) {
    const name = item[1].trim();
    const imageUrl = normalizeImageUrl(item[2]);
    
    if (name && isValidColorName(name) && !seenColors.has(name.toLowerCase())) {
      const chineseInfo = CHINESE_COLOR_MAP[name] || null;
      const englishInfo = Object.entries(COLOR_MAP).find(([k]) => name.toLowerCase().includes(k));
      if (chineseInfo || englishInfo) {
        seenColors.add(name.toLowerCase());
        colors.push({
          name: chineseInfo?.en || englishInfo?.[0] || name,
          name_ar: chineseInfo?.ar || englishInfo?.[1]?.ar || name,
          hex_code: chineseInfo?.hex || englishInfo?.[1]?.hex || '#808080',
          image_url: imageUrl.startsWith('http') ? imageUrl : null,
        });
      }
    }
  }

  console.log(`Direct SKU extraction: ${colors.length} colors, ${options.length} options`);
  return { colors, options };
}

// ===== Bambu Lab deterministic color-image parser =====
// Parses the rendered HTML to find color swatches with names (including SKU codes)
// and their associated swatch images from the property_selector_Color section
function parseBambuLabColors(html: string): Array<{name: string; name_ar: string; hex_code: string; image_url: string | null}> {
  const colors: Array<{name: string; name_ar: string; hex_code: string; image_url: string | null}> = [];

  const bambuColorArMap: Record<string, string> = {
    'gray': 'رمادي', 'grey': 'رمادي',
    'light blue': 'أزرق فاتح', 'blue': 'أزرق',
    'olive': 'زيتي', 'brown': 'بني',
    'teal': 'أزرق مخضر', 'orange': 'برتقالي',
    'purple': 'بنفسجي', 'pink': 'وردي',
    'red': 'أحمر', 'green': 'أخضر',
    'yellow': 'أصفر', 'white': 'أبيض',
    'black': 'أسود', 'gold': 'ذهبي',
    'silver': 'فضي', 'jade': 'أخضر يشمي',
    'translucent': 'شفاف', 'clear': 'شفاف',
  };

  // ===== Primary Method: Parse <li value="ColorName (SKU)"> with <img> inside =====
  // This is the most reliable source - each swatch <li> has:
  //   value="Translucent Orange (32300)" and an <img src="...swatch.media">
  const swatchPattern = /<li[^>]*value="([^"]+)"[^>]*class="[^"]*(?:rounded-full|color)[^"]*"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"[^>]*>[\s\S]*?<\/li>/gi;
  let swatchMatch;
  const seenNames = new Set<string>();
  
  while ((swatchMatch = swatchPattern.exec(html)) !== null) {
    const fullName = swatchMatch[1].trim(); // e.g. "Translucent Orange (32300)"
    const swatchImageUrl = swatchMatch[2].trim();
    
    if (seenNames.has(fullName.toLowerCase())) continue;
    seenNames.add(fullName.toLowerCase());

    // Generate Arabic name
    const nameLower = fullName.toLowerCase();
    let nameAr = fullName;
    for (const [key, ar] of Object.entries(bambuColorArMap)) {
      if (nameLower.includes(key)) {
        if (nameLower.includes('translucent') && key !== 'translucent') {
          nameAr = `شفاف ${ar}`;
        } else {
          nameAr = ar;
        }
        break;
      }
    }

    // Try to extract hex from nearby background-color style (swatch circle may have it)
    let hexCode = '#808080';
    // Search within 2000 chars around this match for a background-color
    const matchStart = Math.max(0, swatchMatch.index - 500);
    const matchEnd = Math.min(html.length, swatchMatch.index + swatchMatch[0].length + 500);
    const nearbyHtml = html.substring(matchStart, matchEnd);
    const hexMatch = nearbyHtml.match(/background-color:\s*#([0-9a-fA-F]{6})/i);
    if (hexMatch) {
      hexCode = '#' + hexMatch[1];
    }

    // Use swatch image - it's deterministically linked to this color
    const imageUrl = swatchImageUrl.startsWith('http') ? swatchImageUrl : null;

    colors.push({ name: fullName, name_ar: nameAr, hex_code: hexCode, image_url: imageUrl });
    console.log(`  Bambu swatch: ${fullName} -> ${imageUrl ? 'has image' : 'no image'}`);
  }

  // ===== Fallback: Try JP-prefixed images mapped to spec table =====
  if (colors.length === 0) {
    console.log('No swatch <li> found, trying spec table fallback...');
    
    const colorTablePattern = /<td[^>]*>\s*((?:Translucent|Matte|Glossy|Basic|Silk|Marble|Support|Clear)\s*\w[\w\s]*?)\s*<\/td>\s*<td[^>]*style="[^"]*background-color:\s*#([0-9a-fA-F]+)/gi;
    const tableColors: Array<{name: string; hex: string}> = [];
    let tableMatch;
    while ((tableMatch = colorTablePattern.exec(html)) !== null) {
      tableColors.push({ name: tableMatch[1].trim(), hex: '#' + tableMatch[2] });
    }

    const jpImagePattern = /https:\/\/store\.bblcdn\.com[^"'\s<>]*\/(JP\d{5}[^"'\s<>]+\.jpg)/g;
    const jpImages: Map<string, string> = new Map();
    let jpMatch;
    while ((jpMatch = jpImagePattern.exec(html)) !== null) {
      const fullUrl = jpMatch[0].split('__op__')[0];
      const jpCode = jpMatch[1].match(/^JP\d{5}/)?.[0];
      if (jpCode && !jpImages.has(jpCode)) jpImages.set(jpCode, fullUrl);
    }
    const orderedJpUrls = Array.from(jpImages.values());

    for (let i = 0; i < tableColors.length; i++) {
      const { name, hex } = tableColors[i];
      const imageUrl = i < orderedJpUrls.length ? orderedJpUrls[i] : null;
      const nameLower = name.toLowerCase();
      let nameAr = name;
      for (const [key, ar] of Object.entries(bambuColorArMap)) {
        if (nameLower.includes(key)) {
          nameAr = nameLower.includes('translucent') && key !== 'translucent' ? `شفاف ${ar}` : ar;
          break;
        }
      }
      colors.push({ name, name_ar: nameAr, hex_code: hex, image_url: imageUrl });
    }
  }

  console.log('Bambu Lab parser: found', colors.length, 'colors total');
  return colors;
}

// ===== Bambu Lab unified parser (covers US/EU static HTML and China store) =====
//
// Bambulab US/EU store ships a fully-formed product HTML where each variant is rendered as:
//   <li value="Titan Gray (13108)" class="...rounded-full..."><img src="https://store.bblcdn.com/.../xxx.png" ...></li>   ← color swatch
//   <li value="Refill" class="..."><span ...>Refill</span></li>                                                            ← non-color option
//   <li value="1 kg" class="..."><span ...>1 kg</span></li>                                                                 ← non-color option
//
// We extract ALL <li value="..."> blocks, then classify:
//   - has <img> with a swatch URL → COLOR (use swatch image, sample real hex from PNG)
//   - otherwise                   → OPTION (Type, Size, Nozzle, etc.)

const bambuBaseColorMap: Record<string, string> = {
  'gray': 'رمادي', 'grey': 'رمادي',
  'blue': 'أزرق', 'olive': 'زيتي', 'brown': 'بني',
  'teal': 'أزرق مخضر', 'orange': 'برتقالي',
  'purple': 'بنفسجي', 'pink': 'وردي',
  'red': 'أحمر', 'green': 'أخضر',
  'yellow': 'أصفر', 'white': 'أبيض',
  'black': 'أسود', 'gold': 'ذهبي',
  'silver': 'فضي', 'jade': 'أخضر يشمي',
  'translucent': 'شفاف', 'clear': 'شفاف',
  'champagne': 'شمبانيا', 'mint': 'نعناعي',
  'cream': 'كريمي', 'beige': 'بيج', 'ivory': 'عاجي',
  'cyan': 'سماوي', 'magenta': 'ماجنتا',
  'bronze': 'برونزي', 'copper': 'نحاسي',
  'candy': 'كاندي',
};

const bambuQualifierMap: Array<[string, string]> = [
  ['rose gold', 'وردي ذهبي'],
  ['baby blue', 'أزرق فاتح'],
  ['light blue', 'أزرق فاتح'],
  ['dark blue', 'أزرق غامق'],
  ['sky blue', 'أزرق سماوي'],
  ['light gray', 'رمادي فاتح'],
  ['light grey', 'رمادي فاتح'],
  ['dark gray', 'رمادي غامق'],
  ['dark grey', 'رمادي غامق'],
  ['titan gray', 'رمادي تيتانيوم'],
  ['titan grey', 'رمادي تيتانيوم'],
  ['hot pink', 'وردي فاقع'],
  ['matte black', 'أسود مطفي'],
  ['matte white', 'أبيض مطفي'],
  ['mint green', 'أخضر نعناعي'],
  ['forest green', 'أخضر غابات'],
  ['lime green', 'أخضر ليموني'],
  ['blood red', 'أحمر دموي'],
  ['wine red', 'أحمر نبيذي'],
  ['candy red', 'أحمر كاندي'],
  ['candy green', 'أخضر كاندي'],
];

const bambuOptionArMap: Record<string, string> = {
  'refill': 'إعادة تعبئة',
  'standard': 'قياسي',
  'filament with spool': 'خيط مع بكرة',
  'with spool': 'مع بكرة',
  'without spool': 'بدون بكرة',
  '1 kg': '1 كغم',
  '500 g': '500 غم',
  '250 g': '250 غم',
  '0.2 mm': '0.2 ملم',
  '0.4 mm': '0.4 ملم',
  '0.6 mm': '0.6 ملم',
  '0.8 mm': '0.8 ملم',
  'standard flow': 'تدفق قياسي',
  'high flow': 'تدفق عالي',
  'stainless steel': 'ستانلس ستيل',
  'hardened steel': 'فولاذ مقوّى',
  'left': 'يسار',
  'right': 'يمين',
};

// Translate while PRESERVING SKU code like "(13108)"
function translateBambuColorName(name: string): string {
  const skuMatch = name.match(/\s*(\([^)]+\))\s*$/);
  const sku = skuMatch ? ` ${skuMatch[1]}` : '';
  const baseName = skuMatch ? name.slice(0, skuMatch.index).trim() : name.trim();
  const lower = baseName.toLowerCase();
  for (const [key, ar] of bambuQualifierMap) {
    if (lower.includes(key)) return `${ar}${sku}`;
  }
  for (const [key, ar] of Object.entries(bambuBaseColorMap)) {
    if (lower.includes(key)) {
      const result = (lower.includes('translucent') && key !== 'translucent') ? `شفاف ${ar}` : ar;
      return `${result}${sku}`;
    }
  }
  return name;
}

function translateBambuOption(name: string): string {
  const lower = name.toLowerCase().trim();
  if (bambuOptionArMap[lower]) return bambuOptionArMap[lower];
  // Compound labels (e.g. "0.2mm Stainless Steel"): translate every recognized
  // fragment, then concatenate. Falls back to original name if no fragment matches.
  let working = lower.replace(/(\d)mm\b/g, '$1 mm'); // normalize "0.2mm" -> "0.2 mm"
  const parts: string[] = [];
  let matched = false;
  // Sort keys longest-first so multi-word entries match before single-word.
  const keys = Object.keys(bambuOptionArMap).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    const idx = working.indexOf(key);
    if (idx !== -1) {
      parts.push(bambuOptionArMap[key]);
      working = (working.slice(0, idx) + ' ' + working.slice(idx + key.length)).replace(/\s+/g, ' ').trim();
      matched = true;
    }
  }
  if (matched) return parts.join(' ');
  return name;
}

// Returns null when exact swatch color cannot be read; downstream color-name maps provide fallback hex.
const swatchHexCache = new Map<string, string | null>();
async function sampleSwatchColor(imageUrl: string): Promise<string | null> {
  if (swatchHexCache.has(imageUrl)) return swatchHexCache.get(imageUrl)!;
  swatchHexCache.set(imageUrl, null);
  return null;
}

export interface BambuExtractResult {
  colors: Array<{ name: string; name_ar: string; hex_code: string | null; image_url: string | null }>;
  options: Array<{ name: string; name_ar: string; image_url: string | null }>;
}

// Normalize a variant name for reliable matching across pages.
// Decodes HTML entities + JSON unicode escapes, strips zero-width chars,
// collapses NBSP/whitespace, tightens spacing around () and -.
export function normalizeVariantName(input: string): string {
  if (!input) return '';
  let s = String(input);
  s = s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  s = s.replace(/\\\//g, '/').replace(/\\"/g, '"').replace(/\\'/g, "'");
  s = s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
  s = s.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  const named: Record<string, string> = {
    '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>',
    '&nbsp;': ' ', '&ndash;': '-', '&mdash;': '-', '&hellip;': '…',
  };
  s = s.replace(/&[a-zA-Z]+;/g, (mm) => named[mm.toLowerCase()] ?? mm);
  s = s.replace(/[\u200B-\u200D\uFEFF]/g, '');
  s = s.replace(/[\u00A0\s]+/g, ' ');
  s = s.replace(/\s*\(\s*/g, '(').replace(/\s*\)\s*/g, ')');
  s = s.replace(/\s*-\s*/g, '-');
  return s.trim().toLowerCase();
}

function extractVariantKeyFromProductName(name: string): string {
  if (!name) return '';
  const trimmed = String(name).trim();
  const afterDash = trimmed.includes(' - ') ? trimmed.split(' - ').slice(1).join(' - ') : trimmed;
  const firstSegment = afterDash.split('/')[0]?.trim() || afterDash;
  return normalizeVariantName(firstSegment);
}

function collectJsonLdProducts(node: unknown): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  const visit = (value: unknown) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value !== 'object') return;
    const obj = value as Record<string, unknown>;
    if (obj['@type'] === 'Product') out.push(obj);
    if (Array.isArray(obj.hasVariant)) visit(obj.hasVariant);
    if (Array.isArray(obj['@graph'])) visit(obj['@graph']);
  };
  visit(node);
  return out;
}

// Build a map of variant name -> main product image by scanning RSC/JSON payloads
// for objects pairing "propertyValue" with an image-bearing key. We exclude obvious
// swatch thumbnails so the displayed image actually matches the selected variant.
export function buildBambuVariantImageMap(html: string): Map<string, string> {
  const map = new Map<string, string>();
  const setIfValid = (rawName: string, rawUrl: string) => {
    let url = String(rawUrl || '').trim().replace(/\\\//g, '/');
    const key = normalizeVariantName(rawName);
    if (!key || !url) return;
    if (url === 'null' || url.length < 4) return;
    if (url.startsWith('//')) url = 'https:' + url;
    if (/\/swatch\//i.test(url) || /-swatch[\.-]/i.test(url)) return;
    if (!/^https?:\/\//i.test(url)) return;
    if (!map.has(key)) map.set(key, url);
  };

  for (const match of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(match[1]);
      for (const variant of collectJsonLdProducts(data)) {
        const key = extractVariantKeyFromProductName(String(variant.name || ''));
        const image = typeof variant.image === 'string' ? variant.image : Array.isArray(variant.image) ? variant.image[0] : '';
        if (key && image) setIfValid(key, image);
      }
    } catch {}
  }

  // Secondary source: RSC payload. Intentionally exclude `colorUrl` because it is
  // a swatch thumbnail, not the full product image.
  const IMG_KEYS = '(?:imageUrl|mainImage|productImage|picUrl|image)';
  const patterns = [
    new RegExp(`"propertyValue"\\s*:\\s*"([^"]+)"[^{}]{0,800}?"${IMG_KEYS}"\\s*:\\s*"([^"]+)"`, 'gi'),
    new RegExp(`"${IMG_KEYS}"\\s*:\\s*"([^"]+)"[^{}]{0,800}?"propertyValue"\\s*:\\s*"([^"]+)"`, 'gi'),
    new RegExp(`\\\\"propertyValue\\\\"\\s*:\\s*\\\\"([^\\\\"]+)\\\\"[^{}]{0,800}?\\\\"${IMG_KEYS}\\\\"\\s*:\\s*\\\\"([^\\\\"]+)\\\\"`, 'gi'),
    new RegExp(`\\\\"${IMG_KEYS}\\\\"\\s*:\\s*\\\\"([^\\\\"]+)\\\\"[^{}]{0,800}?\\\\"propertyValue\\\\"\\s*:\\s*\\\\"([^\\\\"]+)\\\\"`, 'gi'),
  ];
  const nameFirst = [true, false, true, false];
  for (let p = 0; p < patterns.length; p++) {
    const re = patterns[p];
    let mm: RegExpExecArray | null;
    while ((mm = re.exec(html)) !== null) {
      const rawName = nameFirst[p] ? mm[1] : mm[2];
      const rawUrl = nameFirst[p] ? mm[2] : mm[1];
      setIfValid(rawName, rawUrl);
    }
  }

  // Tertiary source: Next.js RSC chunk references (Bambu US/EU stores).
  // Variants are encoded as separate chunks linked by IDs, e.g.:
  //   d9:{"resourceFileId":"...","url":"https://.../Matte-Ivory-White.png"}
  //   db:{"propertyKey":"Color","propertyValue":"Matte Ivory White (11100)",...}
  //   da:["$db","$dc","$dd"]
  //   {...,"mediaFile":"$d9","productSkuPropertyList":"$da",...}
  // Resolve the references to map each color's propertyValue to its real image.
  try {
    const mediaMap = new Map<string, string>();
    for (const mm of html.matchAll(/([0-9a-f]+):\{"resourceFileId":"[^"]*","url":"([^"]+)"\}/g)) {
      mediaMap.set(mm[1], mm[2].replace(/\\\//g, '/'));
    }
    const propMap = new Map<string, string>();
    for (const mm of html.matchAll(/([0-9a-f]+):\{[^}]*"propertyKey":"Color"[^}]*"propertyValue":"([^"]+)"[^}]*\}/g)) {
      propMap.set(mm[1], mm[2]);
    }
    const listMap = new Map<string, string[]>();
    for (const mm of html.matchAll(/([0-9a-f]+):\[((?:"\$[0-9a-f]+",?)+)\]/g)) {
      const ids = [...mm[2].matchAll(/"\$([0-9a-f]+)"/g)].map((x) => x[1]);
      listMap.set(mm[1], ids);
    }
    // SKU chunks containing both mediaFile and productSkuPropertyList (in any order).
    const skuRe = /\{[^{}]*"(?:mediaFile|productSkuPropertyList)":"\$[0-9a-f]+"[^{}]*"(?:mediaFile|productSkuPropertyList)":"\$[0-9a-f]+"[^{}]*\}/g;
    for (const mm of html.matchAll(skuRe)) {
      const block = mm[0];
      const mediaIdMatch = block.match(/"mediaFile":"\$([0-9a-f]+)"/);
      const listIdMatch = block.match(/"productSkuPropertyList":"\$([0-9a-f]+)"/);
      if (!mediaIdMatch || !listIdMatch) continue;
      const url = mediaMap.get(mediaIdMatch[1]);
      const refs = listMap.get(listIdMatch[1]) || [];
      if (!url) continue;
      for (const r of refs) {
        const colorName = propMap.get(r);
        if (colorName) {
          const key = normalizeVariantName(colorName);
          let finalUrl = url;
          if (finalUrl.startsWith('//')) finalUrl = 'https:' + finalUrl;
          if (/^https?:\/\//i.test(finalUrl) && !/\/swatch\//i.test(finalUrl) && !/-swatch[\.-]/i.test(finalUrl)) {
            // RSC-resolved match is most accurate — overwrite any previous entry.
            map.set(key, finalUrl);
          }
          break;
        }
      }
    }
  } catch (e) {
    console.log('Bambu RSC chunk resolver failed:', e);
  }

  return map;
}

// Build a map of normalized propertyValue -> propertyKey (axis name) by scanning
// the RSC payload. Lets us tell which axis ("Type", "Size", "Color", ...) each
// <li value="..."> belongs to so we can group multi-axis Bambu products correctly.
export function buildBambuVariantAxisMap(html: string): Map<string, string> {
  const axes = new Map<string, string>();
  const setIfValid = (rawKey: string, rawValue: string) => {
    const key = String(rawKey || '').trim();
    const norm = normalizeVariantName(rawValue);
    if (!key || !norm) return;
    if (!axes.has(norm)) axes.set(norm, key);
  };
  // Plain JSON form: {"propertyKey":"Type","propertyValue":"Standard Flow",...}
  const plain = /"propertyKey"\s*:\s*"([^"]+)"\s*,\s*"propertyValue"\s*:\s*"([^"]+)"/g;
  for (const mm of html.matchAll(plain)) setIfValid(mm[1], mm[2]);
  const plainRev = /"propertyValue"\s*:\s*"([^"]+)"\s*,\s*"propertyKey"\s*:\s*"([^"]+)"/g;
  for (const mm of html.matchAll(plainRev)) setIfValid(mm[2], mm[1]);
  // Escaped form inside an RSC payload string.
  const esc = /\\"propertyKey\\"\s*:\s*\\"([^\\"]+)\\"\s*,\s*\\"propertyValue\\"\s*:\s*\\"([^\\"]+)\\"/g;
  for (const mm of html.matchAll(esc)) setIfValid(mm[1], mm[2]);
  const escRev = /\\"propertyValue\\"\s*:\s*\\"([^\\"]+)\\"\s*,\s*\\"propertyKey\\"\s*:\s*\\"([^\\"]+)\\"/g;
  for (const mm of html.matchAll(escRev)) setIfValid(mm[2], mm[1]);
  return axes;
}

// Robust parser: extracts every <li value="..."> block in HTML, classifies
// color (has <img>) vs non-color option (text only). Maps each variant to its
// real product image (not the swatch) when one is available in the RSC payload.
async function parseBambuLabUnified(html: string): Promise<BambuExtractResult> {
  const colors: BambuExtractResult['colors'] = [];
  const options: BambuExtractResult['options'] = [];
  const seenColorNames = new Set<string>();
  const seenOptionNames = new Set<string>();
  const variantImages = buildBambuVariantImageMap(html);
  const variantAxes = buildBambuVariantAxisMap(html);

  // First pass: collect every <li value="..."> and group by axis (RSC propertyKey).
  type LiEntry = { rawName: string; key: string; swatchUrl: string | null; axis: string | null };
  const entries: LiEntry[] = [];
  const seenKeys = new Set<string>();
  const liPattern = /<li\s+[^>]*\bvalue="([^"]+)"[^>]*>([\s\S]*?)<\/li>/gi;
  let m: RegExpExecArray | null;
  while ((m = liPattern.exec(html)) !== null) {
    const rawName = m[1].trim();
    const body = m[2];
    if (!rawName || rawName.length > 80) continue;
    if (/^\d+$/.test(rawName)) continue;
    if (/^\$|^¥|^€|^د\.ع/i.test(rawName)) continue;
    const key = normalizeVariantName(rawName);
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    const imgMatch = body.match(/<img[^>]*\bsrc="([^"]+)"/i);
    const isSwatch = !!imgMatch && /(?:store(?:-fe)?|store-fe)\.bblcdn\.(?:com|eu|net)/i.test(imgMatch[1]);
    let swatchUrl: string | null = null;
    if (isSwatch) {
      swatchUrl = imgMatch![1].trim();
      if (swatchUrl.startsWith('//')) swatchUrl = 'https:' + swatchUrl;
    }
    entries.push({ rawName, key, swatchUrl, axis: variantAxes.get(key) || null });
  }

  // Decide which axis becomes "colors" and which becomes "options".
  // Default per-entry classifier: swatch image -> color, else option.
  const colorImageJobs: Array<{ idx: number; url: string }> = [];

  // Group entries by axis name (entries with no axis info land in `__unknown__`).
  const byAxis = new Map<string, LiEntry[]>();
  for (const e of entries) {
    const a = e.axis || '__unknown__';
    if (!byAxis.has(a)) byAxis.set(a, []);
    byAxis.get(a)!.push(e);
  }

  const knownAxes = [...byAxis.keys()].filter((a) => a !== '__unknown__');
  const colorAxis = knownAxes.find((a) => /^color$/i.test(a)) || null;
  const sizePattern = /(?:mm|flow|kg|g\b|stainless|hardened|nozzle|size|capacity|left|right)/i;

  // Map axis name -> "color" | "option"
  const axisRole = new Map<string, 'color' | 'option'>();
  if (colorAxis) {
    // Filament-style page: keep current behavior (Color axis -> colors, others -> options).
    for (const a of knownAxes) axisRole.set(a, a === colorAxis ? 'color' : 'option');
  } else if (knownAxes.length === 2) {
    // No real Color axis but two non-color axes (e.g. H2C Hotend: Type + Size).
    // Bigger axis or the one whose values look like sizes/nozzles -> colors.
    const [a, b] = knownAxes;
    const aEntries = byAxis.get(a)!;
    const bEntries = byAxis.get(b)!;
    const aLooksSize = aEntries.some((e) => sizePattern.test(e.rawName));
    const bLooksSize = bEntries.some((e) => sizePattern.test(e.rawName));
    let colorPick: string;
    if (aLooksSize && !bLooksSize) colorPick = a;
    else if (bLooksSize && !aLooksSize) colorPick = b;
    else colorPick = aEntries.length >= bEntries.length ? a : b;
    axisRole.set(colorPick, 'color');
    axisRole.set(colorPick === a ? b : a, 'option');
  }
  // For 1 or 3+ axes with no Color axis, leave axisRole empty -> per-entry fallback.

  for (const e of entries) {
    const role = e.axis ? axisRole.get(e.axis) : undefined;
    // Per-entry fallback when axis info is missing/ambiguous: swatch -> color, else option.
    const isColor = role ? role === 'color' : !!e.swatchUrl;

    if (isColor) {
      if (seenColorNames.has(e.key)) continue;
      seenColorNames.add(e.key);
      const productImg = variantImages.get(e.key) || null;
      const finalImg = productImg || (e.swatchUrl && e.swatchUrl.startsWith('http') ? e.swatchUrl : null);
      const idx = colors.length;
      // Pick the right Arabic translator: real color names use the color map;
      // size-style values (no swatch) use the option map.
      const isSwatchColor = !!e.swatchUrl && (!e.axis || /^color$/i.test(e.axis));
      colors.push({
        name: e.rawName,
        name_ar: isSwatchColor ? translateBambuColorName(e.rawName) : translateBambuOption(e.rawName),
        hex_code: null,
        image_url: finalImg,
      });
      // Only sample hex when the swatch really represents a color value.
      if (isSwatchColor && e.swatchUrl && e.swatchUrl.startsWith('http')) {
        colorImageJobs.push({ idx, url: e.swatchUrl });
      }
    } else {
      if (seenOptionNames.has(e.key)) continue;
      seenOptionNames.add(e.key);
      const productImg = variantImages.get(e.key) || null;
      options.push({
        name: e.rawName,
        name_ar: translateBambuOption(e.rawName),
        image_url: productImg,
      });
    }
  }

  // Sample hex codes in parallel from swatch PNGs (color-axis entries only).
  if (colorImageJobs.length > 0) {
    console.log(`Bambu: sampling ${colorImageJobs.length} swatch hex codes in parallel`);
    const sampled = await Promise.all(colorImageJobs.map(j => sampleSwatchColor(j.url)));
    colorImageJobs.forEach((j, i) => {
      if (sampled[i]) colors[j.idx].hex_code = sampled[i];
    });
  }

  console.log(`Bambu unified parser: ${colors.length} colors, ${options.length} options, axes=${JSON.stringify([...byAxis.entries()].map(([a, v]) => [a, v.length]))}`);
  return { colors, options };
}

// Currency conversion rates to USD (fallback defaults; CNY overridden dynamically from DB)
const CURRENCY_TO_USD: Record<string, number> = {
  'USD': 1,
  'CNY': 0.14,
  'RMB': 0.14,
  'EUR': 1.08,
  'GBP': 1.27,
  'JPY': 0.0067,
  'AED': 0.27,
  'SAR': 0.27,
  'KWD': 3.26,
};

// Default fallback (overridden at runtime from shipping_settings.usd_to_iqd_rate)
let USD_TO_IQD = 1540;

// Fetch live exchange rates from shipping_settings (usd_to_iqd_rate, cny_to_usd_rate)
// Called once before any price extraction so original_price = source_price × exchange_rate only
// (no shipping, no commission added at this stage).
async function loadExchangeRatesFromDb(): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!supabaseUrl || !supabaseKey) return;

    const res = await fetch(
      `${supabaseUrl}/rest/v1/shipping_settings?select=setting_key,setting_value&setting_key=in.(usd_to_iqd_rate,cny_to_usd_rate)`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    );
    if (!res.ok) return;
    const rows: Array<{ setting_key: string; setting_value: string | number }> = await res.json();
    for (const r of rows) {
      const val = parseFloat(String(r.setting_value));
      if (!Number.isFinite(val) || val <= 0) continue;
      if (r.setting_key === 'usd_to_iqd_rate') {
        USD_TO_IQD = val;
      } else if (r.setting_key === 'cny_to_usd_rate') {
        // setting stores CNY-per-USD (e.g. 6.7). Convert to USD-per-CNY for our table.
        const usdPerCny = 1 / val;
        CURRENCY_TO_USD.CNY = usdPerCny;
        CURRENCY_TO_USD.RMB = usdPerCny;
      }
    }
    console.log('Live exchange rates loaded → USD_TO_IQD:', USD_TO_IQD, 'CNY→USD:', CURRENCY_TO_USD.CNY);
  } catch (e) {
    console.log('Could not load exchange rates from DB, using defaults:', (e as Error).message);
  }
}

// Convert source-currency price to USD using ONLY the exchange rate.
function convertToUSD(price: number, currency: string): number {
  const currencyUpper = currency.toUpperCase();
  if (currencyUpper === 'IQD') return price / USD_TO_IQD;
  return price * (CURRENCY_TO_USD[currencyUpper] || 1);
}

// Convert any source-currency price to IQD using ONLY the exchange rate.
// Does not include shipping, commission, taxes, or any markup — that math
// happens later in the pricing pipeline for the final `price` field.
function convertToIQD(price: number, currency: string): number {
  return convertToUSD(price, currency) * USD_TO_IQD;
}

function roundPrice(price: number): number {
  if (price <= 0) return 0;
  return Math.floor(Math.round(price / 500) * 500);
}

function extractPrice(html: string): number | null {
  const patterns = [
    /"price"\s*:\s*"?(\d+(?:\.\d{1,2})?)"?/gi,
    /data-price=["'](\d+(?:\.\d{1,2})?)["']/gi,
    /\$(\d+(?:\.\d{2})?)\s*(?:USD)?/gi,
    /class=["'][^"']*price[^"']*["'][^>]*>[\s\S]*?(\d+(?:\.\d{2})?)/gi,
    /¥\s*(\d+(?:\.\d{2})?)/gi,
    /￥\s*(\d+(?:\.\d{2})?)/gi,
  ];

  for (const pattern of patterns) {
    const matches = html.matchAll(pattern);
    for (const match of matches) {
      const price = parseFloat(match[1]);
      if (price > 0 && price < 100000) return price;
    }
  }
  return null;
}

function extractPriceNumbers(value: unknown): number[] {
  if (typeof value === 'number' && Number.isFinite(value)) return [value];
  if (typeof value !== 'string') return [];
  const matches = value.replace(/,/g, '').match(/\d+(?:\.\d+)?/g) || [];
  return matches
    .map((v) => parseFloat(v))
    .filter((v) => Number.isFinite(v) && v > 0 && v < 1000000);
}

function detectCurrencyFromContent(html: string, platform: string, url: string): string {
  if (['taobao', 'tmall', '1688', 'jd'].includes(platform)) return 'CNY';
  if (url.includes('aliexpress')) return 'USD';
  if (/"priceCurrency"\s*:\s*"([A-Z]{3})"/i.test(html)) {
    return html.match(/"priceCurrency"\s*:\s*"([A-Z]{3})"/i)?.[1] || 'USD';
  }
  if (/[¥￥]/.test(html)) return 'CNY';
  if (/\$/.test(html)) return 'USD';
  if (/€/.test(html)) return 'EUR';
  return 'CNY';
}

function extractStructuredPrices(html: string, platform: string, url: string): { price: number | null; originalPrice: number | null; currency: string } {
  const priceCandidates: number[] = [];
  const originalCandidates: number[] = [];
  let currency = detectCurrencyFromContent(html, platform, url);

  const addFromJson = (data: any) => {
    const visit = (node: any) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) return node.forEach(visit);

      for (const [rawKey, rawValue] of Object.entries(node)) {
        const key = rawKey.toLowerCase();
        if (key === 'pricecurrency' && typeof rawValue === 'string') currency = rawValue;
        if (/original|compare|market|list|was|regular|retail|reserve|strike|strikethrough|highprice|maxprice/.test(key)) {
          originalCandidates.push(...extractPriceNumbers(rawValue));
        } else if (/^price$|saleprice|lowprice|finalprice|currentprice|discountprice|promotionprice/.test(key)) {
          priceCandidates.push(...extractPriceNumbers(rawValue));
        }
        visit(rawValue);
      }
    };
    visit(data);
  };

  for (const match of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { addFromJson(JSON.parse(match[1])); } catch {}
  }

  const keyPricePattern = /["']?(originalPrice|original_price|marketPrice|listPrice|wasPrice|regularPrice|retailPrice|reservePrice|strikePrice|strikethroughPrice|compareAtPrice|highPrice|maxPrice|salePrice|finalPrice|currentPrice|discountPrice|promotionPrice|price)["']?\s*[:=]\s*["']?([\d,.]+(?:\s*[-~]\s*[\d,.]+)?)/gi;
  let keyMatch: RegExpExecArray | null;
  while ((keyMatch = keyPricePattern.exec(html)) !== null) {
    const key = keyMatch[1].toLowerCase();
    const values = extractPriceNumbers(keyMatch[2]);
    if (/original|compare|market|list|was|regular|retail|reserve|strike|high|max/.test(key)) {
      originalCandidates.push(...values);
    } else {
      priceCandidates.push(...values);
    }
  }

  const directPrice = extractPrice(html);
  if (directPrice) priceCandidates.push(directPrice);

  const price = priceCandidates.length > 0 ? Math.min(...priceCandidates) : null;
  const originalPrice = originalCandidates.length > 0
    ? Math.max(...originalCandidates, ...(priceCandidates.length ? priceCandidates : [0]))
    : (priceCandidates.length > 0 ? Math.max(...priceCandidates) : null);

  return { price, originalPrice, currency };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // SECURITY: Admin-only auth gate (this consumes paid AI + Firecrawl quota)
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    if (!jwt) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const { createClient: createAuthClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.0');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authClient = createAuthClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const { data: roleRows } = await authClient
      .from('user_roles').select('role').eq('user_id', userData.user.id).in('role', ['admin', 'assistant']);
    if (!roleRows || roleRows.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'Forbidden' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Load live exchange rates so original_price reflects (source price × current rate) only.
    await loadExchangeRatesFromDb();

    const reqBody = await req.json();
    let { url } = reqBody;
    const forceSeoRegenerate = reqBody?.forceSeoRegenerate === true;
    const existingName = typeof reqBody?.existingName === 'string' ? reqBody.existingName : '';
    const existingNameAr = typeof reqBody?.existingNameAr === 'string' ? reqBody.existingNameAr : '';
    const existingDescription = typeof reqBody?.existingDescription === 'string' ? reqBody.existingDescription : '';
    const existingDescriptionAr = typeof reqBody?.existingDescriptionAr === 'string' ? reqBody.existingDescriptionAr : '';
    
    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'الرجاء إدخال رابط المنتج' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Validate URL format to prevent SSRF and XSS attacks
    url = String(url).trim();
    
    // Block dangerous protocols
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.startsWith('javascript:') || 
        lowerUrl.startsWith('data:') || 
        lowerUrl.startsWith('file:') ||
        lowerUrl.startsWith('ftp:') ||
        lowerUrl.startsWith('vbscript:') ||
        lowerUrl.includes('<script') ||
        lowerUrl.includes('onerror=') ||
        lowerUrl.includes('onclick=')) {
      return new Response(
        JSON.stringify({ success: false, error: 'رابط غير صالح', requiresManualInput: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Ensure URL has proper protocol
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      // Try to fix URLs without protocol
      if (url.includes('.com') || url.includes('.cn') || url.includes('.')) {
        url = 'https://' + url;
      } else {
        return new Response(
          JSON.stringify({ success: false, error: 'الرجاء إدخال رابط صحيح', requiresManualInput: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    // Validate URL can be parsed
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'صيغة الرابط غير صحيحة', requiresManualInput: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: SSRF protection — allowlist of trusted hostnames
    const ALLOWED_DOMAINS = [
      'taobao.com','tmall.com','tb.cn','m.tb.cn','m.taobao.com','detail.tmall.com',
      '1688.com','m.1688.com','aliexpress.com','aliexpress.us','ae01.alicdn.com',
      'alibaba.com','m.alibaba.com',
      'amazon.com','amazon.ae','amazon.sa','a.co',
      'bambulab.com','store.bambulab.com',
      'creality.com','store.creality.com',
      'anycubic.com','elegoo.com','prusa3d.com','prusaprinters.org',
      'qidi3d.com','qidi3dprinter.com','qidi3dofficial.com','qidi-tech.com',
      'thingiverse.com','printables.com','makerworld.com','cults3d.com',
      'shopify.com','myshopify.com',
      // 3D printing retailers (mostly Shopify-hosted)
      'west3d.com','matterhackers.com','printedsolid.com','3djake.com','3djake.us','3djake.uk',
      'filastruder.com','atomicfilament.com','protopasta.com','polymaker.com',
      'e3d-online.com','slice3dengineering.com','sliceengineering.com',
      'mandala-rose-works.com','fabreeko.com','kb-3d.com','triangle-labs.com',
      'biqu.equipment','biqu3d.com','phaetus.com','mellow.klipper.cn',
      'snapmaker.com','shop.snapmaker.com','us.snapmaker.com','eu.snapmaker.com',
    ];
    const host = parsedUrl.hostname.toLowerCase();
    const allowed = ALLOWED_DOMAINS.some(d => host === d || host.endsWith('.' + d));
    // Block private/loopback IPs explicitly
    const isPrivate = /^(127\.|10\.|192\.168\.|169\.254\.|0\.|::1|fc[0-9a-f]{2}:|fe80:)/i.test(host)
      || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
      || host === 'localhost' || host === 'metadata.google.internal';
    if (isPrivate || !allowed) {
      return new Response(
        JSON.stringify({ success: false, error: 'النطاق غير مسموح به', requiresManualInput: true }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Original URL:', url);

    // STEP 1: If URL is a short URL, follow it to get the real URL
    if (isShortUrl(url)) {
      console.log('Detected short URL, following redirects...');
      url = await followShortUrl(url);
      console.log('Resolved URL:', url);
    }

    let { platform, itemId } = detectPlatform(url);
    console.log('Detected platform:', platform, 'Item ID:', itemId);

    // STEP 2: Build canonical URL if we have an item ID
    let canonicalUrl = url;
    if (itemId && (platform === 'taobao' || platform === 'tmall' || platform === 'jd' || platform === '1688')) {
      canonicalUrl = buildCanonicalUrl(itemId, platform);
      console.log('Canonical URL:', canonicalUrl);
    }

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          requiresManualInput: true,
          item_id: itemId,
          platform: platform,
          canonical_url: canonicalUrl,
          message: 'يرجى إدخال البيانات يدوياً'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== Strategy 1: Try platform-specific API for Bambu Lab =====
    let platformApiData: any = null;
    if (platform === 'bambulab') {
      try {
        const urlObj = new URL(url);
        const slug = urlObj.pathname.split('/products/')[1]?.split('?')[0];
        if (slug) {
          console.log('Trying Bambu Lab API for slug:', slug);
          const apiUrl = `${urlObj.origin}/api/spu/product?handle=${slug}`;
          const apiResp = await fetch(apiUrl, {
            headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
          });
          if (apiResp.ok) {
            const apiJson = await apiResp.json();
            if (apiJson && (apiJson.data || apiJson.product)) {
              platformApiData = apiJson.data || apiJson.product || apiJson;
              console.log('Bambu Lab API success, got structured data');
            }
          }
        }
      } catch (e) {
        console.log('Bambu Lab API failed:', e);
      }
    }

    // ===== Strategy 1b: Shopify products.json (structured options/variants) =====
    let shopifyData: any = null;
    let shopifyExtracted: ShopifyExtracted | null = null;
    if (platform === 'shopify') {
      shopifyData = await fetchShopifyProduct(url);
      if (shopifyData) {
        shopifyExtracted = extractShopifyVariants(shopifyData);
        console.log('Shopify structured extraction:',
          'colors=', shopifyExtracted?.colors.length,
          'options=', shopifyExtracted?.options.length,
          'images=', shopifyExtracted?.images.length);
      }
    }


    // Fetch page
    let pageContent = '';
    let fetchSuccess = false;

    try {
      console.log('Fetching page...');
      const pageResponse = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,ar;q=0.7',
          'Referer': 'https://www.taobao.com/',
        }
      });

      if (pageResponse.ok) {
        pageContent = await pageResponse.text();
        fetchSuccess = pageContent.length > 500;
        console.log('Page fetched, length:', pageContent.length);
      }
    } catch (e) {
      console.log('Fetch error:', e);
    }

    // ===== Strategy 2: Parse __NEXT_DATA__ from Next.js sites =====
    let nextData: any = null;
    if (fetchSuccess) {
      try {
        const nextMatch = pageContent.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
        if (nextMatch) {
          nextData = JSON.parse(nextMatch[1]);
          console.log('Found __NEXT_DATA__, extracting product info');
        }
      } catch (e) {
        console.log('__NEXT_DATA__ parse failed:', e);
      }
    }

    if (!fetchSuccess && !platformApiData) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          requiresManualInput: true,
          item_id: itemId,
          platform: platform,
          canonical_url: canonicalUrl,
          message: 'لا يمكن الوصول للصفحة - يرجى إدخال البيانات يدوياً'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Direct extraction
    const directProductName = extractDirectProductName(pageContent, platformApiData, nextData);
    const directImages = extractImages(pageContent);
    const directPrice = extractPrice(pageContent);
    const structuredPrices = extractStructuredPrices(pageContent, platform, url);
    const directSkuData = extractSkuData(pageContent);
    console.log('Direct extraction - name:', directProductName || '-', 'images:', directImages.length, 'price:', directPrice);
    console.log('Structured prices:', structuredPrices);
    console.log('Direct SKU extraction - colors:', directSkuData.colors.length, 'options:', directSkuData.options.length);

    // AI extraction with enhanced prompt
    console.log('Using AI for extraction...');

    // Build extra context from platform API or __NEXT_DATA__
    let extraContext = '';
    if (platformApiData) {
      extraContext = `\n\n===== بيانات API المنصة (بيانات منظمة) =====\n${JSON.stringify(platformApiData).substring(0, 50000)}`;
    }
    if (nextData) {
      const nextStr = JSON.stringify(nextData).substring(0, 50000);
      extraContext += `\n\n===== __NEXT_DATA__ (بيانات Next.js المضمنة) =====\n${nextStr}`;
    }

    // Detect if site is JS-rendered (limited HTML content)
    const isJsRendered = pageContent.includes('__next') || pageContent.includes('__NEXT_DATA__') || 
      pageContent.includes('id="root"') || pageContent.includes('id="app"') ||
      (pageContent.length < 5000 && !pageContent.includes('sku'));

    // First AI call: Extract product info from the page
    const prompt = `استخرج معلومات المنتج من صفحة الويب هذه وأرجعها بصيغة JSON فقط.

الرابط: ${url}
المنصة: ${platform}
رقم المنتج: ${itemId || 'غير معروف'}
${isJsRendered ? '\n⚠️ هذا موقع يعتمد على JavaScript لعرض المحتوى. إذا لم تجد بيانات الألوان في HTML، استخدم معرفتك عن هذا المنتج من الرابط أعلاه لاستخراج كل الألوان المتاحة.\n' : ''}
محتوى HTML (أول 100000 حرف):
${pageContent.substring(0, 100000)}${extraContext}

أرجع JSON بالشكل التالي بالضبط:
{
  "name": "اسم المنتج بالإنجليزية",
  "name_ar": "اسم المنتج بالعربية",
  "description": "وصف قصير بالإنجليزية",
  "description_ar": "وصف قصير بالعربية",
  "price": 29.99,
  "original_price": 39.99,
  "currency": "CNY",
  "brand": "اسم الشركة المصنعة (مثل: QIDI, Bambu Lab, Creality, Apple, Samsung)",
  "dimensions": {"length_cm": 30, "width_cm": 20, "height_cm": 15},
  "weight_kg": 1.5,
  "main_product_images": ["https://صورة-المنتج-الرئيسية.jpg"],
  "colors": [{"name": "Black", "name_ar": "أسود", "hex_code": "#000000", "image_url": "https://صورة-خاصة-بهذا-اللون.jpg"}],
  "options": [{"name": "0.4mm Nozzle", "name_ar": "فوهة 0.4 ملم", "image_url": "https://صورة-خاصة-بهذا-الخيار.jpg"}],
  "features": [{"text": "Feature in English", "text_ar": "الميزة بالعربية"}],
  "short_summary": {"ar": "ملخص قصير بالعربية ≤ 160 حرف", "en": "Short summary in English ≤ 160 chars", "ku": "پوختەی کورت بە کوردی"},
  "searchable_tags": ["كلمة مفتاحية 1", "keyword 2", "tag 3"],
  "ai_content": {
    "problem_solved": {"ar": "المشكلة التي يحلها بالعربية", "en": "Problem solved in English", "ku": "کێشەی چارەسەرکراو بە کوردی"},
    "target_audience": {"ar": "الجمهور المستهدف بالعربية", "en": "Target audience in English", "ku": "جەماوەری ئامانج بە کوردی"},
    "benefits": [{"ar": "فائدة 1 بالعربية", "en": "Benefit 1 in English", "ku": "سوود ١ بە کوردی"}],
    "usage": [{"ar": "خطوة 1 بالعربية", "en": "Step 1 in English", "ku": "هەنگاو ١ بە کوردی"}],
    "specifications": [{"key": {"ar": "مفتاح", "en": "Key", "ku": "کلیل"}, "value": {"ar": "قيمة", "en": "Value", "ku": "نرخ"}}]
  }
}

===== ⚠️ إلزامي: الملخص القصير والمحتوى الذكي (لا تتركها فارغة أبداً) =====
هذه الحقول إجبارية ويجب ملؤها دائماً حتى لو لم تجد معلومات صريحة في الصفحة - استنتجها من اسم المنتج وفئته وصورته ومعرفتك العامة:

- short_summary (إلزامي - 3 لغات): سطر واحد ≤ 160 حرف لكل لغة، يلخص المنتج بشكل جذاب لمحركات البحث (SEO Meta Description).
- searchable_tags (إلزامي): 5-10 كلمات مفتاحية ذات صلة بالمنتج (مزيج عربي/إنجليزي).
- ai_content.problem_solved (إلزامي - 3 لغات): المشكلة الفعلية التي يحلها هذا المنتج للمستخدم - جملة واحدة واضحة.
- ai_content.target_audience (إلزامي - 3 لغات): من هم المستخدمون المثاليون لهذا المنتج (مثل: المصممون، الطلاب، عشاق الطباعة ثلاثية الأبعاد).
- ai_content.benefits (إلزامي - 3-5 عناصر بـ 3 لغات): الفوائد الرئيسية للمنتج، كل فائدة جملة قصيرة جذابة.
- ai_content.usage (إلزامي - 2-4 خطوات بـ 3 لغات): خطوات استخدام المنتج بترتيب منطقي.
- ai_content.specifications (إلزامي - 3-6 عناصر بـ 3 لغات): مواصفات تقنية مفتاح/قيمة (مثل: المادة/PLA، الأبعاد/30×20سم، الوزن/1.5كغ).

⚠️ ممنوع منعاً باتاً إرجاع هذه الحقول فارغة أو null أو بقيم placeholder. استخدم منطقك واستنتج من السياق دائماً.

===== قواعد استخراج أبعاد ووزن الكرتون مع التغليف (مهم جداً جداً) =====

⚠️ مطلوب: أبعاد **الكرتون / علبة الشحن مع كل مواد التغليف** (Packaging / Carton / Box / Shipping dimensions)
⚠️ ممنوع منعاً باتاً إعادة أبعاد المنتج العاري (Product / Net / Item dimensions).
⚠️ مطلوب للوزن: **الوزن الإجمالي مع التغليف** (Gross Weight / Shipping Weight / Package Weight) وليس الوزن الصافي (Net Weight).

قواعد الاختيار:
1. ابحث أولاً عن: "Package Dimensions", "Packaging Size", "Carton Size", "Shipping Dimensions", "Box Size", "包装尺寸", "外箱尺寸", "纸箱尺寸", "Gross Weight", "Shipping Weight", "Package Weight", "毛重", "包装重量", "运输重量".
2. إذا وجدت قيمتين (Product/Package أو Net/Gross): اختر **دائماً** قيمة Package/Carton/Gross — حتى لو كانت أكبر بكثير.
3. إذا وُجد فقط أبعاد/وزن المنتج: قدّر التغليف بإضافة 5-15سم على كل بعد، ووزن إضافي 10-25% للتغليف.
4. للطابعات ثلاثية الأبعاد كرتون التغليف عادة 60-75سم × 50-65سم × 50-65سم ووزن إجمالي 22-35كغ.

تحويل الوحدات: inch → cm (×2.54)، mm → cm (÷10)، g → kg (÷1000)، lb → kg (×0.453).
dimensions.length_cm/width_cm/height_cm بالسنتيمتر، weight_kg بالكيلوغرام.

===== قواعد استخراج البراند =====
- استخرج اسم الشركة المصنعة الحقيقية للمنتج (مثل: QIDI, Bambu Lab, Creality, Anycubic, Elegoo, Apple, Samsung, Xiaomi).
- ابحث في: عنوان الصفحة، اسم المنتج، JSON-LD "brand", "manufacturer"، meta tags، شعار الموقع، اسم الـdomain.
- لا تستخدم اسم المتجر العام (مثل Taobao/JD/Amazon). أعطِ البراند الفعلي للمنتج.
- إذا لم تجد، خمّن من اسم المنتج أو domain (مثل qidi3d.com → QIDI).


===== قواعد استخراج الألوان (مهم جداً) =====

مطلوب: استخرج كل الألوان المتاحة في المنتج - حتى لو كانت 50 أو 100 لون!

أماكن البحث عن الألوان:
1. في JSON: ابحث عن "skuProps", "skuList", "colorProperties", "props", "sku"
2. في HTML: ابحث عن العناصر التي تحتوي على class="sku-item" أو data-value
3. ابحث عن أي عنصر فيه 颜色 أو 颜色分类 أو color
4. استخرج الصور من: data-img, data-bigpic, background-image, src

===== قواعد hex_code (مهم جداً) =====
- لكل لون، أعطِ hex_code الدقيق الذي يمثل اللون الفعلي — ليس لون عام
- مثال: Translucent Teal يجب أن يكون #77EDD7 وليس #008080 العام
- إذا كان اللون ظاهراً كـ swatch في الصفحة، استخرج اللون الفعلي منه
- إذا كان رقم المنتج/SKU ظاهراً بجانب اللون (مثل 32501)، أضفه للاسم
- For each color, provide the EXACT hex code representing the actual shade, NOT a generic color

===== قواعد صور الألوان (مهم جداً) =====
- لكل لون، image_url يجب أن تكون صورة swatch أو صورة المنتج بهذا اللون تحديداً
- لا تستخدم صورة المنتج الرئيسية لكل الألوان — كل لون له صورته الخاصة
- ابحث عن صور variant-specific في الصفحة

ترجمة الألوان الصينية:
黑色=Black/أسود, 白色=White/أبيض, 红色=Red/أحمر, 蓝色=Blue/أزرق, 绿色=Green/أخضر
黄色=Yellow/أصفر, 粉色=Pink/وردي, 紫色=Purple/بنفسجي, 灰色=Gray/رمادي, 棕色=Brown/بني
金色=Gold/ذهبي, 银色=Silver/فضي, 橙色=Orange/برتقالي, 深蓝=Navy/كحلي, 米色=Beige/بيج
卡其=Khaki/كاكي, 驼色=Camel/جملي, 酒红=Wine Red/خمري, 天蓝=Sky Blue/سماوي
军绿=Army Green/أخضر عسكري, 墨绿=Dark Green/أخضر غامق, 浅蓝=Light Blue/أزرق فاتح

===== قواعد استخراج الخيارات (مهم جداً) =====

مطلوب: استخرج كل الخيارات/المقاسات/الإصدارات المتاحة!

أماكن البحث عن الخيارات:
1. ابحث عن: 规格, 尺寸, 尺码, 型号, 版本, 容量, 套餐, size, specification, version
2. استخرج كل خيار مع صورته إن وجدت
3. الخيارات تشمل: المقاسات، الإصدارات، السعات، الحزم

قواعد الصور:
- لكل لون وخيار: ابحث عن صورته الخاصة في data-img أو background-image
- main_product_images = صور المعرض الرئيسي فقط (لا تضع صور الألوان/الخيارات هنا)
- إذا وجدت صورة للون/خيار، ضعها في image_url

أرجع JSON فقط بدون أي نص إضافي. استخرج كل الألوان والخيارات بدون استثناء!`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: buildLovableAiHeaders(lovableApiKey),
      body: JSON.stringify({
        model: LOVABLE_AI_MODEL,
        messages: [
          { role: 'system', content: 'أنت مستخرج بيانات منتجات وكاتب SEO خبير. مهمتك المزدوجة: (1) استخراج كل الألوان والخيارات والأبعاد بدون استثناء. (2) توليد محتوى تسويقي/SEO إلزامي يشمل: short_summary بـ3 لغات، searchable_tags، و ai_content كاملاً (problem_solved, target_audience, benefits, usage, specifications) - كلها إلزامية ولا يجوز تركها فارغة أبداً، استنتجها من اسم المنتج وفئته إن لم تجد بيانات صريحة. أرجع JSON صحيح فقط.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 32000,
      }),
    });

    let productInfo: any = {
      name: directProductName || 'Product',
      name_ar: 'منتج',
      description: '',
      description_ar: '',
      price: 0,
      original_price: null,
      currency: 'IQD',
      images: [],
      colors: [],
      options: [],
      features: [],
      points_reward: 0,
      dimensions: null,
      weight_kg: null
    };
    
    const variantImageUrls = new Set<string>();
    
    if (aiResponse.ok) {
      try {
        const aiData = await aiResponse.json();
        const text = aiData.choices[0]?.message?.content || '';
        console.log('AI response length:', text.length);
        
        {
          const ai = parseAiJsonObject(text);
          
          const aiName = cleanExtractedText(ai.name);
          productInfo.name = isUsefulProductName(aiName) ? aiName : (directProductName || productInfo.name);
          productInfo.name_ar = ai.name_ar || productInfo.name_ar;
          productInfo.description = ai.description || '';
          productInfo.description_ar = ai.description_ar || '';
          if (typeof ai.brand === 'string' && ai.brand.trim().length > 0) {
            productInfo.brand = ai.brand.trim().slice(0, 80);
          }

          // SEO short summary (tri-lang) + searchable tags + AI content (why this product)
          if (ai.short_summary && typeof ai.short_summary === 'object') {
            productInfo.short_summary = {
              ar: normalizeSeoText(ai.short_summary.ar),
              en: normalizeSeoText(ai.short_summary.en),
              ku: normalizeSeoText(ai.short_summary.ku),
            };
          }
          if (Array.isArray(ai.searchable_tags)) {
            productInfo.searchable_tags = ai.searchable_tags
              .map((t: any) => (typeof t === 'string' ? t.trim() : ''))
              .filter((t: string) => t.length > 0)
              .slice(0, 20);
          }
          if (ai.ai_content && typeof ai.ai_content === 'object') {
            productInfo.ai_content = ai.ai_content;
          }
          
          const extractedCurrency = ai.currency || structuredPrices.currency || 'CNY';
          const aiPrice = parseFloat(ai.price) || 0;
          const aiOriginalPrice = parseFloat(ai.original_price) || 0;
          const directPriceNum = directPrice || structuredPrices.price || 0;
          const directOriginalPriceNum = structuredPrices.originalPrice || 0;
          
          console.log('All prices found - AI price:', aiPrice, 'AI original:', aiOriginalPrice, 'Direct:', directPriceNum, 'Structured original:', directOriginalPriceNum, 'Currency:', extractedCurrency);
          
          const extractedOriginalPrice = Math.max(aiPrice, aiOriginalPrice, directPriceNum, directOriginalPriceNum);
          const originalPriceUsd = Math.round(convertToUSD(extractedOriginalPrice, extractedCurrency) * 100) / 100;
          let originalPriceInIqd = convertToIQD(extractedOriginalPrice, extractedCurrency);
          originalPriceInIqd = roundPrice(originalPriceInIqd);
          
          productInfo.price = null;
          productInfo.original_price = originalPriceInIqd > 0 ? originalPriceInIqd : null;
          productInfo.original_price_usd = originalPriceUsd > 0 ? originalPriceUsd : null;
          productInfo.currency = 'IQD';
          
          // Calculate points reward: 1 point per 1000 IQD (based on original price before discount)
          if (originalPriceInIqd > 0) {
            productInfo.points_reward = Math.floor(originalPriceInIqd / 1000);
          }
          
          // Extract dimensions and weight
          if (ai.dimensions) {
            productInfo.dimensions = {
              length_cm: parseFloat(ai.dimensions.length_cm) || null,
              width_cm: parseFloat(ai.dimensions.width_cm) || null,
              height_cm: parseFloat(ai.dimensions.height_cm) || null
            };
          }
          if (ai.weight_kg) {
            productInfo.weight_kg = parseFloat(ai.weight_kg) || null;
          }
          
          // Collect all URLs actually present in the page HTML for validation
          const allUrlsInPageHtml = new Set<string>();
          const pageUrlRegex = /https?:\/\/[^\s"'<>]+/gi;
          let pageUrlMatch;
          while ((pageUrlMatch = pageUrlRegex.exec(pageContent)) !== null) {
            allUrlsInPageHtml.add(pageUrlMatch[0].split('?')[0]);
          }
          
          // Process colors from AI
          if (ai.colors && Array.isArray(ai.colors)) {
            for (const c of ai.colors) {
              if (c.name && isValidColorName(c.name)) {
                const colorLower = c.name.toLowerCase();
                const info = Object.entries(COLOR_MAP).find(([k]) => colorLower.includes(k));
                
                let colorImageUrl = null;
                if (c.image_url && c.image_url.startsWith('http')) {
                  const baseImgUrl = c.image_url.split('?')[0];
                  if (allUrlsInPageHtml.has(baseImgUrl)) {
                    colorImageUrl = normalizeImageUrl(c.image_url);
                    variantImageUrls.add(getImageBaseUrl(colorImageUrl));
                  } else {
                    console.log('Removed hallucinated image URL for color:', c.name);
                  }
                }
                
                productInfo.colors.push({
                  name: c.name,
                  name_ar: c.name_ar || (info ? info[1].ar : c.name),
                  hex_code: (c.hex_code && /^#[0-9A-Fa-f]{6}$/i.test(c.hex_code)) 
                    ? c.hex_code 
                    : (info ? info[1].hex : '#808080'),
                  image_url: colorImageUrl,
                });
              }
            }
          }
          
          // Process options from AI
          if (ai.options && Array.isArray(ai.options)) {
            for (const o of ai.options) {
              if (o.name && isValidOptionName(o.name)) {
                let optionImageUrl = null;
                if (o.image_url && o.image_url.startsWith('http')) {
                  optionImageUrl = normalizeImageUrl(o.image_url);
                  variantImageUrls.add(getImageBaseUrl(optionImageUrl));
                }
                
                productInfo.options.push({
                  name: o.name,
                  name_ar: o.name_ar || o.name,
                  price_adjustment: 0,
                  image_url: optionImageUrl,
                });
              }
            }
          }
          
          // Process main images
          const mainProductImages = ai.main_product_images || ai.images || [];
          if (Array.isArray(mainProductImages)) {
            const seenBases = new Set<string>();
            for (const img of mainProductImages) {
              if (img?.startsWith('http') && !/\.svg/i.test(img)) {
                const normalizedImg = normalizeImageUrl(img);
                const base = getImageBaseUrl(normalizedImg);
                if (variantImageUrls.has(base)) continue;
                if (seenBases.has(base)) continue;
                seenBases.add(base);
                productInfo.images.push(normalizedImg);
              }
            }
          }
          
          // Add features
          if (ai.features && Array.isArray(ai.features)) {
            for (const f of ai.features) {
              if (f.text || f.text_ar) {
                const text = f.text || f.text_ar || '';
                const textAr = f.text_ar || f.text || '';
                productInfo.features.push({
                  text: text,
                  text_ar: textAr,
                  icon: getFeatureIcon(text + ' ' + textAr)
                });
              }
            }
          }
        }
      } catch (e) {
        console.error('Parse error:', e);
      }
    } else {
      console.error('AI error:', aiResponse.status);
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'تم تجاوز حد الطلبات', requiresManualInput: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (!productInfo.original_price_usd && structuredPrices.originalPrice && structuredPrices.originalPrice > 0) {
      const originalPriceUsd = Math.round(convertToUSD(structuredPrices.originalPrice, structuredPrices.currency) * 100) / 100;
      let originalPriceInIqd = convertToIQD(structuredPrices.originalPrice, structuredPrices.currency);
      originalPriceInIqd = roundPrice(originalPriceInIqd);
      productInfo.original_price = originalPriceInIqd > 0 ? originalPriceInIqd : null;
      productInfo.original_price_usd = originalPriceUsd > 0 ? originalPriceUsd : null;
      productInfo.currency = 'IQD';
      productInfo.points_reward = originalPriceInIqd > 0 ? Math.floor(originalPriceInIqd / 1000) : 0;
      console.log('Applied structured original price fallback:', structuredPrices.originalPrice, structuredPrices.currency, productInfo.original_price_usd, productInfo.original_price);
    }

    // ===== STEP: Search web for dimensions and weight if not found =====
    const needsDimensionsSearch = !productInfo.dimensions || 
      (!productInfo.dimensions.length_cm && !productInfo.dimensions.width_cm && !productInfo.dimensions.height_cm);
    const needsWeightSearch = !productInfo.weight_kg;
    
    if (needsDimensionsSearch || needsWeightSearch) {
      console.log('Dimensions/weight not found in page, searching web...');
      
      const searchQuery = `${productInfo.name} package dimensions weight cm kg specifications`;
      console.log('Search query:', searchQuery);
      
      try {
        const searchPrompt = `You are a product specifications expert. Provide the **PACKAGING / CARTON / SHIPPING-BOX dimensions** and **GROSS (shipping) weight including all packaging** for this product. Do NOT return the bare product (net) dimensions or net weight.

Product Name: ${productInfo.name}
Product URL: ${url}

Rules:
1. Always return the OUTER CARTON / shipping box size (width × depth × height in cm) including foam, accessories box, and outer cardboard — NOT the product itself.
2. Always return GROSS weight (kg) including the printer/device + foam + accessories + cardboard + tape + labels.
3. If both Net and Gross are known, return Gross. If both Product and Package dimensions are known, return Package.
4. Reference values (gross / shipping carton):
   - QIDI Plus4 / Bambu Lab X1 / similar enclosed FDM 3D printer carton: ~70×60×60 cm, ~28-32 kg gross.
   - Creality Ender-3 class open-frame printer carton: ~55×50×30 cm, ~9-12 kg gross.
   - Resin printer (Anycubic Mono / Elegoo Saturn): ~45×35×55 cm, ~12-18 kg gross.
   - Laptop carton: ~50×35×12 cm, ~3-5 kg.
   - Phone carton: ~20×12×8 cm, ~0.4-0.6 kg.
5. For other products, estimate carton size = product size + 5-15 cm per axis, gross weight = net × 1.10-1.25.

Return JSON ONLY:
{
  "dimensions": { "length_cm": number, "width_cm": number, "height_cm": number },
  "weight_kg": number,
  "confidence": "high" | "medium" | "low",
  "source": "package/carton/gross estimate"
}`;

        const searchResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: buildLovableAiHeaders(lovableApiKey),
          body: JSON.stringify({
            model: LOVABLE_AI_MODEL,
            messages: [
              { role: 'system', content: 'You are a product packaging expert. Always return PACKAGE/CARTON dimensions and GROSS weight (with packaging), never bare product dimensions or net weight.' },
              { role: 'user', content: searchPrompt }
            ],
            temperature: 0.1,
            max_tokens: 1000,
          }),
        });

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          const searchText = searchData.choices[0]?.message?.content || '';
          console.log('Web search AI response:', searchText);
          
          const searchJsonMatch = searchText.match(/\{[\s\S]*\}/);
          if (searchJsonMatch) {
            const searchResult = JSON.parse(searchJsonMatch[0]);
            
            // Update dimensions if not found
            if (needsDimensionsSearch && searchResult.dimensions) {
              productInfo.dimensions = {
                length_cm: parseFloat(searchResult.dimensions.length_cm) || null,
                width_cm: parseFloat(searchResult.dimensions.width_cm) || null,
                height_cm: parseFloat(searchResult.dimensions.height_cm) || null
              };
              console.log('Updated dimensions from web search:', productInfo.dimensions);
            }
            
            // Update weight if not found
            if (needsWeightSearch && searchResult.weight_kg) {
              productInfo.weight_kg = parseFloat(searchResult.weight_kg) || null;
              console.log('Updated weight from web search:', productInfo.weight_kg);
            }
          }
        }
      } catch (searchError) {
        console.error('Web search error:', searchError);
      }
    }

    // ===== STEP: Fallback AI call for SEO + AI Content if missing (or forced) =====
    const ssEmpty = forceSeoRegenerate || !hasTriLangValue(productInfo.short_summary);
    const tagsEmpty = forceSeoRegenerate || !Array.isArray(productInfo.searchable_tags) || productInfo.searchable_tags.length === 0;
    const aiC = productInfo.ai_content || {};
    const aiEmpty = forceSeoRegenerate || !aiC || (
      (!aiC.problem_solved || (!aiC.problem_solved.ar && !aiC.problem_solved.en && !aiC.problem_solved.ku)) &&
      (!aiC.target_audience || (!aiC.target_audience.ar && !aiC.target_audience.en && !aiC.target_audience.ku)) &&
      (!Array.isArray(aiC.benefits) || aiC.benefits.length === 0) &&
      (!Array.isArray(aiC.usage) || aiC.usage.length === 0) &&
      (!Array.isArray(aiC.specifications) || aiC.specifications.length === 0)
    );

    if (ssEmpty || tagsEmpty || aiEmpty) {
      console.log('SEO/AI content generation:', { ssEmpty, tagsEmpty, aiEmpty, forced: forceSeoRegenerate });
      try {
        // Use existing product info as authoritative reference when re-extracting
        const refName = existingName || productInfo.name || '';
        const refNameAr = existingNameAr || productInfo.name_ar || '';
        const refDesc = existingDescription || productInfo.description || '';
        const refDescAr = existingDescriptionAr || productInfo.description_ar || '';
        const seoPrompt = `أنت كاتب SEO ومسوق منتجات محترف. لديك المنتج التالي:

الاسم (EN): ${refName}
الاسم (AR): ${refNameAr}
الوصف (EN): ${refDesc.slice(0, 500)}
الوصف (AR): ${refDescAr.slice(0, 500)}
المواصفات المعروفة: ${productInfo.dimensions ? `أبعاد ${productInfo.dimensions.length_cm}×${productInfo.dimensions.width_cm}×${productInfo.dimensions.height_cm} سم` : ''} ${productInfo.weight_kg ? `وزن ${productInfo.weight_kg} كغ` : ''}

مهمتك: أنتج JSON كامل بالحقول التالية. كل الحقول إلزامية - لا تترك أياً منها فارغاً. استخدم معرفتك العامة بالمنتج لاستنتاج كل شيء.

أرجع JSON فقط بهذا الشكل:
{
  "short_summary": {
    "ar": "ملخص جذاب ≤ 160 حرف بالعربية",
    "en": "Catchy summary ≤ 160 chars in English",
    "ku": "پوختەی سەرنجڕاکێش ≤ ١٦٠ پیت بە کوردی"
  },
  "searchable_tags": ["كلمة 1", "keyword 2", "كلمة 3", "tag 4", "كلمة 5"],
  "ai_content": {
    "problem_solved": {"ar": "...", "en": "...", "ku": "..."},
    "target_audience": {"ar": "...", "en": "...", "ku": "..."},
    "benefits": [
      {"ar": "فائدة ١", "en": "Benefit 1", "ku": "سوود ١"},
      {"ar": "فائدة ٢", "en": "Benefit 2", "ku": "سوود ٢"},
      {"ar": "فائدة ٣", "en": "Benefit 3", "ku": "سوود ٣"}
    ],
    "usage": [
      {"ar": "خطوة ١", "en": "Step 1", "ku": "هەنگاو ١"},
      {"ar": "خطوة ٢", "en": "Step 2", "ku": "هەنگاو ٢"}
    ],
    "specifications": [
      {"key": {"ar": "المادة", "en": "Material", "ku": "ماددە"}, "value": {"ar": "...", "en": "...", "ku": "..."}},
      {"key": {"ar": "...", "en": "...", "ku": "..."}, "value": {"ar": "...", "en": "...", "ku": "..."}}
    ]
  }
}

قواعد صارمة:
- 3-5 فوائد، 2-4 خطوات استخدام، 3-6 مواصفات
- كل حقل بـ 3 لغات (ar, en, ku) بدون استثناء
- لا تستخدم placeholder مثل "..." في الإخراج النهائي - املأ بقيم حقيقية
- لا تكتب أي نص خارج JSON`;

        const seoResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: buildLovableAiHeaders(lovableApiKey),
          body: JSON.stringify({
            model: LOVABLE_AI_MODEL,
            messages: [
              { role: 'system', content: 'أنت كاتب SEO ومسوق منتجات محترف. أنتج محتوى تسويقي عالي الجودة بـ 3 لغات. أرجع JSON صحيح فقط.' },
              { role: 'user', content: seoPrompt }
            ],
            temperature: 0.4,
            max_tokens: 12000,
          }),
        });

        if (seoResponse.ok) {
          const seoData = await seoResponse.json();
          const seoText = seoData.choices[0]?.message?.content || '';
          try {
            const seo = parseAiJsonObject(seoText);
            if (ssEmpty && seo.short_summary && typeof seo.short_summary === 'object') {
              productInfo.short_summary = {
                ar: normalizeSeoText(seo.short_summary.ar),
                en: normalizeSeoText(seo.short_summary.en),
                ku: normalizeSeoText(seo.short_summary.ku),
              };
              console.log('Filled short_summary via fallback');
            }
            if (tagsEmpty && Array.isArray(seo.searchable_tags)) {
              productInfo.searchable_tags = seo.searchable_tags
                .map((t: any) => (typeof t === 'string' ? t.trim() : ''))
                .filter((t: string) => t.length > 0)
                .slice(0, 20);
              console.log('Filled searchable_tags via fallback:', productInfo.searchable_tags.length);
            }
            if (aiEmpty && seo.ai_content && typeof seo.ai_content === 'object') {
              productInfo.ai_content = seo.ai_content;
              console.log('Filled ai_content via fallback');
            }
          } catch (seoParseErr) {
            console.error('SEO fallback JSON parse error:', seoParseErr);
          }
        } else {
          console.error('SEO fallback AI call failed:', seoResponse.status, await seoResponse.text());
        }
      } catch (seoErr) {
        console.error('SEO fallback error:', seoErr);
      }
    }

    const displayName = cleanExtractedText(productInfo.name_ar) || cleanExtractedText(productInfo.name) || 'المنتج';
    if (!hasTriLangValue(productInfo.short_summary)) {
      productInfo.short_summary = {
        ar: normalizeSeoText(productInfo.short_summary?.ar) || `${displayName} بجودة عالية وخيارات عملية تناسب الاستخدام اليومي وتمنح تجربة موثوقة للمستخدمين.`.slice(0, 200),
        en: normalizeSeoText(productInfo.short_summary?.en) || `${cleanExtractedText(productInfo.name) || displayName} with reliable quality, practical features, and a smooth everyday user experience.`.slice(0, 200),
        ku: normalizeSeoText(productInfo.short_summary?.ku) || `${displayName} بە کوالێتی باش و تایبەتمەندییە کردارییەکان بۆ بەکارهێنانی ڕۆژانە.`.slice(0, 200),
      };
      console.log('Filled short_summary via deterministic fallback');
    }

    if (!Array.isArray(productInfo.searchable_tags) || productInfo.searchable_tags.length === 0) {
      productInfo.searchable_tags = buildFallbackSearchableTags(
        productInfo.name_ar,
        productInfo.name,
        productInfo.description_ar,
        productInfo.description,
        existingNameAr,
        existingName,
        existingDescriptionAr,
        existingDescription,
      );
      if (productInfo.searchable_tags.length === 0) {
        productInfo.searchable_tags = [displayName, cleanExtractedText(productInfo.name) || 'product'].filter(Boolean);
      }
      console.log('Filled searchable_tags via deterministic fallback:', productInfo.searchable_tags.length);
    }

    const finalAi = productInfo.ai_content || {};
    const needsAiFallback = !finalAi || (
      (!finalAi.problem_solved || (!finalAi.problem_solved.ar && !finalAi.problem_solved.en && !finalAi.problem_solved.ku)) &&
      (!finalAi.target_audience || (!finalAi.target_audience.ar && !finalAi.target_audience.en && !finalAi.target_audience.ku)) &&
      (!Array.isArray(finalAi.benefits) || finalAi.benefits.length === 0) &&
      (!Array.isArray(finalAi.usage) || finalAi.usage.length === 0) &&
      (!Array.isArray(finalAi.specifications) || finalAi.specifications.length === 0)
    );
    if (needsAiFallback) {
      productInfo.ai_content = buildFallbackAIContent({
        nameAr: productInfo.name_ar || existingNameAr,
        nameEn: productInfo.name || existingName,
        descriptionAr: productInfo.description_ar || existingDescriptionAr,
        descriptionEn: productInfo.description || existingDescription,
        dimensions: productInfo.dimensions,
        weightKg: productInfo.weight_kg,
      });
      console.log('Filled ai_content via deterministic fallback');
    }

    // ===== STEP: Calculate air shipping cost =====
    let estimatedAirShippingCost: number | null = null;
    
    if (productInfo.dimensions || productInfo.weight_kg) {
      console.log('Calculating air shipping cost...');
      
      // Fetch shipping settings from database
      let kgPrice = 6000; // Default: 6000 IQD per kg
      let safetyMargin = 0.20; // Default: 20%
      
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
        
        if (supabaseUrl && supabaseKey) {
          const settingsResponse = await fetch(
            `${supabaseUrl}/rest/v1/shipping_settings?select=china_air_kg_price,air_safety_margin`,
            {
              headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
              }
            }
          );
          
          if (settingsResponse.ok) {
            const settings = await settingsResponse.json();
            if (settings && settings.length > 0) {
              kgPrice = settings[0].china_air_kg_price || 6000;
              safetyMargin = (settings[0].air_safety_margin || 20) / 100;
              console.log('Shipping settings loaded:', { kgPrice, safetyMargin });
            }
          }
        }
      } catch (e) {
        console.log('Could not fetch shipping settings, using defaults');
      }
      
      // Calculate volumetric weight (L × W × H / 5000)
      let volumetricWeight = 0;
      if (productInfo.dimensions) {
        const { length_cm, width_cm, height_cm } = productInfo.dimensions;
        if (length_cm && width_cm && height_cm) {
          volumetricWeight = (length_cm * width_cm * height_cm) / 5000;
          console.log('Volumetric weight:', volumetricWeight, 'kg');
        }
      }
      
      // Use the greater of actual weight or volumetric weight
      const actualWeight = productInfo.weight_kg || 0;
      const chargeableWeight = Math.max(actualWeight, volumetricWeight);
      console.log('Actual weight:', actualWeight, 'Volumetric:', volumetricWeight, 'Chargeable:', chargeableWeight);
      
      if (chargeableWeight > 0) {
        // Add safety margin
        const weightWithMargin = chargeableWeight * (1 + safetyMargin);
        estimatedAirShippingCost = Math.ceil(weightWithMargin * kgPrice);
        // Round to nearest 500
        estimatedAirShippingCost = Math.ceil(estimatedAirShippingCost / 500) * 500;
        console.log('Estimated air shipping cost:', estimatedAirShippingCost, 'IQD');
      }
    }

    // Merge direct SKU data if AI didn't find enough
    if (productInfo.colors.length === 0 && directSkuData.colors.length > 0) {
      console.log('Using direct SKU colors...');
      for (const c of directSkuData.colors) {
        if (c.image_url) {
          variantImageUrls.add(getImageBaseUrl(c.image_url));
        }
        productInfo.colors.push({ ...c });
      }
    }
    
    if (productInfo.options.length === 0 && directSkuData.options.length > 0) {
      console.log('Using direct SKU options...');
      for (const o of directSkuData.options) {
        if (o.image_url) {
          variantImageUrls.add(getImageBaseUrl(o.image_url));
        }
        productInfo.options.push({ ...o, price_adjustment: 0 });
      }
    }

    // ===== Strategy 3: Firecrawl fallback for JS-rendered sites =====
    // Only run when we actually have no colors yet — otherwise it wastes ~20-40s
    // and pushes the whole edge function past the client invoke timeout.
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    const shouldTryFirecrawl = !!firecrawlKey && productInfo.colors.length === 0 && isJsRendered && !platformApiData;
    if (shouldTryFirecrawl && firecrawlKey) {
        console.log('Trying Firecrawl for JS-rendered content (colors found:', productInfo.colors.length, ')...');
        try {
          const fcController = new AbortController();
          const fcTimer = setTimeout(() => fcController.abort(), 20000);
          const fcResp = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${firecrawlKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url: url,
              formats: ['html'],
              waitFor: 3000,
            }),
            signal: fcController.signal,
          }).finally(() => clearTimeout(fcTimer));

          if (fcResp.ok) {
            const fcData = await fcResp.json();
            const renderedHtml = fcData.data?.html || fcData.html || '';
            console.log('Firecrawl returned HTML length:', renderedHtml.length);

            if (renderedHtml.length > 1000) {
              // Re-run AI extraction on the rendered content focusing on colors
              const colorRetryPrompt = `Extract ALL available color/variant options from this fully-rendered product page HTML.

Product URL: ${url}

Rendered HTML (first 80000 chars):
${renderedHtml.substring(0, 80000)}

CRITICAL INSTRUCTIONS:
- Extract EVERY color variant available - look for swatch elements, variant selectors, option buttons
- Include color name in English and Arabic translation
- Include the SKU/variant code in the color name if shown (e.g., "Translucent Orange (32300)" NOT just "Translucent Orange")
- For hex_code: extract the EXACT hex from CSS background-color or style attributes on swatch elements. Do NOT use generic colors. Example: "Translucent Teal" should be the exact shade like #77EDD7, NOT generic #008080
- For image_url: use the variant-specific product image URL (the image that appears when clicking that color swatch), NOT the main product image
- Look for data-color, aria-label, background-color CSS properties on color swatch elements
- DO NOT skip any colors
- DO NOT hallucinate image URLs - only use URLs that actually exist in the HTML

Return ONLY JSON:
{
  "colors": [{"name": "English Name (SKU)", "name_ar": "الاسم بالعربية", "hex_code": "#exact_hex", "image_url": "url or null"}]
}`;

              const colorAiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
                method: 'POST',
                headers: buildLovableAiHeaders(lovableApiKey),
                body: JSON.stringify({
                  model: LOVABLE_AI_MODEL,
                  messages: [
                    { role: 'system', content: 'You are a product color extraction expert. Extract ALL color variants completely.' },
                    { role: 'user', content: colorRetryPrompt }
                  ],
                  temperature: 0.1,
                  max_tokens: 16000,
                }),
              });

              if (colorAiResp.ok) {
                const colorAiData = await colorAiResp.json();
                const colorText = colorAiData.choices[0]?.message?.content || '';
                const colorJsonMatch = colorText.match(/\{[\s\S]*\}/);
                if (colorJsonMatch) {
                  const colorResult = JSON.parse(colorJsonMatch[0]);
                  if (colorResult.colors && Array.isArray(colorResult.colors)) {
                    console.log('Firecrawl+AI found colors:', colorResult.colors.length);
                    // If we already had AI-guessed colors and Firecrawl found better ones, replace them
                    if (productInfo.colors.length > 0 && colorResult.colors.length > 0) {
                      console.log('Replacing', productInfo.colors.length, 'AI-guessed colors with', colorResult.colors.length, 'Firecrawl colors');
                      productInfo.colors = [];
                    }
                    // Collect all URLs from rendered HTML for validation
                    const allUrlsInRenderedHtml = new Set<string>();
                    const renderedUrlRegex = /https?:\/\/[^\s"'<>]+/gi;
                    let renderedUrlMatch;
                    while ((renderedUrlMatch = renderedUrlRegex.exec(renderedHtml)) !== null) {
                      allUrlsInRenderedHtml.add(renderedUrlMatch[0].split('?')[0]);
                    }
                    
                    for (const c of colorResult.colors) {
                      if (c.name && isValidColorName(c.name)) {
                        const colorLower = c.name.toLowerCase();
                        const info = Object.entries(COLOR_MAP).find(([k]) => colorLower.includes(k));
                        let colorImageUrl = null;
                        if (c.image_url && c.image_url.startsWith('http')) {
                          const baseImgUrl = c.image_url.split('?')[0];
                          if (allUrlsInRenderedHtml.has(baseImgUrl)) {
                            colorImageUrl = normalizeImageUrl(c.image_url);
                            variantImageUrls.add(getImageBaseUrl(colorImageUrl));
                          } else {
                            console.log('Removed hallucinated Firecrawl image URL for color:', c.name);
                          }
                        }
                        productInfo.colors.push({
                          name: c.name,
                          name_ar: c.name_ar || (info ? info[1].ar : c.name),
                          hex_code: (c.hex_code && /^#[0-9A-Fa-f]{6}$/i.test(c.hex_code)) 
                            ? c.hex_code 
                            : (info ? info[1].hex : '#808080'),
                          image_url: colorImageUrl,
                        });
                      }
                    }
                  }
                }
              }
            }
          } else {
            const fcErr = await fcResp.text();
            console.log('Firecrawl error:', fcResp.status, fcErr);
          }
        } catch (fcError) {
          console.error('Firecrawl fallback error:', fcError);
        }
    }

    // ===== Bambu Lab deterministic override (replaces AI guesses) =====
    if (platform === 'bambulab') {
      let bambuResult = await parseBambuLabUnified(pageContent);

      if (bambuResult.colors.length === 0 && bambuResult.options.length === 0) {
        console.log('Bambu unified parser empty in raw HTML, trying Firecrawl...');
        const fcKey = Deno.env.get('FIRECRAWL_API_KEY');
        if (fcKey) {
          try {
            const fcCtrl = new AbortController();
            const fcT = setTimeout(() => fcCtrl.abort(), 20000);
            const fcResp = await fetch('https://api.firecrawl.dev/v1/scrape', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${fcKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ url, formats: ['html'], waitFor: 5000 }),
              signal: fcCtrl.signal,
            }).finally(() => clearTimeout(fcT));
            if (fcResp.ok) {
              const fcData = await fcResp.json();
              const renderedHtml = fcData.data?.html || fcData.html || '';
              if (renderedHtml.length > 1000) {
                bambuResult = await parseBambuLabUnified(renderedHtml);
              }
            }
          } catch (e) {
            console.error('Firecrawl Bambu error:', e);
          }
        }
      }

      if (bambuResult.colors.length > 0) {
        console.log('Bambu unified parser found', bambuResult.colors.length, 'colors — replacing AI colors');
        productInfo.colors = bambuResult.colors.map(c => ({
          name: c.name,
          name_ar: c.name_ar,
          hex_code: c.hex_code || '#808080',
          image_url: c.image_url,
        }));
        for (const c of bambuResult.colors) {
          if (c.image_url) variantImageUrls.add(getImageBaseUrl(c.image_url));
        }
      }

      if (bambuResult.options.length > 0) {
        console.log('Bambu unified parser found', bambuResult.options.length, 'options — replacing AI options');
        productInfo.options = bambuResult.options.map(o => ({
          name: o.name,
          name_ar: o.name_ar,
          image_url: o.image_url,
          price_adjustment: 0,
        }));
      }
    }

    // ===== Shopify override: replace AI-merged colors/options with structured axes =====
    if (shopifyExtracted && (shopifyExtracted.colors.length > 0 || shopifyExtracted.options.length > 0)) {
      console.log('Shopify structured override — replacing AI colors/options',
        'colors:', productInfo.colors.length, '→', shopifyExtracted.colors.length,
        'options:', productInfo.options.length, '→', shopifyExtracted.options.length);
      productInfo.colors = shopifyExtracted.colors.map(c => ({ ...c }));
      productInfo.options = shopifyExtracted.options.map(o => ({ ...o }));
      for (const c of shopifyExtracted.colors) {
        if (c.image_url) variantImageUrls.add(getImageBaseUrl(c.image_url));
      }
      for (const o of shopifyExtracted.options) {
        if (o.image_url) variantImageUrls.add(getImageBaseUrl(o.image_url));
      }
      if (productInfo.images.length === 0 && shopifyExtracted.images.length > 0) {
        productInfo.images = shopifyExtracted.images.slice(0, 10);
      }
    }




    // Note: For direct images, we DON'T exclude variant images because they might be the only product images available
    if (productInfo.images.length === 0 && directImages.length > 0) {
      console.log('Using direct extraction images...', directImages.length, 'images');
      console.log('Direct images:', directImages);
      const seenBases = new Set<string>();
      for (const img of directImages) {
        const base = getImageBaseUrl(img);
        if (seenBases.has(base)) continue;
        seenBases.add(base);
        productInfo.images.push(img);
      }
      console.log('Images after direct extraction:', productInfo.images.length);
    }

    // Final cleanup - only remove duplicates and SVGs, don't exclude variant images
    console.log('Before final cleanup:', productInfo.images.length, 'images');
    const finalImages: string[] = [];
    const finalBases = new Set<string>();
    for (const img of productInfo.images) {
      const base = getImageBaseUrl(img);
      const isSvg = /\.svg/i.test(img);
      const isDupe = finalBases.has(base);
      if (isDupe || isSvg) continue;
      finalBases.add(base);
      finalImages.push(img);
    }
    productInfo.images = finalImages.slice(0, 10);
    console.log('After final cleanup:', productInfo.images.length, 'images');

    // Add estimated air shipping cost to product info
    (productInfo as any).estimated_air_shipping_cost = estimatedAirShippingCost;

    // ===== Brand fallbacks: JSON-LD, og:brand, meta, hostname =====
    if (!productInfo.brand || !String(productInfo.brand).trim()) {
      try {
        // JSON-LD brand
        const ldMatches = pageContent.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
        for (const block of ldMatches) {
          const inner = block.replace(/<script[^>]*>|<\/script>/gi, '').trim();
          try {
            const parsed = JSON.parse(inner);
            const arr = Array.isArray(parsed) ? parsed : [parsed];
            for (const node of arr) {
              const b = node?.brand?.name || (typeof node?.brand === 'string' ? node.brand : null) || node?.manufacturer?.name;
              if (b && typeof b === 'string') { productInfo.brand = b.trim().slice(0, 80); break; }
            }
            if (productInfo.brand) break;
          } catch (_) { /* skip */ }
        }
      } catch (_) { /* skip */ }
    }
    if (!productInfo.brand || !String(productInfo.brand).trim()) {
      const ogBrand = pageContent.match(/<meta[^>]+property=["']og:brand["'][^>]+content=["']([^"']+)["']/i)
        || pageContent.match(/<meta[^>]+name=["']brand["'][^>]+content=["']([^"']+)["']/i);
      if (ogBrand && ogBrand[1]) productInfo.brand = ogBrand[1].trim().slice(0, 80);
    }
    if (!productInfo.brand || !String(productInfo.brand).trim()) {
      try {
        const host = new URL(url).hostname.replace(/^www\./, '');
        const root = host.split('.')[0] || '';
        const known: Record<string, string> = {
          qidi3d: 'QIDI', qidi3dprinter: 'QIDI', qidi3dofficial: 'QIDI', 'qidi-tech': 'QIDI',
          bambulab: 'Bambu Lab', creality: 'Creality', anycubic: 'Anycubic', elegoo: 'Elegoo',
          prusa3d: 'Prusa', flashforge: 'FlashForge', snapmaker: 'Snapmaker',
        };
        if (known[root]) productInfo.brand = known[root];
        else if (root && !['taobao','jd','amazon','aliexpress','alibaba','1688','tmall','ebay'].includes(root)) {
          productInfo.brand = root.charAt(0).toUpperCase() + root.slice(1);
        }
      } catch (_) { /* skip */ }
    }

    console.log('=== FINAL EXTRACTION RESULT ===');
    console.log('Main product images:', productInfo.images.length);
    console.log('Colors:', productInfo.colors.length);
    console.log('Options:', productInfo.options.length);
    console.log('Features:', productInfo.features.length);
    console.log('Dimensions:', JSON.stringify(productInfo.dimensions));
    console.log('Weight (kg):', productInfo.weight_kg);
    console.log('SEO short summary complete:', hasTriLangValue(productInfo.short_summary));
    console.log('SEO searchable tags:', Array.isArray(productInfo.searchable_tags) ? productInfo.searchable_tags.length : 0);
    console.log('AI content keys:', productInfo.ai_content && typeof productInfo.ai_content === 'object' ? Object.keys(productInfo.ai_content).join(',') : 'none');
    console.log('Estimated air shipping cost:', estimatedAirShippingCost);

    return new Response(
      JSON.stringify({
        success: true,
        productInfo,
        platform,
        item_id: itemId,
        canonical_url: canonicalUrl
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'حدث خطأ',
        requiresManualInput: true
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
