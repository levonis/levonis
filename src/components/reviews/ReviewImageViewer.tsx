import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, X, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ReviewImageViewerProps {
  images: string[];
  initialIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ReviewImageViewer({ images, initialIndex, open, onOpenChange }: ReviewImageViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  const isVideo = (url: string) => /\.(mp4|webm|mov)$/i.test(url);

  const goNext = useCallback(() => {
    setCurrentIndex((i) => (i + 1) % images.length);
  }, [images.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => (i - 1 + images.length) % images.length);
  }, [images.length]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goPrev();
      if (e.key === 'ArrowLeft') goNext();
      if (e.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, goNext, goPrev, onOpenChange]);

  // Touch/swipe support
  const [touchStart, setTouchStart] = useState(0);
  const handleTouchStart = (e: React.TouchEvent) => setTouchStart(e.touches[0].clientX);
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStart - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goNext();
      else goPrev();
    }
  };

  if (!images.length) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[100vw] max-h-[100vh] w-screen h-screen p-0 border-none bg-black/95 [&>button]:hidden">
        <div
          className="relative w-full h-full flex items-center justify-center"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Close */}
          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-4 right-4 z-50 p-2 rounded-full bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 transition"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Counter */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm text-white text-sm font-medium">
            {currentIndex + 1} / {images.length}
          </div>

          {/* Navigation */}
          {images.length > 1 && (
            <>
              <button
                onClick={goPrev}
                className="absolute right-3 z-40 p-2 rounded-full bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 transition"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
              <button
                onClick={goNext}
                className="absolute left-3 z-40 p-2 rounded-full bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 transition"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            </>
          )}

          {/* Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="max-w-[90vw] max-h-[85vh] flex items-center justify-center"
            >
              {isVideo(images[currentIndex]) ? (
                <video
                  src={images[currentIndex]}
                  controls
                  autoPlay
                  className="max-w-full max-h-[85vh] rounded-lg"
                />
              ) : (
                <img
                  src={images[currentIndex]}
                  alt=""
                  className="max-w-full max-h-[85vh] rounded-lg object-contain"
                  loading="lazy"
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
