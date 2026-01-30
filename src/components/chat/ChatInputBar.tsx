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
  Home,
  Navigation,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import EmojiPicker from './EmojiPicker';
import RichTextInput from './RichTextInput';

interface ContextBarData {
  type: 'product' | 'request';
  title: string;
  imageUrl?: string | null;
  price?: number | null;
}

interface LocationData {
  latitude: number;
  longitude: number;
  address_name?: string;
}

interface AddressData {
  id: string;
  full_name: string;
  phone_number: string;
  governorate: string;
  area: string;
  neighborhood?: string;
  nearest_landmark?: string;
  additional_notes?: string;
  is_default: boolean;
}

interface ChatInputBarProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onSendMedia: (file: File) => Promise<void>;
  onSendLocation?: (location: LocationData) => Promise<void>;
  onSendAddress?: (address: AddressData) => Promise<void>;
  onOpenProducts: () => void;
  isLoading?: boolean;
  isUploadingMedia?: boolean;
  disabled?: boolean;
  isSeller?: boolean;
  contextBar?: ContextBarData | null;
  onSendContext?: () => void;
  onCloseContext?: () => void;
}

export default function ChatInputBar({
  value,
  onChange,
  onSend,
  onSendMedia,
  onSendLocation,
  onSendAddress,
  onOpenProducts,
  isLoading = false,
  isUploadingMedia = false,
  disabled = false,
  isSeller = false,
  contextBar,
  onSendContext,
  onCloseContext,
}: ChatInputBarProps) {
  const { user } = useAuth();
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const richTextRef = useRef<HTMLDivElement>(null);

  // Fetch user addresses
  const { data: userAddresses = [] } = useQuery({
    queryKey: ['user-addresses', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_addresses')
        .select('*')
        .eq('user_id', user!.id)
        .order('is_default', { ascending: false });
      if (error) throw error;
      return data as AddressData[];
    },
  });

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
      setEmojiPickerOpen(false);
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

  const handleEmojiSelect = (emojiCode: string) => {
    // Fast append emoji to value directly
    onChange(value + emojiCode);
    // Don't close picker - allow multiple emoji selection
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle location sharing
  const handleShareLocation = async () => {
    if (!onSendLocation) {
      toast.info('خدمة الموقع غير متاحة');
      return;
    }
    
    if (!navigator.geolocation) {
      toast.error('المتصفح لا يدعم خدمة الموقع');
      return;
    }

    setGettingLocation(true);
    setAttachMenuOpen(false);
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const locationData: LocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          
          // Try to get address name from reverse geocoding (optional)
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${position.coords.latitude}&lon=${position.coords.longitude}&format=json&accept-language=ar`
            );
            const data = await response.json();
            if (data.display_name) {
              locationData.address_name = data.display_name;
            }
          } catch {
            // Ignore geocoding errors
          }
          
          await onSendLocation(locationData);
          toast.success('تم إرسال الموقع');
        } catch (error) {
          toast.error('فشل إرسال الموقع');
        } finally {
          setGettingLocation(false);
        }
      },
      (error) => {
        setGettingLocation(false);
        if (error.code === error.PERMISSION_DENIED) {
          toast.error('يرجى السماح بالوصول إلى الموقع');
        } else {
          toast.error('تعذر الحصول على الموقع');
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Handle address sharing
  const handleShareAddress = (address: AddressData) => {
    if (onSendAddress) {
      onSendAddress(address);
      setAddressDialogOpen(false);
      setAttachMenuOpen(false);
      toast.success('تم إرسال العنوان');
    }
  };

  const attachOptions = [
    { icon: Camera, label: 'كاميرا', onClick: () => cameraInputRef.current?.click() },
    { icon: ImageIcon, label: 'صور', onClick: () => fileInputRef.current?.click() },
    { icon: FileText, label: 'ملفات', onClick: () => fileInputRef.current?.click() },
    { icon: Navigation, label: 'موقعي', onClick: handleShareLocation, loading: gettingLocation },
    { icon: Home, label: 'عنواني', onClick: () => { setAddressDialogOpen(true); setAttachMenuOpen(false); } },
  ];

  return (
    <div className="border-t bg-card">
      {/* Context Bar - Shows product/request that user entered through */}
      {contextBar && (
        <div className="flex items-center gap-2 px-3 py-2 border-b bg-gradient-to-l from-primary/10 via-primary/5 to-transparent">
          {/* Close Button */}
          <button
            type="button"
            onClick={onCloseContext}
            className="shrink-0 h-6 w-6 rounded-full flex items-center justify-center bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3 w-3" />
          </button>

          {/* Image */}
          {contextBar.imageUrl && (
            <div className="shrink-0 h-10 w-10 rounded-lg overflow-hidden border border-border/50">
              <img src={contextBar.imageUrl} alt={contextBar.title} className="h-full w-full object-cover" />
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-muted-foreground">
              {contextBar.type === 'product' ? 'إرسال منتج' : 'إرسال طلب طباعة'}
            </p>
            <p className="text-xs font-medium truncate">{contextBar.title}</p>
            {contextBar.price && (
              <p className="text-[10px] text-primary font-bold">
                {contextBar.price.toLocaleString('ar-IQ')} د.ع
              </p>
            )}
          </div>

          {/* Send Button */}
          <Button
            size="sm"
            className="shrink-0 h-8 gap-1.5 px-3 text-xs"
            onClick={onSendContext}
          >
            <Send className="h-3 w-3" />
            إرسال
          </Button>
        </div>
      )}

      <div className="p-2">
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
                    type="button"
                    onClick={opt.onClick}
                    disabled={'loading' in opt && opt.loading}
                    className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      {'loading' in opt && opt.loading ? (
                        <Loader2 className="h-5 w-5 text-primary animate-spin" />
                      ) : (
                        <opt.icon className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground">{opt.label}</span>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Send Product Button - Merchant Only */}
          {isSeller && (
            <Button
              type="button"
              variant="default"
              size="icon"
              className="h-9 w-9 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
              onClick={onOpenProducts}
              disabled={disabled || isRecording}
              title="إرسال منتج"
            >
              <ShoppingBag className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* Center: Rich Text Input with Emoji inside OR Recording indicator */}
        <div className="flex-1 relative">
          {isRecording ? (
            <div className="flex items-center justify-center h-[42px] rounded-full bg-red-500/10 px-4 gap-3">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-red-500 font-medium text-sm">{formatTime(recordingTime)}</span>
              <span className="text-red-500/70 text-xs">جاري التسجيل...</span>
            </div>
          ) : (
            <>
              <div className="relative">
                <RichTextInput
                  value={value}
                  onChange={onChange}
                  placeholder="اكتب رسالة..."
                  disabled={disabled}
                  className="pr-10"
                />
                
                {/* Emoji Button - Inside Input on Right */}
                <Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full hover:bg-transparent"
                      disabled={disabled}
                    >
                      <Smile className="h-5 w-5 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent 
                    side="top" 
                    align="end" 
                    className="w-80 p-0 shadow-2xl rounded-2xl overflow-hidden border-0"
                    sideOffset={10}
                    onOpenAutoFocus={(e) => e.preventDefault()}
                    onCloseAutoFocus={(e) => e.preventDefault()}
                    onPointerDownOutside={(e) => e.preventDefault()}
                    onInteractOutside={(e) => e.preventDefault()}
                  >
                    <EmojiPicker onSelectEmoji={handleEmojiSelect} />
                  </PopoverContent>
                </Popover>
              </div>
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

      {/* Address Selection Dialog */}
      <Dialog open={addressDialogOpen} onOpenChange={setAddressDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Home className="h-5 w-5 text-primary" />
              اختر عنوان للإرسال
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {userAddresses.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Home className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">لا توجد عناوين محفوظة</p>
                <p className="text-xs mt-1">أضف عنوانك من صفحة الملف الشخصي</p>
              </div>
            ) : (
              userAddresses.map((addr) => (
                <button
                  key={addr.id}
                  type="button"
                  onClick={() => handleShareAddress(addr)}
                  className="w-full text-right p-3 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">{addr.full_name}</p>
                        {addr.is_default && (
                          <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">افتراضي</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{addr.phone_number}</p>
                      <p className="text-xs text-foreground/80 mt-1">
                        {addr.governorate} - {addr.area}
                        {addr.neighborhood && ` - ${addr.neighborhood}`}
                      </p>
                      {addr.nearest_landmark && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          قرب: {addr.nearest_landmark}
                        </p>
                      )}
                    </div>
                    <Send className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" />
                  </div>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
