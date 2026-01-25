 import { useState } from "react";
 import { useNavigate } from "react-router-dom";
 import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
 import { Store, Plus, Edit2, X, Star, Facebook, Instagram, ArrowRight, Settings } from "lucide-react";
 import { supabase } from "@/integrations/supabase/client";
 import { useAuth } from "@/hooks/useAuth";
 import { Button } from "@/components/ui/button";
 import { Card, CardContent } from "@/components/ui/card";
 import { Skeleton } from "@/components/ui/skeleton";
 import { Badge } from "@/components/ui/badge";
 import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
 import { Label } from "@/components/ui/label";
 import { Input } from "@/components/ui/input";
 import { Textarea } from "@/components/ui/textarea";
 import { Switch } from "@/components/ui/switch";
 import { useToast } from "@/hooks/use-toast";
import MerchantProductMediaUpload from "@/components/merchant/MerchantProductMediaUpload";
import AvatarWithFrame from "@/components/merchant/AvatarWithFrame";
import StoreProfileEditor from "@/components/merchant/StoreProfileEditor";
 
 interface MerchantProduct {
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
  is_featured: boolean;
 }
 
 export default function CommunityMerchantStore() {
   const navigate = useNavigate();
   const { user } = useAuth();
   const { toast } = useToast();
   const queryClient = useQueryClient();
 
   const [productDialogOpen, setProductDialogOpen] = useState(false);
   const [detailDialogOpen, setDetailDialogOpen] = useState(false);
   const [profileEditorOpen, setProfileEditorOpen] = useState(false);
   const [selectedProduct, setSelectedProduct] = useState<MerchantProduct | null>(null);
 
   const [formData, setFormData] = useState({
     title: "",
     description: "",
     price_iqd: "",
     original_price_iqd: "",
     estimated_days: "",
     is_active: true,
    is_featured: false,
   });

  const [mediaState, setMediaState] = useState({
    image_urls: [] as string[],
    video_url: "",
    primary_image_index: 0,
  });
 
   // Fetch merchant application
   const { data: merchantApp, isLoading: appLoading } = useQuery({
     queryKey: ["merchant-app", user?.id],
     enabled: !!user?.id,
     queryFn: async () => {
       const { data, error } = await supabase
         .from("merchant_applications")
         .select("id, status, display_name, bio, store_image_url, social_links, selected_frame_id")
         .eq("user_id", user!.id)
         .eq("status", "approved")
         .maybeSingle();
       if (error) throw error;
       return data;
     },
   });
 
   // Fetch profile for username
   const { data: profile } = useQuery({
     queryKey: ["profile", user?.id],
     enabled: !!user?.id,
     queryFn: async () => {
       const { data, error } = await supabase
         .from("profiles")
         .select("username")
         .eq("id", user!.id)
         .maybeSingle();
       if (error) throw error;
       return data;
     },
   });

   // Fetch selected frame
   const { data: selectedFrame } = useQuery({
     queryKey: ["selected-frame", merchantApp?.selected_frame_id],
     enabled: !!merchantApp?.selected_frame_id,
     queryFn: async () => {
       const { data, error } = await supabase
         .from("avatar_frames")
         .select("id, name_ar, image_url")
         .eq("id", merchantApp!.selected_frame_id!)
         .maybeSingle();
       if (error) throw error;
       return data;
     },
   });
 
   // Fetch merchant products
   const { data: products = [], isLoading: productsLoading } = useQuery({
     queryKey: ["merchant-products", merchantApp?.id],
     enabled: !!merchantApp?.id,
     queryFn: async () => {
       const { data, error } = await supabase
         .from("merchant_products")
         .select("*")
         .eq("merchant_id", merchantApp!.id)
         .order("created_at", { ascending: false });
       if (error) throw error;
       return data as MerchantProduct[];
     },
   });
 
   // Save product mutation
   const saveMutation = useMutation({
     mutationFn: async () => {
       const payload = {
         merchant_id: merchantApp!.id,
         title: formData.title.trim(),
         description: formData.description.trim() || null,
         price_iqd: formData.price_iqd ? parseInt(formData.price_iqd, 10) : null,
         original_price_iqd: formData.original_price_iqd ? parseInt(formData.original_price_iqd, 10) : null,
        image_urls: mediaState.image_urls.length > 0 ? mediaState.image_urls : null,
        video_url: mediaState.video_url || null,
        primary_image_index: mediaState.primary_image_index,
         estimated_days: formData.estimated_days ? parseInt(formData.estimated_days, 10) : null,
         is_active: formData.is_active,
        is_featured: formData.is_featured,
       };
 
       if (selectedProduct) {
         const { error } = await supabase
           .from("merchant_products")
           .update(payload)
           .eq("id", selectedProduct.id);
         if (error) throw error;
       } else {
         const { error } = await supabase.from("merchant_products").insert(payload);
         if (error) throw error;
       }
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ["merchant-products"] });
       setProductDialogOpen(false);
       setSelectedProduct(null);
       setFormData({
         title: "",
         description: "",
         price_iqd: "",
         original_price_iqd: "",
         estimated_days: "",
         is_active: true,
        is_featured: false,
       });
      setMediaState({
        image_urls: [],
        video_url: "",
        primary_image_index: 0,
      });
       toast({ title: selectedProduct ? "تم التحديث" : "تمت الإضافة", description: "المنتج حُفظ بنجاح." });
     },
     onError: () => {
      toast({ title: "خطأ", description: "فشل حفظ المنتج. قد تكون وصلت للحد الأقصى (3 منتجات مميزة).", variant: "destructive" });
     },
   });
 
   // Delete product mutation
   const deleteMutation = useMutation({
     mutationFn: async (id: string) => {
       const { error } = await supabase.from("merchant_products").delete().eq("id", id);
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ["merchant-products"] });
       toast({ title: "تم الحذف", description: "المنتج حُذف بنجاح." });
     },
     onError: () => {
       toast({ title: "خطأ", description: "فشل حذف المنتج.", variant: "destructive" });
     },
   });
 
   const handleOpenEdit = (product: MerchantProduct) => {
     setSelectedProduct(product);
     setFormData({
       title: product.title,
       description: product.description || "",
       price_iqd: product.price_iqd?.toString() || "",
       original_price_iqd: product.original_price_iqd?.toString() || "",
       estimated_days: product.estimated_days?.toString() || "",
       is_active: product.is_active,
      is_featured: product.is_featured || false,
     });
    setMediaState({
      image_urls: product.image_urls || [],
      video_url: product.video_url || "",
      primary_image_index: product.primary_image_index,
    });
     setProductDialogOpen(true);
   };
 
   const handleOpenAdd = () => {
     setSelectedProduct(null);
     setFormData({
       title: "",
       description: "",
       price_iqd: "",
       original_price_iqd: "",
       estimated_days: "",
       is_active: true,
      is_featured: false,
     });
    setMediaState({
      image_urls: [],
      video_url: "",
      primary_image_index: 0,
    });
     setProductDialogOpen(true);
   };
 
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
           <Skeleton className="h-40 rounded-2xl" />
         </main>
       </div>
     );
   }
 
   if (!merchantApp) {
     return (
       <div className="min-h-screen bg-background/95">
         <main className="container mx-auto px-4 py-8 pt-24 max-w-4xl">
           <Card className="border-border bg-card p-6">
             <p className="text-sm text-muted-foreground">لا يمكن الوصول لهذه الصفحة إلا للتجار المقبولين.</p>
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
             <div>
               <h1 className="text-2xl sm:text-3xl font-black text-primary">المتجر</h1>
               <p className="text-sm text-muted-foreground">{merchantApp.display_name}</p>
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
             <div className="flex flex-col sm:flex-row gap-4 items-start">
               {/* Circular store image with frame */}
               <div className="shrink-0 relative">
                 <AvatarWithFrame
                   imageUrl={merchantApp.store_image_url}
                   frameUrl={selectedFrame?.image_url}
                   size="lg"
                 />
                 <Button
                   size="icon"
                   variant="secondary"
                   className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full"
                   onClick={() => setProfileEditorOpen(true)}
                 >
                   <Settings className="h-4 w-4" />
                 </Button>
               </div>
 
               <div className="flex-1">
                 <div className="flex items-center gap-2">
                   <h2 className="text-xl font-bold text-primary">{merchantApp.display_name}</h2>
                   <Button
                     size="sm"
                     variant="ghost"
                     className="h-7 px-2"
                     onClick={() => setProfileEditorOpen(true)}
                   >
                     <Edit2 className="h-3.5 w-3.5" />
                   </Button>
                 </div>
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
         <div className="mb-4 flex items-center justify-between">
           <h2 className="text-lg font-bold text-primary">المنتجات</h2>
           <Button size="sm" onClick={handleOpenAdd} className="gap-2">
             <Plus className="h-4 w-4" />
             إضافة منتج
           </Button>
         </div>
 
         {products.length === 0 ? (
           <Card className="border-border bg-card p-6">
             <p className="text-sm text-muted-foreground text-center">لا توجد منتجات بعد. ابدأ بإضافة منتج جديد.</p>
           </Card>
         ) : (
           <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
             {products.map((p) => {
               const mainImg = p.image_urls?.[p.primary_image_index] || p.image_urls?.[0];
               return (
                 <Card
                   key={p.id}
                   className="border-border bg-card overflow-hidden cursor-pointer hover:shadow-lg transition-shadow group"
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
                     {!p.is_active && (
                       <Badge className="absolute top-2 right-2 bg-muted text-muted-foreground">مخفي</Badge>
                     )}
                     {p.is_featured && (
                       <Badge className="absolute bottom-2 right-2 bg-primary text-primary-foreground text-xs">
                         مميز
                       </Badge>
                     )}
                     <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                       <Button
                         size="sm"
                         variant="secondary"
                         className="h-7 w-7 p-0"
                         onClick={(e) => {
                           e.stopPropagation();
                           handleOpenEdit(p);
                         }}
                       >
                         <Edit2 className="h-3.5 w-3.5" />
                       </Button>
                       <Button
                         size="sm"
                         variant="destructive"
                         className="h-7 w-7 p-0"
                         onClick={(e) => {
                           e.stopPropagation();
                           if (confirm("متأكد من الحذف؟")) deleteMutation.mutate(p.id);
                         }}
                       >
                         <X className="h-3.5 w-3.5" />
                       </Button>
                     </div>
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
                       <p className="text-xs text-muted-foreground mt-1">{p.estimated_days} يوم تقريباً</p>
                     )}
                   </CardContent>
                 </Card>
               );
             })}
           </div>
         )}
 
         {/* Add/Edit Product Dialog */}
         <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
           <DialogContent className="sm:max-w-2xl">
             <DialogHeader>
               <DialogTitle>{selectedProduct ? "تعديل المنتج" : "إضافة منتج جديد"}</DialogTitle>
             </DialogHeader>
             <div className="space-y-4 max-h-[60vh] overflow-y-auto px-1">
               <div>
                 <Label htmlFor="title">العنوان *</Label>
                 <Input
                   id="title"
                   value={formData.title}
                   onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                   placeholder="مثلاً: طباعة 3D مخصصة"
                 />
               </div>
 
               <div>
                 <Label htmlFor="description">الوصف</Label>
                 <Textarea
                   id="description"
                   rows={3}
                   value={formData.description}
                   onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                   placeholder="وصف المنتج..."
                 />
               </div>
 
               <div className="grid grid-cols-2 gap-3">
                 <div>
                   <Label htmlFor="price">السعر (د.ع)</Label>
                   <Input
                     id="price"
                     type="number"
                     value={formData.price_iqd}
                     onChange={(e) => setFormData({ ...formData, price_iqd: e.target.value })}
                     placeholder="مثلاً: 50000"
                   />
                 </div>
                 <div>
                   <Label htmlFor="original_price">السعر قبل الخصم (د.ع)</Label>
                   <Input
                     id="original_price"
                     type="number"
                     value={formData.original_price_iqd}
                     onChange={(e) => setFormData({ ...formData, original_price_iqd: e.target.value })}
                     placeholder="مثلاً: 70000"
                   />
                 </div>
               </div>
 
              <MerchantProductMediaUpload
                imageUrls={mediaState.image_urls}
                onImagesChange={(urls) => setMediaState({ ...mediaState, image_urls: urls })}
                primaryImageIndex={mediaState.primary_image_index}
                onPrimaryImageChange={(idx) => setMediaState({ ...mediaState, primary_image_index: idx })}
                videoUrl={mediaState.video_url}
                onVideoUrlChange={(url) => setMediaState({ ...mediaState, video_url: url })}
              />
 
               <div>
                 <Label htmlFor="estimated_days">وقت التنفيذ التقديري (بالأيام)</Label>
                 <Input
                   id="estimated_days"
                   type="number"
                   value={formData.estimated_days}
                   onChange={(e) => setFormData({ ...formData, estimated_days: e.target.value })}
                   placeholder="مثلاً: 7"
                 />
               </div>
 
               <div className="flex items-center gap-2">
                 <Switch
                   id="is_active"
                   checked={formData.is_active}
                   onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                 />
                 <Label htmlFor="is_active" className="cursor-pointer">
                   نشر المنتج (ظاهر للزبائن)
                 </Label>
               </div>

               <div className="flex items-center gap-2">
                 <Switch
                   id="is_featured"
                   checked={formData.is_featured}
                   onCheckedChange={(checked) => setFormData({ ...formData, is_featured: checked })}
                 />
                 <Label htmlFor="is_featured" className="cursor-pointer">
                   منتج مميز (يظهر في صفحة التجار، حد أقصى 3)
                 </Label>
               </div>
             </div>
 
             <div className="flex gap-2 mt-4">
               <Button variant="outline" onClick={() => setProductDialogOpen(false)} className="flex-1">
                 إلغاء
               </Button>
               <Button
                 onClick={() => saveMutation.mutate()}
                 disabled={!formData.title.trim() || saveMutation.isPending}
                 className="flex-1"
               >
                 {saveMutation.isPending ? "جارٍ الحفظ..." : selectedProduct ? "حفظ التعديل" : "إضافة"}
               </Button>
             </div>
           </DialogContent>
         </Dialog>
 
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
 
                 <div>
                   <Label>حالة النشر</Label>
                   <Badge className="mt-1">{selectedProduct.is_active ? "نشط" : "مخفي"}</Badge>
                 </div>
               </div>
             )}
           </DialogContent>
         </Dialog>

         {/* Store Profile Editor */}
         {merchantApp && (
           <StoreProfileEditor
             open={profileEditorOpen}
             onOpenChange={setProfileEditorOpen}
             merchantApp={{
               id: merchantApp.id,
               display_name: merchantApp.display_name,
               bio: merchantApp.bio,
               store_image_url: merchantApp.store_image_url,
               social_links: socialLinks || null,
               selected_frame_id: merchantApp.selected_frame_id || null,
             }}
           />
         )}
       </main>
     </div>
   );
 }