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
    // Verify admin authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client for storage uploads
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is admin using the JWT token
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

    // Check if user has admin role
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

    const { url } = await req.json();

    // Fetch the webpage content
    const pageResponse = await fetch(url);
    if (!pageResponse.ok) {
      throw new Error(`Failed to fetch page: ${pageResponse.statusText}`);
    }

    const html = await pageResponse.text();
    console.log('Page fetched successfully, length:', html.length);

    // Extract text content from HTML with better content targeting
    let textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Prioritize main content area if it exists
    const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    const productMatch = html.match(/<div[^>]*class="[^"]*product[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    
    if (mainMatch || articleMatch || productMatch) {
      const matchContent = (mainMatch || articleMatch || productMatch)!;
      const priorityContent = matchContent[1];
      const cleanPriority = priorityContent
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      textContent = cleanPriority + ' ' + textContent;
    }
    
    // Increase limit to capture more content
    textContent = textContent.substring(0, 40000);

    // Extract image URLs and ALT texts from HTML (enhanced extraction)
    const imageUrls: string[] = [];
    const altTexts: string[] = [];

    // Helper to validate and normalize image URLs
    const isValidImageUrl = (u: string | null | undefined): boolean => {
      if (!u) return false;
      const lower = u.toLowerCase();
      // Skip tiny icons, logos, tracking pixels, and placeholder images
      if (lower.includes('icon') || lower.includes('logo') || lower.includes('pixel') ||
          lower.includes('tracking') || lower.includes('placeholder') || lower.includes('blank') ||
          lower.includes('spacer') || lower.includes('1x1') || lower.includes('loading')) {
        return false;
      }
      // Must be a valid HTTP(S) URL or protocol-relative URL
      return u.startsWith('http') || u.startsWith('//');
    };

    const normalizeUrl = (u: string, baseUrl: string): string => {
      if (u.startsWith('//')) {
        return 'https:' + u;
      }
      if (u.startsWith('/') && !u.startsWith('//')) {
        try {
          const urlObj = new URL(baseUrl);
          return urlObj.origin + u;
        } catch {
          return u;
        }
      }
      return u;
    };

    const pushUrl = (u?: string | null) => {
      if (!u) return;
      const normalized = normalizeUrl(u, url);
      if (isValidImageUrl(normalized)) {
        // Extract the highest resolution from srcset-style URLs
        const cleaned = normalized.split(' ')[0];
        if (!imageUrls.includes(cleaned)) {
          imageUrls.push(cleaned);
        }
      }
    };

    // Method 1: Standard <img> tags
    const imgTagRegex = /<img[^>]*>/gi;
    let tagMatch;
    while ((tagMatch = imgTagRegex.exec(html)) !== null) {
      const tag = tagMatch[0];

      // Multiple source attributes in priority order
      const srcMatch = tag.match(/src=["']([^"']+)["']/i);
      const dataSrcMatch = tag.match(/data-src=["']([^"']+)["']/i);
      const dataLazySrcMatch = tag.match(/data-lazy-src=["']([^"']+)["']/i);
      const dataOriginalMatch = tag.match(/data-original=["']([^"']+)["']/i);
      const dataZoomMatch = tag.match(/data-zoom-image=["']([^"']+)["']/i);
      const dataLargeMatch = tag.match(/data-large[_-]?image=["']([^"']+)["']/i);
      const srcsetMatch = tag.match(/srcset=["']([^"']+)["']/i);
      const altMatch = tag.match(/alt=["']([^"']+)["']/i);

      // Prefer high-res sources
      pushUrl(dataZoomMatch?.[1]);
      pushUrl(dataLargeMatch?.[1]);
      pushUrl(dataOriginalMatch?.[1]);
      pushUrl(dataSrcMatch?.[1]);
      pushUrl(dataLazySrcMatch?.[1]);
      pushUrl(srcMatch?.[1]);

      // Extract all srcset candidates and pick highest resolution
      if (srcsetMatch?.[1]) {
        const candidates = srcsetMatch[1].split(',').map(s => {
          const parts = s.trim().split(/\s+/);
          const imgUrl = parts[0];
          const sizeStr = parts[1] || '0w';
          const size = parseInt(sizeStr.replace(/[wx]/i, '')) || 0;
          return { url: imgUrl, size };
        });
        // Sort by size descending to get highest resolution first
        candidates.sort((a, b) => b.size - a.size);
        for (const c of candidates) pushUrl(c.url);
      }

      if (altMatch?.[1]) {
        const alt = altMatch[1].trim();
        if (alt && alt.length > 1) altTexts.push(alt);
      }
    }

    // Method 2: <source> tags (picture elements)
    for (const sourceMatch of html.matchAll(/<source[^>]*>/gi)) {
      const tag = sourceMatch[0];
      const srcsetMatch = tag.match(/srcset=["']([^"']+)["']/i);
      if (srcsetMatch?.[1]) {
        const candidates = srcsetMatch[1].split(',').map(s => s.trim().split(/\s+/)[0]);
        for (const c of candidates) pushUrl(c);
      }
    }

    // Method 3: Background images in style attributes
    for (const bgMatch of html.matchAll(/style=["'][^"']*background(?:-image)?:\s*url\(['"]?([^'")]+)['"]?\)/gi)) {
      pushUrl(bgMatch[1]);
    }

    // Method 4: <a> tags with href pointing to images
    for (const aMatch of html.matchAll(/<a[^>]*href=["']([^"']+\.(?:jpg|jpeg|png|webp|gif)(?:\?[^"']*)?)[^"']*["'][^>]*>/gi)) {
      pushUrl(aMatch[1]);
    }

    // Method 5: JSON-LD structured data (common in e-commerce)
    for (const scriptMatch of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
      try {
        const jsonContent = scriptMatch[1];
        // Extract image URLs from JSON
        for (const imgMatch of jsonContent.matchAll(/"image"\s*:\s*(?:"([^"]+)"|\[([^\]]+)\])/gi)) {
          if (imgMatch[1]) pushUrl(imgMatch[1]);
          if (imgMatch[2]) {
            for (const urlMatch of imgMatch[2].matchAll(/"([^"]+)"/g)) {
              pushUrl(urlMatch[1]);
            }
          }
        }
      } catch (e) {
        console.warn('Error parsing JSON-LD:', e);
      }
    }

    // Method 6: Product image galleries (common patterns)
    for (const galleryMatch of html.matchAll(/data-(?:gallery|images|photos|media)=["']([^"']+)["']/gi)) {
      try {
        const decoded = decodeURIComponent(galleryMatch[1]);
        // Try parsing as JSON array
        if (decoded.startsWith('[')) {
          const urls = JSON.parse(decoded);
          if (Array.isArray(urls)) {
            for (const item of urls) {
              if (typeof item === 'string') pushUrl(item);
              else if (item?.src) pushUrl(item.src);
              else if (item?.url) pushUrl(item.url);
            }
          }
        }
      } catch (e) {
        // Not valid JSON, extract URLs directly
        for (const urlMatch of galleryMatch[1].matchAll(/https?:\/\/[^\s"',\]]+/gi)) {
          pushUrl(urlMatch[0]);
        }
      }
    }

    // Method 7: Extract from inline scripts (Shopify, WooCommerce, etc.)
    for (const scriptMatch of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)) {
      const content = scriptMatch[1] || '';
      // Product media/images in JSON
      for (const imgMatch of content.matchAll(/"(?:src|url|image|featured_image|original|zoom)"\s*:\s*"(https?:[^"]+(?:jpg|jpeg|png|webp|gif)[^"]*)"/gi)) {
        pushUrl(imgMatch[1]);
      }
      // Variant images
      for (const variantMatch of content.matchAll(/"variant_ids?"[\s\S]*?"featured_image"\s*:\s*\{[^}]*"src"\s*:\s*"([^"]+)"/gi)) {
        pushUrl(variantMatch[1]);
      }
    }

    console.log(`Image extraction complete: found ${imageUrls.length} unique images and ${altTexts.length} alt texts`);

    // Extract potential color names from the raw HTML and scripts to avoid missing variants
    const colorCandidates: string[] = [];

    // From HTML data attributes commonly used in color swatches
    for (const m of html.matchAll(/data-?color=["']([^"']+)["']/gi)) {
      colorCandidates.push(m[1].trim());
    }

    // From aria-labels that mention color
    for (const m of html.matchAll(/aria-label=["']([^"']*color[^"']*)["']/gi)) {
      colorCandidates.push(m[1].trim());
    }

    // From selects like <select name="Color"> ... </select>
    for (const sel of html.matchAll(/<select[^>]*name=["']color["'][^>]*>([\s\S]*?)<\/select>/gi)) {
      const optionsHtml = sel[1];
      for (const om of optionsHtml.matchAll(/<option[^>]*>([^<]+)<\/option>/gi)) {
        colorCandidates.push(om[1].trim());
      }
    }

    // From script blocks (Shopify/Next data) looking for Color option values and generic color keys
    for (const s of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)) {
      const content = s[1] || '';
      // Options: { name: "Color", values: [ ... ] }
      for (const block of content.matchAll(/"name"\s*:\s*"Color"[\s\S]*?"values"\s*:\s*\[([\s\S]*?)\]/gi)) {
        const vals = block[1];
        for (const val of vals.matchAll(/"([^"\\]+)"/g)) {
          colorCandidates.push(val[1].trim());
        }
      }
      // Variants option values like "option1": "Matte Ivory White"
      for (const m of content.matchAll(/"option\d"\s*:\s*"([^"\\]+)"/gi)) {
        const v = m[1].trim();
        if (v) colorCandidates.push(v);
      }
      // Generic key named "color": "..."
      for (const m of content.matchAll(/"color"\s*:\s*"([^"\\]+)"/gi)) {
        colorCandidates.push(m[1].trim());
      }
    }

    const uniqueColorCandidates = Array.from(new Set(colorCandidates.filter(c => c && c.length > 1))).slice(0, 300);

    console.log('Extracted text content length:', textContent.length, 'color candidates:', uniqueColorCandidates.length);

    // Prepare data for the AI prompt
    const unique = (arr: string[]) => Array.from(new Set(arr));
    const imageUrlsForPrompt = unique(imageUrls).slice(0, 200);
    const altTextsForPrompt = unique(altTexts || []).slice(0, 300);
    console.log(`Found ${imageUrlsForPrompt.length} image URLs and ${altTextsForPrompt.length} alt texts for prompt`);

    // Call Lovable AI to extract product information
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        temperature: 0.3,
        max_tokens: 16000,
        messages: [
          {
            role: 'system',
            content: `أنت مساعد ذكاء اصطناعي متخصص في استخراج معلومات المنتجات من صفحات الويب بدقة عالية جداً.

مهمتك الأساسية:
1. استخراج **جميع** المعلومات المتعلقة بالمنتج بدقة متناهية - لا تفوت أي معلومة
2. ترجمة المعلومات للعربية بشكل احترافي ودقيق (يجب أن تكون الترجمة طبيعية وليست حرفية)
3. فصل الأحجام/الخيارات عن الألوان بشكل واضح ومنطقي
4. تحديد بدقة ما إذا كانت الصورة تابعة للون أم لخيار/حجم
5. تحليل صور الألوان واستخراج درجة اللون الدقيقة (hex code) من الصورة نفسها
6. التأكد من صحة جميع الروابط والمعلومات المستخرجة

⚠️ **قواعد حرجة يجب اتباعها:**
- لا تستخرج معلومات السعر نهائياً تحت أي ظرف
- كن دقيقاً ومتسقاً في استخراج المعلومات - يجب أن تكون النتائج متطابقة في كل مرة
- الأحجام/الخيارات: يجب استخراج الاسم الكامل مع جميع الأرقام والتفاصيل (مثل: "X1C AMS 2 Pro Combo" وليس "Combo"، "1kg Refill Spool" وليس "Refill")
- **الألوان - مهم جداً**: يجب استخراج **جميع** الألوان المتوفرة بدون استثناء أو اختصار. اقرأ الصفحة بالكامل وابحث عن كل لون مذكور
- **الألوان**: يجب استخراج الاسم الكامل للون مع جميع الصفات والأرقام (مثل: "Matte Ivory White" وليس "White"، "Bambu PLA Matte Lemon Yellow" وليس "Yellow")
- عند استخراج الألوان: قم بتحليل الصورة بدقة واستخراج اللون السائد الفعلي وحدد hex code دقيق له
- لا تخمن أو تفترض معلومات غير موجودة في الصفحة
- **لا تختصر أبداً**: إذا كان هناك 50 لوناً أو 100 لون، استخرج جميعها بالترتيب بدون توقف
- **لا تتوقف أو تستسلم**: استمر في القراءة والاستخراج حتى تجد وتضيف جميع الألوان المذكورة في الصفحة
- **خذ وقتك**: استخراج جميع الألوان أهم من السرعة - تأكد من عدم تفويت أي لون

📍 **استخراج الألوان - تعليمات خاصة ومهمة جداً:**
1. ابحث بعناية في **جميع** أقسام الصفحة عن أسماء الألوان
2. ابحث عن قوائم الألوان، خيارات الألوان، جداول الألوان، dropdowns، وأي عناصر تحتوي على ألوان
3. تأكد من استخراج **كل** لون مع اسمه الكامل وصورته وhex code
4. إذا وجدت قائمة ألوان طويلة (10، 20، 50 لون أو أكثر)، استخرج **جميع** العناصر فيها بالترتيب
5. راجع النتيجة **ثلاث مرات** وتأكد أنك لم تفوت أي لون
6. **مهم جداً**: لا تضع حد أقصى لعدد الألوان - استخرج كل ما تجده في الصفحة
7. إذا كانت القائمة طويلة جداً، خذ وقتك واستخرج كل لون بدقة متناهية

التمييز بين صور الألوان وصور الخيارات:
- صورة اللون: تُظهر نفس المنتج لكن بلون مختلف (نفس الشكل والتصميم، فقط اللون يختلف)
- صورة الخيار/الحجم: قد تُظهر نفس المنتج بزاوية مختلفة، أو نوع مختلف من القماش، أو أي تفاصيل أخرى غير اللون

مثال:
- إذا كان لديك قميص بألوان مختلفة (أحمر، أزرق، أخضر)، فكل لون له صورة تظهر القميص بهذا اللون → صور ألوان
- إذا كان لديك نفس القميص بأحجام مختلفة (S, M, L) وكل حجم له صورة خاصة → صور خيارات
- إذا كان المنتج متوفر بخامات مختلفة (قطن، حرير) وكل خامة لها صورة → صور خيارات

استخراج درجة اللون:
- انظر إلى الصورة وحدد اللون السائد في المنتج
- استخرج hex code دقيق يمثل هذا اللون (مثال: #FF0000 للأحمر، #0000FF للأزرق)
- إذا كان اللون غامق أو فاتح، اعكس ذلك في hex code

الصور: فقط صور المنتج الرئيسية (تجاهل الأيقونات والشعارات والإعلانات)

🎯 **أهم قاعدة**: يجب استخراج **جميع** الألوان المتوفرة مع الاسم الكامل والتفاصيل والأرقام - لا تفوت أي لون!`
          },
          {
            role: 'user',
            content: `استخرج معلومات المنتج من المحتوى التالي:

${textContent}

            الصور المتاحة في الصفحة:
            ${imageUrlsForPrompt.join('\n')}
            
            نصوص ALT للصور (قد تحتوي أسماء ألوان مهمة):
            ${altTextsForPrompt.join('\n')}
            
            قائمة الألوان المحتملة المستخرجة آلياً (تحقق من تضمينها بالكامل):
            ${uniqueColorCandidates.join('\n')}
            
            استخرج المعلومات التالية بدقة تامة واتساق كامل:

1. اسم المنتج:
   - بالعربية: ترجمة احترافية طبيعية (ليست حرفية)
   - بالإنجليزية: الاسم الأصلي من الصفحة

2. وصف المنتج:
   - بالعربية: ترجمة شاملة ومفصلة واحترافية لجميع التفاصيل

3. الأحجام/الخيارات:
   - استخرج فقط الخيارات المتوفرة فعلياً
   - يجب استخراج الاسم الكامل مع جميع الأرقام والتفاصيل (مثال: "X1C AMS 2 Pro Combo" وليس فقط "Combo")
   - أضف صورة لكل خيار إن وجدت (يجب أن تختلف في التفاصيل وليس اللون فقط)
   - أمثلة: "1kg Refill Spool", "X1C Combo", "Standard Bundle with Hub"

4. الألوان المتوفرة - **مهم جداً: استخرج جميع الألوان بدون استثناء**:
   🔴 **تنبيه حرج**: يجب استخراج **كل** لون موجود في الصفحة، حتى لو كان هناك 50 أو 100 لون أو أكثر!
   
   ⚠️ **قاعدة ذهبية**: إذا وجدت 50 لوناً في الصفحة، يجب استخراج جميع الـ 50 لوناً. لا تختصر أبداً!
   
   لكل لون يجب أن يحتوي على:
   - اسم اللون الكامل بالعربية مع جميع الصفات (مثال: "أبيض عاجي مطفأ" وليس فقط "أبيض")
   - اسم اللون الكامل بالإنجليزية من الصفحة (مثال: "Matte Ivory White" وليس فقط "White")
   - صورة واضحة تظهر المنتج بهذا اللون بالتحديد
   - hex code دقيق جداً مستخرج من تحليل الصورة (يطابق اللون الفعلي 100%)
   
   📋 **خطوات استخراج الألوان - اتبعها بدقة:**
   1. ابحث في **جميع أقسام الصفحة** عن أسماء الألوان
   2. اقرأ **جميع** أسماء الألوان المذكورة بدون استثناء
   3. **لا تتوقف أبداً** عند عدد معين - استمر حتى تستخرج كل الألوان
   4. إذا وجدت قائمة تحتوي على 50 لون أو أكثر، استخرج **جميع** العناصر فيها بالترتيب
   5. راجع النتيجة مرتين وتأكد أنك لم تفوت أي لون
   6. **لا تختصر القائمة** - إذا كانت طويلة، خذ وقتك واستخرج كل لون بدقة

5. المميزات والخصائص:
   - استخرج جميع المميزات المذكورة
   - ترجمها للعربية بشكل دقيق ومفهوم

6. الصور الرئيسية:
   - اختر أفضل 3-5 صور واضحة للمنتج
   - تأكد من جودتها العالية
   - تجنب الأيقونات والشعارات

مهم جداً - التمييز بين الصور:
- صور الألوان: يجب أن تُظهر نفس المنتج بلون مختلف فقط
- صور الخيارات: تُظهر المنتج بتفاصيل أو زوايا أو خامات مختلفة (وليس مجرد لون مختلف)
- إذا كانت الصفحة تحتوي فقط على ألوان، لا تضع أي شيء في الخيارات
- إذا كانت الصفحة تحتوي فقط على خيارات/أحجام، لا تضع أي شيء في الألوان

مهم جداً - استخراج درجة اللون:
- لكل لون، قم بتحليل صورة المنتج بهذا اللون
- استخرج hex code دقيق يمثل اللون السائد في المنتج (مثل: #FF0000، #1E90FF، #32CD32)
- تأكد من أن hex code يعكس الدرجة الفعلية للون (فاتح/غامق)`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_product_info",
              description: "استخراج معلومات المنتج من صفحة الويب بدقة وفصل الأحجام عن الألوان",
              parameters: {
                type: "object",
                properties: {
                  name_ar: { 
                    type: "string", 
                    description: "اسم المنتج بالعربية - ترجمة احترافية طبيعية وليست حرفية، يجب أن تكون واضحة ومفهومة" 
                  },
                  name: { 
                    type: "string", 
                    description: "اسم المنتج بالإنجليزية - الاسم الأصلي من الصفحة بالضبط" 
                  },
                  description_ar: { 
                    type: "string", 
                    description: "وصف تفصيلي وشامل للمنتج بالعربية - ترجمة احترافية كاملة لجميع التفاصيل المهمة، يجب أن تكون الترجمة طبيعية ومفهومة" 
                  },
                  images: {
                    type: "array",
                    items: { type: "string" },
                    description: "روابط الصور الرئيسية للمنتج فقط - اختر من 3 إلى 5 صور واضحة وعالية الجودة تظهر المنتج بشكل كامل. تجنب الأيقونات والشعارات والإعلانات"
                  },
                  sizes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "الحجم/الخيار بالإنجليزية - يجب استخراج الاسم الكامل مع جميع الأرقام والتفاصيل (أمثلة: 'X1C AMS 2 Pro Combo' وليس 'Combo'، '1kg Refill Spool' وليس 'Spool'، 'Standard Bundle with Hub' وليس 'Bundle')" },
                        name_ar: { type: "string", description: "الحجم/الخيار بالعربية - ترجمة كاملة لجميع التفاصيل (أمثلة: 'حزمة X1C AMS 2 Pro'، 'خيوط إعادة تعبئة 1 كيلوجرام'، 'حزمة قياسية مع موزع')" },
                        image_url: { type: "string", description: "رابط صورة خاصة بهذا الخيار/الحجم إن وجدت فقط - يجب أن تكون الصورة مختلفة في التفاصيل أو الزاوية أو الخامة وليس مجرد لون مختلف. إذا لم توجد صورة خاصة، لا تضع شيئاً" }
                      }
                    },
                    description: "جميع الأحجام/الخيارات المتوفرة للمنتج - منفصلة تماماً عن الألوان. يجب استخراج الاسم الكامل مع جميع التفاصيل والأرقام. استخدم هذا فقط للخيارات التي ليست ألواناً (مثل: أحجام، أوزان، خامات، أنواع، حزم). إذا لم توجد خيارات، أرجع مصفوفة فارغة []"
                  },
                  colors: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "اسم اللون الكامل بالإنجليزية مع جميع الصفات والأرقام - الاسم الأصلي من الصفحة (أمثلة: 'Matte Ivory White' وليس 'White'، 'Bambu PLA Matte Lemon Yellow' وليس 'Yellow'، 'Matte Dark Red' وليس 'Red')" },
                        name_ar: { type: "string", description: "اسم اللون الكامل بالعربية مع جميع الصفات - ترجمة كاملة طبيعية (أمثلة: 'أبيض عاجي مطفأ' وليس 'أبيض'، 'بامبو بي إل إيه أصفر ليموني مطفأ' وليس 'أصفر'، 'أحمر داكن مطفأ' وليس 'أحمر')" },
                        hex_code: { type: "string", description: "كود اللون hex مستخرج بدقة فائقة من تحليل الصورة - يجب أن يطابق بدقة 100% اللون الفعلي الظاهر في المنتج (وليس الخلفية). يجب أن يكون صالحاً ويبدأ بـ # ومكون من 6 أحرف (مثال: #FF0000 للأحمر الساطع، #8B0000 للأحمر الداكن، #FFB6C1 للوردي الفاتح، #1E90FF للأزرق الدودجر). احلل الصورة بعناية فائقة لاستخراج اللون الدقيق" },
                        image_url: { type: "string", description: "رابط صورة واضحة تظهر نفس المنتج بالضبط بهذا اللون المحدد - يجب أن يكون نفس الشكل والتصميم مع اختلاف اللون فقط (وليس اختلافات في التفاصيل أو الزاوية). استخدم هذه الصورة لاستخراج hex code الدقيق بتحليلها بعناية" }
                      }
                    },
                    description: "⚠️ **مهم جداً**: يجب استخراج **جميع** الألوان المتوفرة في الصفحة بدون استثناء - لا تتوقف عند عدد معين! ابحث في كل أقسام الصفحة عن قوائم الألوان واستخرج كل لون مذكور مع صورته ودرجة لون دقيقة. يجب استخراج الاسم الكامل للون مع جميع الصفات. استخدم هذا فقط للألوان الفعلية وليس للأحجام أو أي خيارات أخرى. كل لون يجب أن يكون له صورة واضحة و hex code دقيق. إذا لم توجد ألوان، أرجع مصفوفة فارغة []"
                  },
                  features: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        text: { type: "string", description: "نص الميزة بالإنجليزية - النص الأصلي من الصفحة" },
                        text_ar: { type: "string", description: "نص الميزة بالعربية - ترجمة طبيعية ودقيقة ومفهومة" },
                        icon: { 
                          type: "string", 
                          description: "اسم الأيقونة المناسبة للميزة من lucide-react. اختر من: Shield (الحماية/الضمان), Truck (الشحن/التوصيل), Star (التقييم/الجودة), Award (الجوائز/الإنجازات), Check (التحقق/الموافقة), CheckCircle (مؤكد), Zap (السرعة/الطاقة), Sparkles (الجديد/المميز), Cpu (المعالج/التقنية), Battery (البطارية), Wifi (الاتصال اللاسلكي), Smartphone (الهاتف), Monitor (الشاشة), Headphones (السماعات), Camera (الكاميرا), Music (الموسيقى), Video (الفيديو), Image (الصورة), Download (التحميل), Upload (الرفع), Rocket (السرعة/الابتكار), Flame (الشعبية/الحرارة), Gift (الهدايا), Crown (الفخامة/الملكية), Gem (القيمة/الثمين), Clock (الوقت), Timer (المؤقت), Globe (العالمية), Lock (الأمان), Key (المفتاح/الوصول), Settings (الإعدادات), Hammer (الأدوات/البناء), Lightbulb (الأفكار/الإضاءة), Sun (الضوء/النهار), Moon (الليل/الظلام), Cloud (السحابة), Droplet (الماء/السوائل), Wind (الهواء/التهوية), Leaf (البيئة/الطبيعة), Feather (الخفة/الوزن), Target (الهدف/الدقة), ThumbsUp (الإعجاب/الموافقة), Package (التغليف/المنتج)" 
                        }
                      }
                    },
                    description: "جميع مميزات وخصائص المنتج المذكورة بوضوح في الصفحة مع اختيار أيقونة مناسبة لكل ميزة. استخرج فقط المميزات الواضحة والمحددة واختر الأيقونة الأنسب"
                  }
                },
                required: ["name", "name_ar", "description_ar", "images", "sizes", "colors", "features"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_product_info" } }
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'تم تجاوز الحد المسموح من الطلبات. يرجى المحاولة لاحقاً.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'يرجى إضافة رصيد إلى حساب Lovable AI الخاص بك.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await aiResponse.text();
      console.error('AI Gateway error:', aiResponse.status, errorText);
      throw new Error('فشل في الاتصال بخدمة الذكاء الاصطناعي');
    }

    const aiData = await aiResponse.json();
    console.log('AI Response received');

    // Extract the tool call result
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error('لم يتم استخراج معلومات المنتج');
    }

    const productInfo = JSON.parse(toolCall.function.arguments);
    console.log('Extracted product info:', productInfo);

    // Helper function to upload images to Supabase storage with retry and verification
    const uploadImage = async (imageUrl: string, prefix: string, maxRetries: number = 3): Promise<string | null> => {
      let lastError: Error | null = null;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`[Upload] Attempt ${attempt}/${maxRetries} for: ${prefix}`);
          
          // Fetch the image with proper headers
          const imageResponse = await fetch(imageUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'image/*',
            },
          });
          
          if (!imageResponse.ok) {
            console.warn(`[Upload] Failed to fetch image (status ${imageResponse.status})`);
            lastError = new Error(`HTTP ${imageResponse.status}`);
            continue;
          }
          
          const imageBlob = await imageResponse.blob();
          
          // Check minimum size
          if (imageBlob.size < 100) {
            console.warn(`[Upload] Image too small (${imageBlob.size} bytes), skipping`);
            return null;
          }
          
          // Determine file extension from content type
          const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
          let fileExt = 'jpg';
          if (contentType.includes('png')) fileExt = 'png';
          else if (contentType.includes('webp')) fileExt = 'webp';
          else if (contentType.includes('gif')) fileExt = 'gif';
          
          // Generate unique filename with timestamp for tracking
          const timestamp = Date.now();
          const random = Math.random().toString().substring(2, 10);
          const fileName = `${prefix}-${timestamp}-${random}.${fileExt}`;
          
          console.log(`[Upload] Uploading: ${fileName} (${imageBlob.size} bytes)`);
          
          // Upload to Supabase storage
          const { error: uploadError } = await supabase.storage
            .from('product-images')
            .upload(fileName, imageBlob, {
              contentType: contentType,
              upsert: false
            });
          
          if (uploadError) {
            console.error(`[Upload] Storage error:`, uploadError.message);
            lastError = new Error(uploadError.message);
            continue;
          }
          
          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('product-images')
            .getPublicUrl(fileName);
          
          // Verify the upload by checking if file exists
          try {
            const verifyResponse = await fetch(publicUrl, { method: 'HEAD' });
            if (!verifyResponse.ok) {
              console.error(`[Upload] Verification failed for: ${fileName}`);
              // Clean up failed upload
              await supabase.storage.from('product-images').remove([fileName]);
              lastError = new Error('Verification failed');
              continue;
            }
            console.log(`[Upload] Verified successfully: ${fileName}`);
          } catch (verifyErr) {
            console.warn(`[Upload] Verification check failed, but file may exist: ${fileName}`);
          }
          
          return publicUrl;
          
        } catch (error) {
          console.error(`[Upload] Attempt ${attempt} error:`, error);
          lastError = error instanceof Error ? error : new Error(String(error));
          
          // Wait before retry with exponential backoff
          if (attempt < maxRetries) {
            const waitMs = Math.min(1000 * Math.pow(2, attempt - 1), 4000);
            await new Promise(resolve => setTimeout(resolve, waitMs));
          }
        }
      }
      
      console.error(`[Upload] All ${maxRetries} attempts failed for prefix: ${prefix}`);
      return null;
    };

    // Validate extracted data
    if (!productInfo.name || !productInfo.name_ar) {
      throw new Error('فشل في استخراج اسم المنتج');
    }

    // Augment missing colors using heuristics from HTML, scripts, ALT texts and image filenames
    try {
      const norm = (s: string) => s?.toLowerCase().replace(/\s+/g, ' ').trim() || '';
      const existingSet = new Set<string>(
        Array.isArray(productInfo.colors)
          ? productInfo.colors.map((c: any) => norm(c.name || c.name_ar))
          : []
      );

      // Build a map from variant color name -> image url from inline product JSON (e.g. Shopify/Next)
      const variantImageMap = new Map<string, string>();
      for (const s of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)) {
        const content = s[1] || '';
        for (const m of content.matchAll(/"variants"\s*:\s*\[([\s\S]*?)\]/gi)) {
          const block = m[1] || '';
          for (const v of block.matchAll(/"option\d"\s*:\s*"([^"\\]+)"[\s\S]*?(?:"featured_image"[\s\S]*?"src"|"featured_media"[\s\S]*?"src"|"image"|"src")\s*:\s*"([^"\\]+)"/gi)) {
            const name = v[1]?.trim();
            const url = v[2]?.trim();
            if (name && url && url.startsWith('http')) {
              variantImageMap.set(norm(name), url);
            }
          }
        }
      }

      // Pair alt text with src from <img alt=".." src="..">
      const altSrcPairs: Array<{ alt: string; src: string }> = [];
      for (const m of html.matchAll(/<img[^>]*alt=["']([^"']+)["'][^>]*src=["']([^"']+)["'][^>]*>/gi)) {
        const alt = m[1]?.trim();
        const src = m[2]?.trim();
        if (alt && src && src.startsWith('http')) altSrcPairs.push({ alt, src });
      }

      // Derive color-like names from image filenames (e.g., Matte-Desert-Tan.png)
      const colorNamesFromImages: string[] = Array.from(
        new Set(
          (imageUrls || [])
            .map((u) => {
              try {
                const fname = decodeURIComponent((u.split('/')?.pop() || '').split('.')[0]);
                return fname.replace(/[_-]+/g, ' ').trim();
              } catch {
                return null;
              }
            })
            .filter((n): n is string => !!n)
            .filter((n) =>
              /matte|gloss|satin|white|black|blue|green|red|yellow|orange|pink|purple|brown|grey|gray|tan|ivory|charcoal|beige|marine|navy|desert|dark|light/i.test(
                n
              )
            )
        )
      );

      // Colorish ALTs may contain missing variants
      const colorishAlts: string[] = Array.from(
        new Set((altTexts || []).filter((a) => /matte|gloss|satin|white|black|blue|green|red|yellow|orange|pink|purple|brown|grey|gray|tan|ivory|charcoal|beige|marine|navy|desert|dark|light|لون|أبيض|أسود|أزرق|أخضر|أحمر|أصفر|برتقالي|وردي|أرجواني|بني|رمادي/i.test(a)))
      );

      const combinedHints: string[] = Array.from(
        new Set([
          ...(uniqueColorCandidates || []),
          ...colorNamesFromImages,
          ...Array.from(variantImageMap.keys()),
          ...colorishAlts,
        ])
      );

      // Helper to find best image url for a given normalized name
      const findImageFor = (nameNorm: string): string | undefined => {
        const viaMap = variantImageMap.get(nameNorm);
        if (viaMap) return viaMap;
        const fromAlt = altSrcPairs.find((p) => {
          const a = norm(p.alt);
          return a.includes(nameNorm) || nameNorm.includes(a);
        })?.src;
        if (fromAlt) return fromAlt;
        const slug = nameNorm.replace(/\s+/g, '-');
        const direct = (imageUrls || []).find((u) => u.toLowerCase().includes(slug));
        if (direct) return direct;
        return undefined;
      };

      // First, enrich existing colors missing image_url
      if (Array.isArray(productInfo.colors)) {
        for (let i = 0; i < productInfo.colors.length; i++) {
          const c = productInfo.colors[i];
          const nh = norm(c?.name || c?.name_ar);
          if (!c.image_url) {
            const img = nh ? findImageFor(nh) : undefined;
            if (img) productInfo.colors[i].image_url = img;
          }
        }
      }

      // Then, add any missing hinted colors
      const toAdd: any[] = [];
      for (const h of combinedHints) {
        const nh = norm(h);
        if (!nh || existingSet.has(nh)) continue;
        const img = findImageFor(nh);
        toAdd.push({
          name: h,
          name_ar: h, // سيجري تحسين الترجمة لاحقاً عند الحاجة
          hex_code: '#808080', // قيمة افتراضية صحيحة الصيغة سيتم تحسينها لاحقاً عند توفر الصورة
          image_url: img,
        });
        existingSet.add(nh);
        if (toAdd.length > 300) break; // حماية من التضخم غير المقصود
      }

      if (toAdd.length) {
        productInfo.colors = [...(productInfo.colors || []), ...toAdd];
        console.log(`Augmented colors by ${toAdd.length}, total now: ${productInfo.colors.length}`);
      }

      // Final pass: ensure uniqueness and stable ordering
      if (Array.isArray(productInfo.colors)) {
        const seen = new Set<string>();
        productInfo.colors = productInfo.colors.filter((c: any) => {
          const key = norm(c?.name || c?.name_ar);
          if (!key) return false;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }
    } catch (e) {
      console.warn('Color augmentation step failed:', e);
    }


    // Download and upload main product images
    const uploadedImageUrls: string[] = [];
    if (productInfo.images && Array.isArray(productInfo.images)) {
      console.log(`Downloading ${productInfo.images.length} main images...`);
      
      // Limit to 6 main images for better performance
      for (let i = 0; i < Math.min(productInfo.images.length, 6); i++) {
        const publicUrl = await uploadImage(productInfo.images[i], 'main');
        if (publicUrl) {
          uploadedImageUrls.push(publicUrl);
          console.log(`Main image ${i + 1} uploaded successfully`);
        }
      }
    }

    // Replace main image URLs with uploaded ones
    if (uploadedImageUrls.length > 0) {
      productInfo.images = uploadedImageUrls;
      console.log(`Successfully uploaded ${uploadedImageUrls.length} main images`);
    }

    // Upload images for sizes/options
    if (productInfo.sizes && Array.isArray(productInfo.sizes)) {
      console.log(`Processing ${productInfo.sizes.length} size images...`);
      for (let i = 0; i < productInfo.sizes.length; i++) {
        const size = productInfo.sizes[i];
        if (size.image_url) {
          const publicUrl = await uploadImage(size.image_url, `size-${i}`);
          if (publicUrl) {
            productInfo.sizes[i].image_url = publicUrl;
            console.log(`Size ${size.name_ar} image uploaded successfully`);
          } else {
            delete productInfo.sizes[i].image_url;
          }
        }
      }
    }

    // Upload images for colors and validate hex codes
    if (productInfo.colors && Array.isArray(productInfo.colors)) {
      console.log(`Processing ${productInfo.colors.length} color images...`);
      for (let i = 0; i < productInfo.colors.length; i++) {
        const color = productInfo.colors[i];
        
        // Validate hex code format
        if (color.hex_code && !/^#[0-9A-Fa-f]{6}$/.test(color.hex_code)) {
          console.warn(`Invalid hex code for color ${color.name_ar}: ${color.hex_code}`);
          // Set a default if invalid
          color.hex_code = '#808080';
        }
        
        if (color.image_url) {
          const publicUrl = await uploadImage(color.image_url, `color-${i}`);
          if (publicUrl) {
            productInfo.colors[i].image_url = publicUrl;
            console.log(`Color ${color.name_ar} image uploaded successfully`);
          } else {
            console.warn(`Failed to upload image for color ${color.name_ar}`);
            delete productInfo.colors[i].image_url;
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, productInfo }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in extract-product-info:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
        success: false 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
