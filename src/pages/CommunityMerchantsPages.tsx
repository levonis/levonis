import { ArrowRight, Boxes } from "lucide-react";
import { useNavigate } from "react-router-dom";
 import { useQuery } from "@tanstack/react-query";
 import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
 import { Skeleton } from "@/components/ui/skeleton";
import MerchantDirectoryCard from "@/components/community/MerchantDirectoryCard";
 
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
           <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
             {merchantsWithProducts.map((merchant) => (
               <MerchantDirectoryCard
                 key={merchant.id}
                 id={merchant.id}
                 displayName={merchant.display_name}
                 storeImageUrl={merchant.store_image_url}
                 stats={ratingsMap.get(merchant.id) || null}
                 featuredProducts={merchant.featuredProducts}
                 onOpenStore={() => navigate(`/store/${merchant.id}`)}
               />
             ))}
           </div>
        )}
      </main>
    </div>
  );
}
