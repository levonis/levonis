 import { useState } from "react";
 import { useNavigate } from "react-router-dom";
 import { useQuery } from "@tanstack/react-query";
 import { Store, Search, ArrowRight } from "lucide-react";
 import { supabase } from "@/integrations/supabase/client";
 import { Button } from "@/components/ui/button";
 import { Card, CardContent } from "@/components/ui/card";
 import { Skeleton } from "@/components/ui/skeleton";
 import { Input } from "@/components/ui/input";
 import { Badge } from "@/components/ui/badge";
 
 interface ProductWithMerchant {
   id: string;
   title: string;
   description: string | null;
   price_iqd: number | null;
   original_price_iqd: number | null;
   image_urls: string[] | null;
   video_url: string | null;
   primary_image_index: number;
   is_active: boolean;
   estimated_days: number | null;
   merchant_id: string;
   merchant_name: string;
   merchant_image: string | null;
 }
 
 export default function CommunityAllMerchantsProducts() {
   const navigate = useNavigate();
   const [searchTerm, setSearchTerm] = useState("");
 
   const { data: products = [], isLoading } = useQuery({
     queryKey: ["all-merchant-products"],
     queryFn: async () => {
       // Fetch all active products
       const { data: prods, error: prodsError } = await supabase
         .from("merchant_products")
         .select("*")
         .eq("is_active", true)
         .order("created_at", { ascending: false });
       if (prodsError) throw prodsError;
 
       if (!prods || prods.length === 0) return [];
 
       // Get merchant info
       const merchantIds = Array.from(new Set(prods.map((p) => p.merchant_id)));
       const { data: merchants, error: merchError } = await supabase
         .from("merchant_applications")
         .select("id, display_name, store_image_url")
         .in("id", merchantIds);
       if (merchError) throw merchError;
 
       const merchantMap = new Map(merchants?.map((m) => [m.id, m]) || []);
 
       return prods.map((p) => {
         const merch = merchantMap.get(p.merchant_id);
         return {
           ...p,
           merchant_name: merch?.display_name || "تاجر",
           merchant_image: merch?.store_image_url || null,
         } as ProductWithMerchant;
       });
     },
   });
 
   const filteredProducts = products.filter((p) =>
     p.title.toLowerCase().includes(searchTerm.toLowerCase())
   );
 
   if (isLoading) {
     return (
       <div className="min-h-screen bg-background/95">
         <main className="container mx-auto px-4 py-8 pt-24 max-w-6xl">
           <Skeleton className="h-12 w-64 rounded-xl mb-6" />
           <Skeleton className="h-10 rounded-xl mb-4" />
           <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
             {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
               <Skeleton key={i} className="h-64 rounded-xl" />
             ))}
           </div>
         </main>
       </div>
     );
   }
 
   return (
     <div className="min-h-screen bg-background/95 backdrop-blur-sm">
       <main className="container mx-auto px-4 py-8 pt-24 max-w-6xl">
         <header className="mb-6 flex items-center justify-between gap-4">
           <div className="flex items-center gap-3">
             <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
               <Store className="h-5 w-5 text-primary" />
             </div>
             <div>
               <h1 className="text-2xl sm:text-3xl font-black text-primary">منتجات التجار</h1>
               <p className="text-sm text-muted-foreground">جميع المنتجات المتاحة من التجار</p>
             </div>
           </div>
           <Button variant="outline" onClick={() => navigate("/community")}>
             <ArrowRight className="ml-2 h-4 w-4" />
             رجوع
           </Button>
         </header>
 
         <div className="mb-4 relative">
           <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
           <Input
             placeholder="ابحث عن منتج..."
             value={searchTerm}
             onChange={(e) => setSearchTerm(e.target.value)}
             className="pr-10"
           />
         </div>
 
         {filteredProducts.length === 0 ? (
           <Card className="border-border bg-card p-6">
             <p className="text-sm text-muted-foreground text-center">
               {searchTerm ? "لا توجد منتجات مطابقة للبحث." : "لا توجد منتجات بعد."}
             </p>
           </Card>
         ) : (
           <>
             <p className="text-xs text-muted-foreground mb-3">
               {filteredProducts.length} منتج
             </p>
             <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
               {filteredProducts.map((p) => {
                 const mainImg = p.image_urls?.[p.primary_image_index] || p.image_urls?.[0];
                 return (
                   <Card
                     key={p.id}
                     className="border-border bg-card overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                     onClick={() => navigate(`/store/${p.merchant_id}`)}
                   >
                     <div className="relative aspect-square bg-muted/20">
                       {mainImg ? (
                         <img src={mainImg} alt={p.title} className="w-full h-full object-cover" />
                       ) : (
                         <div className="flex items-center justify-center w-full h-full">
                           <Store className="h-12 w-12 text-muted-foreground" />
                         </div>
                       )}
                     </div>
                     <CardContent className="p-3">
                       <p className="text-sm font-semibold line-clamp-1">{p.title}</p>
                       <div className="flex items-center gap-1 mt-1">
                         {p.merchant_image ? (
                           <img
                             src={p.merchant_image}
                             alt={p.merchant_name}
                             className="w-4 h-4 rounded-full object-cover"
                           />
                         ) : (
                           <div className="w-4 h-4 rounded-full bg-primary/10" />
                         )}
                         <p className="text-xs text-muted-foreground line-clamp-1">{p.merchant_name}</p>
                       </div>
                       {p.price_iqd && (
                         <div className="mt-1 flex items-baseline gap-1">
                           {p.original_price_iqd && (
                             <span className="text-xs text-muted-foreground line-through">
                               {p.original_price_iqd.toLocaleString()}
                             </span>
                           )}
                           <span className="text-sm font-bold text-primary">
                             {p.price_iqd.toLocaleString()} د.ع
                           </span>
                         </div>
                       )}
                       {p.estimated_days && (
                         <p className="text-xs text-muted-foreground mt-1">{p.estimated_days} يوم</p>
                       )}
                     </CardContent>
                   </Card>
                 );
               })}
             </div>
           </>
         )}
       </main>
     </div>
   );
 }