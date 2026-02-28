import { useState, useRef } from "react";
import { Star, Camera, Video, X, Sparkles, Gift } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ProductRatingCardProps {
  itemId: string;
  productId: string;
  productName: string;
  imageUrl?: string;
  rating: number;
  comment: string;
  onRatingChange: (productId: string, rating: number) => void;
  onCommentChange: (productId: string, comment: string) => void;
  images: File[];
  onImagesChange: (productId: string, images: File[]) => void;
  video: File | null;
  onVideoChange: (productId: string, video: File | null) => void;
}

const ratingLabels: Record<number, string> = {
  1: "سيء 😞",
  2: "مقبول 😐",
  3: "جيد 🙂",
  4: "جيد جداً 😊",
  5: "ممتاز 🤩",
};

export default function ProductRatingCard({
  itemId,
  productId,
  productName,
  imageUrl,
  rating,
  comment,
  onRatingChange,
  onCommentChange,
  images,
  onImagesChange,
  video,
  onVideoChange,
}: ProductRatingCardProps) {
  const [hoveredStar, setHoveredStar] = useState(0);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  const displayRating = hoveredStar || rating;

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + images.length > 5) return;
    const newImages = [...images, ...files];
    onImagesChange(productId, newImages);
    files.forEach((f) =>
      setImagePreviews((prev) => [...prev, URL.createObjectURL(f)])
    );
  };

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    onImagesChange(productId, newImages);
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.size > 50 * 1024 * 1024) return;
    onVideoChange(productId, file);
    setVideoPreview(URL.createObjectURL(file));
  };

  const removeVideo = () => {
    onVideoChange(productId, null);
    setVideoPreview(null);
  };

  return (
    <Card className="relative overflow-hidden border border-primary/20 bg-card/40 backdrop-blur-xl shadow-[0_8px_32px_hsl(var(--primary)/0.1)] transition-all duration-300 hover:shadow-[0_12px_48px_hsl(var(--primary)/0.15)] hover:border-primary/30">
      {/* Decorative gradient orb */}
      <div className="absolute -top-20 -left-20 w-40 h-40 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -right-16 w-32 h-32 bg-accent/10 rounded-full blur-3xl pointer-events-none" />

      <CardContent className="relative p-5 space-y-5">
        {/* Product header */}
        <div className="flex items-center gap-4">
          {imageUrl ? (
            <div className="relative group">
              <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-primary/20 shadow-[0_4px_16px_hsl(var(--primary)/0.15)] transition-transform duration-300 group-hover:scale-105">
                <img
                  src={imageUrl}
                  alt={productName}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-lg">
                <Star className="h-3 w-3 text-primary-foreground fill-primary-foreground" />
              </div>
            </div>
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-muted/50 backdrop-blur border border-border/50 flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-foreground text-base leading-tight truncate">
              {productName}
            </h4>
            {displayRating > 0 && (
              <p className="text-sm text-primary font-semibold mt-1 animate-fade-in">
                {ratingLabels[displayRating]}
              </p>
            )}
          </div>
        </div>

        {/* Star rating - 3D style */}
        <div className="flex flex-col items-center gap-3 py-3">
          <p className="text-xs text-muted-foreground font-medium">كيف تقيّم هذا المنتج؟</p>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className="relative group focus:outline-none"
                onMouseEnter={() => setHoveredStar(star)}
                onMouseLeave={() => setHoveredStar(0)}
                onClick={() => onRatingChange(productId, star)}
              >
                <div
                  className={`transition-all duration-200 ${
                    star <= displayRating
                      ? "scale-110 drop-shadow-[0_4px_8px_rgba(250,204,21,0.4)]"
                      : "scale-100 opacity-40 hover:opacity-70"
                  }`}
                >
                  <Star
                    className={`h-10 w-10 transition-colors ${
                      star <= displayRating
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-muted-foreground"
                    }`}
                  />
                </div>
                {/* 3D shadow effect */}
                {star <= displayRating && (
                  <div className="absolute inset-0 -z-10 translate-y-1 blur-sm">
                    <Star className="h-10 w-10 fill-yellow-400/30 text-yellow-400/30" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Comment */}
        <div>
          <Textarea
            value={comment}
            onChange={(e) => onCommentChange(productId, e.target.value)}
            placeholder="شاركنا رأيك في المنتج... ✍️"
            rows={3}
            className="bg-background/50 backdrop-blur border-border/50 focus:border-primary/50 resize-none"
          />
        </div>

        {/* Rewards banner */}
        <div className="rounded-xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border border-amber-500/20 p-3 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-2">
            <Gift className="h-4 w-4 text-amber-500" />
            <span className="text-xs font-bold text-foreground">أضف وسائط واحصل على نقاط!</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Badge variant="secondary" className="text-[10px] bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400">
              <Camera className="h-3 w-3 ml-1" />
              صورة = 50 نقطة
            </Badge>
            <Badge variant="secondary" className="text-[10px] bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400">
              <Video className="h-3 w-3 ml-1" />
              فيديو = 250 نقطة
            </Badge>
          </div>
        </div>

        {/* Media upload section */}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => imageRef.current?.click()}
            disabled={imagePreviews.length >= 5}
            className="flex-1 bg-background/50 backdrop-blur border-border/50 hover:border-primary/40 hover:bg-primary/5"
          >
            <Camera className="h-4 w-4 ml-2" />
            إضافة صور ({imagePreviews.length}/5)
          </Button>
          {!videoPreview && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => videoRef.current?.click()}
              className="flex-1 bg-background/50 backdrop-blur border-border/50 hover:border-purple-500/40 hover:bg-purple-500/5"
            >
              <Video className="h-4 w-4 ml-2" />
              إضافة فيديو
            </Button>
          )}
        </div>

        <input ref={imageRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageSelect} />
        <input ref={videoRef} type="file" accept="video/*" className="hidden" onChange={handleVideoSelect} />

        {/* Image previews */}
        {imagePreviews.length > 0 && (
          <div className="flex gap-2 flex-wrap animate-fade-in">
            {imagePreviews.map((url, i) => (
              <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border border-border/50 shadow-md group">
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute top-0 right-0 bg-destructive text-destructive-foreground rounded-bl-lg p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Video preview */}
        {videoPreview && (
          <div className="relative rounded-xl overflow-hidden border border-border/50 shadow-md animate-fade-in">
            <video src={videoPreview} className="w-full max-h-32" controls />
            <button
              type="button"
              onClick={removeVideo}
              className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1 shadow-lg"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
