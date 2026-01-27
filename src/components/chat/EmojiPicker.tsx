import { cn } from '@/lib/utils';
import { WECHAT_EMOJIS } from './emojiData';

interface EmojiPickerProps {
  onSelectEmoji: (emojiCode: string) => void;
  className?: string;
}

export default function EmojiPicker({ onSelectEmoji, className }: EmojiPickerProps) {
  return (
    <div className={cn("bg-card rounded-2xl overflow-hidden shadow-xl border", className)}>
      {/* Header */}
      <div className="px-3 py-2 border-b bg-muted/30">
        <span className="text-xs font-medium text-muted-foreground">رموز تعبيرية</span>
      </div>
      
      {/* Emoji Grid - scrollable */}
      <div className="max-h-64 overflow-y-auto overscroll-contain">
        <div className="grid grid-cols-8 gap-0.5 p-2">
          {WECHAT_EMOJIS.map((emoji) => (
            <button
              key={emoji.id}
              type="button"
              onClick={() => onSelectEmoji(emoji.code)}
              className="aspect-square p-0.5 rounded-lg hover:bg-primary/10 active:scale-90 transition-all duration-150 flex items-center justify-center"
              title={emoji.alt}
            >
              <img
                src={emoji.src}
                alt={emoji.alt}
                className="w-7 h-7 object-contain"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
