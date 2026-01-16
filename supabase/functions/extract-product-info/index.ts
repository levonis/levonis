import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Detect platform from URL
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

// Feature icon mapping based on keywords
const FEATURE_ICON_MAP: Array<[string, string]> = [
  // Performance & Speed
  ['fast', 'Zap'], ['speed', 'Zap'], ['quick', 'Zap'], ['سريع', 'Zap'], ['سرعة', 'Zap'],
  ['performance', 'TrendingUp'], ['أداء', 'TrendingUp'],
  
  // Quality & Premium
  ['quality', 'Award'], ['premium', 'Crown'], ['جودة', 'Award'], ['ممتاز', 'Crown'], ['فاخر', 'Crown'],
  ['original', 'Shield'], ['أصلي', 'Shield'], ['genuine', 'Shield'],
  
  // Memory & Storage
  ['memory', 'Cpu'], ['ram', 'Cpu'], ['ذاكرة', 'Cpu'], ['storage', 'Disc'], ['تخزين', 'Disc'],
  ['gb', 'Cpu'], ['tb', 'Disc'], ['ssd', 'Disc'], ['hdd', 'Disc'],
  
  // Battery & Power
  ['battery', 'Battery'], ['بطارية', 'Battery'], ['power', 'Battery'], ['طاقة', 'Battery'], ['mah', 'Battery'], ['charge', 'Battery'],
  
  // Display & Screen
  ['display', 'Monitor'], ['screen', 'Monitor'], ['شاشة', 'Monitor'], ['amoled', 'Monitor'], ['lcd', 'Monitor'], ['oled', 'Monitor'], ['hd', 'Monitor'], ['4k', 'Monitor'],
  
  // Camera & Photography
  ['camera', 'Camera'], ['كاميرا', 'Camera'], ['photo', 'Image'], ['صورة', 'Image'], ['megapixel', 'Camera'], ['lens', 'Camera'], ['عدسة', 'Camera'],
  
  // Connectivity
  ['wifi', 'Wifi'], ['bluetooth', 'Wifi'], ['واي فاي', 'Wifi'], ['wireless', 'Wifi'], ['لاسلكي', 'Wifi'], ['5g', 'Wifi'], ['4g', 'Wifi'], ['lte', 'Wifi'],
  
  // Audio
  ['audio', 'Volume2'], ['sound', 'Volume2'], ['صوت', 'Volume2'], ['speaker', 'Volume2'], ['سماعة', 'Headphones'], ['headphone', 'Headphones'], ['music', 'Music'], ['موسيقى', 'Music'],
  
  // Protection & Security
  ['protect', 'Shield'], ['حماية', 'Shield'], ['secure', 'Lock'], ['آمن', 'Lock'], ['waterproof', 'Droplet'], ['مقاوم', 'Shield'], ['water', 'Droplet'], ['ماء', 'Droplet'],
  
  // Shipping & Delivery
  ['shipping', 'Truck'], ['delivery', 'Truck'], ['توصيل', 'Truck'], ['free_shipping', 'Truck'],
  
  // Warranty & Guarantee
  ['warranty', 'Shield'], ['ضمان', 'Shield'], ['guarantee', 'Shield'], ['كفالة', 'Shield'],
  
  // Weight & Size
  ['weight', 'Feather'], ['وزن', 'Feather'], ['light', 'Feather'], ['خفيف', 'Feather'], ['size', 'Package'], ['حجم', 'Package'], ['dimension', 'Package'],
  
  // Material
  ['metal', 'Gem'], ['معدن', 'Gem'], ['aluminum', 'Gem'], ['ألومنيوم', 'Gem'], ['steel', 'Gem'], ['فولاذ', 'Gem'], ['leather', 'Sparkles'], ['جلد', 'Sparkles'],
  
  // Technology
  ['smart', 'Sparkles'], ['ذكي', 'Sparkles'], ['ai', 'Sparkles'], ['intelligent', 'Sparkles'], ['tech', 'Cpu'], ['تقنية', 'Cpu'],
  
  // Nozzle (for 3D printers)
  ['nozzle', 'Target'], ['mm', 'Target'], ['فوهة', 'Target'],
  
  // Default
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
  return 'Check'; // Default icon
}

