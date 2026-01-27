import { cn } from '@/lib/utils';

// WeChat sticker pack - 24 stickers from the official pack
const WECHAT_STICKERS = [
  { id: 'smile', src: '/stickers/smile.webp', alt: 'ابتسامة' },
  { id: 'grin', src: '/stickers/grin.webp', alt: 'ضحكة' },
  { id: 'happy', src: '/stickers/happy.webp', alt: 'سعيد' },
  { id: 'shy', src: '/stickers/shy.webp', alt: 'خجول' },
  { id: 'proud', src: '/stickers/proud.webp', alt: 'فخور' },
  { id: 'snicker', src: '/stickers/snicker.webp', alt: 'ضحكة خفيفة' },
  { id: 'smirk', src: '/stickers/smirk.webp', alt: 'ابتسامة ماكرة' },
  { id: 'badsmile', src: '/stickers/badsmile.webp', alt: 'ابتسامة شريرة' },
  { id: 'sillygrin', src: '/stickers/sillygrin.webp', alt: 'ضحكة سخيفة' },
  { id: 'heyha', src: '/stickers/heyha.webp', alt: 'هيها' },
  { id: 'kiss', src: '/stickers/kiss.webp', alt: 'قبلة' },
  { id: 'hug', src: '/stickers/hug.webp', alt: 'عناق' },
  { id: 'cry', src: '/stickers/cry.webp', alt: 'بكاء' },
  { id: 'wronged', src: '/stickers/wronged.webp', alt: 'مظلوم' },
  { id: 'angry', src: '/stickers/angry.webp', alt: 'غاضب' },
  { id: 'surprised', src: '/stickers/surprised.webp', alt: 'متفاجئ' },
  { id: 'daze', src: '/stickers/daze.webp', alt: 'ذهول' },
  { id: 'sleepy', src: '/stickers/sleepy.webp', alt: 'نعسان' },
  { id: 'embarrassed', src: '/stickers/embarrassed.webp', alt: 'محرج' },
  { id: 'sigh', src: '/stickers/sigh.webp', alt: 'تنهد' },
  { id: 'melon', src: '/stickers/melon.webp', alt: 'آكل البطيخ' },
  { id: 'ok', src: '/stickers/ok.webp', alt: 'موافق' },
  { id: 'cheer', src: '/stickers/cheer.webp', alt: 'تشجيع' },
  { id: '666', src: '/stickers/666.webp', alt: '666' },
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
        <span className="text-xs font-medium text-muted-foreground">رموز تعبيرية</span>
      </div>
      
      {/* Sticker Grid - scrollable */}
      <div className="max-h-52 overflow-y-auto overscroll-contain">
        <div className="grid grid-cols-6 gap-1 p-2">
          {WECHAT_STICKERS.map((sticker) => (
            <button
              key={sticker.id}
              type="button"
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
      </div>
    </div>
  );
}
