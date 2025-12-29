import { useState, useRef } from 'react';
import { X, GripVertical, Star, Edit2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SortableImageListProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  onEditImage?: (index: number) => void;
  primaryIndex?: number;
  onSetPrimary?: (index: number) => void;
  disabled?: boolean;
}

export const SortableImageList = ({
  images,
  onImagesChange,
  onEditImage,
  primaryIndex = 0,
  onSetPrimary,
  disabled = false,
}: SortableImageListProps) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (disabled) return;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragEnd = () => {
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      const newImages = [...images];
      const [removed] = newImages.splice(draggedIndex, 1);
      newImages.splice(dragOverIndex, 0, removed);
      onImagesChange(newImages);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleRemove = (index: number) => {
    if (disabled) return;
    const newImages = images.filter((_, i) => i !== index);
    onImagesChange(newImages);
  };

  if (images.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {images.map((img, idx) => (
        <div
          key={`${img}-${idx}`}
          draggable={!disabled}
          onDragStart={(e) => handleDragStart(e, idx)}
          onDragOver={(e) => handleDragOver(e, idx)}
          onDragEnd={handleDragEnd}
          onDragLeave={() => setDragOverIndex(null)}
          className={cn(
            "relative w-24 h-24 group transition-all duration-200",
            draggedIndex === idx && "opacity-50",
            dragOverIndex === idx && "ring-2 ring-primary ring-offset-2",
            idx === primaryIndex && "ring-2 ring-yellow-500"
          )}
        >
          <img
            src={img}
            alt={`صورة ${idx + 1}`}
            className="w-full h-full object-cover rounded-lg"
          />
          
          {/* Primary badge */}
          {idx === primaryIndex && (
            <div className="absolute top-1 right-1 bg-yellow-500 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-0.5">
              <Star className="w-3 h-3 fill-current" />
              <span>رئيسية</span>
            </div>
          )}

          {/* Drag handle */}
          {!disabled && (
            <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
              <GripVertical className="w-4 h-4 text-white drop-shadow-lg" />
            </div>
          )}

          {/* Actions overlay */}
          {!disabled && (
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-1">
              {onSetPrimary && idx !== primaryIndex && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-white hover:text-yellow-400"
                  onClick={() => onSetPrimary(idx)}
                  title="جعلها الصورة الرئيسية"
                >
                  <Star className="w-4 h-4" />
                </Button>
              )}
              {onEditImage && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-white hover:text-primary"
                  onClick={() => onEditImage(idx)}
                  title="تعديل الصورة"
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white hover:text-destructive"
                onClick={() => handleRemove(idx)}
                title="حذف الصورة"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Index badge */}
          {idx !== primaryIndex && (
            <div className="absolute bottom-1 right-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
              {idx + 1}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default SortableImageList;
