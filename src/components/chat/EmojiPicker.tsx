import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { WECHAT_EMOJIS } from './emojiData';
import { ScrollArea } from '@/components/ui/scroll-area';

interface EmojiPickerProps {
  onSelectEmoji: (emojiCode: string) => void;
  className?: string;
}

export default function EmojiPicker({ onSelectEmoji, className }: EmojiPickerProps) {
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());

  const handleImageLoad = useCallback((id: string) => {
    setLoadedImages(prev => new Set(prev).add(id));
  }, []);

  const handleEmojiClick = useCallback((e: React.MouseEvent, code: string) => {
    e.preventDefault();
    e.stopPropagation();
    onSelectEmoji(code);
  }, [onSelectEmoji]);

  return (
    <div className={cn("bg-card rounded-2xl overflow-hidden shadow-xl border", className)}>
      {/* Header */}
      <div className="px-3 py-2 border-b bg-muted/30 flex-shrink-0">
        <span className="text-xs font-medium text-muted-foreground">رموز تعبيرية</span>
      </div>
      
      {/* Emoji Grid - scrollable with ScrollArea */}
      <ScrollArea className="h-64">
        <div className="grid grid-cols-8 gap-1 p-2">
          {WECHAT_EMOJIS.map((emoji) => (
            <button
              key={emoji.id}
              type="button"
              onClick={(e) => handleEmojiClick(e, emoji.code)}
              className={cn(
                "aspect-square p-1 rounded-lg hover:bg-primary/10 active:scale-90 transition-all duration-150 flex items-center justify-center touch-manipulation",
                !loadedImages.has(emoji.id) && "animate-pulse bg-muted/20"
              )}
              title={emoji.alt}
            >
              <img
                src={emoji.src}
                alt={emoji.alt}
                className="w-6 h-6 object-contain"
                loading="lazy"
                onLoad={() => handleImageLoad(emoji.id)}
              />
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
