import { useState, useCallback, useRef } from "react";
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Check, X, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Slider } from "@/components/ui/slider";

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
        width: 90,
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
  crop: PixelCrop,
  scale: number = 1,
  rotate: number = 0
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("No 2d context");
  }

  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  
  // Calculate the size of the cropped area
  const cropWidth = crop.width * scaleX;
  const cropHeight = crop.height * scaleY;

  // Output size (square for avatar)
  const outputSize = 400;
  canvas.width = outputSize;
  canvas.height = outputSize;

  ctx.imageSmoothingQuality = "high";

  // Apply rotation
  const cropX = crop.x * scaleX;
  const cropY = crop.y * scaleY;

  // Draw the cropped image
  ctx.save();
  ctx.translate(outputSize / 2, outputSize / 2);
  ctx.rotate((rotate * Math.PI) / 180);
  ctx.scale(scale, scale);
  ctx.translate(-outputSize / 2, -outputSize / 2);
  
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
  ctx.restore();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Canvas is empty"));
          return;
        }
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
  const [scale, setScale] = useState(1);
  const [rotate, setRotate] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, 1));
  }, []);

  const handleConfirm = async () => {
    if (!completedCrop || !imgRef.current) return;

    setIsProcessing(true);
    try {
      const croppedBlob = await getCroppedImg(
        imgRef.current,
        completedCrop,
        scale,
        rotate
      );
      onCropComplete(croppedBlob);
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to crop image:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setScale(1);
    setRotate(0);
    if (imgRef.current) {
      const { width, height } = imgRef.current;
      setCrop(centerAspectCrop(width, height, 1));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="text-center">قص الصورة الشخصية</DialogTitle>
        </DialogHeader>

        <div className="p-4 space-y-4">
          {/* Cropper Area */}
          <div className="relative bg-muted/50 rounded-xl overflow-hidden flex items-center justify-center min-h-[280px] max-h-[50vh]">
            <ReactCrop
              crop={crop}
              onChange={(_, percentCrop) => setCrop(percentCrop)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={1}
              circularCrop
              className="max-h-[50vh]"
            >
              <img
                ref={imgRef}
                src={imageSrc}
                alt="صورة للقص"
                style={{
                  transform: `scale(${scale}) rotate(${rotate}deg)`,
                  maxHeight: "50vh",
                  maxWidth: "100%",
                }}
                onLoad={onImageLoad}
                className="object-contain"
              />
            </ReactCrop>
          </div>

          {/* Controls */}
          <div className="space-y-3">
            {/* Zoom Control */}
            <div className="flex items-center gap-3">
              <ZoomOut className="h-4 w-4 text-muted-foreground shrink-0" />
              <Slider
                value={[scale]}
                onValueChange={([v]) => setScale(v)}
                min={0.5}
                max={3}
                step={0.1}
                className="flex-1"
              />
              <ZoomIn className="h-4 w-4 text-muted-foreground shrink-0" />
            </div>

            {/* Rotate Control */}
            <div className="flex items-center justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRotate((r) => r - 90)}
                className="gap-1"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                تدوير
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleReset}
              >
                إعادة تعيين
              </Button>
            </div>
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
