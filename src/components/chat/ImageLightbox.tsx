import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { X, ZoomIn, ZoomOut, Download } from 'lucide-react';

interface ImageLightboxProps {
  src: string;
  alt?: string;
  children: (open: () => void) => React.ReactNode;
}

export default function ImageLightbox({ src, alt = '', children }: ImageLightboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [scale, setScale] = useState(1);

  const handleOpen = () => {
    setScale(1);
    setIsOpen(true);
  };

  const zoomIn = () => setScale((s) => Math.min(s + 0.5, 4));
  const zoomOut = () => setScale((s) => Math.max(s - 0.5, 0.5));

  return (
    <>
      {children(handleOpen)}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          hideClose
          aria-describedby={undefined}
          className="max-w-[95vw] max-h-[95vh] w-auto p-0 bg-black/95 border-none shadow-2xl overflow-hidden flex items-center justify-center"
        >
          <VisuallyHidden><DialogTitle>عرض الصورة</DialogTitle></VisuallyHidden>
          {/* Controls */}
          <div className="absolute top-3 left-3 z-20 flex items-center gap-2" dir="ltr">
            <button
              onClick={() => setIsOpen(false)}
              className="h-9 w-9 rounded-full bg-black/60 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            <button
              onClick={zoomIn}
              className="h-9 w-9 rounded-full bg-black/60 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              onClick={zoomOut}
              className="h-9 w-9 rounded-full bg-black/60 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <a
              href={src}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="h-9 w-9 rounded-full bg-black/60 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
            >
              <Download className="h-4 w-4" />
            </a>
          </div>

          {/* Image */}
          <div className="w-full h-full flex items-center justify-center overflow-auto p-4 min-h-[300px]">
            <img
              src={src}
              alt={alt}
              className="max-w-full max-h-[85vh] object-contain transition-transform duration-200 select-none"
              style={{ transform: `scale(${scale})` }}
              draggable={false}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
