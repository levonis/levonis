import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

// Currency conversion rates to USD
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

const USD_TO_IQD = 1400;

function convertToIQD(price: number, currency: string): number {
  const currencyUpper = currency.toUpperCase();
  if (currencyUpper === 'IQD') return price;
  const toUsdRate = CURRENCY_TO_USD[currencyUpper] || 1;
  const priceInUsd = price * toUsdRate;
  return priceInUsd * USD_TO_IQD;
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let { url } = await req.json();
    
    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'الرجاء إدخال رابط المنتج' }),
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

    if (!fetchSuccess) {
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
    const directImages = extractImages(pageContent);
    const directPrice = extractPrice(pageContent);
    const directSkuData = extractSkuData(pageContent);
    console.log('Direct extraction - images:', directImages.length, 'price:', directPrice);
    console.log('Direct SKU extraction - colors:', directSkuData.colors.length, 'options:', directSkuData.options.length);

    // AI extraction with enhanced prompt for Chinese sites
    console.log('Using AI for extraction...');

    const prompt = `استخرج معلومات المنتج من صفحة الويب هذه وأرجعها بصيغة JSON فقط.

الرابط: ${url}
المنصة: ${platform}
رقم المنتج: ${itemId || 'غير معروف'}

محتوى HTML (أول 100000 حرف):
${pageContent.substring(0, 100000)}

أرجع JSON بالشكل التالي بالضبط:
{
  "name": "اسم المنتج بالإنجليزية",
  "name_ar": "اسم المنتج بالعربية",
  "description": "وصف قصير بالإنجليزية",
  "description_ar": "وصف قصير بالعربية",
  "price": 29.99,
  "original_price": 39.99,
  "currency": "CNY",
  "main_product_images": ["https://صورة-المنتج-الرئيسية.jpg"],
  "colors": [{"name": "Black", "name_ar": "أسود", "hex_code": "#000000", "image_url": "https://صورة-خاصة-بهذا-اللون.jpg"}],
  "options": [{"name": "0.4mm Nozzle", "name_ar": "فوهة 0.4 ملم", "image_url": "https://صورة-خاصة-بهذا-الخيار.jpg"}],
  "features": [{"text": "Feature in English", "text_ar": "الميزة بالعربية"}]
}

===== قواعد استخراج الألوان (مهم جداً) =====

مطلوب: استخرج كل الألوان المتاحة في المنتج - حتى لو كانت 50 أو 100 لون!

أماكن البحث عن الألوان:
1. في JSON: ابحث عن "skuProps", "skuList", "colorProperties", "props", "sku"
2. في HTML: ابحث عن العناصر التي تحتوي على class="sku-item" أو data-value
3. ابحث عن أي عنصر فيه 颜色 أو 颜色分类 أو color
4. استخرج الصور من: data-img, data-bigpic, background-image, src

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
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'أنت مستخرج بيانات منتجات خبير. مهمتك الأساسية: استخراج كل الألوان والخيارات المتاحة في المنتج بدون استثناء - حتى لو كانت 50 أو 100 عنصر. لكل لون/خيار استخرج صورته. أرجع JSON صحيح فقط.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.05,
        max_tokens: 32000,
      }),
    });

    let productInfo: any = {
      name: 'Product',
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
      points_reward: 0
    };
    
    const variantImageUrls = new Set<string>();
    
    if (aiResponse.ok) {
      try {
        const aiData = await aiResponse.json();
        const text = aiData.choices[0]?.message?.content || '';
        console.log('AI response length:', text.length);
        
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const ai = JSON.parse(jsonMatch[0]);
          
          productInfo.name = ai.name || productInfo.name;
          productInfo.name_ar = ai.name_ar || productInfo.name_ar;
          productInfo.description = ai.description || '';
          productInfo.description_ar = ai.description_ar || '';
          
          const extractedCurrency = ai.currency || 'CNY';
          const aiPrice = parseFloat(ai.price) || 0;
          const aiOriginalPrice = parseFloat(ai.original_price) || 0;
          const directPriceNum = directPrice || 0;
          
          console.log('All prices found - AI price:', aiPrice, 'AI original:', aiOriginalPrice, 'Direct:', directPriceNum, 'Currency:', extractedCurrency);
          
          const extractedOriginalPrice = Math.max(aiPrice, aiOriginalPrice, directPriceNum);
          let originalPriceInIqd = convertToIQD(extractedOriginalPrice, extractedCurrency);
          originalPriceInIqd = roundPrice(originalPriceInIqd);
          
          productInfo.price = null;
          productInfo.original_price = originalPriceInIqd > 0 ? originalPriceInIqd : null;
          productInfo.currency = 'IQD';
          
          // Calculate points reward: 1 point per 1000 IQD (based on original price before discount)
          if (originalPriceInIqd > 0) {
            productInfo.points_reward = Math.floor(originalPriceInIqd / 1000);
          }
          
          // Process colors from AI
          if (ai.colors && Array.isArray(ai.colors)) {
            for (const c of ai.colors) {
              if (c.name && isValidColorName(c.name)) {
                const colorLower = c.name.toLowerCase();
                const info = Object.entries(COLOR_MAP).find(([k]) => colorLower.includes(k));
                
                let colorImageUrl = null;
                if (c.image_url && c.image_url.startsWith('http')) {
                  colorImageUrl = normalizeImageUrl(c.image_url);
                  variantImageUrls.add(getImageBaseUrl(colorImageUrl));
                }
                
                productInfo.colors.push({
                  name: c.name,
                  name_ar: info ? info[1].ar : c.name_ar || c.name,
                  hex_code: info ? info[1].hex : c.hex_code || '#808080',
                  image_url: colorImageUrl,
                  in_stock: true,
                  available_for_direct_sale: true,
                  available_for_pre_order: false
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
                  in_stock: true,
                  available_for_direct_sale: true,
                  available_for_pre_order: false
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
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Merge direct SKU data if AI didn't find enough
    if (productInfo.colors.length === 0 && directSkuData.colors.length > 0) {
      console.log('Using direct SKU colors...');
      for (const c of directSkuData.colors) {
        if (c.image_url) {
          variantImageUrls.add(getImageBaseUrl(c.image_url));
        }
        productInfo.colors.push({
          ...c,
          in_stock: true,
          available_for_direct_sale: true,
          available_for_pre_order: false
        });
      }
    }
    
    if (productInfo.options.length === 0 && directSkuData.options.length > 0) {
      console.log('Using direct SKU options...');
      for (const o of directSkuData.options) {
        if (o.image_url) {
          variantImageUrls.add(getImageBaseUrl(o.image_url));
        }
        productInfo.options.push({
          ...o,
          price_adjustment: 0,
          in_stock: true,
          available_for_direct_sale: true,
          available_for_pre_order: false
        });
      }
    }

    // Use direct images if none from AI
    if (productInfo.images.length === 0 && directImages.length > 0) {
      console.log('Using direct extraction images...');
      const seenBases = new Set<string>();
      for (const img of directImages) {
        const base = getImageBaseUrl(img);
        if (variantImageUrls.has(base)) continue;
        if (seenBases.has(base)) continue;
        seenBases.add(base);
        productInfo.images.push(img);
      }
    }

    // Final cleanup
    const finalImages: string[] = [];
    const finalBases = new Set<string>();
    for (const img of productInfo.images) {
      const base = getImageBaseUrl(img);
      if (variantImageUrls.has(base)) continue;
      if (!finalBases.has(base) && !/\.svg/i.test(img)) {
        finalBases.add(base);
        finalImages.push(img);
      }
    }
    productInfo.images = finalImages.slice(0, 10);

    console.log('=== FINAL EXTRACTION RESULT ===');
    console.log('Main product images:', productInfo.images.length);
    console.log('Colors:', productInfo.colors.length);
    console.log('Options:', productInfo.options.length);
    console.log('Features:', productInfo.features.length);

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
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
