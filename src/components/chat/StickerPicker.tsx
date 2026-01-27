import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

// WeChat sticker pack - 24 stickers from the official pack
const WECHAT_STICKERS = [
  { id: 'smile', src: '/stickers/smile.png', alt: 'ابتسامة' },
  { id: 'grin', src: '/stickers/grin.png', alt: 'ضحكة' },
  { id: 'happy', src: '/stickers/happy.png', alt: 'سعيد' },
  { id: 'shy', src: '/stickers/shy.png', alt: 'خجول' },
  { id: 'proud', src: '/stickers/proud.png', alt: 'فخور' },
  { id: 'snicker', src: '/stickers/snicker.png', alt: 'ضحكة خفيفة' },
  { id: 'smirk', src: '/stickers/smirk.png', alt: 'ابتسامة ماكرة' },
  { id: 'badsmile', src: '/stickers/badsmile.png', alt: 'ابتسامة شريرة' },
  { id: 'sillygrin', src: '/stickers/sillygrin.png', alt: 'ضحكة سخيفة' },
  { id: 'heyha', src: '/stickers/heyha.png', alt: 'هيها' },
  { id: 'kiss', src: '/stickers/kiss.png', alt: 'قبلة' },
  { id: 'hug', src: '/stickers/hug.png', alt: 'عناق' },
  { id: 'cry', src: '/stickers/cry.png', alt: 'بكاء' },
  { id: 'wronged', src: '/stickers/wronged.png', alt: 'مظلوم' },
  { id: 'angry', src: '/stickers/angry.png', alt: 'غاضب' },
  { id: 'surprised', src: '/stickers/surprised.png', alt: 'متفاجئ' },
  { id: 'daze', src: '/stickers/daze.png', alt: 'ذهول' },
  { id: 'sleepy', src: '/stickers/sleepy.png', alt: 'نعسان' },
  { id: 'embarrassed', src: '/stickers/embarrassed.png', alt: 'محرج' },
  { id: 'sigh', src: '/stickers/sigh.png', alt: 'تنهد' },
  { id: 'melon', src: '/stickers/melon.png', alt: 'آكل البطيخ' },
  { id: 'ok', src: '/stickers/ok.png', alt: 'موافق' },
  { id: 'cheer', src: '/stickers/cheer.png', alt: 'تشجيع' },
  { id: '666', src: '/stickers/666.png', alt: '666' },
];

interface StickerPickerProps {
  onSelectSticker: (stickerSrc: string) => void;
  className?: string;
}

export default function StickerPicker({ onSelectSticker, className }: StickerPickerProps) {
  return (
    <div className={cn("bg-card rounded-2xl overflow-hidden shadow-xl border", className)}>
      {/* Header */}
      <div className="px-3 py-2 border-b bg-muted/30">
        <span className="text-xs font-medium text-muted-foreground">ملصقات WeChat</span>
      </div>
      
      {/* Sticker Grid */}
      <ScrollArea className="h-52">
        <div className="grid grid-cols-6 gap-1 p-2">
          {WECHAT_STICKERS.map((sticker) => (
            <button
              key={sticker.id}
              onClick={() => onSelectSticker(sticker.src)}
              className="aspect-square p-1 rounded-lg hover:bg-primary/10 active:scale-90 transition-all duration-150 flex items-center justify-center"
              title={sticker.alt}
            >
              <img
                src={sticker.src}
                alt={sticker.alt}
                className="w-10 h-10 object-contain"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
