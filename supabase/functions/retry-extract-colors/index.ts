import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Bambu Lab deterministic color-image parser
// Parses rendered HTML to find color swatches with names (including SKU codes)
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

  // Primary: Parse <li value="ColorName (SKU)"> with <img> inside
  const swatchPattern = /<li[^>]*value="([^"]+)"[^>]*class="[^"]*(?:rounded-full|color)[^"]*"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"[^>]*>[\s\S]*?<\/li>/gi;
  let swatchMatch;
  const seenNames = new Set<string>();
  
  while ((swatchMatch = swatchPattern.exec(html)) !== null) {
    const fullName = swatchMatch[1].trim();
    const swatchImageUrl = swatchMatch[2].trim();
    
    if (seenNames.has(fullName.toLowerCase())) continue;
    seenNames.add(fullName.toLowerCase());

    const nameLower = fullName.toLowerCase();
    let nameAr = fullName;
    for (const [key, ar] of Object.entries(bambuColorArMap)) {
      if (nameLower.includes(key)) {
        nameAr = (nameLower.includes('translucent') && key !== 'translucent') ? `شفاف ${ar}` : ar;
        break;
      }
    }

    let hexCode = '#808080';
    const matchStart = Math.max(0, swatchMatch.index - 500);
    const matchEnd = Math.min(html.length, swatchMatch.index + swatchMatch[0].length + 500);
    const nearbyHtml = html.substring(matchStart, matchEnd);
    const hexMatch = nearbyHtml.match(/background-color:\s*#([0-9a-fA-F]{6})/i);
    if (hexMatch) hexCode = '#' + hexMatch[1];

    const imageUrl = swatchImageUrl.startsWith('http') ? swatchImageUrl : null;
    colors.push({ name: fullName, name_ar: nameAr, hex_code: hexCode, image_url: imageUrl });
    console.log(`  Bambu swatch: ${fullName} -> ${imageUrl ? 'has image' : 'no image'}`);
  }

  // Fallback: spec table + JP images
  if (colors.length === 0) {
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
          nameAr = (nameLower.includes('translucent') && key !== 'translucent') ? `شفاف ${ar}` : ar;
          break;
        }
      }
      colors.push({ name, name_ar: nameAr, hex_code: hex, image_url: imageUrl });
    }
  }

  console.log('Bambu parser: found', colors.length, 'colors total');
  return colors;
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
      let bambuColors = parseBambuLabColors(html);
      
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
                bambuColors = parseBambuLabColors(renderedHtml);
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
