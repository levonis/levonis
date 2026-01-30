import { useState, useCallback, useRef } from "react";
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Check, X } from "lucide-react";

interface AvatarCropperProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageSrc: string;
  onCropComplete: (croppedBlob: Blob) => void;
}

function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number
): Crop {
  return centerCrop(
    makeAspectCrop(
      {
        unit: "%",
        width: 80,
      },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  );
}

async function getCroppedImg(
  image: HTMLImageElement,
  crop: PixelCrop
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("No 2d context");
  }

  // Get the actual rendered size vs natural size ratio
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  
  // Calculate the actual crop coordinates in the original image
  const cropX = crop.x * scaleX;
  const cropY = crop.y * scaleY;
  const cropWidth = crop.width * scaleX;
  const cropHeight = crop.height * scaleY;

  // Output size (square for avatar)
  const outputSize = 400;
  canvas.width = outputSize;
  canvas.height = outputSize;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Draw the cropped portion of the image
  ctx.drawImage(
    image,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    outputSize,
    outputSize
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          console.error("[AvatarCropper] Canvas toBlob returned null");
          reject(new Error("Canvas is empty"));
          return;
        }
        console.log("[AvatarCropper] Cropped blob created, size:", blob.size);
        resolve(blob);
      },
      "image/jpeg",
      0.9
    );
  });
}

export default function AvatarCropper({
  open,
  onOpenChange,
  imageSrc,
  onCropComplete,
}: AvatarCropperProps) {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [isProcessing, setIsProcessing] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    console.log("[AvatarCropper] Image loaded:", width, "x", height);
    const newCrop = centerAspectCrop(width, height, 1);
    setCrop(newCrop);
  }, []);

  const handleConfirm = async () => {
    console.log("[AvatarCropper] Confirm clicked, completedCrop:", completedCrop);
    if (!completedCrop || !imgRef.current) {
      console.error("[AvatarCropper] Missing crop or image ref");
      return;
    }

    setIsProcessing(true);
    try {
      const croppedBlob = await getCroppedImg(imgRef.current, completedCrop);
      onCropComplete(croppedBlob);
      onOpenChange(false);
    } catch (error) {
      console.error("[AvatarCropper] Failed to crop image:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="text-center text-base">قص الصورة الشخصية</DialogTitle>
          <p className="text-xs text-muted-foreground text-center">اسحب لتحديد منطقة القص</p>
        </DialogHeader>

        <div className="p-4 pt-2">
          {/* Cropper Area */}
          <div className="relative bg-muted/30 rounded-xl overflow-hidden flex items-center justify-center" style={{ minHeight: 250 }}>
            {imageSrc ? (
              <ReactCrop
                crop={crop}
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                onComplete={(c) => {
                  console.log("[AvatarCropper] Crop complete:", c);
                  setCompletedCrop(c);
                }}
                aspect={1}
                circularCrop
                className="max-w-full"
              >
                <img
                  ref={imgRef}
                  src={imageSrc}
                  alt="صورة للقص"
                  onLoad={onImageLoad}
                  style={{ maxHeight: "50vh", maxWidth: "100%" }}
                  crossOrigin="anonymous"
                />
              </ReactCrop>
            ) : (
              <div className="text-muted-foreground text-sm">لا توجد صورة</div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center gap-3 p-4 border-t bg-muted/30">
          <Button
            type="button"
            variant="ghost"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            <X className="h-4 w-4 ml-1" />
            إلغاء
          </Button>
          <Button
            type="button"
            className="flex-1 bg-gradient-to-b from-primary to-accent"
            onClick={handleConfirm}
            disabled={isProcessing || !completedCrop}
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin ml-1" />
            ) : (
              <Check className="h-4 w-4 ml-1" />
            )}
            تأكيد
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
