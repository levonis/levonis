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

// Parse Taobao product page to extract availability
async function scrapeTaobaoAvailability(taobaoUrl: string): Promise<SyncResult> {
  const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
  
  if (!firecrawlApiKey) {
    console.error('FIRECRAWL_API_KEY not configured');
    return {
      success: false,
      product_available: false,
      variants: [],
      last_sync_at: new Date().toISOString(),
      error: 'Firecrawl not configured'
    };
  }

  try {
    console.log('Scraping Taobao URL:', taobaoUrl);
    
    // Use Firecrawl to scrape the Taobao page
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
        waitFor: 3000, // Wait for dynamic content
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Firecrawl API error:', errorData);
      return {
        success: false,
        product_available: false,
        variants: [],
        last_sync_at: new Date().toISOString(),
        error: `Scraping failed: ${errorData.error || response.status}`
      };
    }

    const data = await response.json();
    const html = data.data?.html || data.html || '';
    const markdown = data.data?.markdown || data.markdown || '';
    
    console.log('Scraped content length:', html.length);
    
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
    ];
    
    const isOutOfStock = outOfStockPatterns.some(pattern => 
      pattern.test(html) || pattern.test(markdown)
    );
    
    if (isOutOfStock) {
      productAvailable = false;
    }
    
    // Try to extract SKU/variant information
    // Look for color/size selectors in the HTML
    const colorPatterns = [
      /颜色分类[：:]\s*([^<\n]+)/g,
      /data-value="([^"]+)"[^>]*class="[^"]*sku-item/gi,
      /"skuList":\s*\[(.*?)\]/s,
    ];
    
    // Extract variant names from common patterns
    const variantMatches = html.match(/颜色[分类]*[：:]\s*([^<]+)/i);
    if (variantMatches) {
      const variantNames = variantMatches[1].split(/[,，、\s]+/).filter(Boolean);
      variantNames.forEach((name: string) => {
        if (name.trim()) {
          // Check if this specific variant is available
          const variantOutOfStock = html.includes(`${name}.*售罄`) || 
                                    html.includes(`${name}.*缺货`);
          variants.push({
            name: name.trim(),
            available: !variantOutOfStock
          });
        }
      });
    }
    
    // If no variants found, check overall availability
    if (variants.length === 0) {
      variants.push({
        name: 'default',
        available: productAvailable
      });
    }
    
    // Update product availability based on variants
    const anyVariantAvailable = variants.some(v => v.available);
    productAvailable = anyVariantAvailable;
    
    console.log('Sync result:', { productAvailable, variantsCount: variants.length });
    
    return {
      success: true,
      product_available: productAvailable,
      variants,
      last_sync_at: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Error scraping Taobao:', error);
    return {
      success: false,
      product_available: false,
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
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // If sync_all is true, sync all products with Taobao URLs
    if (sync_all) {
      console.log('Starting bulk sync for all products with Taobao URLs');
      
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
          
          results.push({
            product_id: product.id,
            name: product.name_ar,
            success: syncResult.success,
            available: syncResult.product_available
          });
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      return new Response(
        JSON.stringify({ success: true, synced: results.length, results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Single product sync
    if (!taobao_url) {
      return new Response(
        JSON.stringify({ success: false, error: 'Taobao URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const syncResult = await scrapeTaobaoAvailability(taobao_url);
    
    // Update product if product_id is provided
    if (product_id) {
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
        const { data: options } = await supabase
          .from('product_options')
          .select('id, name_ar, name')
          .eq('product_id', product_id);
        
        if (options) {
          for (const option of options) {
            const matchingVariant = syncResult.variants.find(v => 
              v.name === option.name || v.name === option.name_ar ||
              option.name_ar?.includes(v.name) || option.name?.includes(v.name)
            );
            
            if (matchingVariant) {
              await supabase
                .from('product_options')
                .update({
                  in_stock: matchingVariant.available,
                  taobao_available: matchingVariant.available,
                  taobao_last_sync_at: syncResult.last_sync_at
                })
                .eq('id', option.id);
            }
          }
        }
      }
    }
    
    return new Response(
      JSON.stringify(syncResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error in sync-taobao-availability:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
