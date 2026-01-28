import { X, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ProductContextBarProps {
  type: 'product' | 'request';
  title: string;
  imageUrl?: string | null;
  price?: number | null;
  onSend: () => void;
  onClose: () => void;
  className?: string;
}

export default function ProductContextBar({
  type,
  title,
  imageUrl,
  price,
  onSend,
  onClose,
  className,
}: ProductContextBarProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 border-t bg-gradient-to-l from-primary/10 via-primary/5 to-transparent",
        className
      )}
    >
      {/* Close Button */}
      <button
        type="button"
        onClick={onClose}
        className="shrink-0 h-6 w-6 rounded-full flex items-center justify-center bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="h-3 w-3" />
      </button>

      {/* Image */}
      {imageUrl && (
        <div className="shrink-0 h-10 w-10 rounded-lg overflow-hidden border border-border/50">
          <img src={imageUrl} alt={title} className="h-full w-full object-cover" />
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-muted-foreground">
          {type === 'product' ? 'إرسال منتج' : 'إرسال طلب طباعة'}
        </p>
        <p className="text-xs font-medium truncate">{title}</p>
        {price && (
          <p className="text-[10px] text-primary font-bold">
            {price.toLocaleString('ar-IQ')} د.ع
          </p>
        )}
      </div>

      {/* Send Button */}
      <Button
        size="sm"
        className="shrink-0 h-8 gap-1.5 px-3 text-xs"
        onClick={onSend}
      >
        <Send className="h-3 w-3" />
        إرسال
      </Button>
    </div>
  );
}
