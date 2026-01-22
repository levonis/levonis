 import { useState, useRef } from "react";
 import { Upload, X, Star, Video, Image as ImageIcon, Loader2 } from "lucide-react";
 import { Button } from "@/components/ui/button";
 import { Label } from "@/components/ui/label";
 import { useToast } from "@/hooks/use-toast";
 import { supabase } from "@/integrations/supabase/client";
 import { useAuth } from "@/hooks/useAuth";
 import { ImageCropper } from "@/components/marketplace/ImageCropper";
 
 interface MerchantProductMediaUploadProps {
   imageUrls: string[];
   onImagesChange: (urls: string[]) => void;
   primaryImageIndex: number;
   onPrimaryImageChange: (index: number) => void;
   videoUrl: string;
   onVideoUrlChange: (url: string) => void;
 }
 
 export default function MerchantProductMediaUpload({
   imageUrls,
   onImagesChange,
   primaryImageIndex,
   onPrimaryImageChange,
   videoUrl,
   onVideoUrlChange,
 }: MerchantProductMediaUploadProps) {
   const { user } = useAuth();
   const { toast } = useToast();
   const imageInputRef = useRef<HTMLInputElement>(null);
   const videoInputRef = useRef<HTMLInputElement>(null);
 
   const [cropperOpen, setCropperOpen] = useState(false);
   const [currentImageSrc, setCurrentImageSrc] = useState("");
   const [isUploading, setIsUploading] = useState(false);
 
   const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (!file) return;
 
     if (!file.type.startsWith("image/")) {
       toast({ title: "خطأ", description: "يرجى اختيار صورة.", variant: "destructive" });
       return;
     }
 
     if (file.size > 5 * 1024 * 1024) {
       toast({ title: "خطأ", description: "حجم الصورة يجب أن يكون أقل من 5 MB.", variant: "destructive" });
       return;
     }
 
     const reader = new FileReader();
     reader.onload = () => {
       setCurrentImageSrc(reader.result as string);
       setCropperOpen(true);
     };
     reader.readAsDataURL(file);
 
     // Reset input
     if (imageInputRef.current) imageInputRef.current.value = "";
   };
 
   const handleCropComplete = async (croppedBlob: Blob) => {
     if (!user?.id) return;
 
     setIsUploading(true);
     try {
       const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
       const { data, error } = await supabase.storage
         .from("merchant_product_media")
         .upload(fileName, croppedBlob, {
           contentType: "image/jpeg",
           upsert: false,
         });
 
       if (error) throw error;
 
       const {
         data: { publicUrl },
       } = supabase.storage.from("merchant_product_media").getPublicUrl(data.path);
 
       onImagesChange([...imageUrls, publicUrl]);
       toast({ title: "تم الرفع", description: "تم رفع الصورة بنجاح." });
     } catch (err) {
       console.error(err);
       toast({ title: "خطأ", description: "فشل رفع الصورة.", variant: "destructive" });
     } finally {
       setIsUploading(false);
       setCropperOpen(false);
     }
   };
 
   const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (!file || !user?.id) return;
 
     if (!file.type.startsWith("video/")) {
       toast({ title: "خطأ", description: "يرجى اختيار فيديو.", variant: "destructive" });
       return;
     }
 
     if (file.size > 50 * 1024 * 1024) {
       toast({ title: "خطأ", description: "حجم الفيديو يجب أن يكون أقل من 50 MB.", variant: "destructive" });
       return;
     }
 
     setIsUploading(true);
     try {
       const fileName = `${user.id}/${Date.now()}-${file.name}`;
       const { data, error } = await supabase.storage
         .from("merchant_product_media")
         .upload(fileName, file, {
           contentType: file.type,
           upsert: false,
         });
 
       if (error) throw error;
 
       const {
         data: { publicUrl },
       } = supabase.storage.from("merchant_product_media").getPublicUrl(data.path);
 
       onVideoUrlChange(publicUrl);
       toast({ title: "تم الرفع", description: "تم رفع الفيديو بنجاح." });
     } catch (err) {
       console.error(err);
       toast({ title: "خطأ", description: "فشل رفع الفيديو.", variant: "destructive" });
     } finally {
       setIsUploading(false);
       if (videoInputRef.current) videoInputRef.current.value = "";
     }
   };
 
   const handleRemoveImage = (index: number) => {
     const newImages = imageUrls.filter((_, i) => i !== index);
     onImagesChange(newImages);
 
     // Adjust primary index if needed
     if (primaryImageIndex === index) {
       onPrimaryImageChange(0);
     } else if (primaryImageIndex > index) {
       onPrimaryImageChange(primaryImageIndex - 1);
     }
   };
 
   const handleRemoveVideo = () => {
     onVideoUrlChange("");
   };
 
   return (
     <div className="space-y-4">
       {/* Images Section */}
       <div>
         <Label>الصور (اختياري)</Label>
         <div className="mt-2 grid grid-cols-3 gap-2">
           {imageUrls.map((url, idx) => (
             <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-border">
               <img src={url} alt={`صورة ${idx + 1}`} className="w-full h-full object-cover" />
 
               {/* Primary badge */}
               {primaryImageIndex === idx && (
                 <div className="absolute top-1 right-1 bg-primary text-primary-foreground px-2 py-0.5 rounded-md text-xs flex items-center gap-1">
                   <Star className="h-3 w-3 fill-current" />
                   رئيسية
                 </div>
               )}
 
               {/* Controls */}
               <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                 {primaryImageIndex !== idx && (
                   <Button
                     size="sm"
                     variant="secondary"
                     className="h-7 px-2 text-xs"
                     onClick={() => onPrimaryImageChange(idx)}
                   >
                     <Star className="h-3 w-3 ml-1" />
                     رئيسية
                   </Button>
                 )}
                 <Button
                   size="sm"
                   variant="destructive"
                   className="h-7 w-7 p-0"
                   onClick={() => handleRemoveImage(idx)}
                 >
                   <X className="h-3.5 w-3.5" />
                 </Button>
               </div>
             </div>
           ))}
 
           {/* Add image button */}
           {imageUrls.length < 10 && (
             <button
               type="button"
               onClick={() => imageInputRef.current?.click()}
               disabled={isUploading}
               className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary disabled:opacity-50"
             >
               {isUploading ? (
                 <Loader2 className="h-6 w-6 animate-spin" />
               ) : (
                 <>
                   <ImageIcon className="h-6 w-6" />
                   <span className="text-xs">إضافة صورة</span>
                 </>
               )}
             </button>
           )}
         </div>
         <p className="text-xs text-muted-foreground mt-1">
           حد أقصى 10 صور، حجم كل صورة أقل من 5 MB. اضغط على صورة لتحديدها كرئيسية.
         </p>
         <input
           ref={imageInputRef}
           type="file"
           accept="image/*"
           onChange={handleImageSelect}
           className="hidden"
         />
       </div>
 
       {/* Video Section */}
       <div>
         <Label>الفيديو (اختياري)</Label>
         <div className="mt-2">
           {videoUrl ? (
             <div className="relative group rounded-lg overflow-hidden border border-border">
               <video src={videoUrl} controls className="w-full max-h-64 bg-black" />
               <Button
                 size="sm"
                 variant="destructive"
                 className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity"
                 onClick={handleRemoveVideo}
               >
                 <X className="h-3.5 w-3.5 ml-1" />
                 حذف
               </Button>
             </div>
           ) : (
             <button
               type="button"
               onClick={() => videoInputRef.current?.click()}
               disabled={isUploading}
               className="w-full py-8 rounded-lg border-2 border-dashed border-border hover:border-primary transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary disabled:opacity-50"
             >
               {isUploading ? (
                 <Loader2 className="h-6 w-6 animate-spin" />
               ) : (
                 <>
                   <Video className="h-6 w-6" />
                   <span className="text-sm">رفع فيديو</span>
                 </>
               )}
             </button>
           )}
         </div>
         <p className="text-xs text-muted-foreground mt-1">حد أقصى 50 MB للفيديو.</p>
         <input
           ref={videoInputRef}
           type="file"
           accept="video/*"
           onChange={handleVideoSelect}
           className="hidden"
         />
       </div>
 
       {/* Image Cropper Dialog */}
       <ImageCropper
         open={cropperOpen}
         onOpenChange={setCropperOpen}
         imageSrc={currentImageSrc}
         onCropComplete={handleCropComplete}
         aspectRatio={1}
         isUploading={isUploading}
       />
     </div>
   );
 }