import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Send, MessageCircle, Crown, Award, Star, Image as ImageIcon, X, Search, Package, Store, Users } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import AdminLayout, { AdminCard, AdminLoading, AdminEmptyState } from '@/components/admin/AdminLayout';
import { formatPrice } from '@/lib/utils';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  is_read: boolean;
  image_url?: string;
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

export default function AdminChats() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'official' | 'community'>('official');
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Products search for admin
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

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate('/');
    }
  }, [authLoading, user, isAdmin, navigate]);

  // === OFFICIAL SITE CONVERSATIONS ===
  const { data: officialConversations = [], isLoading: officialLoading } = useQuery({
    queryKey: ['admin-official-conversations'],
    queryFn: async () => {
      const { data: convs, error: convsError } = await supabase
        .from('conversations')
        .select('*')
        .order('last_message_at', { ascending: false });

      if (convsError) throw convsError;

      const conversationsWithUsers = await Promise.all(
        (convs || []).map(async (conv) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, full_name, username, avatar_url')
            .eq('id', conv.user_id)
            .single();

          const { data: points } = await supabase
            .from('user_points')
            .select('level, total_points')
            .eq('user_id', conv.user_id)
            .single();

          const { count: unreadCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .neq('sender_id', user?.id || '')
            .eq('is_read', false);

          return {
            ...conv,
            user: profile,
            level: points?.level || 'bronze',
            total_points: points?.total_points || 0,
            unread_count: unreadCount || 0,
            type: 'official' as const,
          };
        })
      );

      return conversationsWithUsers.sort((a, b) => {
        const levelDiff = (LEVEL_PRIORITY[b.level] || 0) - (LEVEL_PRIORITY[a.level] || 0);
        if (levelDiff !== 0) return levelDiff;
        return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
      });
    },
    enabled: !!user && isAdmin,
  });

  // === COMMUNITY CONVERSATIONS ===
  const { data: communityConversations = [], isLoading: communityLoading } = useQuery({
    queryKey: ['admin-community-conversations'],
    queryFn: async () => {
      const { data: convs, error } = await supabase
        .from('listing_conversations')
        .select('id, buyer_id, seller_id, created_at, updated_at')
        .order('updated_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      if (!convs || convs.length === 0) return [];

      // Collect unique user IDs
      const userIds = new Set<string>();
      convs.forEach(c => {
        if (c.buyer_id) userIds.add(c.buyer_id);
        if (c.seller_id) userIds.add(c.seller_id);
      });

      // Fetch profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url')
        .in('id', Array.from(userIds));

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      // Fetch community profiles
      const { data: communityProfiles } = await supabase
        .from('community_customer_profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', Array.from(userIds));

      const communityProfileMap = new Map(communityProfiles?.map(p => [p.user_id, p]) || []);

      // Map conversations
      return convs.map(c => {
        const buyerProfile = profileMap.get(c.buyer_id) || communityProfileMap.get(c.buyer_id);
        const sellerProfile = profileMap.get(c.seller_id) || communityProfileMap.get(c.seller_id);

        return {
          id: c.id,
          buyer_id: c.buyer_id,
          seller_id: c.seller_id,
          created_at: c.created_at,
          updated_at: c.updated_at,
          buyer_name: (buyerProfile as any)?.full_name || (buyerProfile as any)?.display_name || (buyerProfile as any)?.username || 'مستخدم',
          seller_name: (sellerProfile as any)?.full_name || (sellerProfile as any)?.display_name || (sellerProfile as any)?.username || 'تاجر',
          buyer_avatar: (buyerProfile as any)?.avatar_url,
          seller_avatar: (sellerProfile as any)?.avatar_url,
          type: 'community' as const,
        };
      });
    },
    enabled: !!user && isAdmin,
  });

  // Get current conversations based on active tab
  const conversations = activeTab === 'official' ? officialConversations : communityConversations;
  const isLoading = activeTab === 'official' ? officialLoading : communityLoading;

  // Count unread for both tabs
  const officialUnread = officialConversations.filter(c => c.unread_count > 0).length;
  const communityUnread = 0; // Community conversations don't have unread tracking yet

  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ['admin-conversation-messages', selectedConversation, activeTab],
    queryFn: async () => {
      if (!selectedConversation) return [];

      const table = activeTab === 'official' ? 'messages' : 'listing_messages';
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('conversation_id', selectedConversation)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as Message[];
    },
    enabled: !!selectedConversation,
  });

  useEffect(() => {
    const channel = supabase
      .channel('admin-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['admin-official-conversations'] });
          if (selectedConversation && activeTab === 'official') {
            queryClient.invalidateQueries({ 
              queryKey: ['admin-conversation-messages', selectedConversation, 'official'] 
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'listing_messages',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['admin-community-conversations'] });
          if (selectedConversation && activeTab === 'community') {
            queryClient.invalidateQueries({ 
              queryKey: ['admin-conversation-messages', selectedConversation, 'community'] 
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, selectedConversation, activeTab]);

  useEffect(() => {
    if (!selectedConversation || !user || activeTab !== 'official') return;

    const markAsRead = async () => {
      const unreadMessages = messages.filter(
        (m) => m.sender_id !== user.id && !m.is_read
      );

      if (unreadMessages.length > 0) {
        await supabase
          .from('messages')
          .update({ is_read: true })
          .in('id', unreadMessages.map(m => m.id));

        queryClient.invalidateQueries({ queryKey: ['admin-official-conversations'] });
        queryClient.invalidateQueries({ queryKey: ['admin-unread-messages'] });
      }
    };

    markAsRead();
  }, [selectedConversation, messages, user, queryClient, activeTab]);

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

      const table = activeTab === 'official' ? 'messages' : 'listing_messages';
      const { error } = await supabase.from(table).insert({
        conversation_id: selectedConversation,
        sender_id: user.id,
        content,
        image_url: imageUrl,
      });

      if (error) throw error;

      // Update conversation last_message_at
      const convTable = activeTab === 'official' ? 'conversations' : 'listing_conversations';
      const updateField = activeTab === 'official' ? 'last_message_at' : 'updated_at';
      await supabase
        .from(convTable)
        .update({ [updateField]: new Date().toISOString() })
        .eq('id', selectedConversation);
    },
    onSuccess: () => {
      setMessage('');
      setSelectedImage(null);
      setImagePreview(null);
      setShowProductSearch(false);
      setProductSearchQuery('');
      queryClient.invalidateQueries({ 
        queryKey: ['admin-conversation-messages', selectedConversation, activeTab] 
      });
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

  const selectedConv = conversations.find((c: any) => c.id === selectedConversation);

  if (authLoading) {
    return <AdminLoading />;
  }

  if (!user || !isAdmin) return null;

  return (
    <AdminLayout
      title="محادثات الدعم"
      description="إدارة جميع محادثات الموقع ومجتمع ليفو"
      icon={<MessageCircle className="h-5 w-5" />}
    >
      {/* Tabs for switching between systems */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as 'official' | 'community'); setSelectedConversation(null); }} className="mb-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="official" className="gap-2">
            <Users className="h-4 w-4" />
            الموقع الرسمي
            {officialUnread > 0 && (
              <Badge variant="destructive" className="text-[10px] h-5 px-1.5">
                {officialUnread}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="community" className="gap-2">
            <Store className="h-4 w-4" />
            مجتمع ليفو
            {communityUnread > 0 && (
              <Badge variant="destructive" className="text-[10px] h-5 px-1.5">
                {communityUnread}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-280px)]">
        {/* Conversations List */}
        <AdminCard className="lg:col-span-1 overflow-hidden flex flex-col max-h-[300px] lg:max-h-none">
          <div className="p-3 border-b border-border/50">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">المحادثات</h3>
              {activeTab === 'official' && officialUnread > 0 && (
                <Badge variant="destructive" className="text-xs animate-pulse">
                  {officialUnread} غير مقروءة
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {conversations.length} محادثة
              {activeTab === 'official' && ' - العملاء المميزون أولاً'}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                <MessageCircle className="h-10 w-10 text-muted-foreground mb-2" />
                <p className="text-muted-foreground text-sm">لا توجد محادثات</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {conversations.map((conv: any) => {
                  if (activeTab === 'official') {
                    const LevelIcon = LEVEL_ICONS[conv.level] || MessageCircle;
                    const hasUnread = conv.unread_count > 0;
                    return (
                      <button
                        key={conv.id}
                        onClick={() => setSelectedConversation(conv.id)}
                        className={`w-full p-3 text-right hover:bg-muted/50 transition-colors relative ${
                          selectedConversation === conv.id ? 'bg-primary/10' : ''
                        } ${hasUnread ? 'bg-destructive/5' : ''}`}
                      >
                        {hasUnread && (
                          <div className="absolute right-0 top-0 bottom-0 w-1 bg-destructive rounded-l" />
                        )}
                        <div className="flex items-start gap-2">
                          <div className="relative flex-shrink-0">
                            <img
                              src={conv.user?.avatar_url || '/placeholder.svg'}
                              alt={conv.user?.full_name}
                              className={`h-9 w-9 rounded-full object-cover ${hasUnread ? 'ring-2 ring-destructive' : ''}`}
                            />
                            <LevelIcon className="absolute -bottom-1 -right-1 h-4 w-4 text-primary bg-background rounded-full p-0.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <p className={`truncate text-sm ${hasUnread ? 'font-bold' : 'font-medium'}`}>
                                {conv.user?.full_name || conv.user?.username}
                              </p>
                              {hasUnread && (
                                <Badge variant="destructive" className="text-[10px] h-4 px-1.5 animate-pulse flex-shrink-0">
                                  {conv.unread_count}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(conv.last_message_at), {
                                addSuffix: true,
                                locale: ar,
                              })}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  } else {
                    // Community conversation
                    return (
                      <button
                        key={conv.id}
                        onClick={() => setSelectedConversation(conv.id)}
                        className={`w-full p-3 text-right hover:bg-muted/50 transition-colors ${
                          selectedConversation === conv.id ? 'bg-primary/10' : ''
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <div className="relative flex-shrink-0">
                            <img
                              src={(conv as any).buyer_avatar || '/placeholder.svg'}
                              alt={(conv as any).buyer_name}
                              className="h-9 w-9 rounded-full object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="truncate text-sm font-medium">
                              {(conv as any).buyer_name} ↔ {(conv as any).seller_name}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              محادثة مجتمع ليفو
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(conv.updated_at), {
                                addSuffix: true,
                                locale: ar,
                              })}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  }
                })}
              </div>
            )}
          </div>
        </AdminCard>

        {/* Chat Window */}
        <AdminCard className="lg:col-span-2 flex flex-col overflow-hidden min-h-[400px] lg:min-h-0">
          {selectedConversation && selectedConv ? (
            <>
              <div className="p-3 border-b border-border/50 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <img
                    src={(selectedConv as any).user?.avatar_url || (selectedConv as any).buyer_avatar || '/placeholder.svg'}
                    alt="المستخدم"
                    className="h-9 w-9 rounded-full object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate">
                      {activeTab === 'official' 
                        ? ((selectedConv as any).user?.full_name || (selectedConv as any).user?.username)
                        : `${(selectedConv as any).buyer_name} ↔ ${(selectedConv as any).seller_name}`
                      }
                    </h3>
                    <p className="text-xs text-muted-foreground truncate">
                      {activeTab === 'official' 
                        ? ((selectedConv as any).order_id ? `محادثة حول الطلب #${(selectedConv as any).order_id.slice(0, 8)}` : 'محادثة عامة')
                        : 'محادثة مجتمع ليفو'
                      }
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {messagesLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <>
                    {messages.map((msg) => {
                      const isOwn = msg.sender_id === user.id;
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isOwn ? 'justify-start' : 'justify-end'}`}
                        >
                          <div
                            className={`max-w-[75%] rounded-xl px-3 py-2 ${
                              isOwn
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-foreground'
                            }`}
                          >
                            {msg.image_url && (
                              <img
                                src={msg.image_url}
                                alt="صورة"
                                className="rounded-lg mb-2 max-w-full max-h-40 h-auto cursor-pointer"
                                onClick={() => window.open(msg.image_url, '_blank')}
                              />
                            )}
                            <p className="text-sm break-words whitespace-pre-wrap">{msg.content}</p>
                            <p
                              className={`text-[10px] mt-1 ${
                                isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
                              }`}
                            >
                              {formatDistanceToNow(new Date(msg.created_at), {
                                addSuffix: true,
                                locale: ar,
                              })}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Product Search Panel */}
              {showProductSearch && (
                <div className="border-t border-border/50 p-3 bg-muted/30">
                  <div className="flex items-center gap-2 mb-3">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input
                      value={productSearchQuery}
                      onChange={(e) => setProductSearchQuery(e.target.value)}
                      placeholder="ابحث عن منتج..."
                      className="flex-1 h-8"
                    />
                    <Button variant="ghost" size="sm" onClick={() => setShowProductSearch(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <ScrollArea className="h-32">
                    <div className="space-y-1">
                      {chatProducts.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => sendProductMessage(p)}
                          className="w-full flex items-center gap-2 p-2 hover:bg-muted rounded-lg transition-colors text-right"
                        >
                          <img
                            src={p.image_url || '/placeholder.svg'}
                            alt={p.name_ar}
                            className="h-8 w-8 rounded object-cover"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{p.name_ar}</p>
                            <p className="text-[10px] text-muted-foreground">{formatPrice(p.price)} د.ع</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Image Preview */}
              {imagePreview && (
                <div className="border-t border-border/50 p-2 bg-muted/30">
                  <div className="relative inline-block">
                    <img src={imagePreview} alt="معاينة" className="h-20 rounded-lg" />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-5 w-5 rounded-full"
                      onClick={() => {
                        setSelectedImage(null);
                        setImagePreview(null);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Input Bar */}
              <div className="p-3 border-t border-border/50 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleImageSelect}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={() => setShowProductSearch(!showProductSearch)}
                  >
                    <Package className="h-4 w-4" />
                  </Button>
                  <Input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="اكتب رسالتك..."
                    className="flex-1"
                    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  />
                  <Button
                    onClick={handleSend}
                    disabled={(!message.trim() && !selectedImage) || sendMessageMutation.isPending || uploadingImage}
                    className="shrink-0 gap-2"
                  >
                    {(sendMessageMutation.isPending || uploadingImage) ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">اختر محادثة للبدء</p>
              </div>
            </div>
          )}
        </AdminCard>
      </div>
    </AdminLayout>
  );
}
