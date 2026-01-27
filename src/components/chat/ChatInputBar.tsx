import { useState, useRef } from 'react';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

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

  const handleVoiceRecord = () => {
    setIsRecording(!isRecording);
  };

  const handleEmojiSelect = (emoji: any) => {
    onChange(value + emoji.native);
    setEmojiPickerOpen(false);
  };

  const attachOptions = [
    { icon: Camera, label: 'كاميرا', onClick: () => cameraInputRef.current?.click() },
    { icon: ImageIcon, label: 'صور', onClick: () => fileInputRef.current?.click() },
    { icon: FileText, label: 'ملفات', onClick: () => fileInputRef.current?.click() },
    { icon: MapPin, label: 'موقع', onClick: () => {} },
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
                disabled={disabled}
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

          {/* Send Product Button - Seller Only (next to +) */}
          {isSeller && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full text-primary"
              onClick={onOpenProducts}
              disabled={disabled}
            >
              <ShoppingBag className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* Center: Text Input with Emoji inside */}
        <div className="flex-1 relative">
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
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full"
                disabled={disabled}
              >
                <Smile className="h-5 w-5 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent 
              side="top" 
              align="end" 
              className="w-auto p-0 border-0 shadow-lg"
              sideOffset={10}
            >
              <Picker
                data={data}
                onEmojiSelect={handleEmojiSelect}
                theme="light"
                locale="ar"
                previewPosition="none"
                skinTonePosition="none"
                navPosition="bottom"
                perLine={8}
                emojiSize={24}
                emojiButtonSize={32}
                maxFrequentRows={2}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Left Side: Voice or Send (outside input) */}
        {value.trim() ? (
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
            variant="ghost"
            size="icon"
            className={cn(
              "h-10 w-10 rounded-full shrink-0",
              isRecording && "bg-red-500/10 text-red-500"
            )}
            onClick={handleVoiceRecord}
            disabled={disabled}
          >
            <Mic className="h-5 w-5" />
          </Button>
        )}
      </form>
    </div>
  );
}