// Validate color name - accept any reasonable color name
function isValidColorName(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  const nameLower = name.toLowerCase().trim();
  if (nameLower.length < 2 || nameLower.length > 50) return false;
  // Reject HTML/code
  if (/<|>|\[|\]|\{|\}|\\|http|class=|style=|function|var |const |let |import|export/.test(nameLower)) return false;
  // Reject obvious non-color values
  if (/^(select|choose|pick|اختر|option|default|standard|normal|none|null|undefined|\d+$)$/i.test(nameLower)) return false;
  // Accept if it contains any known color word OR looks like a color name (not just numbers)
  const hasKnownColor = Object.keys(COLOR_MAP).some(c => nameLower.includes(c));
  const looksLikeColor = /[a-z\u0600-\u06FF]/.test(nameLower) && !/^\d+$/.test(nameLower);
  return hasKnownColor || looksLikeColor;
}

// Validate option name - must be a valid product option
function isValidOptionName(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  const nameTrimmed = name.trim();
  if (nameTrimmed.length < 1 || nameTrimmed.length > 50) return false;
  // Reject HTML/code
  if (/<|>|\{|\}|\\|function|var |const |let /.test(nameTrimmed)) return false;
  // Reject generic labels
  if (/^(select|choose|pick|اختر|option|color|اللون|please select|الرجاء الاختيار)$/i.test(nameTrimmed)) return false;
  return true;
}

// Normalize image URL
function normalizeImageUrl(url: string): string {
  let cleanUrl = url.trim();
  if (cleanUrl.startsWith('//')) cleanUrl = 'https:' + cleanUrl;
  // Remove query parameters that cause duplicates
  try {
    const urlObj = new URL(cleanUrl);
    // Keep only essential params, remove cache-busting etc
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
    // Remove all query params for comparison
    return urlObj.origin + urlObj.pathname;
  } catch {
    return url;
  }
}

