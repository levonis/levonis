import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, existingColors } = await req.json();
    
    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Re-extracting colors from:', url);
    console.log('Existing colors count:', existingColors?.length || 0);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the webpage
    const pageResponse = await fetch(url);
    if (!pageResponse.ok) {
      throw new Error(`Failed to fetch page: ${pageResponse.statusText}`);
    }

    const html = await pageResponse.text();
    
    // Extract all image URLs and alt texts
    const imageUrls: string[] = [];
    const altTexts: string[] = [];
    const altSrcPairs: Array<{ alt: string; src: string }> = [];

    const imgTagRegex = /<img[^>]*>/gi;
    let tagMatch;
    while ((tagMatch = imgTagRegex.exec(html)) !== null) {
      const tag = tagMatch[0];
      const srcMatch = tag.match(/src=["']([^"']+)["']/i);
      const dataSrcMatch = tag.match(/data-src=["']([^"']+)["']/i);
      const srcsetMatch = tag.match(/srcset=["']([^"']+)["']/i);
      const altMatch = tag.match(/alt=["']([^"']+)["']/i);

      const pushUrl = (u?: string | null) => {
        if (!u) return;
        if (u.startsWith('http') && !u.includes('icon') && !u.includes('logo')) {
          imageUrls.push(u);
        }
      };

      const src = srcMatch?.[1] || dataSrcMatch?.[1] || null;
      const alt = altMatch?.[1] || null;

      if (src && alt) {
        altSrcPairs.push({ alt, src });
      }

      pushUrl(src);
      if (srcsetMatch?.[1]) {
        const candidates = srcsetMatch[1].split(',').map(s => s.trim().split(' ')[0]);
        for (const c of candidates) pushUrl(c);
      }
      if (altMatch?.[1]) altTexts.push(altMatch[1]);
    }

    // Extract color candidates from HTML
    const uniqueColorCandidates = new Set<string>();
    const dataColorRegex = /data-color=["']([^"']+)["']/gi;
    let dcMatch;
    while ((dcMatch = dataColorRegex.exec(html)) !== null) {
      uniqueColorCandidates.add(dcMatch[1]);
    }

    const ariaLabelRegex = /aria-label=["']([^"']*color[^"']*)["']/gi;
    let alMatch;
    while ((alMatch = ariaLabelRegex.exec(html)) !== null) {
      uniqueColorCandidates.add(alMatch[1]);
    }

    const selectOptionsRegex = /<option[^>]*>([^<]*color[^<]*)<\/option>/gi;
    let soMatch;
    while ((soMatch = selectOptionsRegex.exec(html)) !== null) {
      uniqueColorCandidates.add(soMatch[1].trim());
    }

    // Extract from script blocks
    const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let scriptMatch;
    const variantsData: any[] = [];
    while ((scriptMatch = scriptRegex.exec(html)) !== null) {
      const scriptContent = scriptMatch[1];
      try {
        const variantMatch = scriptContent.match(/variants?\s*:\s*(\[[^\]]+\])/i);
        if (variantMatch) {
          const parsed = JSON.parse(variantMatch[1]);
          variantsData.push(...parsed);
        }
      } catch {}
    }

    for (const v of variantsData) {
      if (v.option1) uniqueColorCandidates.add(v.option1);
      if (v.option2) uniqueColorCandidates.add(v.option2);
      if (v.title) uniqueColorCandidates.add(v.title);
    }

    // Extract color names from image filenames
    const colorNamesFromImages = new Set<string>();
    for (const imgUrl of imageUrls) {
      const filename = imgUrl.split('/').pop()?.split('?')[0] || '';
      const nameMatch = filename.match(/([A-Za-z-_]+)/g);
      if (nameMatch) {
        for (const part of nameMatch) {
          if (part.length > 3 && !['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(part.toLowerCase())) {
            colorNamesFromImages.add(part.replace(/-/g, ' ').replace(/_/g, ' '));
          }
        }
      }
    }

    // Combine all hints
    const combinedHints = [
      ...Array.from(uniqueColorCandidates),
      ...Array.from(colorNamesFromImages),
      ...altTexts.filter(a => /color|colour|matt|matte|gloss|shade/i.test(a))
    ];

    console.log('Found color hints:', combinedHints.length);

    // Get LOVABLE_API_KEY
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Prepare prompt for AI
    const prompt = `Extract ALL available color options from this product page. 
    
Previous extraction found ${existingColors?.length || 0} colors. Please extract ALL colors again to ensure none are missed.

Image URLs with ALT texts:
${altSrcPairs.slice(0, 100).map((p, i) => `${i + 1}. ${p.alt} -> ${p.src}`).join('\n')}

Color candidates from page:
${combinedHints.slice(0, 200).join(', ')}

IMPORTANT: 
- Extract EVERY single color variant available
- Include color name in English and Arabic
- Include the image URL for each color
- Extract hex color code if visible
- DO NOT STOP at 17 colors - extract ALL colors available

Return ONLY colors in this JSON format:
{
  "colors": [
    {
      "name": "Color Name in English",
      "name_ar": "اسم اللون بالعربية",
      "image_url": "full image URL",
      "hex_code": "#hexcode"
    }
  ]
}`;

    console.log('Calling AI for color extraction...');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are a product data extraction expert. Extract ALL color variants completely and accurately. Never stop at a limit - extract every single color available.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const extractedText = aiData.choices[0].message.content;

    console.log('AI response received');

    // Parse the extracted data
    const jsonMatch = extractedText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from AI response');
    }

    const extractedData = JSON.parse(jsonMatch[0]);
    const newColors = extractedData.colors || [];

    console.log('Extracted colors:', newColors.length);

    // Compare with existing colors to find new ones
    const existingColorNames = new Set(
      (existingColors || []).map((c: any) => c.name.toLowerCase())
    );

    const addedColors = newColors.filter(
      (c: any) => !existingColorNames.has(c.name.toLowerCase())
    );

    console.log('New colors found:', addedColors.length);

    // Upload new color images
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
              .upload(filename, arrayBuffer, {
                contentType: 'image/png',
                upsert: false
              });

            if (uploadError) {
              console.error('Upload error for color:', color.name, uploadError);
            } else {
              const { data: { publicUrl } } = supabase.storage
                .from('product-images')
                .getPublicUrl(filename);
              
              uploadedColors.push({
                ...color,
                image_url: publicUrl
              });
              console.log(`Color ${color.name} image uploaded`);
            }
          }
        } catch (error) {
          console.error('Error uploading color image:', error);
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
