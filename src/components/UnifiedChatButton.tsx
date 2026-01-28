import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Headphones, X, Loader2, ArrowRight, Send, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import AvatarWithFrame from "@/components/merchant/AvatarWithFrame";

// Support account ID (admin)
const SUPPORT_USER_ID = "2ae7972f-6d1d-40fb-b73f-9fb72941f3f3";

interface ConversationPreview {
  id: string;
  otherUser: {
    id: string;
    name: string;
    avatar?: string | null;
    frameUrl?: string | null;
    isSupport?: boolean;
  };
  lastMessage?: {
    content: string;
    createdAt: string;
    isRead: boolean;
    senderId: string;
  };
  unreadCount: number;
}

export default function UnifiedChatButton() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [creatingSupport, setCreatingSupport] = useState(false);

  // Fetch all conversations
  const { data: conversations, isLoading } = useQuery({
    queryKey: ["unified-chat-conversations", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("listing_conversations")
        .select("id, buyer_id, seller_id, conversation_code, updated_at, entry_context")
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user && isOpen,
  });

  // Get profiles for other users
  const { data: profiles } = useQuery({
    queryKey: ["unified-chat-profiles", conversations?.map(c => [c.buyer_id, c.seller_id]).flat()],
    queryFn: async () => {
      if (!conversations?.length) return {};
      
      const userIds = [...new Set(conversations.flatMap(c => [c.buyer_id, c.seller_id]))];
      
      // Get profiles
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name, username, avatar_url")
        .in("id", userIds);

      // Get merchant data
      const { data: merchantData } = await supabase
        .from("merchant_public_profiles")
        .select("id, display_name, store_image_url, selected_frame_id")
        .in("id", userIds);

      // Get frames
      const frameIds = merchantData?.map(m => m.selected_frame_id).filter(Boolean) as string[] || [];
      let framesMap: Record<string, string> = {};
      if (frameIds.length > 0) {
        const { data: frames } = await supabase
          .from("avatar_frames")
          .select("id, image_url")
          .in("id", frameIds);
        frames?.forEach(f => framesMap[f.id] = f.image_url);
      }

      const result: Record<string, any> = {};
      profilesData?.forEach(p => {
        const merchant = merchantData?.find(m => m.id === p.id);
        result[p.id] = {
          id: p.id,
          name: merchant?.display_name || p.full_name || p.username || "مستخدم",
          avatar: merchant?.store_image_url || p.avatar_url,
          frameUrl: merchant?.selected_frame_id ? framesMap[merchant.selected_frame_id] : null,
          isSupport: p.id === SUPPORT_USER_ID,
        };
      });

      return result;
    },
    enabled: !!conversations?.length,
  });

  // Get last messages
  const { data: lastMessages } = useQuery({
    queryKey: ["unified-chat-last-messages", conversations?.map(c => c.id)],
    queryFn: async () => {
      if (!conversations?.length) return {};
      
      const convIds = conversations.map(c => c.id);
      const { data, error } = await supabase
        .from("listing_messages")
        .select("conversation_id, content, created_at, sender_id, is_read")
        .in("conversation_id", convIds)
        .order("created_at", { ascending: false })
        .limit(convIds.length * 3);

      if (error) throw error;

      const result: Record<string, any> = {};
      for (const msg of data || []) {
        if (!result[msg.conversation_id]) {
          result[msg.conversation_id] = msg;
        }
      }
      return result;
    },
    enabled: !!conversations?.length,
    refetchInterval: isOpen ? 5000 : false,
  });

  // Get unread count
  const { data: totalUnread = 0 } = useQuery({
    queryKey: ["unified-chat-unread", user?.id],
    queryFn: async () => {
      if (!user) return 0;

      const { data: convs } = await supabase
        .from("listing_conversations")
        .select("id")
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`);

      if (!convs?.length) return 0;

      const { count } = await supabase
        .from("listing_messages")
        .select("id", { count: "exact", head: true })
        .in("conversation_id", convs.map(c => c.id))
        .neq("sender_id", user.id)
        .eq("is_read", false);

      return count || 0;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  // Create or get support conversation
  const createSupportConversation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      
      // Check if support conversation exists
      const { data: existing } = await supabase
        .from("listing_conversations")
        .select("id")
        .or(`and(buyer_id.eq.${user.id},seller_id.eq.${SUPPORT_USER_ID}),and(buyer_id.eq.${SUPPORT_USER_ID},seller_id.eq.${user.id})`)
        .maybeSingle();

      if (existing) return existing.id;

      // Create new support conversation
      const convCode = `SUPPORT-${Date.now().toString(36).toUpperCase()}`;
      const { data: newConv, error } = await supabase
        .from("listing_conversations")
        .insert([{
          buyer_id: user.id,
          seller_id: SUPPORT_USER_ID,
          listing_id: SUPPORT_USER_ID,
          conversation_code: convCode,
          status: "open",
        }])
        .select("id")
        .single();

      if (error) throw error;

      // Send welcome message
      await supabase.from("listing_messages").insert({
        conversation_id: newConv.id,
        sender_id: SUPPORT_USER_ID,
        content: "👋 مرحباً بك! كيف يمكنني مساعدتك اليوم؟",
      });

      return newConv.id;
    },
    onSuccess: (convId) => {
      setIsOpen(false);
      navigate(`/community/messages?auto_open=${convId}`);
      queryClient.invalidateQueries({ queryKey: ["unified-chat-conversations"] });
    },
    onError: () => {
      toast.error("فشل فتح محادثة الدعم");
    },
  });

  // Process conversations into previews
  const conversationPreviews: ConversationPreview[] = (conversations || []).map(conv => {
    const otherUserId = conv.buyer_id === user?.id ? conv.seller_id : conv.buyer_id;
    const otherProfile = profiles?.[otherUserId];
    const lastMsg = lastMessages?.[conv.id];
    
    const unreadCount = lastMsg && !lastMsg.is_read && lastMsg.sender_id !== user?.id ? 1 : 0;

    return {
      id: conv.id,
      otherUser: {
        id: otherUserId,
        name: otherProfile?.name || "مستخدم",
        avatar: otherProfile?.avatar,
        frameUrl: otherProfile?.frameUrl,
        isSupport: otherUserId === SUPPORT_USER_ID,
      },
      lastMessage: lastMsg ? {
        content: lastMsg.content,
        createdAt: lastMsg.created_at,
        isRead: lastMsg.is_read,
        senderId: lastMsg.sender_id,
      } : undefined,
      unreadCount,
    };
  });

  // Sort: Support first, then by last message
  const sortedPreviews = [...conversationPreviews].sort((a, b) => {
    if (a.otherUser.isSupport && !b.otherUser.isSupport) return -1;
    if (!a.otherUser.isSupport && b.otherUser.isSupport) return 1;
    return 0;
  });

  const hasSupportConversation = sortedPreviews.some(c => c.otherUser.isSupport);

  const handleOpenConversation = (convId: string) => {
    setIsOpen(false);
    navigate(`/community/messages?auto_open=${convId}`);
  };

  const handleSupportClick = () => {
    if (hasSupportConversation) {
      const supportConv = sortedPreviews.find(c => c.otherUser.isSupport);
      if (supportConv) {
        handleOpenConversation(supportConv.id);
      }
    } else {
      setCreatingSupport(true);
      createSupportConversation.mutate();
    }
  };

  if (!user) return null;

  return (
    <>
      {/* Floating Button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 left-4 sm:left-6 h-14 w-14 rounded-full shadow-xl z-50 bg-primary hover:bg-primary/90 border-2 border-primary-foreground/20"
        size="icon"
      >
        <div className="relative">
          <MessageCircle className="h-6 w-6 text-primary-foreground" />
          {totalUnread > 0 && (
            <span className="absolute -top-3 -right-3 bg-destructive text-destructive-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold animate-pulse">
              {totalUnread > 9 ? "9+" : totalUnread}
            </span>
          )}
        </div>
      </Button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-24 left-4 right-4 sm:left-6 sm:right-auto sm:w-[340px] max-h-[70vh] bg-background border-2 border-primary/40 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="bg-primary p-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary-foreground" />
              <span className="font-bold text-primary-foreground text-sm">المحادثات</span>
              {totalUnread > 0 && (
                <Badge className="bg-destructive text-destructive-foreground text-[10px] h-5">
                  {totalUnread}
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:bg-primary-foreground/20 text-primary-foreground"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Support Button - Always Visible */}
          <div className="p-2 border-b border-border/50 shrink-0">
            <button
              onClick={handleSupportClick}
              disabled={creatingSupport}
              className="w-full flex items-center gap-3 p-2.5 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/30 transition-colors"
            >
              <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center shrink-0">
                <Headphones className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="text-right flex-1 min-w-0">
                <p className="font-bold text-xs text-foreground">خدمة العملاء</p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {creatingSupport ? "جاري الاتصال..." : "تحدث مع فريق الدعم"}
                </p>
              </div>
              {creatingSupport ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
              ) : (
                <Send className="h-4 w-4 text-primary shrink-0" />
              )}
            </button>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : sortedPreviews.filter(c => !c.otherUser.isSupport).length === 0 ? (
              <div className="text-center py-8 px-4">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                  <Store className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">لا توجد محادثات</p>
                <p className="text-xs text-muted-foreground mt-1">
                  تواصل مع التجار من صفحات منتجاتهم
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {sortedPreviews
                  .filter(c => !c.otherUser.isSupport)
                  .map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => handleOpenConversation(conv.id)}
                      className="w-full flex items-center gap-2.5 p-3 hover:bg-muted/50 transition-colors text-right"
                    >
                      <AvatarWithFrame
                        imageUrl={conv.otherUser.avatar}
                        frameUrl={conv.otherUser.frameUrl}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-xs text-foreground truncate">
                            {conv.otherUser.name}
                          </span>
                          {conv.lastMessage && (
                            <span className="text-[9px] text-muted-foreground shrink-0">
                              {new Date(conv.lastMessage.createdAt).toLocaleDateString("ar-IQ")}
                            </span>
                          )}
                        </div>
                        {conv.lastMessage && (
                          <p className={cn(
                            "text-[10px] truncate mt-0.5",
                            conv.unreadCount > 0 ? "text-foreground font-medium" : "text-muted-foreground"
                          )}>
                            {conv.lastMessage.content}
                          </p>
                        )}
                      </div>
                      {conv.unreadCount > 0 && (
                        <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                          <span className="text-[9px] font-bold text-primary-foreground">
                            {conv.unreadCount}
                          </span>
                        </div>
                      )}
                    </button>
                  ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-2 border-t border-border/50 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-8 text-[10px] text-muted-foreground"
              onClick={() => {
                setIsOpen(false);
                navigate("/community/messages");
              }}
            >
              عرض كل المحادثات
              <ArrowRight className="h-3 w-3 mr-1" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
