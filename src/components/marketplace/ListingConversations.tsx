import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  MessageSquare,
  Send,
  ArrowRight,
  AlertTriangle,
  ShieldCheck,
  Loader2,
  Image as ImageIcon,
  Package,
  X,
  Phone,
  MoreVertical,
  Check,
  CheckCheck,
  Mic,
  Video,
  Smile,
  Paperclip,
  Star,
  User,
  ShoppingBag,
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ListingConversationsProps {
  children?: React.ReactNode;
  listingId?: string;
  onClose?: () => void;
  isAdmin?: boolean;
}

const formatMessageDate = (date: Date) => {
  if (isToday(date)) return 'اليوم';
  if (isYesterday(date)) return 'أمس';
  return format(date, 'dd MMM yyyy', { locale: ar });
};

export const ListingConversations = ({ children, listingId, onClose, isAdmin: propIsAdmin }: ListingConversationsProps) => {
  const { user, isAdmin: authIsAdmin } = useAuth();
  const isAdmin = propIsAdmin || authIsAdmin;
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto open if listingId is provided
  useEffect(() => {
    if (listingId) {
      setOpen(true);
    }
  }, [listingId]);

  // Fetch conversations
  const { data: conversations, isLoading: loadingConversations } = useQuery({
    queryKey: ['listing-conversations', user?.id, listingId, isAdmin],
    queryFn: async () => {
      if (!user) return [];
      
      let query = supabase
        .from('listing_conversations')
        .select(`
          *,
          user_listings(title_ar, images, price, currency)
        `)
        .order('updated_at', { ascending: false });
      
      if (listingId) {
        query = query.eq('listing_id', listingId);
      } else if (!isAdmin) {
        query = query.or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user && open,
  });

  // Fetch profiles with seller data
  const { data: profiles } = useQuery({
    queryKey: ['conversation-profiles-full', conversations?.map(c => [c.buyer_id, c.seller_id]).flat()],
    queryFn: async () => {
      if (!conversations?.length) return {};
      const userIds = [...new Set(conversations.flatMap(c => [c.buyer_id, c.seller_id]))];
      const { data: profilesData } = await supabase.from('profiles').select('id, full_name, username, avatar_url, phone_number').in('id', userIds);
      const { data: sellerProfiles } = await supabase.from('seller_profiles').select('*').in('user_id', userIds);
      
      const result: Record<string, any> = {};
      profilesData?.forEach(p => {
        const sellerData = sellerProfiles?.find(sp => sp.user_id === p.id);
        result[p.id] = { ...p, seller_profile: sellerData };
      });
      return result;
    },
    enabled: !!conversations?.length,
  });

  // Fetch messages
  const { data: messages, isLoading: loadingMessages } = useQuery({
    queryKey: ['listing-messages', selectedConversation],
    queryFn: async () => {
      if (!selectedConversation) return [];
      const { data, error } = await supabase
        .from('listing_messages')
        .select('*')
        .eq('conversation_id', selectedConversation)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedConversation,
    refetchInterval: 3000,
  });

  // Get last message for each conversation
  const { data: lastMessages } = useQuery({
    queryKey: ['last-messages', conversations?.map(c => c.id)],
    queryFn: async () => {
      if (!conversations?.length) return {};
      const results: Record<string, any> = {};
      for (const conv of conversations) {
        const { data } = await supabase
          .from('listing_messages')
          .select('content, created_at, sender_id, image_url')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        if (data) results[conv.id] = data;
      }
      return results;
    },
    enabled: !!conversations?.length,
  });

  useEffect(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, [messages, selectedConversation]);

  // Focus input when conversation selected and mark messages as read
  useEffect(() => {
    if (selectedConversation && user) {
      setTimeout(() => inputRef.current?.focus(), 100);
      
      // Mark all messages as read when opening a conversation
      const markAsRead = async () => {
        const { error } = await supabase
          .from('listing_messages')
          .update({ is_read: true })
          .eq('conversation_id', selectedConversation)
          .neq('sender_id', user.id)
          .eq('is_read', false);
        
        if (!error) {
          // Refetch to update UI
          queryClient.invalidateQueries({ queryKey: ['marketplace-unread-users-count'] });
          queryClient.invalidateQueries({ queryKey: ['listing-messages', selectedConversation] });
          queryClient.invalidateQueries({ queryKey: ['last-messages'] });
        }
      };
      markAsRead();
    }
  }, [selectedConversation, user?.id, queryClient]);

  const sendMessageMutation = useMutation({
    mutationFn: async (mediaUrl?: string) => {
      if (!user || !selectedConversation || (!messageInput.trim() && !mediaUrl)) {
        throw new Error('لا يمكن إرسال رسالة فارغة');
      }
      
      const messageContent = messageInput.trim() || (mediaUrl ? '📷 وسائط' : '');
      
      const { error } = await supabase.from('listing_messages').insert({
        conversation_id: selectedConversation,
        sender_id: user.id,
        content: messageContent,
        image_url: mediaUrl || null,
      });
      if (error) throw error;
      
      await supabase.from('listing_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', selectedConversation);

      // Send Telegram notification to the other party
      if (selectedConv) {
        const otherUserId = selectedConv.buyer_id === user.id 
          ? selectedConv.seller_id 
          : selectedConv.buyer_id;
        
        const { data: senderProfile } = await supabase
          .from('profiles')
          .select('full_name, username')
          .eq('id', user.id)
          .single();

        const senderName = senderProfile?.full_name || senderProfile?.username || 'مستخدم';
        const listingTitle = (selectedConv.user_listings as any)?.title_ar || 'منتج';

        // Call the telegram notification function
        await supabase.functions.invoke('notify-marketplace-telegram', {
          body: {
            user_id: otherUserId,
            event_type: 'new_message',
            listing_title: listingTitle,
            sender_name: senderName,
            message_content: messageContent,
            conversation_id: selectedConversation,
          },
        });
      }
    },
    onSuccess: () => {
      setMessageInput('');
      queryClient.invalidateQueries({ queryKey: ['listing-messages', selectedConversation] });
      queryClient.invalidateQueries({ queryKey: ['listing-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['last-messages'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const requestAdminMutation = useMutation({
    mutationFn: async () => {
      if (!selectedConversation) return;
      const { error } = await supabase
        .from('listing_conversations')
        .update({ status: 'disputed' })
        .eq('id', selectedConversation);
      if (error) throw error;

      // Get conversation code for notification
      const { data: conv } = await supabase
        .from('listing_conversations')
        .select('conversation_code')
        .eq('id', selectedConversation)
        .single();

      // Create notification for admins
      const { data: admins } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');

      if (admins?.length) {
        await supabase.from('notifications').insert(
          admins.map(admin => ({
            user_id: admin.user_id,
            title: 'طلب تدخل في محادثة السوق',
            message: `تم طلب تدخل الإدارة في محادثة برمز: ${conv?.conversation_code || 'غير معروف'}`,
            type: 'warning',
            related_id: selectedConversation,
          }))
        );
      }
    },
    onSuccess: () => {
      toast.success('تم طلب تدخل الإدارة - سيتم إعلام الإدارة');
      queryClient.invalidateQueries({ queryKey: ['listing-conversations'] });
    },
  });

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    setUploadingMedia(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `chat/${user.id}/${Date.now()}.${fileExt}`;
      const { error } = await supabase.storage.from('listing-images').upload(fileName, file);
      if (error) throw error;
      
      const { data: { publicUrl } } = supabase.storage.from('listing-images').getPublicUrl(fileName);
      await sendMessageMutation.mutateAsync(publicUrl);
    } catch (error) {
      toast.error('فشل رفع الملف');
    } finally {
      setUploadingMedia(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageInput.trim()) sendMessageMutation.mutate(undefined);
  };

  const handleClose = () => {
    setOpen(false);
    setSelectedConversation(null);
    if (onClose) onClose();
  };

  const selectedConv = conversations?.find(c => c.id === selectedConversation);
  const isBuyer = selectedConv?.buyer_id === user?.id;
  const isSeller = selectedConv?.seller_id === user?.id;
  const otherUserId = selectedConv ? (selectedConv.buyer_id === user?.id ? selectedConv.seller_id : selectedConv.buyer_id) : null;
  const otherUser = otherUserId ? profiles?.[otherUserId] : null;

  // Fetch other listings for selected conversation user
  const { data: otherUserListings } = useQuery({
    queryKey: ['other-user-listings', otherUserId],
    queryFn: async () => {
      if (!otherUserId) return [];
      const { data } = await supabase
        .from('user_listings')
        .select('id, title_ar, price, images, status')
        .eq('seller_id', otherUserId)
        .eq('status', 'approved')
        .limit(6);
      return data || [];
    },
    enabled: !!otherUserId && !!selectedConversation,
  });

  // Group messages by date
  const groupedMessages = messages?.reduce((groups: any, msg) => {
    const date = formatMessageDate(new Date(msg.created_at));
    if (!groups[date]) groups[date] = [];
    groups[date].push(msg);
    return groups;
  }, {});

  return (
    <Dialog open={open} onOpenChange={(v) => v ? setOpen(true) : handleClose()}>
      {!listingId && (
        <DialogTrigger asChild>
          {children || (
            <Button variant="outline" size="sm" className="gap-2">
              <MessageSquare className="w-4 h-4" />
              المحادثات
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent hideClose className="max-w-4xl h-[90vh] sm:h-[85vh] p-0 flex flex-col overflow-hidden">
        {/* Close Button - always visible on desktop, only when no conversation on mobile */}
        <button
          onClick={handleClose}
          className={cn(
            "absolute right-3 top-3 z-50 bg-destructive/90 hover:bg-destructive text-destructive-foreground rounded-full p-2 shadow-lg transition-colors",
            selectedConversation ? "hidden md:block" : "block"
          )}
          aria-label="إغلاق"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-1 min-h-0">
          {/* Conversations List - WhatsApp Style */}
          <div className={cn(
            "flex flex-col w-full md:w-80 lg:w-96 border-l bg-card",
            selectedConversation ? 'hidden md:flex' : 'flex'
          )}>
            {/* Header */}
            <div className="p-3 border-b bg-muted/30 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                <h2 className="font-bold text-sm">{listingId ? 'محادثات المنتج' : 'المحادثات'}</h2>
              </div>
            </div>

            {/* Conversations List */}
            <div className="flex-1 overflow-y-auto">
              {loadingConversations ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex gap-3 p-2">
                      <div className="w-12 h-12 rounded-full bg-muted animate-pulse" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                        <div className="h-3 w-32 bg-muted rounded animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : conversations?.length === 0 ? (
                <div className="flex-1 flex items-center justify-center p-8">
                  <div className="text-center text-muted-foreground">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">لا توجد محادثات</p>
                  </div>
                </div>
              ) : (
                <div>
                  {conversations?.map(conv => {
                    const convOtherUserId = conv.buyer_id === user?.id ? conv.seller_id : conv.buyer_id;
                    const convOtherUser = profiles?.[convOtherUserId];
                    const lastMsg = lastMessages?.[conv.id];
                    const isActive = selectedConversation === conv.id;
                    
                    return (
                      <button
                        key={conv.id}
                        onClick={() => setSelectedConversation(conv.id)}
                        className={cn(
                          "w-full p-3 flex gap-3 hover:bg-muted/50 transition-colors border-b border-border/50",
                          isActive && "bg-muted"
                        )}
                      >
                        {/* Avatar / Product Image */}
                        <div className="relative flex-shrink-0">
                          {(conv.user_listings as any)?.images?.[0] ? (
                            <img 
                              src={(conv.user_listings as any).images[0]} 
                              alt="" 
                              className="w-12 h-12 rounded-full object-cover ring-2 ring-border"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-border">
                              <Package className="w-5 h-5 text-primary" />
                            </div>
                          )}
                          {conv.status === 'disputed' && (
                            <div className="absolute -bottom-1 -right-1 bg-destructive rounded-full p-0.5">
                              <AlertTriangle className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 text-right">
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                          <div className="flex items-center gap-1">
                            <p className="font-medium text-sm truncate">
                              {(conv.user_listings as any)?.title_ar || 'منتج'}
                            </p>
                            {(conv as any).conversation_code && (
                              <Badge variant="outline" className="text-[8px] px-1 py-0 font-mono">
                                {(conv as any).conversation_code}
                              </Badge>
                            )}
                          </div>
                            {lastMsg && (
                              <span className="text-[10px] text-muted-foreground flex-shrink-0">
                                {format(new Date(lastMsg.created_at), 'HH:mm')}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {convOtherUser?.full_name || convOtherUser?.username || 'مستخدم'}
                            {!isAdmin && (
                              <span className="text-primary mr-1">
                                • {conv.buyer_id === user?.id ? 'مشتري' : 'بائع'}
                              </span>
                            )}
                          </p>
                          {lastMsg && (
                            <p className="text-xs text-muted-foreground truncate mt-1 flex items-center gap-1">
                              {lastMsg.sender_id === user?.id && (
                                <CheckCheck className="w-3 h-3 text-primary flex-shrink-0" />
                              )}
                              {lastMsg.image_url ? '📷 صورة' : lastMsg.content}
                            </p>
                          )}
                        </div>

                        {/* Badges */}
                        {(conv.status === 'disputed' || conv.admin_joined) && (
                          <div className="flex flex-col gap-1">
                            {conv.admin_joined && (
                              <ShieldCheck className="w-4 h-4 text-primary" />
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Messages Area - Telegram/WhatsApp Style */}
          <div className={cn(
            "flex-1 flex flex-col min-h-0 bg-[hsl(var(--muted)/0.3)]",
            !selectedConversation ? 'hidden md:flex' : 'flex'
          )}
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          >
            {selectedConversation ? (
              <>
                {/* Chat Header with User Info */}
                <div className="border-b bg-card flex-shrink-0 shadow-sm">
                  {/* Main Header Row */}
                  <div className="p-2 sm:p-3 flex items-center gap-2 sm:gap-3">
                    {/* Back Button - Mobile only, goes back to conversations list */}
                    <button 
                      onClick={() => setSelectedConversation(null)} 
                      className="p-1.5 hover:bg-muted rounded-full md:hidden text-foreground"
                      aria-label="رجوع"
                    >
                      <ArrowRight className="w-5 h-5" />
                    </button>
                    
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      {otherUser?.avatar_url ? (
                        <img 
                          src={otherUser.avatar_url} 
                          alt="" 
                          className="w-10 h-10 rounded-full object-cover ring-2 ring-border"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-border">
                          <User className="w-5 h-5 text-primary" />
                        </div>
                      )}
                    </div>

                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">
                          {otherUser?.username || otherUser?.full_name || 'مستخدم'}
                        </p>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {selectedConv?.buyer_id === user?.id ? 'البائع' : 'المشتري'}
                        </Badge>
                      </div>
                      {/* Rating and Stats */}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        {otherUser?.seller_profile && (
                          <>
                            <span className="flex items-center gap-0.5">
                              <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                              {(otherUser.seller_profile.average_rating ?? 0).toFixed(1)}
                            </span>
                            <span className="flex items-center gap-0.5">
                              <ShoppingBag className="w-3 h-3" />
                              {otherUser.seller_profile.completed_orders ?? 0} طلب
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      {selectedConv?.status === 'disputed' && (
                        <Badge variant="destructive" className="text-xs">نزاع</Badge>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {(isBuyer || isSeller) && selectedConv?.status !== 'disputed' && (
                            <DropdownMenuItem 
                              className="text-destructive gap-2"
                              onClick={() => requestAdminMutation.mutate()}
                            >
                              <AlertTriangle className="w-4 h-4" />
                              طلب تدخل الإدارة
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  
                  {/* Product Info Bar */}
                  <div className="px-3 py-2 bg-muted/30 border-t flex items-center gap-2 text-xs">
                    {(selectedConv?.user_listings as any)?.images?.[0] && (
                      <img 
                        src={(selectedConv?.user_listings as any).images[0]} 
                        alt="" 
                        className="w-8 h-8 rounded object-cover"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-foreground font-medium">
                        {(selectedConv?.user_listings as any)?.title_ar}
                      </p>
                      <p className="text-primary font-bold">
                        {Number((selectedConv?.user_listings as any)?.price).toLocaleString()} دينار
                      </p>
                    </div>
                  </div>
                  
                  {/* Other User Listings */}
                  {otherUserListings && otherUserListings.length > 0 && (
                    <div className="px-3 py-2 bg-muted/20 border-t">
                      <p className="text-[10px] text-muted-foreground mb-1.5">
                        منتجات أخرى من {selectedConv?.buyer_id === user?.id ? 'البائع' : 'المستخدم'}
                      </p>
                      <ScrollArea className="w-full">
                        <div className="flex gap-2">
                          {otherUserListings.slice(0, 4).map((listing: any) => (
                            <div key={listing.id} className="flex-shrink-0 w-14">
                              <img 
                                src={listing.images?.[0] || '/placeholder.svg'} 
                                alt={listing.title_ar}
                                className="w-14 h-14 rounded-md object-cover"
                              />
                              <p className="text-[9px] text-muted-foreground truncate mt-0.5">
                                {Number(listing.price).toLocaleString()}
                              </p>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-2 sm:p-4">
                  {loadingMessages ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : messages?.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center bg-card/80 backdrop-blur-sm rounded-lg p-4 max-w-xs">
                        <MessageSquare className="w-10 h-10 mx-auto mb-2 text-muted-foreground/50" />
                        <p className="text-sm text-muted-foreground">ابدأ المحادثة</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {Object.entries(groupedMessages || {}).map(([date, msgs]: [string, any]) => (
                        <div key={date}>
                          {/* Date separator */}
                          <div className="flex justify-center my-4">
                            <span className="bg-card/80 backdrop-blur-sm text-muted-foreground text-xs px-3 py-1 rounded-full shadow-sm">
                              {date}
                            </span>
                          </div>
                          
                          {/* Messages */}
                          <div className="space-y-1">
                            {msgs.map((msg: any, idx: number) => {
                              const isMe = msg.sender_id === user?.id;
                              const sender = profiles?.[msg.sender_id];
                              const showTail = idx === 0 || msgs[idx - 1]?.sender_id !== msg.sender_id;
                              
                              return (
                                <div 
                                  key={msg.id} 
                                  className={cn(
                                    "flex",
                                    isMe ? "justify-start" : "justify-end"
                                  )}
                                >
                                  <div 
                                    className={cn(
                                      "max-w-[85%] sm:max-w-[70%] rounded-2xl px-3 py-2 shadow-sm relative",
                                      isMe 
                                        ? "bg-primary text-primary-foreground rounded-tl-sm" 
                                        : "bg-card rounded-tr-sm",
                                      showTail && (isMe ? "rounded-tl-2xl" : "rounded-tr-2xl")
                                    )}
                                  >
                                    {/* Sender name for group chats / admin */}
                                    {!isMe && isAdmin && showTail && (
                                      <p className="text-xs font-medium text-primary mb-1">
                                        {sender?.full_name || sender?.username}
                                      </p>
                                    )}
                                    
                                    {/* Image */}
                                    {msg.image_url && (
                                      <div className="mb-1">
                                        <img 
                                          src={msg.image_url} 
                                          alt="" 
                                          className="rounded-lg max-w-full max-h-64 cursor-pointer hover:opacity-90 transition-opacity"
                                          onClick={() => window.open(msg.image_url, '_blank')}
                                        />
                                      </div>
                                    )}
                                    
                                    {/* Text */}
                                    {msg.content && msg.content !== '📷 وسائط' && msg.content !== '📷 صورة' && (
                                      <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                                        {msg.content}
                                      </p>
                                    )}
                                    
                                    {/* Time & Status */}
                                    <div className={cn(
                                      "flex items-center gap-1 mt-1",
                                      isMe ? "justify-start" : "justify-end"
                                    )}>
                                      <span className={cn(
                                        "text-[10px]",
                                        isMe ? "text-primary-foreground/70" : "text-muted-foreground"
                                      )}>
                                        {format(new Date(msg.created_at), 'HH:mm')}
                                      </span>
                                      {isMe && (
                                        <CheckCheck className={cn(
                                          "w-3.5 h-3.5",
                                          msg.is_read ? "text-emerald-400" : "text-primary-foreground/50"
                                        )} />
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </div>

                {/* Input Area - WhatsApp Style */}
                <form onSubmit={handleSend} className="p-2 border-t bg-card flex items-end gap-2 flex-shrink-0">
                  {/* Attachment */}
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    accept="image/*,video/*" 
                    onChange={handleMediaUpload} 
                    className="hidden" 
                  />
                  
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    className="h-10 w-10 rounded-full flex-shrink-0"
                    onClick={() => fileInputRef.current?.click()} 
                    disabled={uploadingMedia}
                  >
                    {uploadingMedia ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Paperclip className="w-5 h-5 text-muted-foreground" />
                    )}
                  </Button>

                  {/* Input */}
                  <div className="flex-1 relative">
                    <Input 
                      ref={inputRef}
                      value={messageInput} 
                      onChange={(e) => setMessageInput(e.target.value)} 
                      placeholder="اكتب رسالة..." 
                      className="rounded-full pl-10 pr-4 py-5 bg-muted/50 border-0 focus-visible:ring-1"
                    />
                  </div>

                  {/* Send */}
                  <Button 
                    type="submit" 
                    size="icon" 
                    className="h-10 w-10 rounded-full flex-shrink-0"
                    disabled={sendMessageMutation.isPending || !messageInput.trim()}
                  >
                    {sendMessageMutation.isPending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </Button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-card flex items-center justify-center">
                    <MessageSquare className="w-12 h-12 text-muted-foreground/30" />
                  </div>
                  <h3 className="text-lg font-medium text-muted-foreground mb-1">المحادثات</h3>
                  <p className="text-sm text-muted-foreground/70">اختر محادثة للبدء</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ListingConversations;
