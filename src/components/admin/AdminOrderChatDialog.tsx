import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Send, MessageCircle, Image as ImageIcon, Mic, Square, Plus, X, Camera, Package, Video, VolumeX, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { sendAllNotifications } from '@/lib/notifications';
import ImageLightbox from '@/components/chat/ImageLightbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { formatPrice } from '@/lib/utils';

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

const STATUS_LABELS: Record<string, string> = {
  pending: 'قيد الانتظار',
  confirmed: 'مؤكد',
  processing: 'قيد المعالجة',
  purchased: 'تم الشراء',
  shipped: 'تم الشحن',
  arrived_warehouse: 'وصل المخزن',
  arrived_iraq: 'وصل العراق',
  on_the_way: 'في الطريق',
  delivered: 'تم التوصيل',
  cancelled: 'ملغي',
};

export default function AdminOrderChatDialog({
  open, onOpenChange, orderId, orderNumber, userId, customerName
}: AdminOrderChatDialogProps) {
  const [message, setMessage] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageViewportRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const previousMessagesCountRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const queryClient = useQueryClient();

  // Fetch order details with product info
  const { data: order } = useQuery({
    queryKey: ['admin-order-detail', orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*, products(name_ar, images, image_url), custom_product_requests(product_name, image_url))')
        .eq('id', orderId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: open && !!orderId,
  });

  useEffect(() => {
    if (open && userId) getOrCreateConversation();
  }, [open, userId]);

  const getOrCreateConversation = async () => {
    setIsLoading(true);
    try {
      const { data: existingConv } = await supabase
        .from('listing_conversations')
        .select('id')
        .or(`and(buyer_id.eq.${userId},seller_id.eq.${SUPPORT_USER_ID}),and(buyer_id.eq.${SUPPORT_USER_ID},seller_id.eq.${userId})`)
        .maybeSingle();

      if (existingConv) {
        setConversationId(existingConv.id);
      } else {
        const { data: anyListing } = await supabase
          .from('community_customer_profiles').select('id').limit(1).maybeSingle();
        const pseudoListingId = anyListing?.id || userId;

        const { data: newConv, error } = await supabase
          .from('listing_conversations')
          .insert({
            listing_id: pseudoListingId, buyer_id: userId, seller_id: SUPPORT_USER_ID,
            entry_context: { type: 'order_support', order_number: orderNumber },
          })
          .select('id').single();
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

  const { data: messages = [], refetch: refetchMessages } = useQuery({
    queryKey: ['admin-order-chat-messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      const { data, error } = await supabase
        .from('listing_messages').select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as Message[];
    },
    enabled: !!conversationId,
    refetchInterval: open && activeTab === 'chat' ? 5000 : false,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!conversationId) await getOrCreateConversation();
      const convId = conversationId;
      if (!convId) throw new Error('No conversation');

      const { data: existingMessages } = await supabase
        .from('listing_messages').select('id').eq('conversation_id', convId).limit(1);

      if (!existingMessages || existingMessages.length === 0) {
        await supabase.from('listing_messages').insert({
          conversation_id: convId, sender_id: SUPPORT_USER_ID,
          content: `📦 مرحباً، هذه رسالة بخصوص طلبك رقم ${orderNumber}`,
        });
      }

      const { error } = await supabase.from('listing_messages').insert({
        conversation_id: convId, sender_id: SUPPORT_USER_ID, content,
      });
      if (error) throw error;

      await supabase.from('listing_conversations')
        .update({ updated_at: new Date().toISOString() }).eq('id', convId);

      await sendAllNotifications({
        userId, title: 'رسالة جديدة من الدعم',
        message: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
        type: 'info', relatedId: orderId,
      });
    },
    onSuccess: () => {
      shouldAutoScrollRef.current = true;
      setMessage('');
      refetchMessages();
      queryClient.invalidateQueries({ queryKey: ['admin-support-conversations'] });
    },
    onError: () => toast.error('فشل في إرسال الرسالة'),
  });

  useEffect(() => {
    if (conversationId && messages.length > 0) {
      supabase.from('listing_messages').update({ is_read: true })
        .eq('conversation_id', conversationId).neq('sender_id', SUPPORT_USER_ID).eq('is_read', false)
        .then(() => queryClient.invalidateQueries({ queryKey: ['admin-support-conversations'] }));
    }
  }, [conversationId, messages.length]);

  useEffect(() => {
    if (open && activeTab === 'chat') {
      shouldAutoScrollRef.current = true;
      previousMessagesCountRef.current = 0;
    }
  }, [open, activeTab, conversationId]);

  useEffect(() => {
    const viewport = messageViewportRef.current;
    const hasNewMessages = messages.length > previousMessagesCountRef.current;

    if (!viewport) {
      previousMessagesCountRef.current = messages.length;
      return;
    }

    const distanceToBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    const isNearBottom = distanceToBottom < 120;

    if (shouldAutoScrollRef.current || (hasNewMessages && isNearBottom)) {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      });
      shouldAutoScrollRef.current = false;
    }

    previousMessagesCountRef.current = messages.length;
  }, [messages, activeTab]);

  const handleSendMedia = async (file: File) => {
    if (!conversationId) await getOrCreateConversation();
    const convId = conversationId;
    if (!convId) return;

    setIsUploadingMedia(true);
    try {
      const ext = file.name.split('.').pop() || 'bin';
      const path = `chat/listing/${SUPPORT_USER_ID}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('product-images')
        .upload(path, file, { contentType: file.type, cacheControl: '3600' });
      if (uploadError) { toast.error('فشل رفع الملف'); return; }
      const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(path);
      await sendMediaMessage(convId, urlData.publicUrl, file.type);
    } catch { toast.error('حدث خطأ أثناء رفع الملف'); }
    finally { setIsUploadingMedia(false); }
  };

  // Strip audio from video file
  const stripAudioFromVideo = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.src = URL.createObjectURL(file);
      video.muted = true;
      video.onloadedmetadata = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d')!;
        const stream = canvas.captureStream();
        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'video/webm' });
          const newFile = new File([blob], `silent_${Date.now()}.webm`, { type: 'video/webm' });
          URL.revokeObjectURL(video.src);
          resolve(newFile);
        };
        recorder.onerror = () => reject(new Error('Failed to process video'));
        video.play();
        recorder.start();
        const draw = () => {
          if (video.ended || video.paused) { recorder.stop(); return; }
          ctx.drawImage(video, 0, 0);
          requestAnimationFrame(draw);
        };
        draw();
        video.onended = () => recorder.stop();
      };
      video.onerror = () => reject(new Error('Failed to load video'));
    });
  };

  const handleSendVideoNoAudio = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachMenuOpen(false);
    setIsUploadingMedia(true);
    try {
      toast.info('جاري معالجة الفيديو بدون صوت...');
      const silentFile = await stripAudioFromVideo(file);
      await handleSendMedia(silentFile);
    } catch {
      toast.error('فشل في معالجة الفيديو');
      setIsUploadingMedia(false);
    }
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const sendMediaMessage = async (convId: string, mediaUrl: string, mimeType: string) => {
    const isAudio = mimeType.startsWith('audio/');
    const isVideo = mimeType.startsWith('video/');
    const content = isAudio ? '🎤 رسالة صوتية' : isVideo ? '🎥 فيديو' : '📷 صورة';

    const { error } = await supabase.from('listing_messages').insert({
      conversation_id: convId, sender_id: SUPPORT_USER_ID, content, image_url: mediaUrl,
    });
    if (error) throw error;

    await supabase.from('listing_conversations').update({ updated_at: new Date().toISOString() }).eq('id', convId);
    await sendAllNotifications({ userId, title: 'رسالة جديدة من الدعم', message: content, type: 'info', relatedId: orderId });
    shouldAutoScrollRef.current = true;
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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
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
    } catch { toast.error('لا يمكن الوصول إلى الميكروفون'); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSend = () => { if (!message.trim()) return; sendMessageMutation.mutate(message.trim()); };
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] h-full flex flex-col p-0 overflow-hidden" dir="rtl">
        <DialogHeader className="p-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <MessageCircle className="h-4 w-4 text-primary" />
            <span>{customerName}</span>
            <span className="text-muted-foreground">- طلب {orderNumber}</span>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2 shrink-0 rounded-none border-b">
            <TabsTrigger value="order" className="gap-1.5 text-xs">
              <Package className="h-3.5 w-3.5" /> الطلب
            </TabsTrigger>
            <TabsTrigger value="chat" className="gap-1.5 text-xs">
              <MessageCircle className="h-3.5 w-3.5" /> المراسلة
            </TabsTrigger>
          </TabsList>

          {/* Order Details Tab */}
          <TabsContent value="order" className="flex-1 m-0 overflow-auto">
            <ScrollArea className="h-full">
              {order ? (
                <div className="p-4 space-y-3">
                  {/* Status & Order Number */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold">طلب {order.order_number}</span>
                    <Badge variant={order.status === 'delivered' ? 'default' : order.status === 'cancelled' ? 'destructive' : 'secondary'}>
                      {STATUS_LABELS[order.status] || order.status}
                    </Badge>
                  </div>

                  {/* Customer Info with copy */}
                  <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">👤</span>
                      <span className="font-medium flex-1">{customerName}</span>
                    </div>
                    {order.phone_number && (
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">📞</span>
                        <span className="flex-1 text-xs" dir="ltr">{order.phone_number}</span>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { navigator.clipboard.writeText(order.phone_number || ''); toast.success('تم نسخ الرقم'); }}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">📍</span>
                      <span className="flex-1 text-xs">{order.shipping_address || order.governorate || '-'}</span>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { navigator.clipboard.writeText(order.shipping_address || order.governorate || ''); toast.success('تم نسخ العنوان'); }}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    {order.shipping_notes && (
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">📝</span>
                        <span className="flex-1 text-xs">{order.shipping_notes}</span>
                      </div>
                    )}
                  </div>

                  {/* Payment Info */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-lg border border-border p-2 text-center">
                      <p className="text-muted-foreground text-[10px]">طريقة الدفع</p>
                      <p className="font-medium text-xs mt-0.5">{order.payment_method || '—'}</p>
                    </div>
                    <div className="rounded-lg border border-border p-2 text-center">
                      <p className="text-muted-foreground text-[10px]">حالة الدفع</p>
                      <p className="font-medium text-xs mt-0.5">{order.payment_status || '—'}</p>
                    </div>
                  </div>

                  {/* Products */}
                  <div className="space-y-2">
                    <p className="text-muted-foreground text-xs font-medium">المنتجات</p>
                    {(order.order_items as any[] || []).length === 0 ? (
                      <div className="rounded-lg border border-border p-4 text-center text-sm text-muted-foreground">
                        لا توجد منتجات في هذا الطلب
                      </div>
                    ) : (
                      (order.order_items as any[]).map((item: any, index: number) => {
                        const itemName = item.product_name_ar || item.product_name || item.products?.name_ar || item.custom_product_requests?.product_name || 'منتج';
                        const itemQty = item.quantity ?? 1;
                        const itemPrice = item.unit_price ?? item.total_price ?? 0;
                        const itemImage = item.color_image_url || item.product_image || item.products?.images?.[0] || item.products?.image_url || item.custom_product_requests?.image_url;

                        return (
                          <div key={item.id || `${order.id}-${index}`} className="flex items-center gap-3 rounded-lg border border-border p-2.5">
                            {itemImage && (
                              <img src={itemImage} className="w-12 h-12 rounded-lg object-cover border border-border" alt={itemName} loading="lazy" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-foreground truncate">{itemName}</p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {item.selected_color && (
                                  <Badge variant="outline" className="text-[10px] px-1.5">{item.selected_color}</Badge>
                                )}
                                {item.selected_option && (
                                  <Badge variant="outline" className="text-[10px] px-1.5">{item.selected_option}</Badge>
                                )}
                                {item.shipping_option_name_ar && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5">{item.shipping_option_name_ar}</Badge>
                                )}
                              </div>
                            </div>
                            <div className="text-left shrink-0">
                              <span className="text-sm font-bold text-foreground">×{itemQty}</span>
                              <p className="text-[11px] text-muted-foreground">{formatPrice(itemPrice)}</p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Total */}
                  <div className="flex items-center justify-between pt-2 border-t border-border text-sm font-bold">
                    <span>المجموع</span>
                    <span className="text-primary">{formatPrice(order.total_amount)}</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Chat Tab */}
          <TabsContent value="chat" className="flex-1 flex flex-col m-0 min-h-0">
            {isLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <div ref={messageViewportRef} className="flex-1 overflow-y-auto">
                  <div className="p-4 space-y-3">
                    {messages.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <MessageCircle className="h-10 w-10 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">ابدأ المحادثة مع العميل</p>
                      </div>
                    ) : (
                      messages.map((msg) => {
                        const isSupport = msg.sender_id === SUPPORT_USER_ID;
                        return (
                          <div key={msg.id} className={`flex ${isSupport ? 'justify-start' : 'justify-end'}`}>
                            <div className={`max-w-[80%] rounded-xl px-4 py-2 ${isSupport ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                              {msg.image_url && (
                                msg.image_url.includes('voice_') ? (
                                  <audio controls src={msg.image_url} className="max-w-full mb-2" />
                                ) : msg.image_url.match(/\.(mp4|mov|avi|webm)$/i) ? (
                                  <video controls src={msg.image_url} className="max-w-full rounded-lg mb-2" />
                                ) : (
                                  <ImageLightbox src={msg.image_url} alt="صورة">
                                    {(openLb) => (
                                      <img src={msg.image_url!} alt="صورة" className="max-w-full rounded-lg mb-2 cursor-pointer hover:opacity-90 transition-opacity" onClick={openLb} />
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
                </div>

                {/* Input Area */}
                <div className="p-3 border-t shrink-0">
                  <input type="file" ref={fileInputRef} accept="image/*,video/*" onChange={handleFileChange} className="hidden" />
                  <input type="file" ref={cameraInputRef} accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
                  <input type="file" ref={videoInputRef} accept="video/*" onChange={handleSendVideoNoAudio} className="hidden" />

                  <div className="flex items-center gap-1.5">
                    <Popover open={attachMenuOpen} onOpenChange={setAttachMenuOpen}>
                      <PopoverTrigger asChild>
                        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-full shrink-0" disabled={isRecording}>
                          {attachMenuOpen ? <X className="h-5 w-5 text-muted-foreground" /> : <Plus className="h-5 w-5 text-muted-foreground" />}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent side="top" align="start" className="w-auto p-2">
                        <div className="flex gap-2">
                          <button type="button" onClick={() => cameraInputRef.current?.click()} className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-muted transition-colors">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center"><Camera className="h-5 w-5 text-primary" /></div>
                            <span className="text-[10px] text-muted-foreground">كاميرا</span>
                          </button>
                          <button type="button" onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-muted transition-colors">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center"><ImageIcon className="h-5 w-5 text-primary" /></div>
                            <span className="text-[10px] text-muted-foreground">صور/فيديو</span>
                          </button>
                          <button type="button" onClick={() => videoInputRef.current?.click()} className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-muted transition-colors">
                            <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                              <div className="relative">
                                <Video className="h-5 w-5 text-destructive" />
                                <VolumeX className="h-3 w-3 text-destructive absolute -bottom-1 -left-1" />
                              </div>
                            </div>
                            <span className="text-[10px] text-muted-foreground">فيديو صامت</span>
                          </button>
                        </div>
                      </PopoverContent>
                    </Popover>

                    <div className="flex-1">
                      {isRecording ? (
                        <div className="flex items-center justify-center h-[42px] rounded-full bg-destructive/10 px-4 gap-3">
                          <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                          <span className="text-destructive font-medium text-sm">{formatTime(recordingTime)}</span>
                          <span className="text-destructive/70 text-xs">جاري التسجيل...</span>
                        </div>
                      ) : (
                        <Textarea value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={handleKeyDown}
                          placeholder="اكتب رسالتك..." className="resize-none min-h-[42px] max-h-24" rows={1} />
                      )}
                    </div>

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
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
