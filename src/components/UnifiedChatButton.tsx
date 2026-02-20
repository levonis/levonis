import { useState, lazy, Suspense } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// Lazy load the conversations component for better performance
const ListingConversations = lazy(() => import("@/components/marketplace/ListingConversations").then(m => ({ default: m.ListingConversations })));

// Support account ID (admin) - used for identification only, chat bubble now visible for all users
const SUPPORT_USER_ID = "2ae7972f-6d1d-40fb-b73f-9fb72941f3f3";

export default function UnifiedChatButton() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Get unread count from community system
  const { data: totalUnread = 0, refetch: refetchUnread } = useQuery({
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

  const handleClose = (val: boolean) => {
    setOpen(val);
    if (!val) {
      // Refetch unread count when closing chat dialog
      refetchUnread();
    }
  };

  // Hide for non-logged users
  if (!user) return null;
  
  // Only show on community main and main site pages
  const restrictedPaths = [
    '/community/merchant/store',
    '/community/merchant/orders',
    '/community/customer/track',
    '/user-info',
    '/settings',
    '/profile',
  ];
  const isOnRestrictedPage = restrictedPaths.some(p => location.pathname.startsWith(p));
  if (isOnRestrictedPage && !open) return null;

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
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

      {/* Direct usage of ListingConversations which has its own Dialog */}
      {open && (
        <Suspense fallback={
          <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-6xl h-[90vh] flex items-center justify-center">
              <DialogTitle className="sr-only">المحادثات</DialogTitle>
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </DialogContent>
          </Dialog>
        }>
          <ListingConversations
            externalOpen={open}
            onExternalOpenChange={handleClose}
            onClose={() => handleClose(false)}
          />
        </Suspense>
      )}
    </>
  );
}

export { SUPPORT_USER_ID };
