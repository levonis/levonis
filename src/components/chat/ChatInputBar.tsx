import { useState, useRef, useEffect } from 'react';
import {
  Mic,
  Smile,
  Plus,
  Send,
  ShoppingBag,
  Loader2,
  X,
  MapPin,
  FileText,
  Camera,
  Image as ImageIcon,
  Square,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';

// WeChat-style emoji set
const EMOJI_CATEGORIES = [
  {
    name: 'وجوه',
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐']
  },
  {
    name: 'يدين',
    emojis: ['👍', '👎', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '👋', '🤚', '🖐️', '✋', '🖖', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💪', '🦾', '🙆', '🙅', '🙋', '💁', '🤷']
  },
  {
    name: 'قلوب',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟']
  },
  {
    name: 'رموز',
    emojis: ['✅', '❌', '⭐', '🌟', '💫', '✨', '⚡', '🔥', '💥', '💯', '💢', '💬', '🗨️', '💭', '🔔', '🔕', '📢', '📣', '💰', '💵', '📦', '🎁', '🏷️', '📌', '📍', '🔗', '📱', '💻', '⌚', '📷', '🎬', '🎵', '🎶']
  }
];

interface ChatInputBarProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onSendMedia: (file: File) => Promise<void>;
  onOpenProducts: () => void;
  isLoading?: boolean;
  isUploadingMedia?: boolean;
  disabled?: boolean;
  isSeller?: boolean;
}

export default function ChatInputBar({
  value,
  onChange,
  onSend,
  onSendMedia,
  onOpenProducts,
  isLoading = false,
  isUploadingMedia = false,
  disabled = false,
  isSeller = false,
}: ChatInputBarProps) {
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [selectedEmojiCategory, setSelectedEmojiCategory] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim() && !isLoading) {
      onSend();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await onSendMedia(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    setAttachMenuOpen(false);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
        
        stream.getTracks().forEach(track => track.stop());
        await onSendMedia(audioFile);
        setRecordingTime(0);
      };

      mediaRecorder.start();
      setIsRecording(true);
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
    } catch (error) {
      toast.error('لا يمكن الوصول إلى الميكروفون');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const handleVoiceRecord = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    onChange(value + emoji);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const attachOptions = [
    { icon: Camera, label: 'كاميرا', onClick: () => cameraInputRef.current?.click() },
    { icon: ImageIcon, label: 'صور', onClick: () => fileInputRef.current?.click() },
    { icon: FileText, label: 'ملفات', onClick: () => fileInputRef.current?.click() },
    { icon: MapPin, label: 'موقع', onClick: () => toast.info('خدمة الموقع قريباً') },
  ];

  return (
    <div className="border-t bg-card p-2">
      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*,video/*,.pdf,.doc,.docx"
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
        {/* Right Side: Attachment Menu + Product Selector (Seller Only) */}
        <div className="flex items-center gap-0.5 shrink-0">
          {/* Attachment Menu */}
          <Popover open={attachMenuOpen} onOpenChange={setAttachMenuOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  "h-9 w-9 rounded-full",
                  attachMenuOpen && "bg-muted"
                )}
                disabled={disabled || isRecording}
              >
                {attachMenuOpen ? (
                  <X className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <Plus className="h-5 w-5 text-muted-foreground" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent 
              side="top" 
              align="start" 
              className="w-auto p-2"
            >
              <div className="flex gap-2">
                {attachOptions.map((opt) => (
                  <button
                    key={opt.label}
                    onClick={opt.onClick}
                    className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-muted transition-colors"
                  >
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <opt.icon className="h-5 w-5 text-primary" />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{opt.label}</span>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Send Product Button - Seller Only */}
          {isSeller && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full text-primary hover:bg-primary/10"
              onClick={onOpenProducts}
              disabled={disabled || isRecording}
              title="إرسال منتج"
            >
              <ShoppingBag className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* Center: Text Input with Emoji inside OR Recording indicator */}
        <div className="flex-1 relative">
          {isRecording ? (
            <div className="flex items-center justify-center h-[42px] rounded-full bg-red-500/10 px-4 gap-3">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-red-500 font-medium text-sm">{formatTime(recordingTime)}</span>
              <span className="text-red-500/70 text-xs">جاري التسجيل...</span>
            </div>
          ) : (
            <>
              <Input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="اكتب رسالة..."
                className="rounded-full pr-10 pl-4 py-5 bg-muted/50 border-0 focus-visible:ring-1"
                disabled={disabled}
              />
              
              {/* Emoji Button - Inside Input on Right */}
              <Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full hover:bg-muted"
                    disabled={disabled}
                  >
                    <Smile className="h-5 w-5 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent 
                  side="top" 
                  align="end" 
                  className="w-72 p-0 shadow-xl rounded-xl overflow-hidden"
                  sideOffset={10}
                >
                  {/* Category Tabs */}
                  <div className="flex border-b bg-muted/30">
                    {EMOJI_CATEGORIES.map((cat, idx) => (
                      <button
                        key={cat.name}
                        onClick={() => setSelectedEmojiCategory(idx)}
                        className={cn(
                          "flex-1 py-2 text-xs font-medium transition-colors",
                          selectedEmojiCategory === idx 
                            ? "text-primary border-b-2 border-primary bg-background" 
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                  
                  {/* Emoji Grid */}
                  <ScrollArea className="h-48">
                    <div className="grid grid-cols-8 gap-1 p-2">
                      {EMOJI_CATEGORIES[selectedEmojiCategory].emojis.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => handleEmojiSelect(emoji)}
                          className="h-8 w-8 flex items-center justify-center text-xl hover:bg-muted rounded transition-colors"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            </>
          )}
        </div>

        {/* Left Side: Voice or Send (outside input) */}
        {value.trim() && !isRecording ? (
          <Button
            type="submit"
            size="icon"
            className="h-10 w-10 rounded-full shrink-0 bg-primary"
            disabled={isLoading || isUploadingMedia || disabled}
          >
            {isLoading || isUploadingMedia ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        ) : (
          <Button
            type="button"
            variant={isRecording ? "destructive" : "ghost"}
            size="icon"
            className={cn(
              "h-10 w-10 rounded-full shrink-0",
              isRecording && "bg-red-500 hover:bg-red-600 text-white"
            )}
            onClick={handleVoiceRecord}
            disabled={disabled}
          >
            {isRecording ? (
              <Square className="h-4 w-4 fill-current" />
            ) : (
              <Mic className="h-5 w-5" />
            )}
          </Button>
        )}
      </form>
    </div>
  );
}