// Extract product images with better deduplication - ONLY MAIN PRODUCT IMAGES
function extractImages(html: string): string[] {
  const seenBases = new Set<string>();
  const images: string[] = [];

  const addImage = (url: string) => {
    if (!url) return;
    let cleanUrl = normalizeImageUrl(url);
    if (!cleanUrl.startsWith('http')) return;
    
    // Skip non-product images
    if (/data:image|placeholder|icon|logo|avatar|consent|trustarc|\.svg|favicon|pixel|tracking|badge|button|banner-ad|sprite/i.test(cleanUrl)) return;
    if (cleanUrl.length < 30) return;
    
    // Check for size - skip tiny images
    if (/\b(16|24|32|48|64)x\1\b/.test(cleanUrl)) return;
    
    // Deduplicate by base URL
    const base = getImageBaseUrl(cleanUrl);
    if (seenBases.has(base)) return;
    seenBases.add(base);
    
    images.push(cleanUrl);
  };

  // OG image (highest priority)
  const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
  if (ogMatch) addImage(ogMatch[1]);

  // JSON-LD images - only from main product, not variants
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

  // Product gallery images - main gallery only
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

// USD to IQD conversion rate
const USD_TO_IQD = 1400;

// Convert price to IQD
function convertToIQD(price: number, currency: string): number {
  const currencyUpper = currency.toUpperCase();
  
  // If already IQD, return as is
  if (currencyUpper === 'IQD') {
    return price;
  }
  
  // Get USD rate for the currency
  const toUsdRate = CURRENCY_TO_USD[currencyUpper] || 1;
  
  // Convert to USD first, then to IQD
  const priceInUsd = price * toUsdRate;
  const priceInIqd = priceInUsd * USD_TO_IQD;
  
  return priceInIqd;
}

// Round price to nearest 500 or 1000 IQD
function roundPrice(price: number): number {
  if (price <= 0) return 0;
  
  // Round to nearest 500
  const rounded = Math.round(price / 500) * 500;
  
  return Math.floor(rounded); // Ensure integer
}

// Extract price from HTML
function extractPrice(html: string): number | null {
  const patterns = [
    /"price"\s*:\s*"?(\d+(?:\.\d{1,2})?)"?/gi,
    /data-price=["'](\d+(?:\.\d{1,2})?)["']/gi,
    /\$(\d+(?:\.\d{2})?)\s*(?:USD)?/gi,
    /class=["'][^"']*price[^"']*["'][^>]*>[\s\S]*?(\d+(?:\.\d{2})?)/gi,
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
    const { url } = await req.json();
    
    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'الرجاء إدخال رابط المنتج' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Extracting product info from URL:', url);

    const { platform, itemId } = detectPlatform(url);
    console.log('Detected platform:', platform, 'Item ID:', itemId);

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          requiresManualInput: true,
          item_id: itemId,
          platform: platform,
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
          'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
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
          message: 'لا يمكن الوصول للصفحة - يرجى إدخال البيانات يدوياً'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Direct extraction - main product images only
    const directImages = extractImages(pageContent);
    const directPrice = extractPrice(pageContent);
    console.log('Direct extraction - images:', directImages.length, 'price:', directPrice);

    // AI extraction with STRICT image classification rules
    console.log('Using AI for extraction with strict image classification...');

    const prompt = `استخرج معلومات المنتج من صفحة الويب هذه وأرجعها بصيغة JSON فقط.

الرابط: ${url}

محتوى HTML (أول 35000 حرف):
${pageContent.substring(0, 35000)}

أرجع JSON بالشكل التالي بالضبط:
{
  "name": "اسم المنتج بالإنجليزية",
  "name_ar": "اسم المنتج بالعربية",
  "description": "وصف قصير بالإنجليزية",
  "description_ar": "وصف قصير بالعربية",
  "price": 29.99,
  "original_price": 39.99,
  "currency": "USD",
  "main_product_images": ["https://صورة-المنتج-الرئيسية.jpg"],
  "colors": [{"name": "Black", "name_ar": "أسود", "hex_code": "#000000", "image_url": "https://صورة-خاصة-بهذا-اللون.jpg"}],
  "options": [{"name": "0.4mm", "name_ar": "0.4 ملم", "image_url": "https://صورة-خاصة-بهذا-الخيار.jpg"}],
  "features": [{"text": "Feature in English", "text_ar": "الميزة بالعربية"}]
}

===== قواعد استخراج الألوان والخيارات (أولوية قصوى) =====

ابحث في HTML عن:
1. عناصر SKU/Variant: ابحث عن data-skuid, data-sku-id, sku-item, sku-prop
2. خيارات اللون: ابحث عن color, لون, 颜色, colour, data-color
3. خيارات الحجم/المقاس: ابحث عن size, مقاس, 尺寸, 尺码, capacity, variant
4. الصور المرتبطة: ابحث عن data-img, data-image, data-thumb, background-image

مواقع شائعة للبحث:
- Taobao/Tmall: ابحث في <div class="sku-item"> و data-value و data-pricepair
- AliExpress: ابحث في sku-property-list و product-prop
- JD: ابحث في chosen-items و item-selected
- 1688: ابحث في obj-sku و sku-wrapper

استخرج كل الألوان والخيارات حتى لو كانت كثيرة. لا تترك أي لون أو خيار.

===== قواعد استخراج الأسعار =====

1. price: السعر النهائي بعد الخصم
2. original_price: السعر المشطوب أو الأصلي قبل الخصم
3. currency: العملة (CNY للمواقع الصينية، USD، EUR، إلخ)

===== قواعد الصور =====

4. main_product_images: صور المعرض الرئيسي فقط - لا تضع صور الألوان هنا!
5. colors[].image_url: الصورة الخاصة بكل لون - استخرجها من data-img أو thumbnail
6. options[].image_url: الصورة الخاصة بكل خيار إن وجدت

===== قواعد مهمة =====

7. colors: استخرج كل الألوان المتاحة. كل لون يجب أن يحتوي على: name, name_ar, hex_code, image_url
8. options: استخرج كل الخيارات (أحجام، مقاسات، أنواع). كل خيار يحتوي على: name, name_ar, image_url
9. features: مميزات المنتج (3-6 مميزات)
10. لا تتجاهل أي ألوان أو خيارات - استخرج الكل!

أرجع فقط كائن JSON بدون أي نص إضافي.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'أنت مستخرج بيانات منتجات خبير. مهمتك الأساسية هي فصل صور المنتج الرئيسية عن صور الألوان والخيارات بشكل صحيح. لا تخلط أبداً بين أنواع الصور. أرجع JSON صحيح فقط.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
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
      features: []
    };
    
    // Collect option/color image URLs for exclusion from main images
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
          
          // ===== قاعدة استخراج السعر =====
          // السعر المستخرج من الرابط = السعر الأصلي قبل التخفيض فقط
          // السعر الحالي = فارغ (يُحدد يدوياً لاحقاً)
          
          const extractedCurrency = ai.currency || 'USD';
          
          // Get all available prices
          const aiPrice = parseFloat(ai.price) || 0;
          const aiOriginalPrice = parseFloat(ai.original_price) || 0;
          const directPriceNum = directPrice || 0;
          
          console.log('All prices found - AI price:', aiPrice, 'AI original:', aiOriginalPrice, 'Direct:', directPriceNum, 'Currency:', extractedCurrency);
          
          // Use the HIGHEST price found as original_price (before discount)
          // This ensures we capture the original price, not a discounted one
          const extractedOriginalPrice = Math.max(aiPrice, aiOriginalPrice, directPriceNum);
          
          console.log('Using highest price as original_price:', extractedOriginalPrice);
          
          // Convert original_price to IQD
          let originalPriceInIqd = convertToIQD(extractedOriginalPrice, extractedCurrency);
          
          console.log('Converted to IQD:', originalPriceInIqd);
          
          // Round price to nearest 500
          originalPriceInIqd = roundPrice(originalPriceInIqd);
          
          console.log('Rounded original_price:', originalPriceInIqd);
          
          // Set prices:
          // price = null (0) - to be set manually later
          // original_price = highest extracted price from link
          productInfo.price = null;
          productInfo.original_price = originalPriceInIqd > 0 ? originalPriceInIqd : null;
          productInfo.currency = 'IQD';
          
          console.log('Final prices - price:', productInfo.price, 'original_price:', productInfo.original_price);
          
          // STEP 1: First, collect ALL color image URLs
          if (ai.colors && Array.isArray(ai.colors)) {
            for (const c of ai.colors) {
              if (c.name && isValidColorName(c.name)) {
                const colorLower = c.name.toLowerCase();
                const info = Object.entries(COLOR_MAP).find(([k]) => colorLower.includes(k));
                
                let colorImageUrl = null;
                if (c.image_url && c.image_url.startsWith('http')) {
                  colorImageUrl = normalizeImageUrl(c.image_url);
                  // Add to variant images set for exclusion
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
          
          // STEP 2: Collect ALL option image URLs
          if (ai.options && Array.isArray(ai.options)) {
            for (const o of ai.options) {
              if (o.name && isValidOptionName(o.name)) {
                let optionImageUrl = null;
                if (o.image_url && o.image_url.startsWith('http')) {
                  optionImageUrl = normalizeImageUrl(o.image_url);
                  // Add to variant images set for exclusion
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
          
          console.log('Variant images collected for exclusion:', variantImageUrls.size);
          
          // STEP 3: Process main product images - EXCLUDE any variant images
          const mainProductImages = ai.main_product_images || ai.images || [];
          if (Array.isArray(mainProductImages)) {
            const seenBases = new Set<string>();
            for (const img of mainProductImages) {
              if (img?.startsWith('http') && !/\.svg/i.test(img)) {
                const normalizedImg = normalizeImageUrl(img);
                const base = getImageBaseUrl(normalizedImg);
                
                // Skip if this is a variant image
                if (variantImageUrls.has(base)) {
                  console.log('Skipping variant image from main:', base);
                  continue;
                }
                
                // Skip duplicates
                if (seenBases.has(base)) continue;
                seenBases.add(base);
                
                productInfo.images.push(normalizedImg);
              }
            }
          }
          
          // Add features with appropriate icons
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

    // STEP 4: If no AI images, use direct extraction but still exclude variant images
    if (productInfo.images.length === 0 && directImages.length > 0) {
      console.log('Using direct extraction images with variant exclusion...');
      const seenBases = new Set<string>();
      for (const img of directImages) {
        const base = getImageBaseUrl(img);
        if (variantImageUrls.has(base)) {
          console.log('Skipping direct variant image:', base);
          continue;
        }
        if (seenBases.has(base)) continue;
        seenBases.add(base);
        productInfo.images.push(img);
      }
    }

    // STEP 5: Final cleanup - ensure no variant images in main product images
    const finalImages: string[] = [];
    const finalBases = new Set<string>();
    for (const img of productInfo.images) {
      const base = getImageBaseUrl(img);
      // Double-check exclusion
      if (variantImageUrls.has(base)) {
        console.log('Final cleanup - removing variant image:', base);
        continue;
      }
      if (!finalBases.has(base) && !/\.svg/i.test(img)) {
        finalBases.add(base);
        finalImages.push(img);
      }
    }
    productInfo.images = finalImages.slice(0, 10);

    console.log('=== FINAL EXTRACTION RESULT ===');
    console.log('Main product images:', productInfo.images.length);
    console.log('Colors with images:', productInfo.colors.filter((c: any) => c.image_url).length, '/', productInfo.colors.length);
    console.log('Options with images:', productInfo.options.filter((o: any) => o.image_url).length, '/', productInfo.options.length);
    console.log('Features:', productInfo.features.length);
    console.log('Variant images excluded:', variantImageUrls.size);

    return new Response(
      JSON.stringify({
        success: true,
        productInfo,
        platform,
        item_id: itemId
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
