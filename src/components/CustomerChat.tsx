import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  MessageCircle, 
  Send, 
  X, 
  Loader2, 
  Image as ImageIcon, 
  Check, 
  CheckCheck,
  Package,
  Search,
  ShoppingBag,
  ShoppingCart
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { formatPrice } from '@/lib/utils';
import OptimizedImage from './OptimizedImage';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  is_read: boolean;
  image_url?: string;
}

interface CustomerChatProps {
  orderId?: string;
  cartRequestCode?: string;
  defaultOpen?: boolean;
  onClose?: () => void;
}

interface Product {
  id: string;
  name_ar: string;
  image_url: string | null;
  price: number;
}

export default function CustomerChat({ 
  orderId, 
  cartRequestCode,
  defaultOpen = false,
  onClose 
}: CustomerChatProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [message, setMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [showCartConfirmInChat, setShowCartConfirmInChat] = useState(false);
  const [cartMessageSent, setCartMessageSent] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (defaultOpen) setIsOpen(true);
  }, [defaultOpen]);

  // Get products for search
  const [chatProducts, setChatProducts] = useState<Product[]>([]);
  
  useEffect(() => {
    if (!showProductSearch) return;
    
    const loadProducts = async () => {
      const { data } = await (supabase as any)
        .from('products')
        .select('id, name_ar, image_url, price')
        .eq('status', 'published')
        .ilike('name_ar', `%${productSearchQuery}%`)
        .limit(50);
      
      if (data) {
        const mapped: Product[] = data.map((p: any) => ({
          id: p.id,
          name_ar: p.name_ar,
          image_url: p.image_url,
          price: p.price
        }));
        setChatProducts(mapped);
      }
    };
    
    loadProducts();
  }, [showProductSearch, productSearchQuery]);
  
  const products = chatProducts;

  const filteredProducts = products.slice(0, 10);

  // Get or create conversation
  const { data: conversation, isLoading: conversationLoading } = useQuery({
    queryKey: ['customer-conversation', user?.id, orderId],
    queryFn: async () => {
      if (!user) return null;

      let query = supabase
        .from('conversations')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'open');

      if (orderId) {
        query = query.eq('order_id', orderId);
      } else {
        query = query.is('order_id', null);
      }

      const { data: existing } = await query.maybeSingle();

      if (existing) return existing;

      // Create new conversation
      const { data: newConv, error } = await supabase
        .from('conversations')
        .insert({
          user_id: user.id,
          order_id: orderId || null,
        })
        .select()
        .single();

      if (error) throw error;
      return newConv;
    },
    enabled: !!user && isOpen,
  });

  // Get messages
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ['conversation-messages', conversation?.id],
    queryFn: async () => {
      if (!conversation) return [];

      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as Message[];
    },
    enabled: !!conversation,
  });

  // Get unread count
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['unread-messages-count', user?.id],
    queryFn: async () => {
      if (!user) return 0;

      const { data: conversations } = await supabase
        .from('conversations')
        .select('id')
        .eq('user_id', user.id);

      if (!conversations || conversations.length === 0) return 0;

      const conversationIds = conversations.map(c => c.id);

      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .in('conversation_id', conversationIds)
        .neq('sender_id', user.id)
        .eq('is_read', false);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
    refetchInterval: 60000,
    staleTime: 30000,
  });

  // Subscribe to new messages
  useEffect(() => {
    if (!conversation) return;

    const channel = supabase
      .channel(`messages-${conversation.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversation.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['conversation-messages', conversation.id] });
          queryClient.invalidateQueries({ queryKey: ['unread-messages-count', user?.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation, queryClient, user?.id]);

  // Mark messages as read when opened
  useEffect(() => {
    if (!conversation || !isOpen || !user) return;

    const markAsRead = async () => {
      const unreadMessages = messages.filter(
        (m) => m.sender_id !== user.id && !m.is_read
      );

      if (unreadMessages.length > 0) {
        await supabase
          .from('messages')
          .update({ is_read: true })
          .in('id', unreadMessages.map(m => m.id));

        queryClient.invalidateQueries({ queryKey: ['unread-messages-count', user?.id] });
        queryClient.invalidateQueries({ queryKey: ['conversation-messages', conversation.id] });
      }
    };

    markAsRead();
  }, [conversation, isOpen, messages, user, queryClient]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Show cart confirmation dialog when opening with cart request code
  useEffect(() => {
    if (cartRequestCode && conversation && isOpen && !cartMessageSent) {
      const hasCartMessage = messages.some(m => 
        m.content.includes(cartRequestCode) && m.sender_id === user?.id
      );
      
      if (!hasCartMessage) {
        // Show in-chat confirmation message
        setShowCartConfirmInChat(true);
      }
    }
  }, [cartRequestCode, conversation, isOpen, messages, user?.id, cartMessageSent]);

  // Handle image selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('يجب اختيار صورة فقط');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('حجم الصورة يجب أن يكون أقل من 5 ميجابايت');
      return;
    }

    setSelectedImage(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Upload image to storage
  const uploadImage = async (file: File): Promise<string> => {
    if (!user) throw new Error('No user');

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('chat-images')
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('chat-images')
      .getPublicUrl(fileName);

    return publicUrl;
  };

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ content, imageUrl }: { content: string; imageUrl?: string }) => {
      if (!conversation || !user) throw new Error('No conversation');

      const { error } = await supabase.from('messages').insert({
        conversation_id: conversation.id,
        sender_id: user.id,
        content,
        image_url: imageUrl,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      setMessage('');
      setSelectedImage(null);
      setImagePreview(null);
      queryClient.invalidateQueries({ queryKey: ['conversation-messages', conversation?.id] });
    },
    onError: () => {
      toast.error('فشل إرسال الرسالة');
      setUploadingImage(false);
    },
  });

  // Send cart request confirmation
  const handleConfirmCartMessage = async () => {
    if (!cartRequestCode) return;
    
    const autoMessage = `🛒 مرحباً، أريد الاستفسار عن سلة التسوق\n\n📋 رمز السلة: ${cartRequestCode}\n\nأرجو تعديل السعر أو الإجابة على استفساري`;
    await sendMessageMutation.mutateAsync({ content: autoMessage });
    setCartMessageSent(true);
    setShowCartConfirmInChat(false);
    toast.success('تم إرسال طلب السلة للإدارة');
  };

  // Send product as message
  const sendProductMessage = (product: Product) => {
    const productMessage = `📦 منتج: ${product.name_ar}\n💰 السعر: ${formatPrice(product.price)} د.ع\n🔗 /product/${product.id}`;
    sendMessageMutation.mutate({ content: productMessage, imageUrl: product.image_url || undefined });
    setShowProductSearch(false);
    setProductSearchQuery('');
  };

  const handleSend = async () => {
    if (!message.trim() && !selectedImage) return;

    try {
      setUploadingImage(true);
      let imageUrl: string | undefined;

      if (selectedImage) {
        imageUrl = await uploadImage(selectedImage);
      }

      await sendMessageMutation.mutateAsync({
        content: message.trim() || 'صورة',
        imageUrl,
      });
    } catch (error) {
      toast.error('فشل إرسال الرسالة');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    onClose?.();
  };

  // Check if message is a product message
  const isProductMessage = (content: string) => {
    return content.startsWith('📦 منتج:') && content.includes('/product/');
  };

  // Extract product ID from message
  const extractProductId = (content: string) => {
    const match = content.match(/\/product\/([a-zA-Z0-9-]+)/);
    return match ? match[1] : null;
  };

  if (!user) return null;

  return (
    <>
      {/* Chat Button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 left-4 sm:left-6 h-14 w-14 rounded-full shadow-xl z-50 bg-primary hover:bg-primary/90 border-2 border-primary-foreground/20"
        size="icon"
      >
        <div className="relative">
          <MessageCircle className="h-6 w-6 text-primary-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-3 -right-3 bg-destructive text-destructive-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
      </Button>

      {/* Chat Window */}
      {isOpen && (
        <Card className="fixed bottom-24 left-4 right-4 sm:left-6 sm:right-auto sm:w-[380px] lg:w-[400px] h-[500px] sm:h-[520px] max-h-[70vh] shadow-2xl z-50 flex flex-col overflow-hidden border-2 border-primary/40 bg-background">
          {/* Header */}
          <CardHeader className="bg-primary p-4 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                  <MessageCircle className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold text-primary-foreground">الدعم الفني</CardTitle>
                  <p className="text-xs text-primary-foreground/80">
                    {orderId ? `طلب #${orderId.slice(0, 8)}` : 'نحن هنا لمساعدتك'}
                  </p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleClose}
                className="hover:bg-primary-foreground/20 text-primary-foreground"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </CardHeader>

          {/* Messages Area */}
          <CardContent 
            className="flex-1 overflow-y-auto p-0 relative bg-background-2"
          >
            <ScrollArea className="h-full">
              <div className="p-4 space-y-3">
                {conversationLoading || messagesLoading ? (
                  <div className="flex items-center justify-center h-48">
                    <div className="text-center">
                      <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-3" />
                      <p className="text-sm text-foreground/70">جاري تحميل المحادثة...</p>
                    </div>
                  </div>
                ) : messages.length === 0 && !showCartConfirmInChat ? (
                  <div className="flex items-center justify-center h-48">
                    <div className="text-center p-6 bg-card rounded-xl border border-border/50">
                      <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                        <MessageCircle className="h-8 w-8 text-primary" />
                      </div>
                      <h3 className="font-semibold mb-2 text-foreground">مرحباً بك!</h3>
                      <p className="text-sm text-foreground/70">ابدأ المحادثة مع فريق الدعم</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {messages.map((msg) => {
                      const isOwn = msg.sender_id === user.id;
                      const productId = isProductMessage(msg.content) ? extractProductId(msg.content) : null;
                      
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-md ${
                              isOwn
                                ? 'bg-primary text-primary-foreground rounded-tr-sm'
                                : 'bg-card border border-border text-foreground rounded-tl-sm'
                            }`}
                          >
                            {/* Product Card in Message */}
                            {productId && msg.image_url && (
                              <div 
                                className={`mb-2 rounded-xl overflow-hidden border cursor-pointer ${
                                  isOwn ? 'border-primary-foreground/30' : 'border-border'
                                }`}
                                onClick={() => window.open(`/product/${productId}`, '_blank')}
                              >
                                <img 
                                  src={msg.image_url} 
                                  alt="منتج" 
                                  className="w-full h-32 object-cover"
                                />
                              </div>
                            )}
                            
                            {/* Regular Image */}
                            {msg.image_url && !productId && (
                              <img
                                src={msg.image_url}
                                alt="صورة"
                                className="rounded-xl mb-2 max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() => window.open(msg.image_url, '_blank')}
                              />
                            )}
                            
                            {/* Message Content */}
                            <p className={`text-sm break-words whitespace-pre-wrap ${
                              isOwn ? 'text-primary-foreground' : 'text-foreground'
                            }`}>
                              {msg.content}
                            </p>
                            
                            {/* Time and Read Status */}
                            <div className={`flex items-center gap-1 mt-1.5 ${
                              isOwn ? 'justify-end' : 'justify-start'
                            }`}>
                              <span className={`text-[10px] ${
                                isOwn ? 'text-primary-foreground/70' : 'text-foreground/60'
                              }`}>
                                {formatDistanceToNow(new Date(msg.created_at), {
                                  addSuffix: true,
                                  locale: ar,
                                })}
                              </span>
                              {isOwn && (
                                <span className={`${msg.is_read ? 'text-blue-400' : 'text-primary-foreground/70'}`}>
                                  {msg.is_read ? (
                                    <CheckCheck className="h-3.5 w-3.5" />
                                  ) : (
                                    <Check className="h-3.5 w-3.5" />
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    
                    {/* In-Chat Cart Confirmation Message - Now at the bottom */}
                    {showCartConfirmInChat && cartRequestCode && (
                      <div className="bg-gradient-to-br from-primary/20 to-primary/10 rounded-2xl p-4 border-2 border-primary/40 shadow-lg animate-in slide-in-from-bottom-2">
                        <div className="flex items-center gap-2 mb-3">
                          <ShoppingCart className="h-5 w-5 text-primary" />
                          <span className="font-bold text-foreground">إرسال طلب السلة</span>
                        </div>
                        <p className="text-sm text-foreground/80 mb-3">
                          هل تريد إرسال رمز السلة <span className="font-bold text-primary">{cartRequestCode}</span> إلى الإدارة للتعديل أو الاستفسار؟
                        </p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={handleConfirmCartMessage}
                            className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                            disabled={sendMessageMutation.isPending}
                          >
                            {sendMessageMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin ml-1" />
                            ) : (
                              <Check className="h-4 w-4 ml-1" />
                            )}
                            نعم، إرسال
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowCartConfirmInChat(false)}
                            className="flex-1 border-border text-foreground hover:bg-muted"
                          >
                            <X className="h-4 w-4 ml-1" />
                            إلغاء
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
          </CardContent>

          {/* Product Search Panel */}
          {showProductSearch && (
            <div className="border-t border-border bg-card p-3 max-h-64 overflow-hidden">
              <div className="relative mb-2">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/50" />
                <Input
                  placeholder="ابحث عن منتج..."
                  value={productSearchQuery}
                  onChange={(e) => setProductSearchQuery(e.target.value)}
                  className="pr-10 bg-background border-border text-foreground placeholder:text-foreground/50"
                  autoFocus
                />
              </div>
              <ScrollArea className="h-40">
                <div className="space-y-1">
                  {filteredProducts.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => sendProductMessage(product)}
                      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-primary/10 transition-colors text-right"
                    >
                      {product.image_url ? (
                        <OptimizedImage
                          src={product.image_url}
                          alt={product.name_ar}
                          className="w-10 h-10 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-muted/30 flex items-center justify-center">
                          <Package className="h-5 w-5 text-foreground/50" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate text-foreground">{product.name_ar}</p>
                        <p className="text-xs text-primary font-bold">{formatPrice(product.price)} د.ع</p>
                      </div>
                    </button>
                  ))}
                  {filteredProducts.length === 0 && productSearchQuery && (
                    <p className="text-sm text-foreground/60 text-center py-4">لا توجد منتجات مطابقة</p>
                  )}
                </div>
              </ScrollArea>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowProductSearch(false)}
                className="w-full mt-2 text-foreground hover:bg-muted/30"
              >
                إغلاق
              </Button>
            </div>
          )}

          {/* Input Area */}
          <div className="border-t border-border bg-card p-2 sm:p-3 flex-shrink-0">
            {imagePreview && (
              <div className="mb-2 relative inline-block">
                <img
                  src={imagePreview}
                  alt="معاينة"
                  className="h-16 w-16 object-cover rounded-xl border-2 border-primary/50"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-5 w-5 rounded-full shadow-lg"
                  onClick={() => {
                    setSelectedImage(null);
                    setImagePreview(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
            
            <div className="flex gap-1.5 items-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageSelect}
              />
              
              {/* Action Buttons */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage || sendMessageMutation.isPending}
                className="h-8 w-8 rounded-full hover:bg-primary/20 text-foreground/70 flex-shrink-0"
              >
                <ImageIcon className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowProductSearch(!showProductSearch)}
                disabled={uploadingImage || sendMessageMutation.isPending}
                className={`h-8 w-8 rounded-full hover:bg-primary/20 flex-shrink-0 ${showProductSearch ? 'bg-primary/20 text-primary' : 'text-foreground/70'}`}
              >
                <ShoppingBag className="h-4 w-4" />
              </Button>
              
              {/* Input Field */}
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="اكتب رسالتك..."
                disabled={uploadingImage || sendMessageMutation.isPending}
                className="flex-1 h-9 rounded-full border-border bg-background text-foreground placeholder:text-foreground/50 focus:border-primary text-sm px-3"
              />
              
              {/* Send Button */}
              <Button
                onClick={handleSend}
                disabled={(!message.trim() && !selectedImage) || uploadingImage || sendMessageMutation.isPending}
                size="icon"
                className="h-8 w-8 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg flex-shrink-0"
              >
                {uploadingImage || sendMessageMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </>
  );
}
