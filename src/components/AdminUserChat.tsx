import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Send, 
  Loader2, 
  Image as ImageIcon, 
  CheckCheck,
  Check,
  Package,
  Search,
  ShoppingBag,
  X,
  MessageCircle
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

interface Product {
  id: string;
  name_ar: string;
  image_url: string | null;
  price: number;
}

interface AdminUserChatProps {
  userId: string;
  orderId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName?: string;
}

export default function AdminUserChat({ 
  userId, 
  orderId, 
  open, 
  onOpenChange,
  userName 
}: AdminUserChatProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Products for search
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

  // Get or create conversation for admin-user
  const { data: conversation, isLoading: conversationLoading } = useQuery({
    queryKey: ['admin-user-conversation', userId, orderId],
    queryFn: async () => {
      if (!userId) return null;

      let query = supabase
        .from('conversations')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'open');

      if (orderId) {
        query = query.eq('order_id', orderId);
      } else {
        query = query.is('order_id', null);
      }

      const { data: existing } = await query.maybeSingle();

      if (existing) return existing;

      // Create new conversation for user
      const { data: newConv, error } = await supabase
        .from('conversations')
        .insert({
          user_id: userId,
          order_id: orderId || null,
        })
        .select()
        .single();

      if (error) throw error;
      return newConv;
    },
    enabled: !!userId && open,
  });

  // Get messages
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ['admin-user-messages', conversation?.id],
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
    refetchInterval: open ? 3000 : false,
  });

  // Mark messages as read
  useEffect(() => {
    if (!conversation || !open || !user) return;

    const markAsRead = async () => {
      const unreadMessages = messages.filter(
        (m) => m.sender_id !== user.id && !m.is_read
      );

      if (unreadMessages.length > 0) {
        await supabase
          .from('messages')
          .update({ is_read: true })
          .in('id', unreadMessages.map(m => m.id));

        queryClient.invalidateQueries({ queryKey: ['admin-user-messages', conversation.id] });
      }
    };

    markAsRead();
  }, [conversation, open, messages, user, queryClient]);

  // Scroll to bottom
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [messages, open]);

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

  // Upload image
  const uploadImage = async (file: File): Promise<string> => {
    if (!user) throw new Error('No user');

    const fileExt = file.name.split('.').pop();
    const fileName = `admin/${user.id}/${Date.now()}.${fileExt}`;

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

      // Update conversation last_message_at
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversation.id);
    },
    onSuccess: () => {
      setMessage('');
      setSelectedImage(null);
      setImagePreview(null);
      setShowProductSearch(false);
      setProductSearchQuery('');
      queryClient.invalidateQueries({ queryKey: ['admin-user-messages', conversation?.id] });
    },
    onError: () => {
      toast.error('فشل إرسال الرسالة');
      setUploadingImage(false);
    },
  });

  // Send product as message
  const sendProductMessage = (product: Product) => {
    const productMessage = `📦 منتج: ${product.name_ar}\n💰 السعر: ${formatPrice(product.price)} د.ع\n🔗 /product/${product.id}`;
    sendMessageMutation.mutate({ content: productMessage, imageUrl: product.image_url || undefined });
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

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg h-[70vh] p-0 flex flex-col">
        {/* Header */}
        <DialogHeader className="p-4 border-b flex-shrink-0 bg-primary text-primary-foreground rounded-t-lg">
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div>
              <span className="text-lg font-bold">{userName || 'محادثة العميل'}</span>
              {orderId && (
                <p className="text-xs opacity-80">طلب #{orderId.slice(0, 8)}</p>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          {conversationLoading || messagesLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-48">
              <div className="text-center p-6 bg-muted/50 rounded-xl">
                <MessageCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">لا توجد رسائل</p>
                <p className="text-xs text-muted-foreground mt-1">ابدأ المحادثة مع العميل</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => {
                const isOwn = msg.sender_id === user.id;
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isOwn ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                        isOwn
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-foreground'
                      }`}
                    >
                      {msg.image_url && (
                        <img
                          src={msg.image_url}
                          alt="صورة"
                          className="rounded-xl mb-2 max-w-full max-h-40 cursor-pointer"
                          onClick={() => window.open(msg.image_url, '_blank')}
                        />
                      )}
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      <div className="flex items-center gap-1 mt-1 justify-end">
                        <span className={`text-[10px] ${isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                          {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: ar })}
                        </span>
                        {isOwn && (
                          <span className={msg.is_read ? 'text-blue-400' : 'text-primary-foreground/70'}>
                            {msg.is_read ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* Product Search Panel */}
        {showProductSearch && (
          <div className="border-t p-3 max-h-48 overflow-hidden">
            <div className="relative mb-2">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ابحث عن منتج..."
                value={productSearchQuery}
                onChange={(e) => setProductSearchQuery(e.target.value)}
                className="pr-10 h-8 text-sm"
                autoFocus
              />
            </div>
            <ScrollArea className="h-32">
              <div className="space-y-1">
                {chatProducts.slice(0, 10).map((product) => (
                  <button
                    key={product.id}
                    onClick={() => sendProductMessage(product)}
                    className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-primary/10 transition-colors text-right"
                  >
                    {product.image_url ? (
                      <OptimizedImage
                        src={product.image_url}
                        alt={product.name_ar}
                        className="w-8 h-8 rounded object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                        <Package className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{product.name_ar}</p>
                      <p className="text-xs text-primary font-bold">{formatPrice(product.price)} د.ع</p>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Input Area */}
        <div className="border-t p-3 flex-shrink-0">
          {imagePreview && (
            <div className="mb-2 relative inline-block">
              <img
                src={imagePreview}
                alt="معاينة"
                className="h-14 w-14 object-cover rounded-lg"
              />
              <Button
                variant="destructive"
                size="icon"
                className="absolute -top-2 -right-2 h-5 w-5 rounded-full"
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
          <div className="flex gap-2 items-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageSelect}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImage}
              className="h-9 w-9 flex-shrink-0"
            >
              <ImageIcon className="h-4 w-4" />
            </Button>
            <Button
              variant={showProductSearch ? 'default' : 'ghost'}
              size="icon"
              onClick={() => setShowProductSearch(!showProductSearch)}
              className="h-9 w-9 flex-shrink-0"
            >
              <ShoppingBag className="h-4 w-4" />
            </Button>
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="اكتب رسالتك..."
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              disabled={uploadingImage}
              className="h-9 text-sm"
            />
            <Button
              onClick={handleSend}
              disabled={(!message.trim() && !selectedImage) || uploadingImage || sendMessageMutation.isPending}
              size="icon"
              className="h-9 w-9 flex-shrink-0 bg-primary text-primary-foreground"
            >
              {uploadingImage || sendMessageMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
