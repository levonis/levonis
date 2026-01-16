import { useState, useRef, useCallback } from 'react';
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Crop as CropIcon, RotateCcw, Check } from 'lucide-react';

interface BannerImageCropperProps {
  imageUrl: string;
  onCropComplete: (croppedImageUrl: string, cropSettings: CropSettings) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialCropSettings?: CropSettings | null;
}

export interface CropSettings {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
}

const BannerImageCropper = ({ 
  imageUrl, 
  onCropComplete, 
  open, 
  onOpenChange,
  initialCropSettings 
}: BannerImageCropperProps) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop>({
    unit: '%',
    x: 10,
    y: 10,
    width: 80,
    height: 80,
  });
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [scale, setScale] = useState(1);
  const [aspect] = useState(3 / 1); // Banner aspect ratio

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    
    // Calculate initial crop based on aspect ratio
    const imageAspect = naturalWidth / naturalHeight;
    let cropWidth = 80;
    let cropHeight = 80;
    
    if (imageAspect > aspect) {
      cropWidth = (cropHeight * aspect * naturalHeight) / naturalWidth;
    } else {
      cropHeight = (cropWidth * naturalWidth) / (aspect * naturalHeight);
    }
    
    setCrop({
      unit: '%',
      x: (100 - cropWidth) / 2,
      y: (100 - cropHeight) / 2,
      width: cropWidth,
      height: cropHeight,
    });
  }, [aspect]);

  const handleConfirm = useCallback(() => {
    if (!completedCrop || !imgRef.current) {
      onOpenChange(false);
      return;
    }

    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    canvas.width = completedCrop.width * scaleX;
    canvas.height = completedCrop.height * scaleY;

    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height
    );

    // Convert canvas to blob and get URL
    canvas.toBlob((blob) => {
      if (blob) {
        const croppedUrl = URL.createObjectURL(blob);
        const cropSettings: CropSettings = {
          x: completedCrop.x * scaleX,
          y: completedCrop.y * scaleY,
          width: completedCrop.width * scaleX,
          height: completedCrop.height * scaleY,
          scale: scale,
        };
        onCropComplete(croppedUrl, cropSettings);
      }
      onOpenChange(false);
    }, 'image/jpeg', 0.95);
  }, [completedCrop, scale, onCropComplete, onOpenChange]);

  const handleReset = () => {
    setScale(1);
    setCrop({
      unit: '%',
      x: 10,
      y: 10,
      width: 80,
      height: 80,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CropIcon className="h-5 w-5" />
            قص وتعديل الصورة
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto max-h-[60vh]">
          {/* Crop Area */}
          <div className="flex justify-center bg-muted/20 rounded-lg p-4">
            <ReactCrop
              crop={crop}
              onChange={(c) => setCrop(c)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={aspect}
              className="max-h-[400px]"
            >
              <img
                ref={imgRef}
                src={imageUrl}
                alt="صورة البانر"
                style={{ 
                  transform: `scale(${scale})`,
                  maxHeight: '400px',
                  width: 'auto'
                }}
                onLoad={onImageLoad}
                crossOrigin="anonymous"
              />
            </ReactCrop>
          </div>

          {/* Scale Slider */}
          <div className="space-y-2 px-4">
            <Label>تكبير/تصغير: {Math.round(scale * 100)}%</Label>
            <Slider
              value={[scale]}
              min={0.5}
              max={2}
              step={0.1}
              onValueChange={(value) => setScale(value[0])}
              className="w-full"
            />
          </div>

          {/* Preview Info */}
          <div className="text-sm text-muted-foreground text-center px-4">
            اسحب زوايا الإطار لتحديد المنطقة المرغوبة. نسبة العرض للبانر هي 3:1
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 ml-2" />
            إعادة تعيين
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button onClick={handleConfirm}>
            <Check className="h-4 w-4 ml-2" />
            تطبيق
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BannerImageCropper;
