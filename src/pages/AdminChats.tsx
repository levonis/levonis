import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send, MessageCircle, Crown, Award, Star, Image as ImageIcon, X, Search, Package, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import AdminLayout, { AdminCard, AdminLoading, AdminEmptyState } from '@/components/admin/AdminLayout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatPrice } from '@/lib/utils';

// Support user ID - messages TO this ID are from users seeking support
const SUPPORT_USER_ID = "f632ba7b-60e7-4f2f-9cb7-2851f7f2ed2f";

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  is_read: boolean;
  image_url?: string;
}

interface SupportConversation {
  id: string;
  user_id: string;
  user_name: string;
  user_avatar: string | null;
  level: string;
  total_points: number;
  unread_count: number;
  last_message_at: string;
  last_message?: string;
}

const LEVEL_PRIORITY: { [key: string]: number } = {
  platinum: 4,
  gold: 3,
  silver: 2,
  bronze: 1,
};

const LEVEL_ICONS: { [key: string]: any } = {
  platinum: Crown,
  gold: Award,
  silver: Star,
  bronze: MessageCircle,
};

const LEVEL_COLORS: { [key: string]: string } = {
  platinum: "text-purple-500",
  gold: "text-amber-500",
  silver: "text-slate-400",
  bronze: "text-orange-600",
};

