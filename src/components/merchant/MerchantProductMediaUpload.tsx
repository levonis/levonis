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

    // Reset input so same file can be selected again
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

      const newUrls = [...imageUrls, publicUrl];
      onImagesChange(newUrls);
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

  const handleRemoveImage = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    const newImages = imageUrls.filter((_, i) => i !== index);
    onImagesChange(newImages);

    if (primaryImageIndex === index) {
      onPrimaryImageChange(0);
    } else if (primaryImageIndex > index) {
      onPrimaryImageChange(primaryImageIndex - 1);
    }
  };

  const handleSetPrimary = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    onPrimaryImageChange(index);
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
             <div key={`img-${idx}-${url.slice(-10)}`} className="relative aspect-square rounded-lg overflow-hidden border border-border">
               <img src={url} alt={`صورة ${idx + 1}`} className="w-full h-full object-cover" />

               {/* Primary badge */}
               {primaryImageIndex === idx && (
                 <div className="absolute top-1 right-1 bg-primary text-primary-foreground px-1.5 py-0.5 rounded text-[10px] flex items-center gap-0.5 pointer-events-none">
                   <Star className="h-2.5 w-2.5 fill-current" />
                   رئيسية
                 </div>
               )}

               {/* Always-visible controls */}
               <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 flex items-center justify-between">
                 {primaryImageIndex !== idx ? (
                   <button
                     type="button"
                     className="h-6 px-1.5 text-[10px] gap-0.5 flex items-center bg-white/20 backdrop-blur-sm text-white rounded hover:bg-white/30 active:scale-95 transition-all"
                     onClick={(e) => handleSetPrimary(e, idx)}
                   >
                     <Star className="h-2.5 w-2.5" />
                     رئيسية
                   </button>
                 ) : (
                   <span />
                 )}
                 <button
                   type="button"
                   className="h-6 w-6 flex items-center justify-center bg-destructive/80 text-white rounded hover:bg-destructive active:scale-95 transition-all"
                   onClick={(e) => handleRemoveImage(e, idx)}
                 >
                   <X className="h-3 w-3" />
                 </button>
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
          حد أقصى 10 صور، حجم كل صورة أقل من 5 MB.
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
            <div className="relative rounded-lg overflow-hidden border border-border">
              <video src={videoUrl} controls className="w-full max-h-64 bg-black" />
              <Button
                size="sm"
                variant="destructive"
                className="absolute top-2 left-2"
                onClick={handleRemoveVideo}
                type="button"
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
