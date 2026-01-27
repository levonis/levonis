import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  MessageSquare,
  ArrowRight,
  AlertTriangle,
  ShieldCheck,
  Loader2,
  Package,
  X,
  Check,
  CheckCheck,
  Star,
  ShoppingBag,
  ExternalLink,
  Ban,
  UserX,
  MoreVertical,
  Paperclip,
  Send,
  AlertOctagon,
  Hash,
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useUserPrintReputation } from '@/hooks/useUserPrintReputation';
import AvatarWithFrame from '@/components/merchant/AvatarWithFrame';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
// Chat Commerce Components - Taobao Style
import ChatTopBar from '@/components/chat/ChatTopBar';
import ChatInputBar from '@/components/chat/ChatInputBar';
import SystemMessage from '@/components/chat/messages/SystemMessage';
import TextMessage from '@/components/chat/messages/TextMessage';
import ProductCard from '@/components/chat/messages/ProductCard';
import OrderCard from '@/components/chat/messages/OrderCard';
import ConfirmationCard from '@/components/chat/messages/ConfirmationCard';
import ProductSelector from '@/components/chat/ProductSelector';
import PriceChangeDialog from '@/components/chat/PriceChangeDialog';
import CreateOrderDialog from '@/components/chat/CreateOrderDialog';
import { useChatCommerce, type ChatOrder } from '@/hooks/useChatCommerce';
import { parseEmojisInText } from '@/components/chat/emojiData';

interface ListingConversationsProps {
  children?: React.ReactNode;
  listingId?: string;
  onClose?: () => void;
  isAdmin?: boolean;
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
  autoOpenConversationId?: string | null;
}

const formatMessageDate = (date: Date) => {
  if (isToday(date)) return 'اليوم';
  if (isYesterday(date)) return 'أمس';
  return format(date, 'dd MMM yyyy', { locale: ar });
};