export default function AdminChats() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  interface Product {
    id: string;
    name_ar: string;
    image_url: string | null;
    price: number;
  }
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
        setChatProducts(data.map((p: any) => ({
          id: p.id,
          name_ar: p.name_ar,
          image_url: p.image_url,
          price: p.price
        })));
      }
    };
    
    loadProducts();
  }, [showProductSearch, productSearchQuery]);

  // Search for users when opening new chat dialog
  const { data: searchedUsers = [] } = useQuery({
    queryKey: ['admin-search-users-chat', newChatSearch],
    queryFn: async () => {
      if (!newChatSearch.trim() || newChatSearch.trim().length < 2) return [];
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url')
        .or(`full_name.ilike.%${newChatSearch}%,username.ilike.%${newChatSearch}%`)
        .neq('id', SUPPORT_USER_ID)
        .limit(20);
      if (error) return [];
      return data || [];
    },
    enabled: showNewChatDialog && newChatSearch.trim().length >= 2,
  });

  const startNewConversation = async (targetUserId: string) => {
    try {
      // Check for existing conversation
      const { data: existingConv } = await supabase
        .from('listing_conversations')
        .select('id')
        .or(`and(buyer_id.eq.${targetUserId},seller_id.eq.${SUPPORT_USER_ID}),and(buyer_id.eq.${SUPPORT_USER_ID},seller_id.eq.${targetUserId})`)
        .maybeSingle();

      if (existingConv) {
        setSelectedConversation(existingConv.id);
        setSelectedUserId(targetUserId);
      } else {
        const { data: newConv, error } = await supabase
          .from('listing_conversations')
          .insert({
            listing_id: targetUserId, // Use user ID as pseudo listing ref
            buyer_id: targetUserId,
            seller_id: SUPPORT_USER_ID,
          })
          .select('id')
          .single();

        if (error) throw error;
        setSelectedConversation(newConv.id);
        setSelectedUserId(targetUserId);
      }
      setShowNewChatDialog(false);
      setNewChatSearch('');
      queryClient.invalidateQueries({ queryKey: ['admin-support-conversations'] });
    } catch (error) {
      toast.error('فشل في فتح المحادثة');
    }
  };

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate('/');
    }
  }, [authLoading, user, isAdmin, navigate]);

  // Fetch support conversations - users who messaged support
  const { data: supportConversations = [], isLoading } = useQuery({
    queryKey: ['admin-support-conversations'],
    queryFn: async (): Promise<SupportConversation[]> => {
      // Get conversations where seller_id is SUPPORT_USER_ID (users messaging support)
      // Exclude conversations where buyer is also support (self-conversations)
      const { data: convs, error } = await supabase
        .from('listing_conversations')
        .select('id, buyer_id, created_at, updated_at')
        .eq('seller_id', SUPPORT_USER_ID)
        .neq('buyer_id', SUPPORT_USER_ID)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      if (!convs || convs.length === 0) return [];

      // Get user IDs
      const userIds = [...new Set(convs.map(c => c.buyer_id))];

      // Fetch profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      // Fetch points/levels
      const { data: points } = await supabase
        .from('user_points')
        .select('user_id, level, total_points')
        .in('user_id', userIds);

      const pointsMap = new Map(points?.map(p => [p.user_id, p]) || []);

      // Get last messages and unread counts
      const conversationsWithDetails: SupportConversation[] = await Promise.all(
        convs.map(async (conv) => {
          const profile = profileMap.get(conv.buyer_id);
          const userPoints = pointsMap.get(conv.buyer_id);

          // Get unread count (messages from user, not read by admin)
          const { count: unreadCount } = await supabase
            .from('listing_messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .eq('sender_id', conv.buyer_id)
            .eq('is_read', false);

          // Get last message
          const { data: lastMsg } = await supabase
            .from('listing_messages')
            .select('content')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            id: conv.id,
            user_id: conv.buyer_id,
            user_name: profile?.full_name || profile?.username || 'مستخدم',
            user_avatar: profile?.avatar_url || null,
            level: userPoints?.level || 'bronze',
            total_points: userPoints?.total_points || 0,
            unread_count: unreadCount || 0,
            last_message_at: conv.updated_at,
            last_message: lastMsg?.content,
          };
        })
      );

      // Sort by level priority then by last message
      return conversationsWithDetails.sort((a, b) => {
        const levelDiff = (LEVEL_PRIORITY[b.level] || 0) - (LEVEL_PRIORITY[a.level] || 0);
        if (levelDiff !== 0) return levelDiff;
        return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
      });
    },
    enabled: !!user && isAdmin,
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Filter conversations
  const filteredConversations = supportConversations.filter(conv => {
    if (!searchFilter.trim()) return true;
    return conv.user_name.toLowerCase().includes(searchFilter.toLowerCase());
  });

  const totalUnread = supportConversations.reduce((sum, c) => sum + c.unread_count, 0);

  // Fetch messages for selected conversation
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ['admin-support-messages', selectedConversation],
    queryFn: async () => {
      if (!selectedConversation) return [];

      const { data, error } = await supabase
        .from('listing_messages')
        .select('*')
        .eq('conversation_id', selectedConversation)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as Message[];
    },
    enabled: !!selectedConversation,
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('admin-support-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'listing_messages',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['admin-support-conversations'] });
          if (selectedConversation) {
            queryClient.invalidateQueries({ queryKey: ['admin-support-messages', selectedConversation] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, selectedConversation]);

  // Mark messages as read
  useEffect(() => {
    if (!selectedConversation || !selectedUserId) return;

    const markAsRead = async () => {
      const unreadMessages = messages.filter(
        (m) => m.sender_id === selectedUserId && !m.is_read
      );

      if (unreadMessages.length > 0) {
        await supabase
          .from('listing_messages')
          .update({ is_read: true })
          .in('id', unreadMessages.map(m => m.id));

        queryClient.invalidateQueries({ queryKey: ['admin-support-conversations'] });
      }
    };

    markAsRead();
  }, [selectedConversation, selectedUserId, messages, queryClient]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  const sendMessageMutation = useMutation({
    mutationFn: async ({ content, imageUrl }: { content: string; imageUrl?: string }) => {
      if (!selectedConversation || !user) throw new Error('No conversation');

      // Admin sends as SUPPORT_USER_ID
      const { error } = await supabase.from('listing_messages').insert({
        conversation_id: selectedConversation,
        sender_id: SUPPORT_USER_ID,
        content,
        image_url: imageUrl,
      });

      if (error) throw error;

      // Update conversation timestamp
      await supabase
        .from('listing_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', selectedConversation);
    },
    onSuccess: () => {
      setMessage('');
      setSelectedImage(null);
      setImagePreview(null);
      setShowProductSearch(false);
      setProductSearchQuery('');
      queryClient.invalidateQueries({ queryKey: ['admin-support-messages', selectedConversation] });
    },
    onError: () => {
      toast.error('فشل إرسال الرسالة');
      setUploadingImage(false);
    },
  });

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

  const selectedConv = filteredConversations.find(c => c.id === selectedConversation);

  if (authLoading) {
    return <AdminLoading />;
  }

  if (!user || !isAdmin) return null;

  return (
    <AdminLayout
      title="رسائل الدعم الفني"
      description="الرد على رسائل المستخدمين الذين يطلبون المساعدة"
      icon={<MessageCircle className="h-5 w-5" />}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-200px)]">
        {/* Conversations List */}
        <AdminCard className="lg:col-span-1 overflow-hidden flex flex-col">
          <div className="p-3 border-b border-border/50 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">المستخدمون</h3>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowNewChatDialog(true)}>
                  <Plus className="h-3 w-3 ml-1" />
                  محادثة جديدة
                </Button>
                {totalUnread > 0 && (
                  <Badge variant="destructive" className="text-xs animate-pulse">
                    {totalUnread} غير مقروءة
                  </Badge>
                )}
              </div>
            </div>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="البحث..."
                className="pr-9 h-8 text-sm"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {filteredConversations.length} محادثة - العملاء المميزون أولاً
            </p>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                <MessageCircle className="h-10 w-10 text-muted-foreground mb-2" />
                <p className="text-muted-foreground text-sm">لا توجد رسائل دعم</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {filteredConversations.map((conv) => {
                  const LevelIcon = LEVEL_ICONS[conv.level] || MessageCircle;
                  const levelColor = LEVEL_COLORS[conv.level] || "";
                  const hasUnread = conv.unread_count > 0;

                  return (
                    <button
                      key={conv.id}
                      onClick={() => {
                        setSelectedConversation(conv.id);
                        setSelectedUserId(conv.user_id);
                      }}
                      className={`w-full p-3 text-right hover:bg-muted/50 transition-colors relative ${
                        selectedConversation === conv.id ? 'bg-primary/10' : ''
                      } ${hasUnread ? 'bg-destructive/5' : ''}`}
                    >
                      {hasUnread && (
                        <div className="absolute right-0 top-0 bottom-0 w-1 bg-destructive rounded-l" />
                      )}
                      <div className="flex items-start gap-2">
                        <div className="relative">
                          <Avatar className={`h-10 w-10 ${hasUnread ? 'ring-2 ring-destructive' : ''}`}>
                            <AvatarImage src={conv.user_avatar || undefined} />
                            <AvatarFallback className="text-xs">
                              {conv.user_name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className={`absolute -bottom-1 -left-1 p-0.5 rounded-full bg-card ${levelColor}`}>
                            <LevelIcon className="h-3 w-3" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-medium text-sm truncate">{conv.user_name}</span>
                            {hasUnread && (
                              <Badge variant="destructive" className="text-[10px] h-4 px-1">
                                {conv.unread_count}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {conv.last_message || "لا توجد رسائل"}
                          </p>
                          <span className="text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(conv.last_message_at), { 
                              addSuffix: true, 
                              locale: ar 
                            })}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </AdminCard>

        {/* Chat Area */}
        <AdminCard className="lg:col-span-2 overflow-hidden flex flex-col">
          {!selectedConversation ? (
            <div className="flex-1 flex items-center justify-center">
              <AdminEmptyState
                icon={<MessageCircle className="h-12 w-12" />}
                title="اختر محادثة"
                description="اختر مستخدم من القائمة للرد على رسالته"
              />
            </div>
          ) : (
            <>
              {/* Chat Header */}
              {selectedConv && (
                <div className="p-3 border-b border-border/50 flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedConv.user_avatar || undefined} />
                    <AvatarFallback>{selectedConv.user_name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm">{selectedConv.user_name}</h3>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] h-4">
                        {selectedConv.level}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {selectedConv.total_points.toLocaleString()} نقطة
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                {messagesLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    لا توجد رسائل بعد
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((msg) => {
                      const isSupport = msg.sender_id === SUPPORT_USER_ID;
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isSupport ? 'justify-start' : 'justify-end'}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                              isSupport
                                ? 'bg-primary text-primary-foreground rounded-br-sm'
                                : 'bg-muted rounded-bl-sm'
                            }`}
                          >
                            {msg.image_url && (
                              <img
                                src={msg.image_url}
                                alt=""
                                className="max-w-full rounded-lg mb-2 max-h-48 object-cover"
                              />
                            )}
                            <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                            <span className={`text-[10px] mt-1 block ${
                              isSupport ? 'text-primary-foreground/70' : 'text-muted-foreground'
                            }`}>
                              {formatDistanceToNow(new Date(msg.created_at), { 
                                addSuffix: true, 
                                locale: ar 
                              })}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              {/* Product Search Overlay */}
              {showProductSearch && (
                <div className="absolute inset-0 bg-background/95 z-10 flex flex-col">
                  <div className="p-3 border-b flex items-center gap-2">
                    <Input
                      value={productSearchQuery}
                      onChange={(e) => setProductSearchQuery(e.target.value)}
                      placeholder="ابحث عن منتج..."
                      className="flex-1"
                      autoFocus
                    />
                    <Button variant="ghost" size="icon" onClick={() => setShowProductSearch(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <ScrollArea className="flex-1 p-3">
                    <div className="grid grid-cols-2 gap-2">
                      {chatProducts.map((product) => (
                        <button
                          key={product.id}
                          onClick={() => sendProductMessage(product)}
                          className="p-2 border rounded-lg text-right hover:bg-muted transition-colors"
                        >
                          {product.image_url && (
                            <img
                              src={product.image_url}
                              alt=""
                              className="w-full h-20 object-cover rounded mb-1"
                            />
                          )}
                          <p className="text-xs font-medium line-clamp-2">{product.name_ar}</p>
                          <p className="text-xs text-primary">{formatPrice(product.price)} د.ع</p>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Input Area */}
              <div className="p-3 border-t border-border/50">
                {imagePreview && (
                  <div className="relative mb-2 inline-block">
                    <img src={imagePreview} alt="" className="h-20 rounded-lg" />
                    <button
                      onClick={() => {
                        setSelectedImage(null);
                        setImagePreview(null);
                      }}
                      className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2">
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
                  >
                    <ImageIcon className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowProductSearch(true)}
                  >
                    <Package className="h-5 w-5" />
                  </Button>
                  <Input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="اكتب ردك..."
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    disabled={sendMessageMutation.isPending || uploadingImage}
                  />
                  <Button
                    onClick={handleSend}
                    disabled={(!message.trim() && !selectedImage) || sendMessageMutation.isPending || uploadingImage}
                    size="icon"
                  >
                    {uploadingImage || sendMessageMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </AdminCard>
      </div>

      {/* New Chat Dialog */}
      {showNewChatDialog && (
        <Dialog open={showNewChatDialog} onOpenChange={setShowNewChatDialog}>
          <DialogContent className="sm:max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle>بدء محادثة جديدة</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={newChatSearch}
                  onChange={(e) => setNewChatSearch(e.target.value)}
                  placeholder="ابحث عن مستخدم بالاسم..."
                  className="pr-9"
                  autoFocus
                />
              </div>
              <ScrollArea className="max-h-64">
                {searchedUsers.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    {newChatSearch.trim().length < 2 ? 'اكتب حرفين على الأقل للبحث' : 'لا توجد نتائج'}
                  </p>
                ) : (
                  <div className="space-y-1">
                    {searchedUsers.map((u: any) => (
                      <button
                        key={u.id}
                        onClick={() => startNewConversation(u.id)}
                        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors text-right"
                      >
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={u.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">{(u.full_name || u.username || '?').charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{u.full_name || u.username}</p>
                          {u.username && u.full_name && (
                            <p className="text-xs text-muted-foreground">@{u.username}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </AdminLayout>
  );
}
