import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  Headphones,
  Search,
  ShoppingCart,
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
import ChatSupportTopBar from '@/components/chat/ChatSupportTopBar';
import AdminChatTopBar from '@/components/chat/AdminChatTopBar';
import ChatInputBar from '@/components/chat/ChatInputBar';
import SystemMessage from '@/components/chat/messages/SystemMessage';
import TextMessage from '@/components/chat/messages/TextMessage';
import ProductCard from '@/components/chat/messages/ProductCard';
import OrderCard from '@/components/chat/messages/OrderCard';
import ConfirmationCard from '@/components/chat/messages/ConfirmationCard';
import OrderTrackingCard from '@/components/chat/messages/OrderTrackingCard';
import LocationMessage from '@/components/chat/messages/LocationMessage';
import AddressMessage from '@/components/chat/messages/AddressMessage';
import ProductSelector from '@/components/chat/ProductSelector';
import PriceChangeDialog from '@/components/chat/PriceChangeDialog';
import CreateOrderDialog from '@/components/chat/CreateOrderDialog';
import AddToCartSheet from '@/components/community/AddToCartSheet';
import MerchantOrderDialog from '@/components/chat/MerchantOrderDialog';
import { useChatCommerce, type ChatOrder } from '@/hooks/useChatCommerce';
import { parseEmojisInText } from '@/components/chat/emojiData';
import ImageLightbox from '@/components/chat/ImageLightbox';
import LinkRenderer from '@/components/chat/LinkRenderer';
import SwipeableMessage from '@/components/chat/messages/SwipeableMessage';
import ReplyBubble from '@/components/chat/messages/ReplyBubble';
import { type ReplyToMessage } from '@/components/chat/messages/ReplyPreviewBar';

// Support account ID
const SUPPORT_USER_ID = "f632ba7b-60e7-4f2f-9cb7-2851f7f2ed2f";
// Maintenance support account ID (virtual)
const MAINTENANCE_SUPPORT_ID = "00000000-0000-0000-0000-000000000001";

interface EntryContextData {
  type: 'product' | 'request';
  title: string;
  imageUrl?: string | null;
  price?: number | null;
  requestId?: string | null;
  productId?: string | null;
}

interface ListingConversationsProps {
  children?: React.ReactNode;
  listingId?: string;
  onClose?: () => void;
  isAdmin?: boolean;
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
  autoOpenConversationId?: string | null;
  entryContext?: EntryContextData | null;
  /** When true, renders content directly without Dialog wrapper (for embedding in other dialogs) */
  embedded?: boolean;
}

// Admin: Search all registered users to start new conversations
function AdminUserSearchResults({ 
  searchTerm, 
  existingConversations, 
  onSelectUser 
}: { 
  searchTerm: string; 
  existingConversations: any[] | undefined;
  onSelectUser: (userId: string) => void;
}) {
  const { data: searchResults, isLoading } = useQuery({
    queryKey: ['admin-user-search', searchTerm],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 2) return [];
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url')
        .or(`full_name.ilike.%${searchTerm}%,username.ilike.%${searchTerm}%`)
        .neq('id', SUPPORT_USER_ID)
        .limit(8);
      return data || [];
    },
    enabled: searchTerm.length >= 2,
  });

  if (!searchTerm || searchTerm.length < 2 || !searchResults?.length) return null;

  // Filter out users who already have conversations (they'll show in existing list)
  const existingUserIds = new Set(
    existingConversations?.flatMap(c => [c.buyer_id, c.seller_id]) || []
  );

  const newUsers = searchResults.filter(u => !existingUserIds.has(u.id));
  if (!newUsers.length) return null;

  return (
    <div className="border border-border/50 rounded-lg overflow-hidden bg-card">
      <div className="px-2 py-1 bg-muted/30 text-[10px] font-medium text-muted-foreground">
        بدء محادثة جديدة
      </div>
      {newUsers.map(u => (
        <button
          key={u.id}
          onClick={() => onSelectUser(u.id)}
          className="w-full flex items-center gap-2 p-2 hover:bg-muted/50 transition-colors text-right"
        >
          <AvatarWithFrame imageUrl={u.avatar_url} frameUrl={null} size="xs" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{u.full_name || u.username || 'مستخدم'}</p>
            {u.username && <p className="text-[10px] text-muted-foreground">@{u.username}</p>}
          </div>
          <MessageSquare className="h-3.5 w-3.5 text-primary" />
        </button>
      ))}
    </div>
  );
}

const formatMessageDate = (date: Date) => {
  if (isToday(date)) return 'اليوم';
  if (isYesterday(date)) return 'أمس';
  return format(date, 'dd MMM yyyy', { locale: ar });
};

