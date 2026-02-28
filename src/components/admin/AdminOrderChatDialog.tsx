import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send, MessageCircle, Image as ImageIcon, Mic, Square, Plus, X, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { sendAllNotifications } from '@/lib/notifications';
import ImageLightbox from '@/components/chat/ImageLightbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// Support user ID - the admin support account
const SUPPORT_USER_ID = "f632ba7b-60e7-4f2f-9cb7-2851f7f2ed2f";

interface AdminOrderChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: string;
  userId: string;
  customerName: string;
}

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  image_url?: string | null;
  is_read: boolean;
}

export default function AdminOrderChatDialog({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  userId,
  customerName
}: AdminOrderChatDialogProps) {
  const [message, setMessage] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const queryClient = useQueryClient();

  // Get or create conversation when dialog opens
  useEffect(() => {
    if (open && userId) {
      getOrCreateConversation();
    }
  }, [open, userId]);

  const getOrCreateConversation = async () => {
    setIsLoading(true);
    try {
      // Check if conversation already exists
      const { data: existingConv } = await supabase
        .from('listing_conversations')
        .select('id')
        .or(`and(buyer_id.eq.${userId},seller_id.eq.${SUPPORT_USER_ID}),and(buyer_id.eq.${SUPPORT_USER_ID},seller_id.eq.${userId})`)
        .maybeSingle();

      if (existingConv) {
        setConversationId(existingConv.id);
      } else {
        // listing_id is NOT NULL, so we need a valid UUID. 
        // Use a deterministic UUID from user+support pairing or get any listing
        const { data: anyListing } = await supabase
          .from('community_customer_profiles')
          .select('id')
          .limit(1)
          .maybeSingle();

        // Generate a deterministic listing-like UUID for support conversations
        const pseudoListingId = anyListing?.id || userId;

        const { data: newConv, error } = await supabase
          .from('listing_conversations')
          .insert({
            listing_id: pseudoListingId,
            buyer_id: userId,
            seller_id: SUPPORT_USER_ID,
            entry_context: { type: 'order_support', order_number: orderNumber },
          })
          .select('id')
          .single();

        if (error) throw error;
        setConversationId(newConv.id);
      }
    } catch (error) {
      console.error('Error getting/creating conversation:', error);
      toast.error('حدث خطأ في فتح المحادثة');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch messages
  const { data: messages = [], refetch: refetchMessages } = useQuery({
    queryKey: ['admin-order-chat-messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      
      const { data, error } = await supabase
        .from('listing_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as Message[];
    },
    enabled: !!conversationId,
    refetchInterval: open ? 5000 : false,
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!conversationId) {
        await getOrCreateConversation();
      }
      
      const convId = conversationId;
      if (!convId) throw new Error('No conversation');

      // Send initial context message if this is first message
      const { data: existingMessages } = await supabase
        .from('listing_messages')
        .select('id')
        .eq('conversation_id', convId)
        .limit(1);

      if (!existingMessages || existingMessages.length === 0) {
        // Send context about the order
        await supabase.from('listing_messages').insert({
          conversation_id: convId,
          sender_id: SUPPORT_USER_ID,
          content: `📦 مرحباً، هذه رسالة بخصوص طلبك رقم ${orderNumber}`,
        });
      }

      // Send the actual message
      const { error } = await supabase.from('listing_messages').insert({
        conversation_id: convId,
        sender_id: SUPPORT_USER_ID,
        content,
      });

      if (error) throw error;

      // Update conversation timestamp
      await supabase
        .from('listing_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', convId);

      // Send all notifications (in-app and Telegram only)
      await sendAllNotifications({
        userId,
        title: 'رسالة جديدة من الدعم',
        message: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
        type: 'info',
        relatedId: orderId,
      });
    },
    onSuccess: () => {
      setMessage('');
      refetchMessages();
      queryClient.invalidateQueries({ queryKey: ['admin-support-conversations'] });
    },
    onError: (error) => {
      console.error('Error sending message:', error);
      toast.error('فشل في إرسال الرسالة');
    }
  });

  // Mark messages as read when viewing
  useEffect(() => {
    if (conversationId && messages.length > 0) {
      supabase
        .from('listing_messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .neq('sender_id', SUPPORT_USER_ID)
        .eq('is_read', false)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['admin-support-conversations'] });
        });
    }
  }, [conversationId, messages.length]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Upload media file and send as message
  const handleSendMedia = async (file: File) => {
    if (!conversationId) {
      await getOrCreateConversation();
    }
    const convId = conversationId;
    if (!convId) return;

    setIsUploadingMedia(true);
    try {
      const ext = file.name.split('.').pop() || 'bin';
      const path = `chat/listing/${SUPPORT_USER_ID}/${Date.now()}.${ext}`;
      
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(path, file, { contentType: file.type, cacheControl: '3600' });

      if (uploadError) {
        toast.error('فشل رفع الملف: ' + uploadError.message);
        return;
      }
      
      const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(path);
      await sendMediaMessage(convId, urlData.publicUrl, file.type);
    } catch (err) {
      console.error('Media upload error:', err);
      toast.error('حدث خطأ أثناء رفع الملف');
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const sendMediaMessage = async (convId: string, mediaUrl: string, mimeType: string) => {
    const isAudio = mimeType.startsWith('audio/');
    const isVideo = mimeType.startsWith('video/');
    const content = isAudio ? '🎤 رسالة صوتية' : isVideo ? '🎥 فيديو' : '📷 صورة';

    const { error } = await supabase.from('listing_messages').insert({
      conversation_id: convId,
      sender_id: SUPPORT_USER_ID,
      content,
      image_url: mediaUrl,
    });

    if (error) throw error;

    await supabase.from('listing_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', convId);

    await sendAllNotifications({
      userId,
      title: 'رسالة جديدة من الدعم',
      message: content,
      type: 'info',
      relatedId: orderId,
    });

    refetchMessages();
    queryClient.invalidateQueries({ queryKey: ['admin-support-conversations'] });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await handleSendMedia(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    setAttachMenuOpen(false);
  };

  // Voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        await handleSendMedia(audioFile);
        setRecordingTime(0);
      };

      mediaRecorder.start();
      setIsRecording(true);
      timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    } catch {
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

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSend = () => {
    if (!message.trim()) return;
    sendMessageMutation.mutate(message.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] h-full flex flex-col p-0 overflow-hidden" dir="rtl">
        <DialogHeader className="p-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            <span>محادثة مع {customerName}</span>
          </DialogTitle>
          <p className="text-xs text-muted-foreground">طلب رقم: {orderNumber}</p>
        </DialogHeader>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Messages Area */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3">
                {messages.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageCircle className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">ابدأ المحادثة مع العميل</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isSupport = msg.sender_id === SUPPORT_USER_ID;
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isSupport ? 'justify-start' : 'justify-end'}`}
                      >
                         <div
                          className={`max-w-[80%] rounded-xl px-4 py-2 ${
                            isSupport
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          {msg.image_url && (
                            msg.image_url.includes('voice_') ? (
                              <audio controls src={msg.image_url} className="max-w-full mb-2" />
                            ) : msg.image_url.match(/\.(mp4|mov|avi|webm)$/i) ? (
                              <video controls src={msg.image_url} className="max-w-full rounded-lg mb-2" />
                            ) : (
                              <ImageLightbox src={msg.image_url} alt="صورة">
                                {(open) => (
                                  <img
                                    src={msg.image_url!}
                                    alt="صورة"
                                    className="max-w-full rounded-lg mb-2 cursor-pointer hover:opacity-90 transition-opacity"
                                    onClick={open}
                                  />
                                )}
                              </ImageLightbox>
                            )
                          )}
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          <p className={`text-xs mt-1 ${isSupport ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                            {format(new Date(msg.created_at), 'HH:mm', { locale: ar })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="p-3 border-t shrink-0">
              {/* Hidden File Inputs */}
              <input type="file" ref={fileInputRef} accept="image/*,video/*" onChange={handleFileChange} className="hidden" />
              <input type="file" ref={cameraInputRef} accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />

              <div className="flex items-center gap-1.5">
                {/* Attach Menu */}
                <Popover open={attachMenuOpen} onOpenChange={setAttachMenuOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-full shrink-0" disabled={isRecording}>
                      {attachMenuOpen ? <X className="h-5 w-5 text-muted-foreground" /> : <Plus className="h-5 w-5 text-muted-foreground" />}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent side="top" align="start" className="w-auto p-2">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => { cameraInputRef.current?.click(); }} className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-muted transition-colors">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center"><Camera className="h-5 w-5 text-primary" /></div>
                        <span className="text-[10px] text-muted-foreground">كاميرا</span>
                      </button>
                      <button type="button" onClick={() => { fileInputRef.current?.click(); }} className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-muted transition-colors">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center"><ImageIcon className="h-5 w-5 text-primary" /></div>
                        <span className="text-[10px] text-muted-foreground">صور/فيديو</span>
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Input or Recording */}
                <div className="flex-1">
                  {isRecording ? (
                    <div className="flex items-center justify-center h-[42px] rounded-full bg-destructive/10 px-4 gap-3">
                      <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                      <span className="text-destructive font-medium text-sm">{formatTime(recordingTime)}</span>
                      <span className="text-destructive/70 text-xs">جاري التسجيل...</span>
                    </div>
                  ) : (
                    <Textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="اكتب رسالتك..."
                      className="resize-none min-h-[42px] max-h-24"
                      rows={1}
                    />
                  )}
                </div>

                {/* Send / Voice / Stop */}
                {message.trim() && !isRecording ? (
                  <Button onClick={handleSend} disabled={sendMessageMutation.isPending || isUploadingMedia} size="icon" className="h-10 w-10 rounded-full shrink-0">
                    {sendMessageMutation.isPending || isUploadingMedia ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                ) : isRecording ? (
                  <Button onClick={stopRecording} variant="destructive" size="icon" className="h-10 w-10 rounded-full shrink-0">
                    <Square className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button onClick={startRecording} variant="ghost" size="icon" className="h-10 w-10 rounded-full shrink-0" disabled={isUploadingMedia}>
                    {isUploadingMedia ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-5 w-5 text-muted-foreground" />}
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