export const ListingConversations = ({ children, listingId, onClose, isAdmin: propIsAdmin, externalOpen, onExternalOpenChange, autoOpenConversationId }: ListingConversationsProps) => {
  const { user, isAdmin: authIsAdmin } = useAuth();
  const isAdmin = propIsAdmin || authIsAdmin;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = (value: boolean) => {
    if (onExternalOpenChange) {
      onExternalOpenChange(value);
    } else {
      setInternalOpen(value);
    }
  };
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [productSelectorOpen, setProductSelectorOpen] = useState(false);
  const [priceChangeDialogOpen, setPriceChangeDialogOpen] = useState(false);
  const [createOrderDialogOpen, setCreateOrderDialogOpen] = useState(false);
  const [selectedOrderForPriceChange, setSelectedOrderForPriceChange] = useState<ChatOrder | null>(null);
  const [selectedProductForOrder, setSelectedProductForOrder] = useState<{
    id: string;
    title: string;
    image?: string;
    price: number;
  } | null>(null);
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
      
      // NOTE: سوق المستعمل تم إزالته. نُبقي المحادثات فقط بدون ربطها بجدول الإعلانات.
      let query = supabase
        .from('listing_conversations')
        .select('id, buyer_id, seller_id, listing_id, status, conversation_code, admin_joined, created_at, updated_at')
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

  // Auto open conversation if autoOpenConversationId is provided
  useEffect(() => {
    if (autoOpenConversationId && conversations?.length) {
      const conv = conversations.find(c => c.id === autoOpenConversationId);
      if (conv) {
        setSelectedConversation(autoOpenConversationId);
      }
    }
  }, [autoOpenConversationId, conversations]);

  // Fetch profiles (بدون seller_profiles لأن سوق المستعمل تم حذفه)
  const { data: profiles } = useQuery({
    queryKey: ['conversation-profiles-full', conversations?.map(c => [c.buyer_id, c.seller_id]).flat()],
    queryFn: async () => {
      if (!conversations?.length) return {};
      const userIds = [...new Set(conversations.flatMap(c => [c.buyer_id, c.seller_id]))];
      
      // First get profiles
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url, phone_number')
        .in('id', userIds);
      
      // Then check if any are merchants and get their frames
      const { data: merchantProfiles } = await supabase
        .from('merchant_public_profiles')
        .select('id, display_name, store_image_url, selected_frame_id')
        .in('id', userIds);
      
      // Get all frame IDs from merchants
      const frameIds = merchantProfiles?.map(m => m.selected_frame_id).filter(Boolean) as string[] || [];
      
      // Fetch frames
      let framesMap: Record<string, string> = {};
      if (frameIds.length > 0) {
        const { data: framesData } = await supabase
          .from('avatar_frames')
          .select('id, image_url')
          .in('id', frameIds);
        framesData?.forEach(f => {
          framesMap[f.id] = f.image_url;
        });
      }
      
      const result: Record<string, any> = {};
      
      // Add profiles with frame URLs
      profilesData?.forEach(p => {
        const merchantData = merchantProfiles?.find(m => m.id === p.id);
        const frameId = merchantData?.selected_frame_id;
        result[p.id] = { 
          ...p,
          // Use merchant store image if available, otherwise profile avatar
          avatar_url: merchantData?.store_image_url || p.avatar_url,
          display_name: merchantData?.display_name,
          selected_frame_url: frameId ? framesMap[frameId] : null 
        };
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
      const convIds = conversations?.map(c => c.id) ?? [];
      if (!convIds.length) return {};

      const limit = Math.min(1000, Math.max(25, convIds.length * 5));

      const { data, error } = await supabase
        .from('listing_messages')
        .select('conversation_id, content, created_at, sender_id, image_url, is_read')
        .in('conversation_id', convIds)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      const results: Record<string, any> = {};
      for (const msg of data || []) {
        if (!results[msg.conversation_id]) results[msg.conversation_id] = msg;
      }
      return results;
    },
    enabled: !!conversations?.length,
    refetchInterval: open ? 3000 : false,
  });

  useEffect(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, [messages, selectedConversation]);

  // Mark messages as read when conversation selected (don't auto-focus to prevent keyboard popup)
  useEffect(() => {
    if (selectedConversation && user) {
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
        const listingTitle = selectedConv.conversation_code ? `محادثة #${selectedConv.conversation_code}` : 'محادثة';

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
      if (!selectedConversation || !user) return;
      const { error } = await supabase
        .from('listing_conversations')
        .update({ status: 'disputed' })
        .eq('id', selectedConversation);
      if (error) throw error;

      // Get conversation details for notification
      const { data: conv } = await supabase
        .from('listing_conversations')
        .select('conversation_code')
        .eq('id', selectedConversation)
        .single();

      // Get user info
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('full_name, username')
        .eq('id', user.id)
        .single();

      const userName = userProfile?.full_name || userProfile?.username || 'مستخدم';
      const listingTitle = conv?.conversation_code ? `محادثة #${conv.conversation_code}` : 'محادثة';

      // Insert system message in conversation
      await supabase.from('listing_messages').insert({
        conversation_id: selectedConversation,
        sender_id: user.id,
        content: `⚠️ تم طلب تدخل الإدارة من قبل ${userName}`,
      });

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

        // Send Telegram notification to admins
        for (const admin of admins) {
          await supabase.functions.invoke('send-telegram-notification', {
            body: {
              user_id: admin.user_id,
              title: '⚠️ طلب تدخل في نزاع',
              message: `طلب ${userName} تدخل الإدارة في محادثة بخصوص "${listingTitle}"\n\n📋 رمز المحادثة: ${conv?.conversation_code || 'غير معروف'}`,
            },
          });
        }
      }
    },
    onSuccess: () => {
      toast.success('تم طلب تدخل الإدارة - سيتم إعلام الإدارة');
      queryClient.invalidateQueries({ queryKey: ['listing-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['listing-messages', selectedConversation] });
    },
  });

  const cancelDisputeMutation = useMutation({
    mutationFn: async () => {
      if (!selectedConversation || !user) return;
      const { error } = await supabase
        .from('listing_conversations')
        .update({ status: 'open' })
        .eq('id', selectedConversation);
      if (error) throw error;

      // Get user info
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('full_name, username')
        .eq('id', user.id)
        .single();

      const userName = userProfile?.full_name || userProfile?.username || 'مستخدم';

      // Insert system message in conversation
      await supabase.from('listing_messages').insert({
        conversation_id: selectedConversation,
        sender_id: user.id,
        content: `✅ تم إلغاء طلب تدخل الإدارة من قبل ${userName}`,
      });
    },
    onSuccess: () => {
      toast.success('تم إلغاء طلب تدخل الإدارة');
      queryClient.invalidateQueries({ queryKey: ['listing-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['listing-messages', selectedConversation] });
    },
  });

  const selectedConv = conversations?.find(c => c.id === selectedConversation);
  const isBuyer = selectedConv?.buyer_id === user?.id;
  const isSeller = selectedConv?.seller_id === user?.id;
  const otherUserId = selectedConv ? (selectedConv.buyer_id === user?.id ? selectedConv.seller_id : selectedConv.buyer_id) : null;
  const otherUser = otherUserId ? profiles?.[otherUserId] : null;

  const { data: otherUserReputation } = useUserPrintReputation(otherUserId ?? undefined);

  // Check if current user is a merchant (can send products)
  // IMPORTANT: merchant_products.merchant_id references merchant_applications.id (which equals merchant_public_profiles.id)
  // The link is: user.id -> merchant_applications.user_id -> merchant_applications.id -> merchant_products.merchant_id
  const { data: currentUserMerchant } = useQuery({
    queryKey: ['current-user-merchant-profile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      // Get the merchant application ID for this user (this ID is used as merchant_id in products)
      const { data: application } = await supabase
        .from('merchant_applications')
        .select('id, user_id, status')
        .eq('user_id', user.id)
        .eq('status', 'approved')
        .maybeSingle();
      
      if (application) {
        // application.id is the same as merchant_public_profiles.id and merchant_products.merchant_id
        return { id: application.id, isMerchant: true };
      }
      
      return null;
    },
    enabled: !!user,
  });
  
  // User can send products if they are the seller OR if they are a registered merchant
  // Always show for seller in this conversation, or any registered merchant
  const canSendProducts = isSeller || !!currentUserMerchant;

  // Chat Commerce Hook
  const chatCommerce = useChatCommerce({
    conversationId: selectedConversation,
    sellerId: selectedConv?.seller_id,
    buyerId: selectedConv?.buyer_id,
  });
  // Check if user is blocked
  const { data: isUserBlocked } = useQuery({
    queryKey: ['user-blocked', user?.id, otherUserId],
    queryFn: async () => {
      if (!user || !otherUserId) return false;
      const { data } = await supabase
        .from('user_blocks')
        .select('id')
        .eq('blocker_id', user.id)
        .eq('blocked_id', otherUserId)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user && !!otherUserId,
  });

  // Block user mutation
  const blockUserMutation = useMutation({
    mutationFn: async (reason?: string) => {
      if (!user || !otherUserId) throw new Error('لا يمكن الحظر');
      
      const { error } = await supabase
        .from('user_blocks')
        .insert({
          blocker_id: user.id,
          blocked_id: otherUserId,
          reason: reason || 'حظر من المحادثة',
        });
      
      if (error) {
        if (error.code === '23505') {
          throw new Error('هذا المستخدم محظور بالفعل');
        }
        throw error;
      }
    },
    onSuccess: () => {
      toast.success('تم حظر المستخدم بنجاح');
      queryClient.invalidateQueries({ queryKey: ['user-blocks'] });
      queryClient.invalidateQueries({ queryKey: ['user-blocked', user?.id, otherUserId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Unblock user mutation
  const unblockUserMutation = useMutation({
    mutationFn: async () => {
      if (!user || !otherUserId) throw new Error('لا يمكن إلغاء الحظر');
      
      const { error } = await supabase
        .from('user_blocks')
        .delete()
        .eq('blocker_id', user.id)
        .eq('blocked_id', otherUserId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم إلغاء حظر المستخدم');
      queryClient.invalidateQueries({ queryKey: ['user-blocks'] });
      queryClient.invalidateQueries({ queryKey: ['user-blocked', user?.id, otherUserId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Admin: Ban user mutation
  const banUserMutation = useMutation({
    mutationFn: async ({ userId, reason, isBan }: { userId: string; reason: string; isBan: boolean }) => {
      if (!user || !isAdmin) throw new Error('غير مصرح');
      
      // Update profile ban status
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          is_banned: isBan,
          ban_reason: isBan ? reason : null,
        })
        .eq('id', userId);
      
      if (profileError) throw profileError;

      // Add warning record
      const { error: warningError } = await supabase
        .from('user_warnings')
        .insert({
          user_id: userId,
          admin_id: user.id,
          reason: reason,
          warning_type: isBan ? 'ban' : 'warning',
        });
      
      if (warningError) throw warningError;

      // Update warnings count
      if (!isBan) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('warnings_count')
          .eq('id', userId)
          .single();
        
        await supabase
          .from('profiles')
          .update({ warnings_count: (profile?.warnings_count || 0) + 1 })
          .eq('id', userId);
      }

      // Notify user
      await supabase.from('notifications').insert({
        user_id: userId,
        title: isBan ? '🚫 تم حظر حسابك' : '⚠️ تحذير من الإدارة',
        message: isBan 
          ? `تم حظر حسابك من المنصة بسبب: ${reason}`
          : `تلقيت تحذيراً من الإدارة بسبب: ${reason}`,
        type: 'warning',
      });

      // Add system message
      if (selectedConversation) {
        await supabase.from('listing_messages').insert({
          conversation_id: selectedConversation,
          sender_id: user.id,
          content: isBan 
            ? `🚫 تم حظر المستخدم من المنصة بواسطة الإدارة\nالسبب: ${reason}`
            : `⚠️ تم إرسال تحذير للمستخدم بواسطة الإدارة\nالسبب: ${reason}`,
        });
      }
    },
    onSuccess: (_, { isBan }) => {
      toast.success(isBan ? 'تم حظر المستخدم بنجاح' : 'تم إرسال التحذير بنجاح');
      queryClient.invalidateQueries({ queryKey: ['listing-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['listing-messages', selectedConversation] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    setUploadingMedia(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `chat/listing/${user.id}/${Date.now()}.${fileExt}`;
      // سوق المستعمل تم حذفه، لذلك نستخدم نفس حاوية الملفات العامة للتطبيق
      const { error } = await supabase.storage.from('product-images').upload(fileName, file);
      if (error) throw error;
      
      const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(fileName);
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

  // NOTE: تم حذف منتجات السوق، لذلك لا نجلب "منتجات أخرى" هنا.

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
      <DialogContent hideClose className="max-w-6xl h-[100dvh] sm:h-[90vh] w-full sm:w-[95vw] lg:w-[80vw] xl:w-[70vw] p-0 flex flex-col overflow-hidden border-0">
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

        <div className="flex flex-1 min-h-0 h-full">
          {/* Conversations List - WhatsApp Style */}
          <div className={cn(
            "flex flex-col w-full md:w-80 lg:w-[320px] xl:w-[360px] md:border-l bg-card h-full min-h-0 flex-shrink-0",
            selectedConversation ? 'hidden md:flex' : 'flex'
          )}>
            {/* Header */}
            <div className="p-3 border-b bg-muted/30 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                <h2 className="font-bold text-sm">المحادثات</h2>
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
                  {/* Sort conversations by last message time */}
                  {[...(conversations || [])].sort((a, b) => {
                    const lastMsgA = lastMessages?.[a.id];
                    const lastMsgB = lastMessages?.[b.id];
                    const timeA = lastMsgA ? new Date(lastMsgA.created_at).getTime() : new Date(a.updated_at).getTime();
                    const timeB = lastMsgB ? new Date(lastMsgB.created_at).getTime() : new Date(b.updated_at).getTime();
                    return timeB - timeA;
                  }).map(conv => {
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
                        {/* Avatar with Frame */}
                        <div className="relative flex-shrink-0">
                          <AvatarWithFrame
                            imageUrl={convOtherUser?.avatar_url}
                            frameUrl={(convOtherUser as any)?.selected_frame_url}
                            size="sm"
                          />
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
                              {convOtherUser?.full_name || convOtherUser?.username || 'محادثة'}
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
                                <CheckCheck
                                  className={cn(
                                    "w-3 h-3 flex-shrink-0",
                                    lastMsg.is_read ? "text-whatsapp" : "text-muted-foreground"
                                  )}
                                />
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

          {/* Messages Area - Fixed for large screens */}
          <div className={cn(
            "flex-1 flex flex-col min-h-0 bg-background h-full overflow-hidden min-w-0",
            !selectedConversation && 'hidden md:flex'
          )}
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          >
            {selectedConversation ? (
              <>
                {/* Chat Top Bar - Taobao Style */}
                <ChatTopBar
                  storeName={otherUser?.display_name || otherUser?.full_name || otherUser?.username || 'المتجر'}
                  storeId={otherUserId || ''}
                  storeImage={otherUser?.avatar_url}
                  storeFrameUrl={(otherUser as any)?.selected_frame_url}
                  rating={Number(otherUserReputation?.avg_stars ?? 0)}
                  status={selectedConv?.status as 'open' | 'disputed' | 'resolved' | undefined}
                  onBack={() => setSelectedConversation(null)}
                  onContactAdmin={() => requestAdminMutation.mutate()}
                />

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6">
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
                              const timestamp = format(new Date(msg.created_at), 'HH:mm');
                              
                              // Check if it's a system message (starts with emoji or 🔔)
                              const isSystemMessage = msg.content?.startsWith('⚠️') || 
                                                     msg.content?.startsWith('✅') ||
                                                     msg.content?.startsWith('🛡️') ||
                                                     msg.content?.startsWith('🚫') ||
                                                     msg.content?.startsWith('🔔');
                              
                              // Check if it's a product message (starts with 📦)
                              const isProductMessage = msg.content?.startsWith('📦');
                              
                              // Check if it's a JSON message (order_card or confirmation_card)
                              let parsedContent: any = null;
                              try {
                                if (msg.content?.startsWith('{')) {
                                  parsedContent = JSON.parse(msg.content);
                                }
                              } catch {}
                              
                              // Render system message
                              if (isSystemMessage) {
                                return (
                                  <SystemMessage
                                    key={msg.id}
                                    content={msg.content.replace('🔔 ', '')}
                                    timestamp={timestamp}
                                  />
                                );
                              }
                              
                              // Render Order Card
                              if (parsedContent?.type === 'order_card') {
                                const order = chatCommerce.orders.find(o => o.id === parsedContent.order_id);
                                if (order) {
                                  return (
                                    <OrderCard
                                      key={msg.id}
                                      orderId={order.id}
                                      productId={order.product_id}
                                      productTitle={order.product_title}
                                      productImage={order.product_image}
                                      quantity={order.quantity}
                                      unitPrice={order.unit_price}
                                      totalPrice={order.total_price}
                                      notes={order.notes}
                                      status={order.status}
                                      isMe={isMe}
                                      timestamp={timestamp}
                                      userRole={chatCommerce.userRole}
                                      onPayNow={() => {
                                        toast.info('سيتم توجيهك لصفحة الدفع');
                                        // TODO: Integrate payment
                                      }}
                                      onTrack={() => toast.info('تتبع الشحن قريبًا')}
                                      onConfirmReceipt={() => {
                                        chatCommerce.updateOrderStatus({
                                          orderId: order.id,
                                          status: 'completed',
                                        });
                                      }}
                                      onCancel={() => {
                                        chatCommerce.updateOrderStatus({
                                          orderId: order.id,
                                          status: 'canceled',
                                        });
                                      }}
                                      onProposeChange={() => {
                                        setSelectedOrderForPriceChange(order);
                                        setPriceChangeDialogOpen(true);
                                      }}
                                      onViewDetails={() => toast.info('تفاصيل الطلب')}
                                      onAddNotes={() => toast.info('إضافة ملاحظة')}
                                    />
                                  );
                                }
                              }
                              
                              // Render Confirmation Card
                              if (parsedContent?.type === 'confirmation_card') {
                                const modification = chatCommerce.pendingModifications.find(
                                  m => m.id === parsedContent.modification_id
                                );
                                return (
                                  <ConfirmationCard
                                    key={msg.id}
                                    modificationId={parsedContent.modification_id}
                                    orderId={parsedContent.order_id}
                                    changeType={parsedContent.change_type}
                                    oldValue={parsedContent.old_value}
                                    newValue={parsedContent.new_value}
                                    sellerNote={parsedContent.seller_note}
                                    isMe={isMe}
                                    timestamp={timestamp}
                                    isPending={modification?.status === 'pending'}
                                    userRole={chatCommerce.userRole}
                                    onApprove={() => {
                                      chatCommerce.approveModification({
                                        modificationId: parsedContent.modification_id,
                                      });
                                    }}
                                    onReject={() => {
                                      chatCommerce.rejectModification({
                                        modificationId: parsedContent.modification_id,
                                      });
                                    }}
                                  />
                                );
                              }
                              
                              // Render product message as a rich ProductCard
                              if (isProductMessage) {
                                const lines = msg.content?.split('\n') || [];
                                const productName = lines[0]?.replace('📦 ', '') || '';
                                const priceMatch = lines[1]?.match(/(\d[\d,]*)/);
                                const price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, '')) : 0;
                                
                                return (
                                  <ProductCard
                                    key={msg.id}
                                    productId={msg.id}
                                    storeId={otherUserId || ''}
                                    imageUrl={msg.image_url}
                                    title={productName}
                                    price={price}
                                    isMe={isMe}
                                    timestamp={timestamp}
                                    userRole={chatCommerce.userRole}
                                    onCreateOrder={() => {
                                      setSelectedProductForOrder({
                                        id: msg.id,
                                        title: productName,
                                        image: msg.image_url,
                                        price: price,
                                      });
                                      setCreateOrderDialogOpen(true);
                                    }}
                                  />
                                );
                              }
                              
                              // Regular text message
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
                                    
                                    {/* Text with inline emojis */}
                                    {msg.content && msg.content !== '📷 وسائط' && msg.content !== '📷 صورة' && !msg.content.startsWith('{') && (
                                      <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                                        {parseEmojisInText(msg.content).map((item, idx) => 
                                          typeof item === 'string' 
                                            ? <span key={idx}>{item}</span>
                                            : <img key={idx} src={item.src} alt={item.alt} className="inline-block w-5 h-5 align-text-bottom mx-0.5" loading="lazy" />
                                        )}
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
                                        {timestamp}
                                      </span>
                                      {isMe && (
                                        <CheckCheck
                                          className={cn(
                                            "w-3.5 h-3.5",
                                            msg.is_read ? "text-whatsapp" : "text-primary-foreground/50"
                                          )}
                                        />
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

                {/* Input Area - Taobao Style */}
                <ChatInputBar
                  value={messageInput}
                  onChange={setMessageInput}
                  onSend={() => {
                    if (messageInput.trim()) sendMessageMutation.mutate(undefined);
                  }}
                  onSendMedia={async (file: File) => {
                    setUploadingMedia(true);
                    try {
                      const fileExt = file.name.split('.').pop();
                      const fileName = `chat/listing/${user?.id}/${Date.now()}.${fileExt}`;
                      const { error } = await supabase.storage.from('product-images').upload(fileName, file);
                      if (error) throw error;
                      const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(fileName);
                      await sendMessageMutation.mutateAsync(publicUrl);
                    } catch (error) {
                      toast.error('فشل رفع الملف');
                    } finally {
                      setUploadingMedia(false);
                    }
                  }}
                  onOpenProducts={() => setProductSelectorOpen(true)}
                  isLoading={sendMessageMutation.isPending}
                  isUploadingMedia={uploadingMedia}
                  isSeller={canSendProducts}
                />
                
                {/* Product Selector Dialog */}
                <ProductSelector
                  open={productSelectorOpen}
                  onOpenChange={setProductSelectorOpen}
                  merchantId={currentUserMerchant?.id || ''}
                  onSelectProduct={async (product) => {
                    // Send product as a message
                    const primaryIndex = product.primary_image_index || 0;
                    const imageUrl = product.image_urls?.[primaryIndex] || product.image_urls?.[0];
                    const productMessage = `📦 ${product.title}\n💰 ${product.price_iqd?.toLocaleString() || 0} د.ع`;
                    const { error } = await supabase.from('listing_messages').insert({
                      conversation_id: selectedConversation,
                      sender_id: user?.id,
                      content: productMessage,
                      image_url: imageUrl,
                    });
                    if (!error) {
                      queryClient.invalidateQueries({ queryKey: ['listing-messages', selectedConversation] });
                      setProductSelectorOpen(false);
                      toast.success('تم إرسال المنتج');
                    }
                  }}
                />
                
                {/* Price Change Dialog - Seller Only */}
                {selectedOrderForPriceChange && (
                  <PriceChangeDialog
                    open={priceChangeDialogOpen}
                    onOpenChange={(open) => {
                      setPriceChangeDialogOpen(open);
                      if (!open) setSelectedOrderForPriceChange(null);
                    }}
                    currentPrice={selectedOrderForPriceChange.total_price}
                    onSubmit={(newPrice, reason) => {
                      chatCommerce.proposePriceChange({
                        orderId: selectedOrderForPriceChange.id,
                        newPrice,
                        reason,
                      });
                      setPriceChangeDialogOpen(false);
                      setSelectedOrderForPriceChange(null);
                    }}
                    isLoading={chatCommerce.isProposingPrice}
                  />
                )}
                
                {/* Create Order Dialog - Customer Only */}
                {selectedProductForOrder && (
                  <CreateOrderDialog
                    open={createOrderDialogOpen}
                    onOpenChange={(open) => {
                      setCreateOrderDialogOpen(open);
                      if (!open) setSelectedProductForOrder(null);
                    }}
                    productId={selectedProductForOrder.id}
                    productTitle={selectedProductForOrder.title}
                    productImage={selectedProductForOrder.image}
                    productPrice={selectedProductForOrder.price}
                    onSubmit={(quantity) => {
                      chatCommerce.createOrder({
                        productId: selectedProductForOrder.id,
                        productTitle: selectedProductForOrder.title,
                        productImage: selectedProductForOrder.image,
                        price: selectedProductForOrder.price,
                        quantity,
                      });
                      setCreateOrderDialogOpen(false);
                      setSelectedProductForOrder(null);
                    }}
                    isLoading={chatCommerce.isCreatingOrder}
                  />
                )}
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
