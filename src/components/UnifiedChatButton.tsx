import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// Support account ID (admin) - used for identification only, chat bubble now visible for all users
const SUPPORT_USER_ID = "f632ba7b-60e7-4f2f-9cb7-2851f7f2ed2f";

export default function UnifiedChatButton() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Get unread count from community system
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

  // Hide for non-logged users
  if (!user) return null;
  
  // Hide on chats page itself
  if (location.pathname === '/chats' || location.pathname === '/community/messages') return null;

  // Only show on community main and main site pages
  const restrictedPaths = [
    '/community/merchant/store',
    '/community/merchant/orders',
    '/community/customer/track',
    '/user-info',
    '/settings',
    '/profile',
    '/games',
  ];
  const isOnRestrictedPage = restrictedPaths.some(p => location.pathname.startsWith(p));
  if (isOnRestrictedPage) return null;

  return (
    <Button
      onClick={() => navigate("/chats")}
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
  );
}

export { SUPPORT_USER_ID };
