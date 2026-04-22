import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Bambu Lab unified parser — extracts colors AND non-color options from <li value="..."> blocks.
// Color = <li> with <img src="store.bblcdn.com/...png">, Option = text-only <li>.

const bambuBaseColorMap: Record<string, string> = {
  'gray': 'رمادي', 'grey': 'رمادي', 'blue': 'أزرق', 'olive': 'زيتي', 'brown': 'بني',
  'teal': 'أزرق مخضر', 'orange': 'برتقالي', 'purple': 'بنفسجي', 'pink': 'وردي',
  'red': 'أحمر', 'green': 'أخضر', 'yellow': 'أصفر', 'white': 'أبيض',
  'black': 'أسود', 'gold': 'ذهبي', 'silver': 'فضي', 'jade': 'أخضر يشمي',
  'translucent': 'شفاف', 'clear': 'شفاف', 'champagne': 'شمبانيا', 'mint': 'نعناعي',
  'cream': 'كريمي', 'beige': 'بيج', 'ivory': 'عاجي', 'cyan': 'سماوي',
  'magenta': 'ماجنتا', 'bronze': 'برونزي', 'copper': 'نحاسي', 'candy': 'كاندي',
};
const bambuQualifierMap: Array<[string, string]> = [
  ['rose gold', 'وردي ذهبي'], ['baby blue', 'أزرق فاتح'], ['light blue', 'أزرق فاتح'],
  ['dark blue', 'أزرق غامق'], ['sky blue', 'أزرق سماوي'], ['light gray', 'رمادي فاتح'],
  ['light grey', 'رمادي فاتح'], ['dark gray', 'رمادي غامق'], ['dark grey', 'رمادي غامق'],
  ['titan gray', 'رمادي تيتانيوم'], ['titan grey', 'رمادي تيتانيوم'], ['hot pink', 'وردي فاقع'],
  ['matte black', 'أسود مطفي'], ['matte white', 'أبيض مطفي'], ['mint green', 'أخضر نعناعي'],
  ['forest green', 'أخضر غابات'], ['lime green', 'أخضر ليموني'], ['blood red', 'أحمر دموي'],
  ['wine red', 'أحمر نبيذي'], ['candy red', 'أحمر كاندي'], ['candy green', 'أخضر كاندي'],
];
const bambuOptionArMap: Record<string, string> = {
  'refill': 'إعادة تعبئة', 'standard': 'قياسي', 'filament with spool': 'خيط مع بكرة',
  'with spool': 'مع بكرة', 'without spool': 'بدون بكرة',
  '1 kg': '1 كغم', '500 g': '500 غم', '250 g': '250 غم',
  '0.2 mm': '0.2 ملم', '0.4 mm': '0.4 ملم', '0.6 mm': '0.6 ملم', '0.8 mm': '0.8 ملم',
};
function translateBambuColorName(name: string): string {
  const skuMatch = name.match(/\s*(\([^)]+\))\s*$/);
  const sku = skuMatch ? ` ${skuMatch[1]}` : '';
  const baseName = skuMatch ? name.slice(0, skuMatch.index).trim() : name.trim();
  const lower = baseName.toLowerCase();
  for (const [key, ar] of bambuQualifierMap) if (lower.includes(key)) return `${ar}${sku}`;
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
  for (const [key, ar] of Object.entries(bambuOptionArMap)) if (lower.includes(key)) return ar;
  return name;
}

