import { ArrowRight, Boxes, Store, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
 import { useQuery } from "@tanstack/react-query";
 import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
 import { Skeleton } from "@/components/ui/skeleton";
 
 interface MerchantWithProducts {
   id: string;
   display_name: string;
   store_image_url: string | null;
   featuredProducts: Array<{
     id: string;
     title: string;
     image_urls: string[] | null;
     primary_image_index: number;
   }>;
 }

export default function CommunityMerchantsPages() {
  const navigate = useNavigate();
 
   // Fetch approved merchants
   const { data: merchants = [], isLoading: merchantsLoading } = useQuery({
     queryKey: ["approved-merchants"],
     queryFn: async () => {
       const { data, error } = await supabase
          .from("merchant_public_profiles")
          .select("id, display_name, store_image_url")
          .order("created_at", { ascending: false });
       if (error) throw error;
       return data || [];
     },
   });
 
   // Fetch featured products for all merchants
   const merchantIds = merchants.map((m) => m.id);
   const { data: products = [], isLoading: productsLoading } = useQuery({
     queryKey: ["featured-products", merchantIds],
     enabled: merchantIds.length > 0,
     queryFn: async () => {
       const { data, error } = await supabase
         .from("merchant_products")
         .select("id, merchant_id, title, image_urls, primary_image_index")
         .in("merchant_id", merchantIds)
         .eq("is_featured", true)
         .eq("is_active", true);
       if (error) throw error;
       return data || [];
     },
   });
 
   const productsMap = new Map<string, typeof products>();
   products.forEach((p) => {
     if (!productsMap.has(p.merchant_id)) productsMap.set(p.merchant_id, []);
     productsMap.get(p.merchant_id)!.push(p);
   });
 
   const merchantsWithProducts: MerchantWithProducts[] = merchants.map((m) => ({
     ...m,
     featuredProducts: productsMap.get(m.id) || [],
   }));
 
  // Fetch rating stats for all merchants
  const { data: ratingsStats = [] } = useQuery({
    queryKey: ["all-merchant-rating-stats", merchantIds],
    enabled: merchantIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_rating_stats")
        .select("*")
        .in("merchant_id", merchantIds);
      if (error) throw error;
      return data || [];
    },
  });

  const ratingsMap = new Map(ratingsStats.map((r: any) => [r.merchant_id, r]));

   if (merchantsLoading || productsLoading) {
     return (
       <div className="min-h-screen bg-background/95 backdrop-blur-sm">
         <main className="container mx-auto px-4 py-8 pt-24 max-w-5xl">
           <Skeleton className="h-12 w-64 rounded-xl mb-6" />
           <div className="space-y-4">
             {[1, 2, 3].map((i) => (
               <Skeleton key={i} className="h-40 rounded-2xl" />
             ))}
           </div>
         </main>
       </div>
     );
   }

  return (
    <div className="min-h-screen bg-background/95 backdrop-blur-sm">
      <main className="container mx-auto px-4 py-8 pt-24 max-w-5xl">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Boxes className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-primary">التجار</h1>
              <p className="text-sm text-muted-foreground">تصفح متاجر التجار ومنتجاتهم</p>
            </div>
          </div>

          <Button variant="outline" onClick={() => navigate("/community/customer")} className="gap-2">
            <ArrowRight className="h-4 w-4" />
            رجوع
          </Button>
        </header>

        {merchantsWithProducts.length === 0 ? (
          <Card className="border-border bg-card p-6">
            <p className="text-sm text-muted-foreground text-center">لا يوجد تجار مقبولين بعد.</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {merchantsWithProducts.map((merchant) => (
              <Card
                key={merchant.id}
                className="border-border bg-card cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => navigate(`/store/${merchant.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    {merchant.store_image_url ? (
                      <img
                        src={merchant.store_image_url}
                        alt={merchant.display_name}
                        className="w-12 h-12 rounded-xl object-cover border border-border"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-muted/20 flex items-center justify-center">
                        <Store className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1">
                      <CardTitle className="text-base">{merchant.display_name}</CardTitle>
                      <CardDescription className="text-xs">عرض المتجر</CardDescription>
                    </div>
                  </div>
                  {(() => {
                    const stats = ratingsMap.get(merchant.id);
                    if (stats && stats.total_ratings > 0) {
                      return (
                        <div className="flex items-center gap-1 mt-2">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <Star
                              key={i}
                              className={`h-3.5 w-3.5 ${
                                i <= Math.round(stats.average_rating)
                                  ? "fill-yellow-500 text-yellow-500"
                                  : "text-muted-foreground"
                              }`}
                            />
                          ))}
                          <span className="text-xs text-muted-foreground mr-1">
                            ({stats.average_rating.toFixed(1)} • {stats.total_ratings} تقييم)
                          </span>
                        </div>
                      );
                    }
                    return (
                      <p className="text-xs text-muted-foreground mt-2">لا توجد تقييمات بعد</p>
                    );
                  })()}
                </CardHeader>
                <CardContent>
                  {merchant.featuredProducts.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2">
                      {merchant.featuredProducts.slice(0, 3).map((product) => {
                        const mainImg =
                          product.image_urls?.[product.primary_image_index] || product.image_urls?.[0];
                        return (
                          <div key={product.id} className="relative">
                            <div className="aspect-square rounded-lg bg-muted/20 overflow-hidden">
                              {mainImg ? (
                                <img src={mainImg} alt={product.title} className="w-full h-full object-cover" />
                              ) : (
                                <div className="flex items-center justify-center w-full h-full">
                                  <Store className="h-6 w-6 text-muted-foreground" />
                                </div>
                              )}
                            </div>
                            <p className="text-xs font-semibold line-clamp-1 mt-1">{product.title}</p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">لا توجد منتجات مميزة</p>
                  )}
                </CardContent>
            </Card>
          ))}
          </div>
        )}
      </main>
    </div>
  );
}
