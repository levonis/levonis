import { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { WECHAT_EMOJIS, EmojiItem } from './emojiData';
import { Clock } from 'lucide-react';

const RECENT_EMOJIS_KEY = 'chat_recent_emojis';
const MAX_RECENT_EMOJIS = 7;

interface EmojiPickerProps {
  onSelectEmoji: (emojiCode: string) => void;
  className?: string;
}

// Get recent emojis from localStorage
function getRecentEmojis(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_EMOJIS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// Save recent emoji to localStorage
function saveRecentEmoji(emojiCode: string): string[] {
  try {
    let recent = getRecentEmojis();
    recent = recent.filter(code => code !== emojiCode);
    recent.unshift(emojiCode);
    recent = recent.slice(0, MAX_RECENT_EMOJIS);
    localStorage.setItem(RECENT_EMOJIS_KEY, JSON.stringify(recent));
    return recent;
  } catch {
    return [emojiCode];
  }
}

// Create a map for faster lookup
const emojiMap = new Map(WECHAT_EMOJIS.map(e => [e.code, e]));

export default function EmojiPicker({ onSelectEmoji, className }: EmojiPickerProps) {
  const [recentEmojis, setRecentEmojis] = useState<EmojiItem[]>([]);
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());

  useEffect(() => {
    const recentCodes = getRecentEmojis();
    const emojis = recentCodes
      .map(code => emojiMap.get(code))
      .filter((e): e is EmojiItem => e !== undefined);
    setRecentEmojis(emojis);
  }, []);

  const handleImageLoad = useCallback((id: string) => {
    setLoadedImages(prev => new Set(prev).add(id));
  }, []);

  const handleEmojiClick = useCallback((e: React.MouseEvent, code: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const updatedRecent = saveRecentEmoji(code);
    const emojis = updatedRecent
      .map(c => emojiMap.get(c))
      .filter((em): em is EmojiItem => em !== undefined);
    setRecentEmojis(emojis);
    
    onSelectEmoji(code);
  }, [onSelectEmoji]);

  return (
    <div className={cn("bg-card rounded-2xl overflow-hidden shadow-xl border", className)}>
      {/* Header */}
      <div className="px-3 py-2 border-b bg-muted/30 flex-shrink-0">
        <span className="text-xs font-medium text-muted-foreground">رموز تعبيرية</span>
      </div>
      
      {/* Scrollable Container - Native scroll for full touch support */}
      <div 
        className="h-72 overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y"
        style={{ 
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'thin',
          scrollbarColor: 'hsl(var(--muted-foreground) / 0.3) transparent'
        }}
      >
        <div className="flex flex-col">
          {/* Recent Emojis Section */}
          {recentEmojis.length > 0 && (
            <div className="p-2 border-b border-border/50 bg-card">
              <div className="flex items-center gap-1.5 mb-2 px-1">
                <Clock className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] font-medium text-muted-foreground">الأخيرة</span>
              </div>
              <div className="flex gap-1">
                {recentEmojis.map((emoji) => (
                  <button
                    key={`recent-${emoji.id}`}
                    type="button"
                    onClick={(e) => handleEmojiClick(e, emoji.code)}
                    className="w-9 h-9 p-1 rounded-lg hover:bg-primary/10 active:scale-90 transition-all duration-150 flex items-center justify-center touch-manipulation"
                    title={emoji.alt}
                  >
                    <img
                      src={emoji.src}
                      alt={emoji.alt}
                      className="w-6 h-6 object-contain pointer-events-none"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* All Emojis Grid */}
          <div className="p-2">
            <div className="grid grid-cols-8 gap-1">
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
                    className="w-6 h-6 object-contain pointer-events-none"
                    loading="lazy"
                    onLoad={() => handleImageLoad(emoji.id)}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