const swatchHexCache = new Map<string, string | null>();
async function sampleSwatchColor(imageUrl: string): Promise<string | null> {
  if (swatchHexCache.has(imageUrl)) return swatchHexCache.get(imageUrl)!;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const resp = await fetch(imageUrl, { signal: ctrl.signal });
    clearTimeout(t);
    if (!resp.ok) { swatchHexCache.set(imageUrl, null); return null; }
    const buf = new Uint8Array(await resp.arrayBuffer());
    if (buf.length < 100 || buf.length > 4_000_000) { swatchHexCache.set(imageUrl, null); return null; }
    const { decode } = await import('https://deno.land/x/imagescript@1.2.17/mod.ts');
    const img: any = await decode(buf);
    if (!img || !img.bitmap) { swatchHexCache.set(imageUrl, null); return null; }
    const w = img.width, h = img.height;
    const stepX = Math.max(1, Math.floor(w / 32));
    const stepY = Math.max(1, Math.floor(h / 32));
    // Two-pass histogram: first ignore near-white/near-black/transparent (matte),
    // then re-sample without those filters if pass 1 yielded nothing — this handles
    // pure white / pure black swatches (e.g. White (13110)).
    const sample = (allowExtremes: boolean) => {
      const counts = new Map<number, [number, number, number, number]>();
      for (let y = 0; y < h; y += stepY) {
        for (let x = 0; x < w; x += stepX) {
          const px = img.getPixelAt(x + 1, y + 1);
          const r = (px >>> 24) & 0xff, g = (px >>> 16) & 0xff, b = (px >>> 8) & 0xff, a = px & 0xff;
          if (a < 64) continue;
          if (!allowExtremes) {
            if (r > 245 && g > 245 && b > 245) continue;
            if (r < 12 && g < 12 && b < 12) continue;
          }
          const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
          const cur = counts.get(key);
          if (cur) { cur[0] += r; cur[1] += g; cur[2] += b; cur[3] += 1; }
          else counts.set(key, [r, g, b, 1]);
        }
      }
      return counts;
    };
    let counts = sample(false);
    if (counts.size === 0) counts = sample(true);
    if (counts.size === 0) { swatchHexCache.set(imageUrl, null); return null; }
    let best: [number, number, number, number] | null = null;
    for (const v of counts.values()) if (!best || v[3] > best[3]) best = v;
    if (!best) { swatchHexCache.set(imageUrl, null); return null; }
    const r = Math.round(best[0] / best[3]), g = Math.round(best[1] / best[3]), b = Math.round(best[2] / best[3]);
    const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
    swatchHexCache.set(imageUrl, hex);
    return hex;
  } catch { swatchHexCache.set(imageUrl, null); return null; }
}

