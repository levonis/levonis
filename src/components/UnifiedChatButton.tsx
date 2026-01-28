import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Headphones, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// Support account ID (admin)
const SUPPORT_USER_ID = "2ae7972f-6d1d-40fb-b73f-9fb72941f3f3";

export default function UnifiedChatButton() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [creatingSupport, setCreatingSupport] = useState(false);

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

  // Create or get support conversation and navigate
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
      setCreatingSupport(false);
      navigate(`/community/messages?auto_open=${convId}`);
      queryClient.invalidateQueries({ queryKey: ["listing-conversations"] });
    },
    onError: () => {
      setCreatingSupport(false);
      toast.error("فشل فتح محادثة الدعم");
    },
  });

  const handleClick = () => {
    // Navigate directly to messages page
    navigate("/community/messages");
  };

  const handleSupportClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setCreatingSupport(true);
    createSupportConversation.mutate();
  };

  if (!user) return null;

  return (
    <>
      {/* Floating Chat Button */}
      <div className="fixed bottom-6 left-4 sm:left-6 z-50 flex flex-col gap-2">
        {/* Support Quick Button */}
        <Button
          onClick={handleSupportClick}
          disabled={creatingSupport}
          className="h-10 w-10 rounded-full shadow-lg bg-muted hover:bg-muted/90 border border-primary/30"
          size="icon"
          title="خدمة العملاء"
        >
          {creatingSupport ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : (
            <Headphones className="h-4 w-4 text-primary" />
          )}
        </Button>

        {/* Main Chat Button */}
        <Button
          onClick={handleClick}
          className="h-14 w-14 rounded-full shadow-xl bg-primary hover:bg-primary/90 border-2 border-primary-foreground/20"
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
      </div>
    </>
  );
}
