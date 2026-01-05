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

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { url, manualData } = await req.json();
    
    // If manual data is provided, just translate it
    if (manualData) {
      console.log('Processing manual data...');
      return await processManualData(manualData);
    }

    console.log('Processing URL:', url);

    // Extract item ID from URL
    const itemIdMatch = url.match(/[?&]id=(\d+)/) || url.match(/\/(\d{10,})\.html/);
    const itemId = itemIdMatch?.[1];
    
    if (!itemId) {
      return new Response(
        JSON.stringify({ error: 'Could not extract item ID from URL', success: false }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Item ID:', itemId);

    // Determine platform
    const isTmall = url.includes('tmall.com');
    const isJD = url.includes('jd.com');
    const is1688 = url.includes('1688.com');
    const platform = isTmall ? 'tmall' : isJD ? 'jd' : is1688 ? '1688' : 'taobao';

    // Since Taobao blocks direct access, return guidance for manual input
    return new Response(
      JSON.stringify({ 
        success: false, 
        requiresManualInput: true,
        item_id: itemId,
        platform,
        message: 'Taobao يحظر الوصول المباشر. يرجى إدخال البيانات يدوياً.',
        hint: 'افتح صفحة المنتج في تبويب جديد وانسخ: العنوان، الألوان، المقاسات، ثم الصق هنا.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An error occurred',
        success: false
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function processManualData(manualData: {
  title?: string;
  colors?: string;
  sizes?: string;
  images?: string[];
  features?: string;
}) {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY not configured');
  }

  console.log('Translating manual data with AI...');

  const systemPrompt = `أنت مساعد ترجمة للمنتجات الصينية. قم بترجمة المعلومات المقدمة إلى العربية والإنجليزية بشكل احترافي.

قواعد مهمة:
1. ترجم كل النصوص الصينية بشكل طبيعي
2. للألوان: استخرج اسم اللون بالعربية والإنجليزية وكود HEX الصحيح
3. للمقاسات: ترجمها كما هي (S, M, L, XL, إلخ) أو بالسنتيمتر
4. اجعل الوصف مناسباً للتجارة الإلكترونية
5. لا تضف معلومات غير موجودة في البيانات الأصلية`;

  const userPrompt = `ترجم هذه المعلومات عن المنتج:

العنوان: ${manualData.title || 'غير متوفر'}
الألوان: ${manualData.colors || 'غير متوفر'}
المقاسات: ${manualData.sizes || 'غير متوفر'}
الميزات: ${manualData.features || 'غير متوفر'}

أعد البيانات بالتنسيق المطلوب.`;

  const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      temperature: 0.1,
      max_tokens: 4000,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "translate_product",
            description: "ترجمة وتنسيق بيانات المنتج",
            parameters: {
              type: "object",
              properties: {
                name: { type: "string", description: "اسم المنتج بالإنجليزية" },
                name_ar: { type: "string", description: "اسم المنتج بالعربية" },
                description: { type: "string", description: "وصف المنتج بالإنجليزية" },
                description_ar: { type: "string", description: "وصف المنتج بالعربية" },
                colors: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      name_ar: { type: "string" },
                      hex_code: { type: "string" }
                    }
                  }
                },
                sizes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      name_ar: { type: "string" }
                    }
                  }
                },
                features: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      text: { type: "string" },
                      text_ar: { type: "string" },
                      icon: { type: "string" }
                    }
                  }
                }
              },
              required: ["name", "name_ar", "description", "description_ar", "colors", "sizes", "features"]
            }
          }
        }
      ],
      tool_choice: { type: "function", function: { name: "translate_product" } }
    }),
  });

  if (!aiResponse.ok) {
    const errorText = await aiResponse.text();
    console.error('AI error:', aiResponse.status, errorText);
    throw new Error('AI service error');
  }

  const aiData = await aiResponse.json();
  const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
  
  if (!toolCall) {
    throw new Error('AI did not return translated data');
  }

  const productInfo = JSON.parse(toolCall.function.arguments);
  
  // Validate hex codes
  if (productInfo.colors && Array.isArray(productInfo.colors)) {
    productInfo.colors = productInfo.colors.map((color: any) => {
      let hex = color.hex_code || '#808080';
      if (!hex.startsWith('#')) hex = '#' + hex;
      if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) hex = '#808080';
      return { ...color, hex_code: hex };
    });
  }

  // Add images from manual data
  productInfo.images = manualData.images || [];

  console.log('Translation complete:', productInfo.name);

  return new Response(
    JSON.stringify({ 
      success: true, 
      productInfo,
      extraction_method: 'manual_with_ai'
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
