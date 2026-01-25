import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Store, Facebook, Instagram, ArrowRight, Clock, BadgePercent, Play, MessageCircle, Link as LinkIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import MerchantRatingsDisplay from "@/components/merchant/MerchantRatingsDisplay";
import { MerchantBadgesDisplay, BadgeTier } from "@/components/community/MerchantBadges";
import MerchantBadgesDetailCard from "@/components/community/MerchantBadgesDetailCard";
import AvatarWithFrame from "@/components/merchant/AvatarWithFrame";
 
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
   const { user } = useAuth();
   const [detailDialogOpen, setDetailDialogOpen] = useState(false);
   const [selectedProduct, setSelectedProduct] = useState<MerchantProduct | null>(null);
   const [activeMediaIndex, setActiveMediaIndex] = useState(0);
   const [messageDialogOpen, setMessageDialogOpen] = useState(false);
   const [includeProductLink, setIncludeProductLink] = useState(true);
 
   const { data: merchantApp, isLoading: appLoading } = useQuery({
     queryKey: ["merchant-store", merchantId],
     enabled: !!merchantId,
     queryFn: async () => {
      const { data, error } = await supabase
         .from("merchant_public_profiles")
         .select("id, display_name, bio, store_image_url, social_links, is_verified, badge_tier")
         .eq("id", merchantId!)
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
     setActiveMediaIndex(product.primary_image_index || 0);
     setDetailDialogOpen(true);
   };

   const handleContactMerchant = () => {
     if (!user) {
       navigate("/auth");
       return;
     }
     setMessageDialogOpen(true);
   };

   const handleStartConversation = () => {
     // Build the message with optional product link
     const productUrl = selectedProduct 
       ? `${window.location.origin}/store/${merchantId}?product=${selectedProduct.id}`
       : null;
     
     // Navigate to messages with conversation context
     const params = new URLSearchParams();
     params.set("merchant_id", merchantId!);
     if (includeProductLink && selectedProduct) {
       params.set("product_title", selectedProduct.title);
       params.set("product_url", productUrl!);
     }
     
     navigate(`/community/messages?${params.toString()}`);
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
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black text-primary" title={merchantApp.display_name}>{merchantApp.display_name}</h1>
                <MerchantBadgesDisplay 
                  isVerified={merchantApp.is_verified} 
                  badgeTier={(merchantApp.badge_tier || "none") as BadgeTier}
                  size="md"
                />
              </div>
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
                  <p className="text-sm text-muted-foreground mt-1">متجر داخل مجتمع ليفو</p>
 
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

          {/* Badges Detail Card */}
          {(merchantApp.is_verified || (merchantApp.badge_tier && merchantApp.badge_tier !== "none")) && (
            <MerchantBadgesDetailCard 
              isVerified={merchantApp.is_verified} 
              badgeTier={(merchantApp.badge_tier || "none") as BadgeTier}
              className="mb-6"
            />
          )}

          <div className="border-t border-border my-6" />
 
         {/* Ratings Section */}
         <div className="mb-6">
           <h2 className="text-lg font-bold text-primary mb-3">التقييمات</h2>
           <MerchantRatingsDisplay merchantId={merchantId!} />
         </div>

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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto px-1">
                  {/* Media */}
                  <div className="space-y-3">
                    {selectedProduct.image_urls && selectedProduct.image_urls.length > 0 ? (
                      <div className="rounded-2xl overflow-hidden border border-border bg-muted/10">
                        <div className="relative aspect-square bg-muted/20">
                          <img
                            src={
                              selectedProduct.image_urls[
                                Math.min(activeMediaIndex, selectedProduct.image_urls.length - 1)
                              ]
                            }
                            alt={selectedProduct.title}
                            className="w-full h-full object-cover"
                          />

                          {!!selectedProduct.video_url && (
                            <div className="absolute bottom-3 left-3">
                              <div className="inline-flex items-center gap-1 rounded-full bg-background/80 backdrop-blur px-2 py-1 border border-border text-xs text-muted-foreground">
                                <Play className="h-3.5 w-3.5" />
                                فيديو متاح
                              </div>
                            </div>
                          )}
                        </div>

                        {selectedProduct.image_urls.length > 1 && (
                          <div className="grid grid-cols-5 gap-2 p-3 bg-background/40">
                            {selectedProduct.image_urls.slice(0, 10).map((url, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setActiveMediaIndex(idx)}
                                className={`relative aspect-square rounded-lg overflow-hidden border transition-colors ${
                                  idx === activeMediaIndex
                                    ? "border-primary"
                                    : "border-border hover:border-primary/50"
                                }`}
                              >
                                <img src={url} alt={`${selectedProduct.title} ${idx + 1}`} className="w-full h-full object-cover" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-border bg-muted/20 aspect-square flex items-center justify-center">
                        <Store className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}

                    {selectedProduct.video_url && (
                      <div className="rounded-2xl border border-border overflow-hidden">
                        <video controls className="w-full" preload="metadata">
                          <source src={selectedProduct.video_url} />
                          المتصفح لا يدعم تشغيل الفيديو.
                        </video>
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="space-y-4">
                    {/* Price */}
                    {(selectedProduct.price_iqd || selectedProduct.original_price_iqd) && (
                      <div className="rounded-2xl border border-border bg-card p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs text-muted-foreground">السعر</p>
                            <div className="mt-1 flex items-baseline gap-2">
                              {selectedProduct.original_price_iqd && selectedProduct.price_iqd && selectedProduct.original_price_iqd > selectedProduct.price_iqd && (
                                <span className="text-sm text-muted-foreground line-through">
                                  {selectedProduct.original_price_iqd.toLocaleString()} د.ع
                                </span>
                              )}
                              {selectedProduct.price_iqd && (
                                <span className="text-2xl font-black text-primary">
                                  {selectedProduct.price_iqd.toLocaleString()} د.ع
                                </span>
                              )}
                            </div>
                          </div>

                          {selectedProduct.original_price_iqd && selectedProduct.price_iqd && selectedProduct.original_price_iqd > selectedProduct.price_iqd && (
                            <Badge variant="outline" className="gap-1">
                              <BadgePercent className="h-3.5 w-3.5" />
                              خصم
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    {/* ETA */}
                    {selectedProduct.estimated_days && (
                      <div className="rounded-2xl border border-border bg-card p-4">
                        <div className="flex items-center gap-2">
                          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Clock className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <Label className="text-xs">وقت التنفيذ</Label>
                            <p className="text-sm text-foreground/80 mt-0.5">{selectedProduct.estimated_days} يوم تقريباً</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Description */}
                    {selectedProduct.description && (
                      <div className="rounded-2xl border border-border bg-card p-4">
                        <Label className="text-xs">الوصف</Label>
                        <p className="text-sm text-foreground/80 mt-2 whitespace-pre-wrap leading-relaxed">
                          {selectedProduct.description}
                        </p>
                      </div>
                    )}

                    {/* Contact Button */}
                    <Button
                      className="w-full gap-2"
                      onClick={handleContactMerchant}
                    >
                      <MessageCircle className="h-4 w-4" />
                      تواصل مع التاجر
                    </Button>
                  </div>
                </div>
             )}
           </DialogContent>
         </Dialog>

         {/* Message Dialog */}
         <Dialog open={messageDialogOpen} onOpenChange={setMessageDialogOpen}>
           <DialogContent className="sm:max-w-md">
             <DialogHeader>
               <DialogTitle>مراسلة التاجر</DialogTitle>
               <DialogDescription>
                 سيتم فتح محادثة جديدة مع {merchantApp?.display_name}
               </DialogDescription>
             </DialogHeader>

             <div className="space-y-4">
               {selectedProduct && (
                 <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/20 border border-border">
                   <div className="h-12 w-12 rounded-lg overflow-hidden bg-muted/30 shrink-0">
                     {selectedProduct.image_urls?.[0] ? (
                       <img
                         src={selectedProduct.image_urls[0]}
                         alt={selectedProduct.title}
                         className="h-full w-full object-cover"
                       />
                     ) : (
                       <div className="h-full w-full flex items-center justify-center">
                         <Store className="h-5 w-5 text-muted-foreground" />
                       </div>
                     )}
                   </div>
                   <div className="flex-1 min-w-0">
                     <p className="text-sm font-medium line-clamp-1">{selectedProduct.title}</p>
                     {selectedProduct.price_iqd && (
                       <p className="text-xs text-primary font-bold mt-0.5">
                         {selectedProduct.price_iqd.toLocaleString()} د.ع
                       </p>
                     )}
                   </div>
                 </div>
               )}

               <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
                 <Checkbox
                   id="include-link"
                   checked={includeProductLink}
                   onCheckedChange={(checked) => setIncludeProductLink(!!checked)}
                 />
                 <label htmlFor="include-link" className="text-sm cursor-pointer flex-1">
                   <div className="flex items-center gap-2">
                     <LinkIcon className="h-4 w-4 text-primary" />
                     <span>إرسال رابط المنتج تلقائياً</span>
                   </div>
                   <p className="text-xs text-muted-foreground mt-0.5">
                     سيتم إرفاق رابط المنتج في بداية المحادثة
                   </p>
                 </label>
               </div>

               <div className="flex gap-2">
                 <Button
                   variant="outline"
                   className="flex-1"
                   onClick={() => setMessageDialogOpen(false)}
                 >
                   إلغاء
                 </Button>
                 <Button
                   className="flex-1 gap-2"
                   onClick={handleStartConversation}
                 >
                   <MessageCircle className="h-4 w-4" />
                   بدء المحادثة
                 </Button>
               </div>
             </div>
           </DialogContent>
         </Dialog>
       </main>
     </div>
   );
 }