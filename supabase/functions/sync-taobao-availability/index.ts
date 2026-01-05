import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.78.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VariantAvailability {
  name: string;
  name_ar?: string;
  available: boolean;
  sku_id?: string;
}

interface SyncResult {
  success: boolean;
  product_available: boolean;
  variants: VariantAvailability[];
  last_sync_at: string;
  error?: string;
}

// Detect URL type (Taobao, JD, 1688, Tmall)
function detectUrlType(url: string): 'taobao' | 'jd' | '1688' | 'tmall' | 'unknown' {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('tmall.com')) return 'tmall';
  if (lowerUrl.includes('1688.com')) return '1688';
  if (lowerUrl.includes('taobao.com')) return 'taobao';
  if (lowerUrl.includes('jd.com')) return 'jd';
  return 'unknown';
}

// Parse Taobao/Tmall/1688 product page to extract availability
async function scrapeTaobaoAvailability(taobaoUrl: string): Promise<SyncResult> {
  const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
  
  if (!firecrawlApiKey) {
    console.error('[Sync] FIRECRAWL_API_KEY not configured');
    return {
      success: false,
      product_available: false,
      variants: [],
      last_sync_at: new Date().toISOString(),
      error: 'Firecrawl not configured'
    };
  }

  try {
    console.log('[Sync] Scraping URL:', taobaoUrl);
    
    const urlType = detectUrlType(taobaoUrl);
    console.log('[Sync] URL type:', urlType);
    
    // Use Firecrawl to scrape the page
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: taobaoUrl,
        formats: ['html', 'markdown'],
        onlyMainContent: false,
        waitFor: 5000, // Wait longer for dynamic content
        headers: {
          'Accept-Language': 'zh-CN,zh;q=0.9',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[Sync] Firecrawl API error:', errorData);
      return {
        success: false,
        product_available: true, // Default to available when scraping fails
        variants: [],
        last_sync_at: new Date().toISOString(),
        error: `Scraping failed: ${errorData.error || response.status}`
      };
    }

    const data = await response.json();
    const html = data.data?.html || data.html || '';
    const markdown = data.data?.markdown || data.markdown || '';
    const content = html + '\n' + markdown;
    
    console.log('[Sync] Scraped content length:', content.length);
    
    // Parse availability from the page content
    const variants: VariantAvailability[] = [];
    let productAvailable = true;
    
    // Check for common out-of-stock indicators in Chinese
    const outOfStockPatterns = [
      /下架|已下架/i,
      /售罄|已售罄/i,
      /缺货|无货/i,
      /暂时缺货/i,
      /库存不足/i,
      /商品已下架/i,
      /该商品已下架/i,
      /该宝贝已下架/i,
      /此商品已下柜/i,
      /暂不销售/i,
    ];
    
    const isOutOfStock = outOfStockPatterns.some(pattern => 
      pattern.test(content)
    );
    
    if (isOutOfStock) {
      console.log('[Sync] Product detected as out of stock');
      productAvailable = false;
    }
    
    // Extract variant/SKU information using multiple patterns
    const extractedVariants = new Set<string>();
    
    // Pattern 1: Look for color classification (颜色分类)
    const colorPatterns = [
      /颜色分类[：:]\s*([^\n<]+)/gi,
      /颜色[：:]\s*([^\n<]+)/gi,
      /选择颜色[：:]\s*([^\n<]+)/gi,
      /规格[：:]\s*([^\n<]+)/gi,
      /型号[：:]\s*([^\n<]+)/gi,
    ];
    
    for (const pattern of colorPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        const variantText = match[1];
        // Split by common separators
        const variantNames = variantText.split(/[,，、\s\|]+/).filter(Boolean);
        variantNames.forEach((name: string) => {
          const cleanName = name.trim().replace(/[【】\[\]\(\)（）<>]/g, '');
          if (cleanName.length >= 2 && cleanName.length <= 30) {
            extractedVariants.add(cleanName);
          }
        });
      }
    }
    
    // Pattern 2: Look for SKU items in data attributes or classes
    const skuPatterns = [
      /data-value="([^"]+)"/gi,
      /sku-name[^>]*>([^<]+)</gi,
      /tb-sku-name[^>]*>([^<]+)</gi,
      /"valueName"\s*:\s*"([^"]+)"/gi,
      /"name"\s*:\s*"([^"]+)"[^}]*"skuId"/gi,
    ];
    
    for (const pattern of skuPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        const variantName = match[1].trim();
        if (variantName.length >= 2 && variantName.length <= 30) {
          // Filter out common non-variant strings
          const invalidStrings = ['确定', '取消', '立即购买', '加入购物车', '收藏', '分享'];
          if (!invalidStrings.some(s => variantName.includes(s))) {
            extractedVariants.add(variantName);
          }
        }
      }
    }
    
    // Pattern 3: Look for list items that might be variants
    const listPatterns = [
      /<li[^>]*class="[^"]*sku[^"]*"[^>]*>([^<]+)</gi,
      /<span[^>]*class="[^"]*sku[^"]*"[^>]*>([^<]+)</gi,
    ];
    
    for (const pattern of listPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        const variantName = match[1].trim();
        if (variantName.length >= 2 && variantName.length <= 30) {
          extractedVariants.add(variantName);
        }
      }
    }
    
    console.log('[Sync] Extracted variants:', Array.from(extractedVariants));
    
    // Convert extracted variants to array with availability
    for (const variantName of extractedVariants) {
      // Check if this specific variant is marked as unavailable
      const variantUnavailablePatterns = [
        new RegExp(`${variantName}[^\\n]*(?:售罄|缺货|无货|下架)`, 'i'),
        new RegExp(`(?:售罄|缺货|无货|下架)[^\\n]*${variantName}`, 'i'),
      ];
      
      const variantOutOfStock = variantUnavailablePatterns.some(p => p.test(content));
      
      variants.push({
        name: variantName,
        available: !variantOutOfStock && productAvailable
      });
    }
    
    // If no variants found, add a default one
    if (variants.length === 0) {
      variants.push({
        name: 'default',
        available: productAvailable
      });
    }
    
    // Update product availability based on variants
    const anyVariantAvailable = variants.some(v => v.available);
    if (variants.length > 0 && variants[0].name !== 'default') {
      productAvailable = anyVariantAvailable;
    }
    
    console.log('[Sync] Result:', { 
      productAvailable, 
      variantsCount: variants.length,
      variants: variants.map(v => ({ name: v.name, available: v.available }))
    });
    
    return {
      success: true,
      product_available: productAvailable,
      variants,
      last_sync_at: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('[Sync] Error scraping:', error);
    return {
      success: false,
      product_available: true, // Default to available on error
      variants: [],
      last_sync_at: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { product_id, taobao_url, sync_all } = await req.json();
    
    console.log('[Sync] Request:', { product_id, sync_all, has_url: !!taobao_url });
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // If sync_all is true, sync all products with Taobao/JD URLs
    if (sync_all) {
      console.log('[Sync] Starting bulk sync for all products');
      
      const { data: products, error: fetchError } = await supabase
        .from('products')
        .select('id, taobao_url, name_ar')
        .not('taobao_url', 'is', null)
        .neq('taobao_url', '');
      
      if (fetchError) {
        throw fetchError;
      }
      
      const results = [];
      for (const product of products || []) {
        if (product.taobao_url) {
          console.log('[Sync] Syncing product:', product.id, product.name_ar);
          
          const syncResult = await scrapeTaobaoAvailability(product.taobao_url);
          
          // Update product availability
          await supabase
            .from('products')
            .update({
              in_stock: syncResult.product_available,
              taobao_last_sync_at: syncResult.last_sync_at,
              taobao_sync_status: syncResult.success ? 'success' : 'error',
              taobao_availability_cache: {
                variants: syncResult.variants,
                last_sync: syncResult.last_sync_at,
                error: syncResult.error
              }
            })
            .eq('id', product.id);
          
          // Log sync attempt
          await supabase
            .from('taobao_sync_logs')
            .insert({
              product_id: product.id,
              sync_status: syncResult.success ? 'success' : 'error',
              error_message: syncResult.error,
              variants_synced: syncResult.variants.length
            });
          
          // Update product options if variants were found
          if (syncResult.variants.length > 0 && syncResult.variants[0].name !== 'default') {
            await updateProductOptionsAvailability(supabase, product.id, syncResult);
          }
          
          results.push({
            product_id: product.id,
            name: product.name_ar,
            success: syncResult.success,
            available: syncResult.product_available
          });
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }
      
      console.log('[Sync] Bulk sync completed:', results.length, 'products');
      
      return new Response(
        JSON.stringify({ success: true, synced: results.length, results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Single product sync
    if (!taobao_url) {
      return new Response(
        JSON.stringify({ success: false, error: 'taobao_url is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const syncResult = await scrapeTaobaoAvailability(taobao_url);
    
    // Update product if product_id is provided
    if (product_id) {
      console.log('[Sync] Updating product:', product_id);
      
      await supabase
        .from('products')
        .update({
          in_stock: syncResult.product_available,
          taobao_last_sync_at: syncResult.last_sync_at,
          taobao_sync_status: syncResult.success ? 'success' : 'error',
          taobao_availability_cache: {
            variants: syncResult.variants,
            last_sync: syncResult.last_sync_at,
            error: syncResult.error
          }
        })
        .eq('id', product_id);
      
      // Log sync attempt
      await supabase
        .from('taobao_sync_logs')
        .insert({
          product_id,
          sync_status: syncResult.success ? 'success' : 'error',
          error_message: syncResult.error,
          variants_synced: syncResult.variants.length
        });
      
      // Update product options availability if variants were found
      if (syncResult.variants.length > 0 && syncResult.variants[0].name !== 'default') {
        await updateProductOptionsAvailability(supabase, product_id, syncResult);
      }
    }
    
    return new Response(
      JSON.stringify(syncResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('[Sync] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper function to update product options based on synced variants
async function updateProductOptionsAvailability(
  supabase: any, 
  productId: string, 
  syncResult: SyncResult
) {
  const { data: options } = await supabase
    .from('product_options')
    .select('id, name_ar, name')
    .eq('product_id', productId);
  
  if (!options || options.length === 0) {
    console.log('[Sync] No product options found for product:', productId);
    return;
  }
  
  console.log('[Sync] Updating options for product:', productId, 'Options:', options.length);
  
  for (const option of options) {
    // Try to find a matching variant
    const matchingVariant = syncResult.variants.find(v => {
      const variantName = v.name.toLowerCase();
      const optionName = option.name?.toLowerCase() || '';
      const optionNameAr = option.name_ar?.toLowerCase() || '';
      
      // Check for exact match or partial match
      return variantName === optionName || 
             variantName === optionNameAr ||
             optionName.includes(variantName) || 
             variantName.includes(optionName) ||
             optionNameAr.includes(variantName) ||
             variantName.includes(optionNameAr);
    });
    
    if (matchingVariant) {
      console.log('[Sync] Found matching variant for option:', option.name_ar, '->', matchingVariant.name);
      
      await supabase
        .from('product_options')
        .update({
          in_stock: matchingVariant.available,
          taobao_available: matchingVariant.available,
          taobao_last_sync_at: syncResult.last_sync_at
        })
        .eq('id', option.id);
    } else {
      console.log('[Sync] No matching variant for option:', option.name_ar);
    }
  }
}
