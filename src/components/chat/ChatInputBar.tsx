import { useState, useRef } from 'react';
import {
  Mic,
  Smile,
  Plus,
  Send,
  Camera,
  Image as ImageIcon,
  FileText,
  Package,
  ShoppingBag,
  Loader2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface ChatInputBarProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onSendMedia: (file: File) => Promise<void>;
  onOpenProducts: () => void;
  onOpenOrders: () => void;
  isLoading?: boolean;
  isUploadingMedia?: boolean;
  disabled?: boolean;
}

export default function ChatInputBar({
  value,
  onChange,
  onSend,
  onSendMedia,
  onOpenProducts,
  onOpenOrders,
  isLoading = false,
  isUploadingMedia = false,
  disabled = false,
}: ChatInputBarProps) {
  const [showOptions, setShowOptions] = useState(false);
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
    setShowOptions(false);
  };

  const handleVoiceRecord = () => {
    // TODO: Implement voice recording
    setIsRecording(!isRecording);
  };

  const optionButtons = [
    { 
      icon: Camera, 
      label: 'كاميرا', 
      color: 'text-blue-500',
      onClick: () => cameraInputRef.current?.click() 
    },
    { 
      icon: ImageIcon, 
      label: 'ألبوم', 
      color: 'text-green-500',
      onClick: () => fileInputRef.current?.click() 
    },
    { 
      icon: FileText, 
      label: 'ملفات', 
      color: 'text-purple-500',
      onClick: () => fileInputRef.current?.click() 
    },
    { 
      icon: Package, 
      label: 'الطلبات', 
      color: 'text-orange-500',
      onClick: onOpenOrders 
    },
    { 
      icon: ShoppingBag, 
      label: 'المنتجات', 
      color: 'text-primary',
      onClick: onOpenProducts 
    },
  ];

  return (
    <div className="border-t bg-card">
      {/* Options Panel */}
      {showOptions && (
        <div className="p-4 border-b bg-muted/30 animate-in slide-in-from-bottom-2">
          <div className="grid grid-cols-5 gap-3">
            {optionButtons.map((btn) => (
              <button
                key={btn.label}
                onClick={btn.onClick}
                className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-muted transition-colors"
              >
                <div className={cn(
                  "h-12 w-12 rounded-xl flex items-center justify-center",
                  "bg-background border border-border shadow-sm"
                )}>
                  <btn.icon className={cn("h-6 w-6", btn.color)} />
                </div>
                <span className="text-[10px] text-muted-foreground font-medium">
                  {btn.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Row */}
      <form onSubmit={handleSubmit} className="flex items-end gap-1.5 p-2">
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

        {/* Voice Button */}
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

        {/* Text Input */}
        <div className="flex-1 relative">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="اكتب رسالة..."
            className="rounded-full pl-20 pr-4 py-5 bg-muted/50 border-0 focus-visible:ring-1"
            disabled={disabled}
          />
          
          {/* Emoji Button - Inside Input */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute left-10 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full"
            disabled={disabled}
          >
            <Smile className="h-5 w-5 text-muted-foreground" />
          </Button>

          {/* Plus Button - Inside Input */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "absolute left-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full transition-transform",
              showOptions && "rotate-45"
            )}
            onClick={() => setShowOptions(!showOptions)}
            disabled={disabled}
          >
            {showOptions ? (
              <X className="h-5 w-5 text-muted-foreground" />
            ) : (
              <Plus className="h-5 w-5 text-muted-foreground" />
            )}
          </Button>
        </div>

        {/* Send Button */}
        <Button
          type="submit"
          size="icon"
          className="h-10 w-10 rounded-full shrink-0 bg-primary"
          disabled={isLoading || isUploadingMedia || !value.trim() || disabled}
        >
          {isLoading || isUploadingMedia ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </Button>
      </form>

      {/* Quick Products Button - Always Visible */}
      <div className="px-2 pb-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full h-9 rounded-full gap-2 text-xs font-semibold border-primary/30 text-primary hover:bg-primary/5"
          onClick={onOpenProducts}
          disabled={disabled}
        >
          <ShoppingBag className="h-4 w-4" />
          إرسال منتج من المتجر
        </Button>
      </div>
    </div>
  );
}