export const ListingConversations = ({ children, listingId, onClose, isAdmin: propIsAdmin, externalOpen, onExternalOpenChange, autoOpenConversationId, entryContext: propsEntryContext, embedded = false }: ListingConversationsProps) => {
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
  const [merchantOrderDialogOpen, setMerchantOrderDialogOpen] = useState(false);
  const [selectedOrderForPriceChange, setSelectedOrderForPriceChange] = useState<ChatOrder | null>(null);
  const [selectedProductForOrder, setSelectedProductForOrder] = useState<{
    id: string;
    title: string;
    image?: string;
    price: number;
  } | null>(null);
  const [merchantOrderInitialData, setMerchantOrderInitialData] = useState<{
    title?: string;
    price?: number;
    image?: string;
  } | null>(null);
   const [cartSheetProduct, setCartSheetProduct] = useState<any>(null);
   const [cartSheetOpen, setCartSheetOpen] = useState(false);
   const messagesEndRef = useRef<HTMLDivElement>(null);
   const fileInputRef = useRef<HTMLInputElement>(null);
   const inputRef = useRef<HTMLInputElement>(null);
   
   // Admin search state
   const [adminSearchTerm, setAdminSearchTerm] = useState('');
   
   // Admin cart edit state
   const [adminCartEditOpen, setAdminCartEditOpen] = useState(false);
   const [adminCartRequest, setAdminCartRequest] = useState<any>(null);
   
   // Reply-to state
   const [replyTo, setReplyTo] = useState<ReplyToMessage | null>(null);
   
   // Entry context state - shows product/request bar above input
   const [entryContext, setEntryContext] = useState<EntryContextData | null>(propsEntryContext || null);
  
  // Sync entry context from props
  useEffect(() => {
    if (propsEntryContext) {
      setEntryContext(propsEntryContext);
    }
  }, [propsEntryContext]);

  // Clear reply when conversation changes
  useEffect(() => {
    setReplyTo(null);
  }, [selectedConversation]);

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
        .select('id, buyer_id, seller_id, listing_id, status, conversation_code, admin_joined, created_at, updated_at, entry_context')
        .order('updated_at', { ascending: false });
      
      if (listingId) {
        query = query.eq('listing_id', listingId);
      } else if (isAdmin) {
        // Admin sees all support conversations (where SUPPORT_USER_ID is participant)
        query = query.or(`buyer_id.eq.${SUPPORT_USER_ID},seller_id.eq.${SUPPORT_USER_ID}`);
      } else {
        query = query.or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user && open,
  });

  // Check if user has active warranty/insurance (to show maintenance support contact)
  const { data: hasActiveWarranty } = useQuery({
    queryKey: ['user-active-warranty', user?.id],
    queryFn: async () => {
      if (!user || isAdmin) return false;
      // Check for active printer subscriptions or active warranty (store_printers with active status)
      const [{ data: subs }, { data: printers }] = await Promise.all([
        supabase
          .from('printer_subscriptions')
          .select('id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .limit(1),
        supabase
          .from('user_printers')
          .select('id, store_printers!inner(status, expiry_date)')
          .eq('user_id', user.id)
          .limit(1),
      ]);
      const hasActiveSub = (subs?.length || 0) > 0;
      const hasActivePrinter = printers?.some((p: any) => 
        p.store_printers?.status === 'active' && 
        (!p.store_printers?.expiry_date || new Date(p.store_printers.expiry_date) > new Date())
      );
      return hasActiveSub || hasActivePrinter;
    },
    enabled: !!user && open && !isAdmin,
    staleTime: 60_000,
  });

  // Find maintenance conversation for current user
  const maintenanceConv = useMemo(() => {
    if (isAdmin || !conversations) return null;
    return conversations.find(c => 
      c.buyer_id === MAINTENANCE_SUPPORT_ID || c.seller_id === MAINTENANCE_SUPPORT_ID
    );
  }, [conversations, isAdmin]);

  const [hasAutoOpened, setHasAutoOpened] = useState(false);
  useEffect(() => {
    if (autoOpenConversationId && conversations?.length && !hasAutoOpened) {
      const conv = conversations.find(c => c.id === autoOpenConversationId);
      if (conv) {
        setSelectedConversation(autoOpenConversationId);
        setHasAutoOpened(true);
      }
    }
  }, [autoOpenConversationId, conversations, hasAutoOpened]);

  // Fetch profiles (use profiles_public view to protect sensitive data)
  const { data: profiles } = useQuery({
    queryKey: ['conversation-profiles-full', conversations?.map(c => [c.buyer_id, c.seller_id]).flat()],
    queryFn: async () => {
      if (!conversations?.length) return {};
      const userIds = [...new Set(conversations.flatMap(c => [c.buyer_id, c.seller_id]))];
      
      // Use profiles_public view to protect sensitive user data (excludes phone, email, etc.)
      const { data: profilesData } = await supabase
        .from('profiles_public')
        .select('id, full_name, username, avatar_url, last_active_at')
        .in('id', userIds);
      
      // Map user_id → merchant_applications.id to then fetch merchant_public_profiles
      const { data: merchantApps } = await supabase
        .from('merchant_applications')
        .select('id, user_id, display_name')
        .in('user_id', userIds)
        .eq('status', 'approved');
      
      // Build user_id → merchant_app_id map
      const userToMerchantId: Record<string, string> = {};
      merchantApps?.forEach(app => {
        userToMerchantId[app.user_id] = app.id;
      });
      
      // Fetch merchant public profiles using merchant app IDs
      const merchantAppIds = Object.values(userToMerchantId);
      let merchantProfiles: any[] = [];
      if (merchantAppIds.length > 0) {
        const { data } = await supabase
          .from('merchant_public_profiles')
          .select('id, display_name, store_image_url, selected_frame_id')
          .in('id', merchantAppIds);
        merchantProfiles = data || [];
      }
      
      // Get all frame IDs from merchants
      const frameIds = merchantProfiles.map(m => m.selected_frame_id).filter(Boolean) as string[];
      
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
      
      // Add profiles with frame URLs and merchant app ID
      profilesData?.forEach(p => {
        const merchantAppId = userToMerchantId[p.id];
        const merchantData = merchantAppId ? merchantProfiles.find(m => m.id === merchantAppId) : null;
        const frameId = merchantData?.selected_frame_id;
        result[p.id] = { 
          ...p,
          // Use merchant store image if available, otherwise profile avatar
          avatar_url: merchantData?.store_image_url || p.avatar_url,
          display_name: merchantData?.display_name,
          selected_frame_url: frameId ? framesMap[frameId] : null,
          // Store merchant app ID for navigation to /store/:merchantId
          merchant_app_id: merchantAppId || null,
          // Online status: consider online if active in last 5 minutes
          is_online: p.last_active_at ? (Date.now() - new Date(p.last_active_at).getTime()) < 5 * 60 * 1000 : false,
        };
      });
      
      return result;
    },
    enabled: !!conversations?.length,
    refetchInterval: 60_000, // Refresh online status every minute
  });

  // Pagination state
  const [messageLimit, setMessageLimit] = useState(50);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const shouldScrollToBottom = useRef(true);
  const prevSelectedConversation = useRef<string | null>(null);

  // Reset pagination when conversation changes
  useEffect(() => {
    if (selectedConversation !== prevSelectedConversation.current) {
      setMessageLimit(50);
      setHasMoreMessages(false);
      shouldScrollToBottom.current = true;
      prevSelectedConversation.current = selectedConversation;
    }
  }, [selectedConversation]);

  // Fetch messages with pagination
  const { data: messages, isLoading: loadingMessages } = useQuery({
    queryKey: ['listing-messages', selectedConversation, messageLimit],
    queryFn: async () => {
      if (!selectedConversation) return [];
      // Get total count first
      const { count } = await supabase
        .from('listing_messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', selectedConversation);
      
      setHasMoreMessages((count || 0) > messageLimit);
      
      const { data, error } = await supabase
        .from('listing_messages')
        .select('*')
        .eq('conversation_id', selectedConversation)
        .order('created_at', { ascending: false })
        .limit(messageLimit);
      if (error) throw error;
      return (data || []).reverse(); // Reverse to show oldest first
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

  // Unread count per conversation
  const { data: unreadCounts } = useQuery({
    queryKey: ['conv-unread-counts', user?.id, conversations?.map(c => c.id)],
    queryFn: async () => {
      if (!conversations?.length || !user) return {};
      const effectiveId = isAdmin ? SUPPORT_USER_ID : user.id;
      const counts: Record<string, number> = {};
      // Batch: get all unread messages across all conversations
      const { data } = await supabase
        .from('listing_messages')
        .select('conversation_id')
        .in('conversation_id', conversations.map(c => c.id))
        .neq('sender_id', effectiveId)
        .eq('is_read', false);
      
      for (const msg of data || []) {
        counts[msg.conversation_id] = (counts[msg.conversation_id] || 0) + 1;
      }
      return counts;
    },
    enabled: !!conversations?.length && !!user,
    refetchInterval: open ? 5000 : false,
  });

  // Scroll to bottom only on initial load or when user sends a message
  useEffect(() => {
    if (shouldScrollToBottom.current && messages?.length) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
        shouldScrollToBottom.current = false;
      }, 100);
    }
  }, [messages, selectedConversation]);

  // Load older messages on scroll to top
  const handleMessagesScroll = () => {
    const container = messagesContainerRef.current;
    if (!container || loadingOlder || !hasMoreMessages) return;
    if (container.scrollTop < 80) {
      setLoadingOlder(true);
      const prevScrollHeight = container.scrollHeight;
      setMessageLimit(prev => prev + 50);
      // After new messages load, maintain scroll position
      setTimeout(() => {
        if (container) {
          container.scrollTop = container.scrollHeight - prevScrollHeight;
        }
        setLoadingOlder(false);
      }, 500);
    }
  };

  // Mark messages as read when conversation selected
  useEffect(() => {
    if (selectedConversation && user) {
      const markAsRead = async () => {
        const effectiveId = isAdmin ? SUPPORT_USER_ID : user.id;
        const { error } = await supabase
          .from('listing_messages')
          .update({ is_read: true })
          .eq('conversation_id', selectedConversation)
          .neq('sender_id', effectiveId)
          .eq('is_read', false);
        
        if (!error) {
          queryClient.invalidateQueries({ queryKey: ['marketplace-unread-users-count'] });
          queryClient.invalidateQueries({ queryKey: ['unified-chat-unread'] });
          queryClient.invalidateQueries({ queryKey: ['conv-unread-counts'] });
          queryClient.invalidateQueries({ queryKey: ['last-messages'] });
        }
      };
      markAsRead();
    }
  }, [selectedConversation, user?.id, isAdmin, queryClient]);

  const sendMessageMutation = useMutation({
    mutationFn: async ({ content, mediaUrl, locationData, addressData, replyToId }: { 
      content: string; 
      mediaUrl?: string; 
      locationData?: { latitude: number; longitude: number; address_name?: string };
      addressData?: any;
      replyToId?: string;
    }) => {
      if (!user || !selectedConversation || (!content.trim() && !mediaUrl && !locationData && !addressData)) {
        throw new Error('لا يمكن إرسال رسالة فارغة');
      }
      
      let messageContent = content.trim();
      if (!messageContent) {
        if (mediaUrl) messageContent = '📷 وسائط';
        else if (locationData) messageContent = '📍 موقع جغرافي';
        else if (addressData) messageContent = '🏠 عنوان توصيل';
      }
      
      // Send message - this is the only blocking operation
      // Admin sends as SUPPORT_USER_ID or MAINTENANCE_SUPPORT_ID based on conversation type
      const isMaintenanceChat = selectedConv?.buyer_id === MAINTENANCE_SUPPORT_ID || selectedConv?.seller_id === MAINTENANCE_SUPPORT_ID;
      const effectiveSenderId = isAdmin ? (isMaintenanceChat ? MAINTENANCE_SUPPORT_ID : SUPPORT_USER_ID) : user.id;
      const { error } = await supabase.from('listing_messages').insert({
        conversation_id: selectedConversation,
        sender_id: effectiveSenderId,
        content: messageContent,
        image_url: mediaUrl || null,
        location_data: locationData || null,
        address_data: addressData || null,
        reply_to_id: replyToId || null,
      });
      if (error) throw error;
      
      // Fire-and-forget: update conversation timestamp and send notifications
      supabase.from('listing_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', selectedConversation)
        .then(() => {});

      // Background notification (in-app + Telegram)
      if (selectedConv) {
        const otherUserId = selectedConv.buyer_id === effectiveSenderId 
          ? selectedConv.seller_id 
          : selectedConv.buyer_id;
        
        supabase
          .from('profiles')
          .select('full_name, username')
          .eq('id', user.id)
          .single()
          .then(({ data: senderProfile }) => {
            const senderName = senderProfile?.full_name || senderProfile?.username || 'مستخدم';
            const convCode = selectedConv.conversation_code ? `#${selectedConv.conversation_code}` : '';
            const listingTitle = selectedConv.conversation_code ? `محادثة ${convCode}` : 'محادثة';

            // 1. In-app notification
            supabase.from('notifications').insert({
              user_id: otherUserId,
              title: `💬 رسالة جديدة من ${senderName}`,
              message: messageContent.length > 80 ? messageContent.slice(0, 80) + '...' : messageContent,
              type: 'info',
              related_id: selectedConversation,
              is_general: false,
            }).then(() => {});

            // 2. Telegram notification
            supabase.functions.invoke('notify-marketplace-telegram', {
              body: {
                user_id: otherUserId,
                event_type: 'new_message',
                listing_title: listingTitle,
                sender_name: senderName,
                message_content: messageContent,
                conversation_id: selectedConversation,
              },
            });
          });
      }
    },
    onSuccess: () => {
      setMessageInput('');
      setReplyTo(null);
      shouldScrollToBottom.current = true;
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
  // For admin, treat SUPPORT_USER_ID as "me" when determining buyer/seller roles
  const effectiveUserId = isAdmin ? SUPPORT_USER_ID : user?.id;
  const isBuyer = selectedConv?.buyer_id === effectiveUserId;
  const isSeller = selectedConv?.seller_id === effectiveUserId;
  const otherUserId = selectedConv ? (selectedConv.buyer_id === effectiveUserId ? selectedConv.seller_id : selectedConv.buyer_id) : null;
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
  
   // Determine if this is a support/admin chat (with SUPPORT_USER_ID or MAINTENANCE_SUPPORT_ID)
   const isSupportConversation = selectedConv?.buyer_id === SUPPORT_USER_ID || selectedConv?.seller_id === SUPPORT_USER_ID;
   const isMaintenanceConversation = selectedConv?.buyer_id === MAINTENANCE_SUPPORT_ID || selectedConv?.seller_id === MAINTENANCE_SUPPORT_ID;
   
   // Everyone can send products (from different sources based on context)
   const canSendProducts = true;
   
   // Product selection logic:
   // 1. Support conversations → site products (for ALL users: customers, merchants, admins)
   // 2. Merchant talking to customer → merchant's OWN products
   // 3. Customer talking to merchant → that MERCHANT's products
   const useSiteProducts = isSupportConversation || isAdmin;
   
   // For merchant product selector, determine the correct merchant_applications.id
   const otherPartyUserId = selectedConv ? (selectedConv.buyer_id === effectiveUserId ? selectedConv.seller_id : selectedConv.buyer_id) : null;
   
   const { data: otherPartyMerchantApp } = useQuery({
     queryKey: ['other-party-merchant-app', otherPartyUserId],
     queryFn: async () => {
       if (!otherPartyUserId) return null;
       const { data } = await supabase
         .from('merchant_applications')
         .select('id')
         .eq('user_id', otherPartyUserId)
         .eq('status', 'approved')
         .maybeSingle();
       return data;
     },
     enabled: !!otherPartyUserId && !useSiteProducts,
   });
   
   // Merchant → own products; Customer → other party's merchant products
   const productSelectorMerchantId = useSiteProducts 
     ? '' 
     : (currentUserMerchant?.id || otherPartyMerchantApp?.id || '');
  
  // Only seller and admin can create orders (not customer)
  const canCreateOrderInChat = isSeller || isAdmin;

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
      const { error } = await supabase.storage.from('product-images').upload(fileName, file);
      if (error) throw error;
      
      const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(fileName);
      await sendMessageMutation.mutateAsync({ content: '', mediaUrl: publicUrl });
    } catch (error) {
      toast.error('فشل رفع الملف');
    } finally {
      setUploadingMedia(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const content = messageInput.trim();
    if (content) {
      setMessageInput('');
      sendMessageMutation.mutate({ content });
    }
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
      <DialogContent hideClose className="!max-w-none !w-full sm:!w-[95vw] lg:!w-[90vw] xl:!w-[85vw] 2xl:!w-[80vw] !max-h-none h-[100dvh] sm:h-[85vh] lg:h-[80vh] !p-0 !gap-0 overflow-hidden border-0">
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

        <div className="flex flex-1 min-h-0 h-full w-full overflow-hidden">
          {/* Conversations List - Fixed width sidebar */}
          <div className={cn(
            "flex flex-col md:border-l bg-card h-full min-h-0",
            selectedConversation 
              ? 'hidden md:flex md:w-72 lg:w-80 xl:w-96 flex-shrink-0' 
              : 'flex w-full'
          )}>
            {/* Header */}
             <div className="p-3 border-b bg-muted/30 flex items-center justify-between flex-shrink-0">
               <div className="flex items-center gap-2">
                 <MessageSquare className="w-5 h-5 text-primary" />
                 <h2 className="font-bold text-sm">المحادثات</h2>
               </div>
             </div>
             
             {/* Search Bar - available for all users, admin gets new conversation feature */}
             <div className="p-2 border-b bg-muted/10 space-y-2">
               <div className="relative">
                 <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                 <Input
                   placeholder="بحث في المحادثات..."
                   value={adminSearchTerm}
                   onChange={(e) => setAdminSearchTerm(e.target.value)}
                   className="h-8 pr-8 text-xs"
                 />
               </div>
               {isAdmin && (
                 <AdminUserSearchResults 
                   searchTerm={adminSearchTerm}
                   existingConversations={conversations}
                   onSelectUser={async (userId) => {
                     // Check if conversation already exists
                     const existingConv = conversations?.find(c => 
                       c.buyer_id === userId || c.seller_id === userId
                     );
                     if (existingConv) {
                       setSelectedConversation(existingConv.id);
                       return;
                     }
                     // Create new conversation
                     const convCode = `SUPPORT-${Date.now().toString(36).toUpperCase()}`;
                     const { data: newConv, error } = await supabase
                       .from('listing_conversations')
                       .insert({
                         buyer_id: userId,
                         seller_id: SUPPORT_USER_ID,
                         listing_id: SUPPORT_USER_ID,
                         conversation_code: convCode,
                         status: 'open',
                       })
                       .select('id')
                       .single();
                     if (!error && newConv) {
                       await supabase.from('listing_messages').insert({
                         conversation_id: newConv.id,
                         sender_id: SUPPORT_USER_ID,
                         content: '👋 مرحباً، تم بدء محادثة من قبل الإدارة.',
                       });
                       queryClient.invalidateQueries({ queryKey: ['listing-conversations'] });
                       setSelectedConversation(newConv.id);
                       setAdminSearchTerm('');
                     }
                   }}
                 />
               )}
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
                  {/* Support conversation pinned at top - HIDDEN for support account itself */}
                  {(() => {
                    // Check if current user is admin (role-based, not hardcoded)
                    const isCurrentUserSupport = isAdmin;
                    
                    // Find support conversation
                    const supportConv = conversations?.find(c => 
                      c.buyer_id === SUPPORT_USER_ID || c.seller_id === SUPPORT_USER_ID
                    );
                    
                    // Deduplicate conversations by other user ID (prevent showing same user multiple times)
                    const effectiveId = isCurrentUserSupport ? SUPPORT_USER_ID : user?.id;
                    const seenUserIds = new Set<string>();
                    const uniqueConversations = [...(conversations || [])].filter(conv => {
                      const otherUserId = conv.buyer_id === effectiveId ? conv.seller_id : conv.buyer_id;
                      if (seenUserIds.has(otherUserId)) return false;
                      if (seenUserIds.has(otherUserId)) return false;
                      seenUserIds.add(otherUserId);
                      return true;
                    });
                    
                    // For admin (support account): show all users who contacted support
                    // For regular users: filter out support conversations from regular list
                    const sortedConvs = uniqueConversations
                      .filter(c => {
                        if (isCurrentUserSupport) {
                          const otherUserId = c.buyer_id === effectiveId ? c.seller_id : c.buyer_id;
                          if (otherUserId === SUPPORT_USER_ID) return false;
                          // Apply admin search filter
                          if (adminSearchTerm.trim()) {
                            const otherProfile = profiles?.[otherUserId];
                            const searchLower = adminSearchTerm.toLowerCase();
                            const name = (otherProfile?.display_name || otherProfile?.full_name || otherProfile?.username || '').toLowerCase();
                            const code = ((c as any).conversation_code || '').toLowerCase();
                            return name.includes(searchLower) || code.includes(searchLower) || otherUserId.includes(searchLower);
                          }
                          return true;
                        } else {
                          // Regular user: exclude support and maintenance conversations (shown pinned)
                          if (c.buyer_id === SUPPORT_USER_ID || c.seller_id === SUPPORT_USER_ID) return false;
                          if (c.buyer_id === MAINTENANCE_SUPPORT_ID || c.seller_id === MAINTENANCE_SUPPORT_ID) return false;
                          // Apply search filter for regular users too
                          if (adminSearchTerm.trim()) {
                            const otherUserId = c.buyer_id === user?.id ? c.seller_id : c.buyer_id;
                            const otherProfile = profiles?.[otherUserId];
                            const searchLower = adminSearchTerm.toLowerCase();
                            const name = (otherProfile?.display_name || otherProfile?.full_name || otherProfile?.username || '').toLowerCase();
                            const code = ((c as any).conversation_code || '').toLowerCase();
                            return name.includes(searchLower) || code.includes(searchLower);
                          }
                          return true;
                        }
                      })
                      .sort((a, b) => {
                        const lastMsgA = lastMessages?.[a.id];
                        const lastMsgB = lastMessages?.[b.id];
                        const timeA = lastMsgA ? new Date(lastMsgA.created_at).getTime() : new Date(a.updated_at).getTime();
                        const timeB = lastMsgB ? new Date(lastMsgB.created_at).getTime() : new Date(b.updated_at).getTime();
                        return timeB - timeA;
                      });
                    
                    return (
                      <>
                        {/* Pinned Support Conversation - ONLY show for regular users, NOT for admin/support account */}
                        {!isCurrentUserSupport && (
                          <button
                            onClick={async () => {
                              if (supportConv) {
                                setSelectedConversation(supportConv.id);
                              } else {
                                // Create support conversation
                                const convCode = `SUPPORT-${Date.now().toString(36).toUpperCase()}`;
                                const { data: newConv, error } = await supabase
                                  .from('listing_conversations')
                                  .insert({
                                    buyer_id: user?.id,
                                    seller_id: SUPPORT_USER_ID,
                                    listing_id: SUPPORT_USER_ID,
                                    conversation_code: convCode,
                                    status: 'open',
                                  })
                                  .select('id')
                                  .single();

                                if (!error && newConv) {
                                  // Send welcome message
                                  await supabase.from('listing_messages').insert({
                                    conversation_id: newConv.id,
                                    sender_id: SUPPORT_USER_ID,
                                    content: '👋 مرحباً بك! كيف يمكنني مساعدتك اليوم؟',
                                  });
                                  queryClient.invalidateQueries({ queryKey: ['listing-conversations'] });
                                  setSelectedConversation(newConv.id);
                                }
                              }
                            }}
                            className={cn(
                              "w-full p-3 flex gap-3 hover:bg-primary/10 transition-colors border-b-2 border-primary/20 bg-gradient-to-l from-primary/5 to-transparent",
                              selectedConversation && (
                                (supportConv && selectedConversation === supportConv.id)
                              ) && "bg-primary/10"
                            )}
                          >
                            {/* Support Avatar */}
                            <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center shrink-0">
                              <Headphones className="h-6 w-6 text-primary-foreground" />
                            </div>
                            
                            {/* Support Info */}
                            <div className="flex-1 min-w-0 text-right">
                              <div className="flex items-center justify-between gap-2 mb-0.5">
                                <p className="font-bold text-sm">خدمة العملاء</p>
                                {supportConv && lastMessages?.[supportConv.id] && (
                                  <span className="text-[10px] text-muted-foreground">
                                    {format(new Date(lastMessages[supportConv.id].created_at), 'HH:mm')}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">
                                {supportConv && lastMessages?.[supportConv.id] 
                                  ? lastMessages[supportConv.id].content?.slice(0, 40)
                                  : 'تحدث مع فريق الدعم'}
                              </p>
                            </div>
                            
                            {/* Unread indicator */}
                            {supportConv && lastMessages?.[supportConv.id] && 
                             !lastMessages[supportConv.id].is_read && 
                             lastMessages[supportConv.id].sender_id !== user?.id && (
                              <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                                <span className="text-[9px] font-bold text-primary-foreground">!</span>
                              </div>
                            )}
                          </button>
                         )}

                        {/* Pinned Maintenance Support - Only for users with active warranty */}
                        {!isCurrentUserSupport && hasActiveWarranty && (
                          <button
                            onClick={async () => {
                              if (maintenanceConv) {
                                setSelectedConversation(maintenanceConv.id);
                              } else {
                                const convCode = `MAINT-${Date.now().toString(36).toUpperCase()}`;
                                const { data: newConv, error } = await supabase
                                  .from('listing_conversations')
                                  .insert({
                                    buyer_id: user?.id,
                                    seller_id: MAINTENANCE_SUPPORT_ID,
                                    listing_id: MAINTENANCE_SUPPORT_ID,
                                    conversation_code: convCode,
                                    status: 'open',
                                  })
                                  .select('id')
                                  .single();

                                if (!error && newConv) {
                                  await supabase.from('listing_messages').insert({
                                    conversation_id: newConv.id,
                                    sender_id: MAINTENANCE_SUPPORT_ID,
                                    content: '🔧 مرحباً بك في دعم الصيانة! كيف يمكننا مساعدتك؟',
                                  });
                                  queryClient.invalidateQueries({ queryKey: ['listing-conversations'] });
                                  setSelectedConversation(newConv.id);
                                }
                              }
                            }}
                            className={cn(
                              "w-full p-3 flex gap-3 hover:bg-accent/10 transition-colors border-b border-border/50 bg-gradient-to-l from-accent/5 to-transparent",
                              maintenanceConv && selectedConversation === maintenanceConv.id && "bg-accent/10"
                            )}
                          >
                            <div className="h-12 w-12 rounded-full bg-accent flex items-center justify-center shrink-0">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-accent-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                            </div>
                            <div className="flex-1 min-w-0 text-right">
                              <div className="flex items-center justify-between gap-2 mb-0.5">
                                <p className="font-bold text-sm">دعم الصيانة</p>
                                {maintenanceConv && lastMessages?.[maintenanceConv.id] && (
                                  <span className="text-[10px] text-muted-foreground">
                                    {format(new Date(lastMessages[maintenanceConv.id].created_at), 'HH:mm')}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">
                                {maintenanceConv && lastMessages?.[maintenanceConv.id]
                                  ? lastMessages[maintenanceConv.id].content?.slice(0, 40)
                                  : 'تواصل مع فريق الصيانة'}
                              </p>
                            </div>
                            {maintenanceConv && lastMessages?.[maintenanceConv.id] &&
                             !lastMessages[maintenanceConv.id].is_read &&
                             lastMessages[maintenanceConv.id].sender_id !== user?.id && (
                              <div className="h-5 w-5 rounded-full bg-accent flex items-center justify-center shrink-0">
                                <span className="text-[9px] font-bold text-accent-foreground">!</span>
                              </div>
                            )}
                          </button>
                        )}
                        
                        {/* Other conversations */}
                        {sortedConvs.map(conv => {
                          const convOtherUserId = conv.buyer_id === effectiveId ? conv.seller_id : conv.buyer_id;
                          const convOtherUser = profiles?.[convOtherUserId];
                          const lastMsg = lastMessages?.[conv.id];
                          const isActive = selectedConversation === conv.id;
                          const convUnread = unreadCounts?.[conv.id] || 0;
                          const isOtherOnline = convOtherUser?.is_online;
                          
                          const convEntryContext = (conv as any).entry_context;
                          
                          return (
                            <button
                              key={conv.id}
                              onClick={() => setSelectedConversation(conv.id)}
                              className={cn(
                                "w-full p-3 flex gap-3 hover:bg-muted/50 transition-colors border-b border-border/50",
                                isActive && "bg-muted"
                              )}
                            >
                               {/* Avatar - Dual avatar for disputes (admin view) */}
                               <div className="relative flex-shrink-0">
                                 {conv.status === 'disputed' && isAdmin ? (
                                  <div className="relative w-12 h-12">
                                    {/* Buyer avatar (top-right) */}
                                    <div className="absolute top-0 right-0 z-10">
                                      <AvatarWithFrame
                                        imageUrl={profiles?.[conv.buyer_id]?.avatar_url}
                                        frameUrl={null}
                                        size="xs"
                                      />
                                    </div>
                                    {/* Seller avatar (bottom-left) */}
                                    <div className="absolute bottom-0 left-0">
                                      <AvatarWithFrame
                                        imageUrl={profiles?.[conv.seller_id]?.avatar_url}
                                        frameUrl={null}
                                        size="xs"
                                      />
                                    </div>
                                    {/* Dispute indicator */}
                                    <div className="absolute -bottom-1 -right-1 z-20 bg-destructive rounded-full p-0.5">
                                      <AlertTriangle className="w-3 h-3 text-white" />
                                    </div>
                                  </div>
                                ) : (
                                   <>
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
                                    {/* Green online dot */}
                                    {isOtherOnline && conv.status !== 'disputed' && (
                                      <span className="absolute -bottom-0.5 -left-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-[1.5px] border-card z-10" />
                                    )}
                                  </>
                                )}
                              </div>

                              {/* Content - Three Sections */}
                              <div className="flex-1 min-w-0 text-right">
                                {/* Section 1: Name with badges and conversation code */}
                                <div className="flex items-center justify-between gap-2 mb-0.5">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                     <p className={cn("text-sm truncate max-w-[120px]", convUnread > 0 ? "font-bold" : "font-semibold")}>
                                      {conv.status === 'disputed' && isAdmin
                                        ? `${profiles?.[conv.buyer_id]?.full_name || 'مشتري'} ↔ ${profiles?.[conv.seller_id]?.display_name || profiles?.[conv.seller_id]?.full_name || 'بائع'}`
                                        : (convOtherUser?.display_name || convOtherUser?.full_name || convOtherUser?.username || 'محادثة')
                                      }
                                    </p>
                                    {/* Badges */}
                                    {conv.admin_joined && (
                                      <ShieldCheck className="w-3 h-3 text-primary shrink-0" />
                                    )}
                                    {(conv as any).conversation_code && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          navigator.clipboard.writeText((conv as any).conversation_code);
                                          toast.success('تم نسخ رمز المحادثة');
                                        }}
                                        className="text-[8px] px-1 py-0 font-mono text-muted-foreground hover:text-primary transition-colors"
                                        title="انقر للنسخ"
                                      >
                                        #{(conv as any).conversation_code}
                                      </button>
                                    )}
                                  </div>
                                  {lastMsg && (
                                    <span className="text-[10px] text-muted-foreground flex-shrink-0">
                                      {format(new Date(lastMsg.created_at), 'HH:mm')}
                                    </span>
                                  )}
                                </div>
                                
                                {/* Section 2: Last message */}
                                {lastMsg && (
                                  <p className={cn("text-xs truncate flex items-center gap-1", convUnread > 0 ? "text-foreground font-semibold" : "text-muted-foreground")}>
                                    {(lastMsg.sender_id === user?.id || (isAdmin && lastMsg.sender_id === SUPPORT_USER_ID)) && (
                                      <CheckCheck
                                        className={cn(
                                          "w-3 h-3 flex-shrink-0",
                                          lastMsg.is_read ? "text-whatsapp" : "text-muted-foreground"
                                        )}
                                      />
                                    )}
                                    {lastMsg.image_url ? '📷 صورة' : lastMsg.content?.slice(0, 40)}
                                  </p>
                                )}
                              </div>

                              {/* Section 3: Entry context or Unread badge */}
                              <div className="shrink-0 flex flex-col items-center gap-1">
                                {convEntryContext?.title && (
                                  <div className="h-8 w-8 rounded-lg overflow-hidden border border-border/50 bg-muted/50 flex items-center justify-center">
                                    {convEntryContext.imageUrl ? (
                                      <img 
                                        src={convEntryContext.imageUrl} 
                                        alt="" 
                                        className="h-full w-full object-cover" 
                                      />
                                    ) : (
                                      <Package className="h-4 w-4 text-muted-foreground" />
                                    )}
                                  </div>
                                )}
                                {/* Unread count badge */}
                                {convUnread > 0 && (
                                  <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                                    {convUnread > 99 ? '99+' : convUnread}
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* Messages Area - Expands to fill ALL remaining space */}
          <div className={cn(
            "flex flex-col min-h-0 bg-background h-full overflow-hidden min-w-0",
            selectedConversation ? 'flex-1' : 'hidden md:flex md:flex-1',
          )}
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          >
          {selectedConversation ? (
              <>
                {/* Chat Top Bar - Use Admin bar for support account, Support bar for support chat, regular for others */}
                {(() => {
                   const isSupportChat = otherUserId === SUPPORT_USER_ID;
                  const isCurrentUserSupport = isAdmin;
                  
                  if (isSupportChat) {
                    return (
                      <ChatSupportTopBar
                        onBack={() => setSelectedConversation(null)}
                      />
                    );
                  }
                  
                  // Admin view: show AdminChatTopBar with quick actions
                  if (isCurrentUserSupport) {
                    return (
                      <AdminChatTopBar
                        userName={otherUser?.display_name || otherUser?.full_name || otherUser?.username || 'مستخدم'}
                        usersId={otherUserId || ''}
                        userImage={otherUser?.avatar_url}
                        userFrameUrl={(otherUser as any)?.selected_frame_url}
                        status={selectedConv?.status as 'open' | 'disputed' | 'resolved' | undefined}
                        onBack={() => setSelectedConversation(null)}
                        onBanUser={(reason) => {
                          if (otherUserId) {
                            banUserMutation.mutate({ userId: otherUserId, reason, isBan: true });
                          }
                        }}
                        onUnbanUser={() => {
                          if (otherUserId) {
                            banUserMutation.mutate({ userId: otherUserId, reason: 'رفع الحظر', isBan: false });
                          }
                        }}
                        onWarnUser={(reason) => {
                          if (otherUserId) {
                            banUserMutation.mutate({ userId: otherUserId, reason, isBan: false });
                          }
                        }}
                        onResolveDispute={(resolution) => {
                          // Add resolution message and resolve
                          if (selectedConversation && user) {
                            supabase.from('listing_conversations')
                              .update({ status: 'resolved' })
                              .eq('id', selectedConversation)
                              .then(() => {
                                supabase.from('listing_messages').insert({
                                  conversation_id: selectedConversation,
                                  sender_id: user.id,
                                  content: `✅ تم حل النزاع: ${resolution}`,
                                }).then(() => {
                                  queryClient.invalidateQueries({ queryKey: ['listing-conversations'] });
                                  queryClient.invalidateQueries({ queryKey: ['listing-messages', selectedConversation] });
                                  toast.success('تم حل النزاع');
                                });
                              });
                          }
                        }}
                        onCloseDispute={() => {
                          cancelDisputeMutation.mutate();
                        }}
                      />
                    );
                  }
                  
                  // Determine if other user is a merchant - use merchant_app_id for store navigation
                  const otherMerchantAppId = otherUser?.merchant_app_id;
                  
                  return (
                    <ChatTopBar
                      storeName={otherUser?.display_name || otherUser?.full_name || otherUser?.username || 'المحادثة'}
                      storeId={otherMerchantAppId || otherUserId || ''}
                      storeImage={otherUser?.avatar_url}
                      storeFrameUrl={(otherUser as any)?.selected_frame_url}
                      rating={Number(otherUserReputation?.avg_stars ?? 0)}
                      customerId={!otherMerchantAppId ? otherUserId || undefined : undefined}
                      isOnline={otherUser?.is_online || false}
                      lastActiveAt={otherUser?.last_active_at}
                      isSeller={isSeller}
                      status={selectedConv?.status as 'open' | 'disputed' | 'resolved' | undefined}
                      onBack={() => setSelectedConversation(null)}
                      onContactAdmin={() => requestAdminMutation.mutate()}
                    />
                  );
                })()}

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6" ref={messagesContainerRef} onScroll={handleMessagesScroll}>
                  {/* Load older messages indicator */}
                  {hasMoreMessages && (
                    <div className="flex justify-center py-2">
                      <button 
                        onClick={() => setMessageLimit(prev => prev + 50)}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1 rounded-full bg-muted/50"
                      >
                        {loadingOlder ? (
                          <Loader2 className="w-3 h-3 animate-spin inline ml-1" />
                        ) : 'تحميل الرسائل القديمة'}
                      </button>
                    </div>
                  )}
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
                              const isMe = msg.sender_id === user?.id || (isAdmin && msg.sender_id === SUPPORT_USER_ID);
                              const sender = profiles?.[msg.sender_id];
                              const showTail = idx === 0 || msgs[idx - 1]?.sender_id !== msg.sender_id;
                              const timestamp = format(new Date(msg.created_at), 'HH:mm');
                              
                              // Check if it's a system message (starts with emoji or 🔔)
                              const isSystemMessage = msg.content?.startsWith('⚠️') || 
                                                     msg.content?.startsWith('✅') ||
                                                     msg.content?.startsWith('🛡️') ||
                                                     msg.content?.startsWith('🚫') ||
                                                     msg.content?.startsWith('🔔');
                              
                              // Check if it's a cart code message for admin
                              const cartCodeMatch = msg.content?.match(/رمز السلة:\s*(CART-[A-Z0-9-]+)/);
                              const isCartMessage = !!cartCodeMatch;
                              
                              // Check if it's a product message (starts with 📦 or 🛒) but NOT a cart request message or order reference
                              const isOrderReferenceMessage = msg.content?.includes('بخصوص طلبك رقم');
                              const isProductMessage = !isCartMessage && !isOrderReferenceMessage && (msg.content?.startsWith('📦') || msg.content?.startsWith('🛒'));
                              
                              // Check if it's a JSON message (order_card or confirmation_card)
                              let parsedContent: any = null;
                              try {
                                if (msg.content?.startsWith('{')) {
                                  parsedContent = JSON.parse(msg.content);
                                }
                              } catch {}
                              
                              // Check if message has location or address data
                              const hasLocationData = msg.location_data && typeof msg.location_data === 'object';
                              const hasAddressData = msg.address_data && typeof msg.address_data === 'object';
                              
                              // Render Location Message
                              if (hasLocationData) {
                                return (
                                  <LocationMessage
                                    key={msg.id}
                                    location={msg.location_data}
                                    isMe={isMe}
                                    timestamp={timestamp}
                                  />
                                );
                              }
                              
                              // Render Address Message
                              if (hasAddressData) {
                                return (
                                  <AddressMessage
                                    key={msg.id}
                                    address={msg.address_data}
                                    isMe={isMe}
                                    timestamp={timestamp}
                                  />
                                );
                              }
                              
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
                                      onPayNow={(orderId) => {
                                        navigate(`/community/checkout/${orderId}`);
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
                                      
                                      onAddNotes={() => toast.info('إضافة ملاحظة')}
                                    />
                                  );
                                }
                              }
                              
                              // Render Order Tracking Card
                              if (parsedContent?.type === 'order_tracking') {
                                return (
                                  <OrderTrackingCard
                                    key={msg.id}
                                    orderNumber={parsedContent.order_number}
                                    orderId={parsedContent.order_id}
                                    isMe={isMe}
                                    timestamp={timestamp}
                                  />
                                );
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
                                const isInterestFormat = msg.content?.startsWith('🛒');
                                const productName = isInterestFormat
                                  ? (lines[1]?.trim() || '')
                                  : (lines[0]?.replace('📦 ', '').trim() || '');
                                const priceLine = isInterestFormat ? lines[2] : lines[1];
                                // Parse price - handle both Arabic (٠-٩) and Latin (0-9) digits
                                const arabicToLatin = (s: string) => s?.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))) || '';
                                const normalizedPriceLine = arabicToLatin(priceLine || '').replace(/٬/g, ',');
                                const priceMatch = normalizedPriceLine?.match(/(\d[\d,]*)/);
                                const price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, '')) : 0;
                                
                                // Extract product ID from message (🆔productId)
                                const idLine = lines.find((l: string) => l.startsWith('🆔'));
                                const embeddedProductId = idLine ? idLine.replace('🆔', '').trim() : null;
                                
                                return (
                                  <ProductCard
                                    key={msg.id}
                                    productId={embeddedProductId || msg.id}
                                    storeId={otherUserId || ''}
                                    imageUrl={msg.image_url}
                                    title={productName}
                                    price={price}
                                    isMe={isMe}
                                    timestamp={timestamp}
                                    userRole={chatCommerce.userRole}
                                    canCreateOrder={true}
                                    onProductClick={() => {
                                      const merchantAppId = selectedConv?.listing_id;
                                      if (merchantAppId) {
                                        navigate(`/store/${merchantAppId}`);
                                      }
                                    }}
                                    onCreateOrder={() => {
                                      if (canCreateOrderInChat) {
                                        // Seller/Admin flow: CreateOrderDialog
                                        setSelectedProductForOrder({
                                          id: embeddedProductId || msg.id,
                                          title: productName,
                                          image: msg.image_url,
                                          price: price,
                                        });
                                        setCreateOrderDialogOpen(true);
                                      } else {
                                        // Customer flow: open AddToCartSheet with product options
                                        const merchantId = otherPartyMerchantApp?.id || selectedConv?.listing_id;
                                        const productIdToUse = embeddedProductId;
                                        
                                        if (productIdToUse) {
                                          // Use embedded product ID directly
                                          supabase
                                            .from('merchant_products')
                                            .select('id, merchant_id, title, price_iqd, image_urls, primary_image_index, sale_type, max_queue_slots, current_queue_count, preorder_deposit_percent, preorder_available_date, preorder_note')
                                            .eq('id', productIdToUse)
                                            .maybeSingle()
                                            .then(({ data: foundProduct }) => {
                                              if (foundProduct) {
                                                setCartSheetProduct({
                                                  id: foundProduct.id,
                                                  merchant_id: foundProduct.merchant_id,
                                                  title: foundProduct.title,
                                                  price_iqd: foundProduct.price_iqd,
                                                  image_urls: foundProduct.image_urls as string[] | null,
                                                  primary_image_index: foundProduct.primary_image_index ?? 0,
                                                  sale_type: foundProduct.sale_type,
                                                  max_queue_slots: foundProduct.max_queue_slots,
                                                  current_queue_count: foundProduct.current_queue_count,
                                                  preorder_deposit_percent: foundProduct.preorder_deposit_percent,
                                                });
                                                setCartSheetOpen(true);
                                              } else {
                                                toast.error('لم يتم العثور على المنتج');
                                              }
                                            });
                                        } else if (merchantId) {
                                          // Fallback: search by title for older messages without embedded ID
                                          supabase
                                            .from('merchant_products')
                                            .select('id, merchant_id, title, price_iqd, image_urls, primary_image_index, sale_type, max_queue_slots, current_queue_count, preorder_deposit_percent, preorder_available_date, preorder_note')
                                            .eq('merchant_id', merchantId)
                                            .ilike('title', productName)
                                            .limit(1)
                                            .maybeSingle()
                                            .then(({ data: foundProduct }) => {
                                              if (foundProduct) {
                                                setCartSheetProduct({
                                                  id: foundProduct.id,
                                                  merchant_id: foundProduct.merchant_id,
                                                  title: foundProduct.title,
                                                  price_iqd: foundProduct.price_iqd,
                                                  image_urls: foundProduct.image_urls as string[] | null,
                                                  primary_image_index: foundProduct.primary_image_index ?? 0,
                                                  sale_type: foundProduct.sale_type,
                                                  max_queue_slots: foundProduct.max_queue_slots,
                                                  current_queue_count: foundProduct.current_queue_count,
                                                  preorder_deposit_percent: foundProduct.preorder_deposit_percent,
                                                });
                                                setCartSheetOpen(true);
                                              } else {
                                                toast.error('لم يتم العثور على المنتج');
                                              }
                                            });
                                        }
                                      }
                                    }}
                                    onEditOrder={canCreateOrderInChat ? () => {
                                      setMerchantOrderInitialData({
                                        title: productName,
                                        price: price,
                                        image: msg.image_url,
                                      });
                                      setMerchantOrderDialogOpen(true);
                                    } : undefined}
                                  />
                                );
                              }
                              
                              // Regular text message
                              const replyMsg = msg.reply_to_id ? (msgs as any[]).find((m: any) => m.id === msg.reply_to_id) || (messages as any[])?.find((m: any) => m.id === msg.reply_to_id) : null;
                              const replySender = replyMsg ? profiles?.[replyMsg.sender_id] : null;
                              const isReplyMe = replyMsg ? (replyMsg.sender_id === user?.id || (isAdmin && replyMsg.sender_id === SUPPORT_USER_ID)) : false;
                              
                              return (
                                <SwipeableMessage
                                  key={msg.id}
                                  isMe={isMe}
                                  onSwipeReply={() => {
                                    setReplyTo({
                                      id: msg.id,
                                      content: msg.content || '',
                                      senderName: msg.sender_id === SUPPORT_USER_ID 
                                        ? '🎧 خدمة العملاء' 
                                        : (sender?.display_name || sender?.full_name || sender?.username || 'مستخدم'),
                                      isMe,
                                    });
                                  }}
                                >
                                <div 
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
                                    {!isMe && showTail && (
                                      <p className="text-xs font-medium text-primary mb-1">
                                        {msg.sender_id === SUPPORT_USER_ID 
                                          ? '🎧 خدمة العملاء' 
                                          : (sender?.display_name || sender?.full_name || sender?.username || 'مستخدم')}
                                      </p>
                                    )}
                                    
                                    {/* Reply bubble */}
                                    {replyMsg && (
                                      <ReplyBubble
                                        senderName={isReplyMe ? 'أنت' : (replySender?.display_name || replySender?.full_name || replySender?.username || 'مستخدم')}
                                        content={replyMsg.content || '📷 وسائط'}
                                        isMe={isReplyMe}
                                        isParentMe={isMe}
                                      />
                                    )}
                                    
                                    {/* Image with Lightbox */}
                                    {msg.image_url && (
                                      <ImageLightbox src={msg.image_url} alt="صورة">
                                        {(open) => (
                                          <div className="mb-1">
                                            <img 
                                              src={msg.image_url} 
                                              alt="" 
                                              className="rounded-lg max-w-full max-h-64 cursor-pointer hover:opacity-90 transition-opacity"
                                              onClick={open}
                                            />
                                          </div>
                                        )}
                                      </ImageLightbox>
                                    )}
                                    
                                    {/* Text with inline emojis + link detection */}
                                    {(() => {
                                      if (!msg.content || msg.content === '📷 وسائط' || msg.content === '📷 صورة' || msg.content.startsWith('{')) return null;
                                      const URL_REGEX = /(https?:\/\/[^\s<>"']+)/gi;
                                      const urls = msg.content.match(URL_REGEX) || [];
                                      const textWithoutUrls = msg.content.replace(URL_REGEX, '').trim();
                                      const hasText = textWithoutUrls.length > 0;
                                      return (
                                        <>
                                          {hasText && (
                                            <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                                              {parseEmojisInText(textWithoutUrls).map((item, idx) => 
                                                typeof item === 'string' 
                                                  ? <span key={idx}>{item}</span>
                                                  : <img key={idx} src={item.src} alt={item.alt} className="inline-block w-5 h-5 align-text-bottom mx-0.5" loading="lazy" />
                                              )}
                                            </p>
                                          )}
                                          {urls.map((url, idx) => (
                                            <LinkRenderer key={idx} url={url} isMe={isMe} />
                                          ))}
                                        </>
                                      );
                                    })()}
                                    
                                    {/* Admin Cart Edit Button */}
                                    {isCartMessage && isAdmin && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="mt-2 h-7 text-xs gap-1 bg-primary/10 hover:bg-primary/20 border-primary/30"
                                        onClick={async () => {
                                          const code = cartCodeMatch[1];
                                          const { data } = await supabase
                                            .from('cart_requests')
                                            .select('*')
                                            .eq('cart_code', code)
                                            .maybeSingle();
                                          if (data) {
                                            const { data: profile } = await supabase
                                              .from('profiles')
                                              .select('id, full_name, username, avatar_url')
                                              .eq('id', data.user_id)
                                              .single();
                                            setAdminCartRequest({ ...data, user: profile });
                                            setAdminCartEditOpen(true);
                                          } else {
                                            toast.error('لم يتم العثور على السلة');
                                          }
                                        }}
                                      >
                                        <ShoppingCart className="h-3 w-3" />
                                        تعديل السلة
                                      </Button>
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
                                </SwipeableMessage>
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
                    const content = messageInput.trim();
                    if (content) {
                      setMessageInput('');
                      sendMessageMutation.mutate({ content, replyToId: replyTo?.id });
                      setEntryContext(null);
                    }
                  }}
                  replyTo={replyTo}
                  onCancelReply={() => setReplyTo(null)}
                  onSendMedia={async (file: File) => {
                    setUploadingMedia(true);
                    try {
                      const fileExt = file.name.split('.').pop();
                      const fileName = `chat/listing/${user?.id}/${Date.now()}.${fileExt}`;
                      const { error } = await supabase.storage.from('product-images').upload(fileName, file);
                      if (error) throw error;
                      const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(fileName);
                      await sendMessageMutation.mutateAsync({ content: '', mediaUrl: publicUrl });
                    } catch (error) {
                      toast.error('فشل رفع الملف');
                    } finally {
                      setUploadingMedia(false);
                    }
                  }}
                  onSendLocation={async (location) => {
                    await sendMessageMutation.mutateAsync({ 
                      content: '', 
                      locationData: location 
                    });
                  }}
                  onSendAddress={async (address) => {
                    await sendMessageMutation.mutateAsync({ 
                      content: '', 
                      addressData: address 
                    });
                  }}
                  onOpenProducts={() => setProductSelectorOpen(true)}
                  isLoading={sendMessageMutation.isPending}
                  isUploadingMedia={uploadingMedia}
                  isSeller={canSendProducts}
                  contextBar={entryContext}
                  onSendContext={async () => {
                    if (!entryContext) return;
                    
                    let content: string;
                    if (entryContext.type === 'request' && entryContext.requestId) {
                      // Send request details
                      content = `📦 أريد التواصل بخصوص طلب الطباعة:\n${entryContext.title}`;
                    } else {
                      // Send product details
                      content = `🛒 أنا مهتم بالمنتج:\n${entryContext.title}${entryContext.price ? `\n💰 ${entryContext.price.toLocaleString('ar-IQ')} د.ع` : ''}${entryContext.productId ? `\n🆔${entryContext.productId}` : ''}`;
                    }
                    
                    await sendMessageMutation.mutateAsync({ 
                      content, 
                      mediaUrl: entryContext.imageUrl || undefined 
                    });
                    setEntryContext(null);
                  }}
                  onCloseContext={() => setEntryContext(null)}
                />
                
                {/* Product Selector Dialog */}
                <ProductSelector
                  open={productSelectorOpen}
                  onOpenChange={setProductSelectorOpen}
                  merchantId={productSelectorMerchantId}
                  useSiteProducts={useSiteProducts}
                  onSelectProduct={async (product) => {
                    const effectiveSenderId = isAdmin ? SUPPORT_USER_ID : user?.id;
                    const productMessage = `📦 ${product.title}\n💰 ${product.price?.toLocaleString() || 0} د.ع\n🆔${product.id}`;
                    const { error } = await supabase.from('listing_messages').insert({
                      conversation_id: selectedConversation,
                      sender_id: effectiveSenderId,
                      content: productMessage,
                      image_url: product.imageUrl,
                    });
                    if (!error) {
                      queryClient.invalidateQueries({ queryKey: ['listing-messages', selectedConversation] });
                      setProductSelectorOpen(false);
                      toast.success('تم إرسال المنتج');
                    }
                  }}
                  onCreateCustomOrder={canCreateOrderInChat ? () => {
                    setMerchantOrderInitialData(null);
                    setMerchantOrderDialogOpen(true);
                  } : undefined}
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
                
                {/* Merchant Order Dialog - Create Custom Order */}
                <MerchantOrderDialog
                  open={merchantOrderDialogOpen}
                  onOpenChange={(open) => {
                    setMerchantOrderDialogOpen(open);
                    if (!open) setMerchantOrderInitialData(null);
                  }}
                  initialTitle={merchantOrderInitialData?.title}
                  initialPrice={merchantOrderInitialData?.price}
                  initialImage={merchantOrderInitialData?.image}
                  onSubmit={async (data) => {
                    if (!selectedConversation || !user) {
                      toast.error('يرجى تسجيل الدخول أولاً');
                      return;
                    }
                    
                    if (!selectedConv) {
                      toast.error('المحادثة غير موجودة');
                      return;
                    }
                    
                    const totalWithShipping = (data.price * data.quantity) + data.shippingPrice;
                    
                    // Determine customer_id - the other participant in the conversation
                    const customerId = selectedConv.buyer_id === user.id 
                      ? selectedConv.seller_id 
                      : selectedConv.buyer_id;
                    
                    if (!customerId) {
                      toast.error('لا يمكن تحديد الزبون');
                      return;
                    }
                    
                    try {
                      // Create order in database
                      const { data: order, error } = await supabase
                        .from('chat_orders')
                        .insert({
                          conversation_id: selectedConversation,
                          product_title: data.title,
                          product_image: merchantOrderInitialData?.image || null,
                          description: data.description || null,
                          quantity: data.quantity,
                          unit_price: data.price,
                          total_price: totalWithShipping,
                          notes: data.notes || null,
                          seller_id: user.id,
                          customer_id: customerId,
                          status: 'waiting_payment',
                          payment_method: data.paymentMethod,
                          partial_payment_percent: data.paymentMethod === 'partial' ? data.partialPaymentPercent : null,
                          commission_rate: data.paymentMethod === 'cod' ? 10 : (data.paymentMethod === 'partial' ? 5 : 0),
                        })
                        .select()
                        .single();

                      if (error) {
                        console.error('Order creation error:', error);
                        toast.error(`فشل إنشاء الطلب: ${error.message}`);
                        return;
                      }

                      if (!order) {
                        toast.error('فشل إنشاء الطلب - لم يتم إرجاع بيانات');
                        return;
                      }

                      // Send order card message
                      await supabase.from('listing_messages').insert({
                        conversation_id: selectedConversation,
                        sender_id: user.id,
                        content: JSON.stringify({
                          type: 'order_card',
                          order_id: order.id,
                          product_title: data.title,
                          product_image: merchantOrderInitialData?.image,
                          quantity: data.quantity,
                          total_price: totalWithShipping,
                          status: 'waiting_payment',
                        }),
                      });

                      // Send system message
                      await supabase.from('listing_messages').insert({
                        conversation_id: selectedConversation,
                        sender_id: user.id,
                        content: `🔔 تم إنشاء طلب جديد بقيمة ${totalWithShipping.toLocaleString()} د.ع. يرجى مراجعة الطلب والدفع.`,
                      });

                      queryClient.invalidateQueries({ queryKey: ['chat-orders', selectedConversation] });
                      queryClient.invalidateQueries({ queryKey: ['listing-messages', selectedConversation] });
                      
                      toast.success('تم إنشاء الطلب وإرساله للزبون');
                      setMerchantOrderDialogOpen(false);
                      setMerchantOrderInitialData(null);
                    } catch (err) {
                      console.error('Unexpected error:', err);
                      toast.error('حدث خطأ غير متوقع');
                    }
                  }}
                  isLoading={false}
                />
                
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
                
                {/* Customer Add to Cart Sheet */}
                <AddToCartSheet
                  product={cartSheetProduct}
                  open={cartSheetOpen}
                  onOpenChange={setCartSheetOpen}
                />
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
        
        {/* Admin Cart Edit Dialog */}
        {adminCartEditOpen && adminCartRequest && (
          <Dialog open={adminCartEditOpen} onOpenChange={setAdminCartEditOpen}>
            <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto z-[60]" dir="rtl">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-primary" />
                  <h3 className="font-bold">تعديل سلة: {adminCartRequest.cart_code}</h3>
                </div>
                
                {/* User info */}
                <div className="p-3 bg-muted/50 rounded-lg flex items-center gap-3">
                  <img
                    src={adminCartRequest.user?.avatar_url || '/placeholder.svg'}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover"
                  />
                  <span className="text-sm font-medium">{adminCartRequest.user?.full_name || 'مستخدم'}</span>
                  <Badge variant="outline" className="mr-auto text-xs">
                    {adminCartRequest.status === 'pending' ? 'قيد المراجعة' : adminCartRequest.status === 'adjusted' ? 'تم التعديل' : adminCartRequest.status}
                  </Badge>
                </div>

                {/* Original price */}
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">السعر الأصلي</p>
                  <p className="text-lg font-bold">{adminCartRequest.original_total?.toLocaleString()} د.ع</p>
                </div>

                {/* Cart items with per-item price editing */}
                {adminCartRequest.cart_items?.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">المنتجات ({adminCartRequest.cart_items.length})</p>
                    {adminCartRequest.cart_items.map((item: any, idx: number) => {
                      const existingPrices = adminCartRequest._editItemPrices || {};
                      const currentPrice = existingPrices[idx] ?? item.price ?? 0;
                      return (
                        <div key={idx} className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg text-xs">
                          {item.image_url && <img src={item.image_url} alt="" className="h-8 w-8 rounded object-cover" />}
                          <div className="flex-1 min-w-0">
                            <span className="block truncate">{item.name_ar || item.product_name || 'منتج'}</span>
                            <span className="text-muted-foreground">×{item.quantity}</span>
                          </div>
                          <Input
                            type="number"
                            className="w-24 h-7 text-xs"
                            value={currentPrice}
                            onChange={(e) => setAdminCartRequest((prev: any) => ({
                              ...prev,
                              _editItemPrices: { ...(prev._editItemPrices || {}), [idx]: e.target.value }
                            }))}
                          />
                          <span className="text-muted-foreground whitespace-nowrap">د.ع</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Delivery price */}
                <div>
                  <label className="text-sm font-medium mb-1 block">سعر التوصيل (د.ع)</label>
                  <Input
                    type="number"
                    value={adminCartRequest._editDelivery ?? (() => {
                      try { const n = JSON.parse(adminCartRequest.admin_notes || '{}'); return n.delivery_price ?? 0; } catch { return 0; }
                    })()}
                    onChange={(e) => setAdminCartRequest((prev: any) => ({ ...prev, _editDelivery: e.target.value }))}
                  />
                </div>

                {/* Computed total preview */}
                {(() => {
                  const items = adminCartRequest.cart_items || [];
                  const editPrices = adminCartRequest._editItemPrices || {};
                  const itemsTotal = items.reduce((sum: number, item: any, idx: number) => {
                    const p = parseFloat(String(editPrices[idx] ?? item.price ?? 0)) || 0;
                    const q = item.quantity || 1;
                    return sum + (p * q);
                  }, 0);
                  const delivery = parseFloat(String(adminCartRequest._editDelivery ?? (() => {
                    try { return JSON.parse(adminCartRequest.admin_notes || '{}').delivery_price ?? 0; } catch { return 0; }
                  })())) || 0;
                  const total = itemsTotal + delivery;
                  return (
                    <div className="p-3 bg-primary/5 rounded-lg space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>مجموع المنتجات</span>
                        <span>{itemsTotal.toLocaleString()} د.ع</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>التوصيل</span>
                        <span>{delivery.toLocaleString()} د.ع</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold border-t pt-1">
                        <span>الإجمالي الجديد</span>
                        <span>{total.toLocaleString()} د.ع</span>
                      </div>
                    </div>
                  );
                })()}

                <div>
                  <label className="text-sm font-medium mb-1 block">ملاحظات الإدارة</label>
                  <Input
                    placeholder="ملاحظات..."
                    value={adminCartRequest._editNotes ?? (() => {
                      try { return JSON.parse(adminCartRequest.admin_notes || '{}').notes || adminCartRequest.admin_notes || ''; } catch { return adminCartRequest.admin_notes || ''; }
                    })()}
                    onChange={(e) => setAdminCartRequest((prev: any) => ({ ...prev, _editNotes: e.target.value }))}
                    id="admin-cart-notes"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    className="flex-1 gap-1"
                    onClick={async () => {
                      const items = adminCartRequest.cart_items || [];
                      const editPrices = adminCartRequest._editItemPrices || {};
                      const notesVal = adminCartRequest._editNotes ?? (() => {
                        try { return JSON.parse(adminCartRequest.admin_notes || '{}').notes || adminCartRequest.admin_notes || ''; } catch { return adminCartRequest.admin_notes || ''; }
                      })();

                      // Build adjusted items
                      const adjustedItems = items.map((item: any, idx: number) => {
                        const rawPrice = String(editPrices[idx] ?? item.price ?? 0)
                          .replace(/[٠-٩]/g, (d: string) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
                          .replace(/[٬،,\s]/g, '');
                        return { ...item, price: parseFloat(rawPrice) || 0 };
                      });

                      const rawDelivery = String(adminCartRequest._editDelivery ?? (() => {
                        try { return JSON.parse(adminCartRequest.admin_notes || '{}').delivery_price ?? 0; } catch { return 0; }
                      })())
                        .replace(/[٠-٩]/g, (d: string) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
                        .replace(/[٬،,\s]/g, '');
                      const deliveryPrice = parseFloat(rawDelivery) || 0;

                      const itemsTotal = adjustedItems.reduce((sum: number, item: any) => sum + ((item.price || 0) * (item.quantity || 1)), 0);
                      const totalPrice = itemsTotal + deliveryPrice;

                      const adminNotesJson = JSON.stringify({
                        notes: notesVal || '',
                        delivery_price: deliveryPrice,
                        adjusted_items: adjustedItems.map((it: any, idx: number) => ({
                          name: it.name_ar || it.product_name,
                          original_price: items[idx]?.price || 0,
                          adjusted_price: it.price,
                          quantity: it.quantity,
                        })),
                      });

                      const { error } = await supabase
                        .from('cart_requests')
                        .update({
                          adjusted_total: totalPrice,
                          admin_notes: adminNotesJson,
                          cart_items: adjustedItems,
                          status: 'adjusted',
                          updated_at: new Date().toISOString(),
                        })
                        .eq('id', adminCartRequest.id);
                      if (error) {
                        toast.error('فشل تحديث السعر');
                        return;
                      }
                      // Notify user
                      await supabase.from('notifications').insert({
                        user_id: adminCartRequest.user_id,
                        title: 'تم تعديل سعر السلة',
                        message: `تم تعديل سعر السلة (${adminCartRequest.cart_code}) إلى ${totalPrice.toLocaleString()} د.ع`,
                        type: 'info',
                      });
                      // Build detailed message
                      let msgLines = [`✅ تم تعديل سعر السلة (${adminCartRequest.cart_code})`];
                      adjustedItems.forEach((it: any) => {
                        msgLines.push(`📦 ${it.name_ar || it.product_name || 'منتج'}: ${(it.price || 0).toLocaleString()} د.ع × ${it.quantity || 1}`);
                      });
                      if (deliveryPrice > 0) msgLines.push(`🚚 التوصيل: ${deliveryPrice.toLocaleString()} د.ع`);
                      msgLines.push(`💰 الإجمالي: ${totalPrice.toLocaleString()} د.ع`);
                      if (notesVal) msgLines.push(`📝 ${notesVal}`);

                      if (selectedConversation && user) {
                        await supabase.from('listing_messages').insert({
                          conversation_id: selectedConversation,
                          sender_id: user.id,
                          content: msgLines.join('\n'),
                        });
                        queryClient.invalidateQueries({ queryKey: ['listing-messages', selectedConversation] });
                      }
                      toast.success('تم تحديث السعر بنجاح');
                      setAdminCartEditOpen(false);
                      setAdminCartRequest(null);
                    }}
                  >
                    <Check className="h-4 w-4" />
                    حفظ التعديل
                  </Button>
                  <Button variant="outline" onClick={() => setAdminCartEditOpen(false)}>
                    إلغاء
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ListingConversations;