// Normalize a variant name for reliable matching across pages.
// Rules:
//  1) Decode common HTML entities (&amp; &#39; &quot; &nbsp; numeric entities).
//  2) Unescape JSON-encoded sequences (\u00xx, \/, \").
//  3) Strip zero-width chars and the BOM.
//  4) Replace NBSP and any whitespace run with a single ASCII space.
//  5) Collapse spaces around parentheses/hyphens so "Red ( 13100 )" === "Red(13100)".
//  6) Lowercase + trim for the lookup key.
export function normalizeVariantName(input: string): string {
  if (!input) return '';
  let s = String(input);
  // JSON unicode escapes
  s = s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  // JSON slash/quote escapes
  s = s.replace(/\\\//g, '/').replace(/\\"/g, '"').replace(/\\'/g, "'");
  // Numeric HTML entities
  s = s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
  s = s.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  // Named HTML entities (common set)
  const named: Record<string, string> = {
    '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>',
    '&nbsp;': ' ', '&ndash;': '-', '&mdash;': '-', '&hellip;': '…',
  };
  s = s.replace(/&[a-zA-Z]+;/g, (m) => named[m.toLowerCase()] ?? m);
  // Zero-width chars + BOM
  s = s.replace(/[\u200B-\u200D\uFEFF]/g, '');
  // NBSP and any whitespace run -> single space
  s = s.replace(/[\u00A0\s]+/g, ' ');
  // Tighten spacing around () and -
  s = s.replace(/\s*\(\s*/g, '(').replace(/\s*\)\s*/g, ')');
  s = s.replace(/\s*-\s*/g, '-');
  return s.trim().toLowerCase();
}

// Build a map of variant name -> main product image by scanning RSC/JSON payloads
// for objects that pair "propertyValue" with an image-bearing key.
export function buildBambuVariantImageMap(html: string): Map<string, string> {
  const map = new Map<string, string>();
  // Bambu's RSC stream embeds JSON either as plain JSON or escaped (\"...\").
  // For each shape we look for "propertyValue" paired with an image-bearing key.
  // Image keys observed in the wild: imageUrl, mainImage, productImage, picUrl,
  // image, AND colorUrl (used for the per-color hero image on filament pages).
  const IMG_KEYS = '(?:imageUrl|mainImage|productImage|picUrl|image|colorUrl)';
  const patterns = [
    new RegExp(`"propertyValue"\\s*:\\s*"([^"]+)"[^{}]{0,800}?"${IMG_KEYS}"\\s*:\\s*"([^"]+)"`, 'gi'),
    new RegExp(`"${IMG_KEYS}"\\s*:\\s*"([^"]+)"[^{}]{0,800}?"propertyValue"\\s*:\\s*"([^"]+)"`, 'gi'),
    // Escaped JSON inside RSC stream
    new RegExp(`\\\\"propertyValue\\\\"\\s*:\\s*\\\\"([^\\\\"]+)\\\\"[^{}]{0,800}?\\\\"${IMG_KEYS}\\\\"\\s*:\\s*\\\\"([^\\\\"]+)\\\\"`, 'gi'),
    new RegExp(`\\\\"${IMG_KEYS}\\\\"\\s*:\\s*\\\\"([^\\\\"]+)\\\\"[^{}]{0,800}?\\\\"propertyValue\\\\"\\s*:\\s*\\\\"([^\\\\"]+)\\\\"`, 'gi'),
  ];
  const nameFirst = [true, false, true, false];
  for (let p = 0; p < patterns.length; p++) {
    const re = patterns[p];
    let mm: RegExpExecArray | null;
    while ((mm = re.exec(html)) !== null) {
      const rawName = nameFirst[p] ? mm[1] : mm[2];
      let url = (nameFirst[p] ? mm[2] : mm[1]).trim().replace(/\\\//g, '/');
      const key = normalizeVariantName(rawName);
      if (!key || !url) continue;
      if (url === 'null' || url.length < 4) continue;
      if (url.startsWith('//')) url = 'https:' + url;
      if (/\/swatch\//i.test(url) || /-swatch[\.-]/i.test(url)) continue;
      if (!/^https?:\/\//i.test(url)) continue;
      if (!map.has(key)) map.set(key, url);
    }
  }
  return map;
}

export async function parseBambuLabUnified(html: string): Promise<{
  colors: Array<{ name: string; name_ar: string; hex_code: string | null; image_url: string | null }>;
  options: Array<{ name: string; name_ar: string; image_url: string | null }>;
}> {
  const colors: any[] = [], options: any[] = [];
  const seenC = new Set<string>(), seenO = new Set<string>();
  const jobs: Array<{ idx: number; url: string }> = [];
  const variantImages = buildBambuVariantImageMap(html);
  const liPattern = /<li\s+[^>]*\bvalue="([^"]+)"[^>]*>([\s\S]*?)<\/li>/gi;
  let m: RegExpExecArray | null;
  while ((m = liPattern.exec(html)) !== null) {
    const rawName = m[1].trim();
    if (!rawName || rawName.length > 80 || /^\d+$/.test(rawName)) continue;
    const imgMatch = m[2].match(/<img[^>]*\bsrc="([^"]+)"/i);
    const looksLikeColor = !!imgMatch && /store\.bblcdn\.com/i.test(imgMatch[1]);
    const key = normalizeVariantName(rawName);
    if (looksLikeColor) {
      if (seenC.has(key)) continue;
      seenC.add(key);
      let swatchUrl = imgMatch![1].trim();
      if (swatchUrl.startsWith('//')) swatchUrl = 'https:' + swatchUrl;
      // Prefer the variant's main product image; fall back to swatch only if no main image is available.
      const productImg = variantImages.get(key) || null;
      const usedFallback = !productImg;
      const finalImg = productImg || (swatchUrl.startsWith('http') ? swatchUrl : null);
      console.log(
        `[retry-extract-colors] variant matched | propertyValue="${rawName}" | key="${key}" | productImage=${productImg ?? 'NONE'} | swatch=${swatchUrl} | finalImage=${finalImg ?? 'NONE'} | swatchFallback=${usedFallback}`
      );
      const idx = colors.length;
      colors.push({ name: rawName, name_ar: translateBambuColorName(rawName), hex_code: null, image_url: finalImg });
      // Always sample hex from the swatch (more accurate than the full product photo)
      if (swatchUrl.startsWith('http')) jobs.push({ idx, url: swatchUrl });
    } else {
      if (seenO.has(key)) continue;
      seenO.add(key);
      if (/^\$|^¥|^€|^د\.ع/i.test(rawName)) continue;
      const productImg = variantImages.get(key) || null;
      options.push({ name: rawName, name_ar: translateBambuOption(rawName), image_url: productImg });
    }
  }
  if (jobs.length > 0) {
    const sampled = await Promise.all(jobs.map(j => sampleSwatchColor(j.url)));
    jobs.forEach((j, i) => { if (sampled[i]) colors[j.idx].hex_code = sampled[i]; });
  }
  const fallbackCount = colors.filter((c) => {
    const productImg = variantImages.get(normalizeVariantName(c.name));
    return !productImg && !!c.image_url;
  }).length;
  console.log(
    `[retry-extract-colors] Bambu unified parser: ${colors.length} colors (${variantImages.size} variant images mapped, ${fallbackCount} used swatch fallback), ${options.length} options`
  );
  return { colors, options };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (roleError || !roleData) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { url, existingColors } = await req.json();

    // Detect if Bambu Lab
    const isBambuLab = url.toLowerCase().includes('bambulab.com');

    // Fetch the webpage
    const pageResponse = await fetch(url);
    if (!pageResponse.ok) {
      throw new Error(`Failed to fetch page: ${pageResponse.statusText}`);
    }
    const html = await pageResponse.text();

    // ===== Try Bambu Lab deterministic parser =====
    if (isBambuLab) {
      // First try raw HTML
      let bambuParsed = await parseBambuLabUnified(html);
      let bambuColors = bambuParsed.colors;

      // If raw HTML has no swatch data, try Firecrawl for rendered HTML
      if (bambuColors.length === 0) {
        console.log('Bambu parser found 0 in raw HTML, trying Firecrawl...');
        const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
        if (firecrawlKey) {
          try {
            const fcResp = await fetch('https://api.firecrawl.dev/v1/scrape', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${firecrawlKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ url, formats: ['html'], waitFor: 5000 }),
            });
            if (fcResp.ok) {
              const fcData = await fcResp.json();
              const renderedHtml = fcData.data?.html || fcData.html || '';
              console.log('Firecrawl returned HTML length:', renderedHtml.length);
              if (renderedHtml.length > 1000) {
                bambuParsed = await parseBambuLabUnified(renderedHtml);
                bambuColors = bambuParsed.colors;
              }
            }
          } catch (e) {
            console.error('Firecrawl error:', e);
          }
        }
      }

      if (bambuColors.length > 0) {
        console.log('Bambu Lab parser found', bambuColors.length, 'colors — using deterministic results');

        // Upload images
        const uploadedColors = [];
        for (const color of bambuColors) {
          if (color.image_url && color.image_url.startsWith('http')) {
            try {
              const imgResp = await fetch(color.image_url);
              if (imgResp.ok) {
                const blob = await imgResp.blob();
                const arrayBuffer = await blob.arrayBuffer();
                const timestamp = Date.now();
                const filename = `color-${color.name.replace(/\s+/g, '-').toLowerCase()}-${timestamp}.png`;
                
                const { data: uploadData, error: uploadError } = await supabase.storage
                  .from('product-images')
                  .upload(filename, arrayBuffer, { contentType: 'image/png', upsert: false });

                if (!uploadError) {
                  const { data: { publicUrl } } = supabase.storage
                    .from('product-images')
                    .getPublicUrl(filename);
                  uploadedColors.push({ ...color, image_url: publicUrl });
                } else {
                  uploadedColors.push(color);
                }
              } else {
                uploadedColors.push(color);
              }
            } catch (error) {
              console.error('Error uploading:', error);
              uploadedColors.push(color);
            }
          } else {
            uploadedColors.push(color);
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            totalColors: uploadedColors.length,
            existingColors: existingColors?.length || 0,
            newColorsCount: uploadedColors.length,
            addedColors: uploadedColors,
            mode: 'replace'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ===== Fallback: AI-based extraction for non-Bambu or if parser found nothing =====
    let nextDataContent = '';
    try {
      const nextMatch = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
      if (nextMatch) {
        nextDataContent = nextMatch[1].substring(0, 30000);
        console.log('Found __NEXT_DATA__ in page');
      }
    } catch {}

    const imageUrls: string[] = [];
    const altTexts: string[] = [];
    const altSrcPairs: Array<{ alt: string; src: string }> = [];

    const imgTagRegex = /<img[^>]*>/gi;
    let tagMatch;
    while ((tagMatch = imgTagRegex.exec(html)) !== null) {
      const tag = tagMatch[0];
      const srcMatch = tag.match(/src=["']([^"']+)["']/i);
      const dataSrcMatch = tag.match(/data-src=["']([^"']+)["']/i);
      const altMatch = tag.match(/alt=["']([^"']+)["']/i);

      const src = srcMatch?.[1] || dataSrcMatch?.[1] || null;
      const alt = altMatch?.[1] || null;

      if (src && alt) altSrcPairs.push({ alt, src });
      if (src?.startsWith('http') && !src.includes('icon') && !src.includes('logo')) {
        imageUrls.push(src);
      }
      if (alt) altTexts.push(alt);
    }

    const uniqueColorCandidates = new Set<string>();
    const dataColorRegex = /data-color=["']([^"']+)["']/gi;
    let dcMatch;
    while ((dcMatch = dataColorRegex.exec(html)) !== null) {
      uniqueColorCandidates.add(dcMatch[1]);
    }

    const combinedHints = [...Array.from(uniqueColorCandidates)];

    const isJsRendered = html.includes('__next') || html.includes('__NEXT_DATA__');

    let firecrawlHtml = '';
    if (combinedHints.length === 0 && isJsRendered) {
      const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
      if (firecrawlKey) {
        console.log('Using Firecrawl for JS-rendered site...');
        try {
          const fcResp = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${firecrawlKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url, formats: ['html'], waitFor: 3000 }),
          });
          if (fcResp.ok) {
            const fcData = await fcResp.json();
            firecrawlHtml = fcData.data?.html || fcData.html || '';
          }
        } catch (e) {
          console.error('Firecrawl error:', e);
        }
      }
    }

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const contentForAi = firecrawlHtml.length > 1000 ? firecrawlHtml.substring(0, 80000) : '';
    
    const prompt = `Extract ALL available color options from this product page. 
    
Product URL: ${url}
${isJsRendered ? '\n⚠️ This is a JavaScript-rendered site.\n' : ''}

${contentForAi ? `Fully rendered HTML:\n${contentForAi}\n` : ''}
Image URLs with ALT texts:
${altSrcPairs.slice(0, 200).map((p, i) => `${i + 1}. ${p.alt} -> ${p.src}`).join('\n')}

${nextDataContent ? `\n__NEXT_DATA__:\n${nextDataContent}\n` : ''}
IMPORTANT: 
- Extract EVERY color variant
- Include color name in English and Arabic
- For hex_code: extract EXACT hex from CSS or swatch elements
- For image_url: ONLY use URLs that exist in the HTML — do NOT hallucinate
- If no image can be definitively linked to a color, set image_url to null

Return ONLY JSON:
{
  "colors": [{"name": "Color Name", "name_ar": "الاسم", "image_url": "url or null", "hex_code": "#hexcode"}]
}`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Extract ALL color variants completely. Never hallucinate image URLs.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 16000,
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const extractedText = aiData.choices[0].message.content;

    const jsonMatch = extractedText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Failed to extract JSON from AI response');

    const extractedData = JSON.parse(jsonMatch[0]);
    const newColors = extractedData.colors || [];

    // Validate image URLs
    const sourceHtml = firecrawlHtml || html;
    const allUrlsInSource = new Set<string>();
    const sourceUrlRegex = /https?:\/\/[^\s"'<>]+/gi;
    let sourceUrlMatch;
    while ((sourceUrlMatch = sourceUrlRegex.exec(sourceHtml)) !== null) {
      allUrlsInSource.add(sourceUrlMatch[0].split('?')[0]);
    }
    for (const c of newColors) {
      if (c.image_url) {
        const baseUrl = c.image_url.split('?')[0];
        if (!allUrlsInSource.has(baseUrl)) {
          console.log('Removed hallucinated image for:', c.name);
          c.image_url = null;
        }
      }
    }

    // Find new colors not in existing
    const existingColorNames = new Set(
      (existingColors || []).map((c: any) => c.name.toLowerCase())
    );

    const addedColors = newColors.filter(
      (c: any) => !existingColorNames.has(c.name.toLowerCase())
    );

    // Upload images
    const uploadedColors = [];
    for (const color of addedColors) {
      if (color.image_url && color.image_url.startsWith('http')) {
        try {
          const imgResp = await fetch(color.image_url);
          if (imgResp.ok) {
            const blob = await imgResp.blob();
            const arrayBuffer = await blob.arrayBuffer();
            const timestamp = Date.now();
            const filename = `color-${color.name.replace(/\s+/g, '-').toLowerCase()}-${timestamp}.png`;
            
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('product-images')
              .upload(filename, arrayBuffer, { contentType: 'image/png', upsert: false });

            if (!uploadError) {
              const { data: { publicUrl } } = supabase.storage
                .from('product-images')
                .getPublicUrl(filename);
              uploadedColors.push({ ...color, image_url: publicUrl });
            } else {
              uploadedColors.push(color);
            }
          } else {
            uploadedColors.push(color);
          }
        } catch {
          uploadedColors.push(color);
        }
      } else {
        uploadedColors.push(color);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        totalColors: newColors.length,
        existingColors: existingColors?.length || 0,
        newColorsCount: uploadedColors.length,
        addedColors: uploadedColors
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in retry-extract-colors:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
