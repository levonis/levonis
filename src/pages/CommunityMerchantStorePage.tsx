 import { useState } from "react";
 import { useNavigate, useParams } from "react-router-dom";
 import { useQuery } from "@tanstack/react-query";
 import { Store, Star, Facebook, Instagram, ArrowRight } from "lucide-react";
 import { supabase } from "@/integrations/supabase/client";
 import { Button } from "@/components/ui/button";
 import { Card, CardContent } from "@/components/ui/card";
 import { Skeleton } from "@/components/ui/skeleton";
 import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
 import { Label } from "@/components/ui/label";
 import { Badge } from "@/components/ui/badge";
 
 interface MerchantProduct {
   id: string;
   title: string;
   description: string | null;
   price_iqd: number | null;
   original_price_iqd: number | null;
   image_urls: string[] | null;
   video_url: string | null;
   primary_image_index: number;
   estimated_days: number | null;
 }
 
 export default function CommunityMerchantStorePage() {
   const navigate = useNavigate();
   const { merchantId } = useParams<{ merchantId: string }>();
   const [detailDialogOpen, setDetailDialogOpen] = useState(false);
   const [selectedProduct, setSelectedProduct] = useState<MerchantProduct | null>(null);
 
   const { data: merchantApp, isLoading: appLoading } = useQuery({
     queryKey: ["merchant-store", merchantId],
     enabled: !!merchantId,
     queryFn: async () => {
       const { data, error } = await supabase
         .from("merchant_applications")
         .select("id, display_name, bio, store_image_url, social_links, user_id")
         .eq("id", merchantId!)
         .eq("status", "approved")
         .maybeSingle();
       if (error) throw error;
       return data;
     },
   });
 
   const { data: profile } = useQuery({
     queryKey: ["merchant-profile", merchantApp?.user_id],
     enabled: !!merchantApp?.user_id,
     queryFn: async () => {
       const { data, error } = await supabase
         .from("profiles")
         .select("username")
         .eq("id", merchantApp!.user_id)
         .maybeSingle();
       if (error) throw error;
       return data;
     },
   });
 
   const { data: products = [], isLoading: productsLoading } = useQuery({
     queryKey: ["merchant-store-products", merchantId],
     enabled: !!merchantId,
     queryFn: async () => {
       const { data, error } = await supabase
         .from("merchant_products")
         .select("*")
         .eq("merchant_id", merchantId!)
         .eq("is_active", true)
         .order("is_featured", { ascending: false })
         .order("created_at", { ascending: false });
       if (error) throw error;
       return data as MerchantProduct[];
     },
   });
 
   const handleOpenDetail = (product: MerchantProduct) => {
     setSelectedProduct(product);
     setDetailDialogOpen(true);
   };
 
   const socialLinks = merchantApp?.social_links as { facebook?: string; instagram?: string } | undefined;
 
   if (appLoading || productsLoading) {
     return (
       <div className="min-h-screen bg-background/95">
         <main className="container mx-auto px-4 py-8 pt-24 max-w-5xl">
           <Skeleton className="h-12 w-64 rounded-xl mb-6" />
           <Skeleton className="h-40 rounded-2xl mb-6" />
           <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
             {[1, 2, 3, 4].map((i) => (
               <Skeleton key={i} className="h-64 rounded-xl" />
             ))}
           </div>
         </main>
       </div>
     );
   }
 
   if (!merchantApp) {
     return (
       <div className="min-h-screen bg-background/95">
         <main className="container mx-auto px-4 py-8 pt-24 max-w-4xl">
           <Card className="border-border bg-card p-6">
             <p className="text-sm text-muted-foreground">لا يمكن العثور على هذا المتجر.</p>
             <Button className="mt-4" variant="outline" onClick={() => navigate("/community")}>
               العودة للمجتمع
             </Button>
           </Card>
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
             <h1 className="text-2xl sm:text-3xl font-black text-primary">{merchantApp.display_name}</h1>
           </div>
           <Button variant="outline" onClick={() => navigate("/community")}>
             <ArrowRight className="ml-2 h-4 w-4" />
             رجوع
           </Button>
         </header>
 
         {/* Store info card */}
         <Card className="border-border bg-card mb-6">
           <CardContent className="p-6">
             <div className="flex flex-col sm:flex-row gap-4">
               <div className="shrink-0">
                 {merchantApp.store_image_url ? (
                   <img
                     src={merchantApp.store_image_url}
                     alt="Store"
                     className="w-24 h-24 rounded-xl object-cover border border-border"
                   />
                 ) : (
                   <div className="w-24 h-24 rounded-xl bg-muted/20 flex items-center justify-center">
                     <Store className="h-10 w-10 text-muted-foreground" />
                   </div>
                 )}
               </div>
 
               <div className="flex-1">
                 <h2 className="text-xl font-bold text-primary">{merchantApp.display_name}</h2>
                 <p className="text-sm text-muted-foreground mt-1">@{profile?.username || "—"}</p>
 
                 <div className="flex items-center gap-1 mt-2">
                   {[1, 2, 3, 4, 5].map((i) => (
                     <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                   ))}
                   <span className="text-xs text-muted-foreground mr-2">(تقييم تجريبي)</span>
                 </div>
 
                 {merchantApp.bio && (
                   <p className="text-sm text-foreground/80 mt-3 whitespace-pre-wrap">{merchantApp.bio}</p>
                 )}
 
                 {(socialLinks?.facebook || socialLinks?.instagram) && (
                   <div className="flex gap-2 mt-3">
                     {socialLinks.facebook && (
                       <a
                         href={socialLinks.facebook}
                         target="_blank"
                         rel="noopener noreferrer"
                         className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs hover:bg-primary/20 transition-colors"
                       >
                         <Facebook className="h-3.5 w-3.5" />
                         فيسبوك
                       </a>
                     )}
                     {socialLinks.instagram && (
                       <a
                         href={socialLinks.instagram}
                         target="_blank"
                         rel="noopener noreferrer"
                         className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs hover:bg-primary/20 transition-colors"
                       >
                         <Instagram className="h-3.5 w-3.5" />
                         إنستقرام
                       </a>
                     )}
                   </div>
                 )}
               </div>
             </div>
           </CardContent>
         </Card>
 
         <div className="border-t border-border my-6" />
 
         {/* Products section */}
         <div className="mb-4">
           <h2 className="text-lg font-bold text-primary">المنتجات</h2>
         </div>
 
         {products.length === 0 ? (
           <Card className="border-border bg-card p-6">
             <p className="text-sm text-muted-foreground text-center">لا توجد منتجات متاحة حالياً.</p>
           </Card>
         ) : (
           <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
             {products.map((p) => {
               const mainImg = p.image_urls?.[p.primary_image_index] || p.image_urls?.[0];
               return (
                 <Card
                   key={p.id}
                   className="border-border bg-card overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                   onClick={() => handleOpenDetail(p)}
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
         )}
 
         {/* Product Detail Dialog */}
         <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
           <DialogContent className="sm:max-w-3xl">
             <DialogHeader>
               <DialogTitle>{selectedProduct?.title}</DialogTitle>
             </DialogHeader>
             {selectedProduct && (
               <div className="space-y-4 max-h-[60vh] overflow-y-auto px-1">
                 {selectedProduct.image_urls && selectedProduct.image_urls.length > 0 && (
                   <div className="grid grid-cols-2 gap-2">
                     {selectedProduct.image_urls.map((url, idx) => (
                       <img
                         key={idx}
                         src={url}
                         alt={`${selectedProduct.title} ${idx + 1}`}
                         className="w-full aspect-square rounded-lg object-cover border border-border"
                       />
                     ))}
                   </div>
                 )}
 
                 {selectedProduct.video_url && (
                   <div>
                     <Label>الفيديو</Label>
                     <video controls className="w-full rounded-lg border border-border mt-1">
                       <source src={selectedProduct.video_url} />
                       المتصفح لا يدعم تشغيل الفيديو.
                     </video>
                   </div>
                 )}
 
                 {selectedProduct.description && (
                   <div>
                     <Label>الوصف</Label>
                     <p className="text-sm text-foreground/80 mt-1 whitespace-pre-wrap">
                       {selectedProduct.description}
                     </p>
                   </div>
                 )}
 
                 {selectedProduct.price_iqd && (
                   <div>
                     <Label>السعر</Label>
                     <div className="flex items-baseline gap-2 mt-1">
                       {selectedProduct.original_price_iqd && (
                         <span className="text-sm text-muted-foreground line-through">
                           {selectedProduct.original_price_iqd.toLocaleString()} د.ع
                         </span>
                       )}
                       <span className="text-lg font-bold text-primary">
                         {selectedProduct.price_iqd.toLocaleString()} د.ع
                       </span>
                     </div>
                   </div>
                 )}
 
                 {selectedProduct.estimated_days && (
                   <div>
                     <Label>وقت التنفيذ</Label>
                     <p className="text-sm text-foreground/80 mt-1">{selectedProduct.estimated_days} يوم تقريباً</p>
                   </div>
                 )}
               </div>
             )}
           </DialogContent>
         </Dialog>
       </main>
     </div>
   );
 }