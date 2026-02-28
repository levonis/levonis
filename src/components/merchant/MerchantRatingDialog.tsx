import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, Camera, Video, X, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface MerchantRatingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  merchantId: string;
  requestId: string;
  existingRating?: {
    id: string;
    rating: number;
    review_text: string | null;
    image_urls?: string[];
    video_url?: string | null;
  } | null;
}

export default function MerchantRatingDialog({
  open,
  onOpenChange,
  merchantId,
  requestId,
  existingRating,
}: MerchantRatingDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [rating, setRating] = useState(existingRating?.rating || 0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [reviewText, setReviewText] = useState(existingRating?.review_text || "");
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>(existingRating?.image_urls || []);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(existingRating?.video_url || null);
  const [uploading, setUploading] = useState(false);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + images.length > 5) {
      toast({ title: "حد أقصى 5 صور", variant: "destructive" });
      return;
    }
    setImages(prev => [...prev, ...files]);
    files.forEach(f => setImagePreviewUrls(prev => [...prev, URL.createObjectURL(f)]));
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      toast({ title: "حجم الفيديو يجب أن يكون أقل من 50MB", variant: "destructive" });
      return;
    }
    setVideoFile(file);
    setVideoPreviewUrl(URL.createObjectURL(file));
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const removeVideo = () => {
    setVideoFile(null);
    setVideoPreviewUrl(null);
  };

  const uploadFile = async (file: File, path: string) => {
    const { error } = await supabase.storage.from("merchant-reviews").upload(path, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from("merchant-reviews").getPublicUrl(path);
    return data.publicUrl;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || rating === 0) throw new Error("Invalid data");
      setUploading(true);

      // Upload new images
      const uploadedImageUrls: string[] = [];
      for (const img of images) {
        const path = `${user.id}/${requestId}/${Date.now()}-${img.name}`;
        const url = await uploadFile(img, path);
        uploadedImageUrls.push(url);
      }
      // Keep existing URLs that weren't removed + new uploads
      const existingKept = imagePreviewUrls.filter(u => u.startsWith("http") && !u.startsWith("blob:"));
      const allImageUrls = [...existingKept, ...uploadedImageUrls];

      // Upload video
      let finalVideoUrl = videoPreviewUrl?.startsWith("blob:") ? null : videoPreviewUrl;
      if (videoFile) {
        const path = `${user.id}/${requestId}/video-${Date.now()}.mp4`;
        finalVideoUrl = await uploadFile(videoFile, path);
      }

      // Calculate points
      let points = 0;
      if (allImageUrls.length > 0) points = 50;
      if (finalVideoUrl) points = 250;

      const payload = {
        rating,
        review_text: reviewText.trim() || null,
        image_urls: allImageUrls,
        video_url: finalVideoUrl,
        points_awarded: points,
      };

      if (existingRating) {
        const { error } = await supabase
          .from("merchant_ratings")
          .update(payload)
          .eq("id", existingRating.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("merchant_ratings").insert({
          merchant_id: merchantId,
          customer_id: user.id,
          request_id: requestId,
          ...payload,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      setUploading(false);
      queryClient.invalidateQueries({ queryKey: ["merchant-ratings"] });
      queryClient.invalidateQueries({ queryKey: ["merchant-rating-stats"] });
      queryClient.invalidateQueries({ queryKey: ["customer-rating"] });
      toast({ title: "تم التقييم", description: "شكراً لتقييمك! تم نشره تلقائياً." });
      onOpenChange(false);
    },
    onError: (err) => {
      setUploading(false);
      console.error(err);
      toast({ title: "خطأ", description: "فشل حفظ التقييم.", variant: "destructive" });
    },
  });

  const displayRating = hoveredRating || rating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existingRating ? "تعديل التقييم" : "تقييم التاجر"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Star Rating */}
          <div>
            <Label>التقييم بالنجوم *</Label>
            <div className="flex items-center gap-1 mt-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className="focus:outline-none transition-transform hover:scale-110"
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  onClick={() => setRating(star)}
                >
                  <Star
                    className={`h-8 w-8 ${
                      star <= displayRating ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground"
                    }`}
                  />
                </button>
              ))}
              {rating > 0 && (
                <span className="text-sm text-muted-foreground mr-2">
                  ({rating} {rating === 1 ? "نجمة" : "نجوم"})
                </span>
              )}
            </div>
          </div>

          {/* Review Text */}
          <div>
            <Label htmlFor="review">التعليق (اختياري)</Label>
            <Textarea
              id="review"
              rows={3}
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="شاركنا تجربتك مع هذا التاجر..."
              className="mt-1"
            />
          </div>

          {/* Media Upload Incentives */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <p className="text-xs font-semibold text-foreground">📸 أضف وسائط واحصل على نقاط!</p>
            <div className="flex gap-2">
              <Badge variant="secondary" className="text-xs">
                <Camera className="h-3 w-3 ml-1" />
                صورة = 50 نقطة
              </Badge>
              <Badge variant="secondary" className="text-xs">
                <Video className="h-3 w-3 ml-1" />
                فيديو = 250 نقطة
              </Badge>
            </div>
          </div>

          {/* Image Upload */}
          <div>
            <div className="flex items-center justify-between">
              <Label>الصور (حتى 5)</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => imageInputRef.current?.click()}
                disabled={imagePreviewUrls.length >= 5}
              >
                <Camera className="h-4 w-4 ml-1" />
                إضافة صورة
              </Button>
            </div>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleImageSelect}
            />
            {imagePreviewUrls.length > 0 && (
              <div className="flex gap-2 mt-2 flex-wrap">
                {imagePreviewUrls.map((url, i) => (
                  <div key={i} className="relative w-16 h-16 rounded-md overflow-hidden border border-border">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute top-0 right-0 bg-destructive text-destructive-foreground rounded-bl p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Video Upload */}
          <div>
            <div className="flex items-center justify-between">
              <Label>فيديو (اختياري)</Label>
              {!videoPreviewUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => videoInputRef.current?.click()}
                >
                  <Video className="h-4 w-4 ml-1" />
                  إضافة فيديو
                </Button>
              )}
            </div>
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handleVideoSelect}
            />
            {videoPreviewUrl && (
              <div className="relative mt-2 rounded-md overflow-hidden border border-border">
                <video src={videoPreviewUrl} className="w-full max-h-32" controls />
                <button
                  type="button"
                  onClick={removeVideo}
                  className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={rating === 0 || saveMutation.isPending || uploading}
          >
            {saveMutation.isPending || uploading ? "جارٍ الحفظ..." : existingRating ? "تحديث" : "نشر التقييم"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
