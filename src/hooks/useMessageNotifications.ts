import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';

const SUPPORT_USER_ID = 'f632ba7b-60e7-4f2f-9cb7-2851f7f2ed2f';

/**
 * Global hook that listens for new listing_messages via realtime
 * and shows browser notifications when the user is not viewing that conversation.
 */
export function useMessageNotifications(activeConversationId?: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const activeConvRef = useRef(activeConversationId);
  activeConvRef.current = activeConversationId;

  useEffect(() => {
    if (!user) return;

    const effectiveUserId = user.id;

    const channel = supabase
      .channel('global-message-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'listing_messages',
        },
        async (payload) => {
          const newMsg = payload.new as any;
          if (!newMsg) return;

          // Don't notify for own messages
          if (newMsg.sender_id === effectiveUserId || newMsg.sender_id === SUPPORT_USER_ID && user.id === SUPPORT_USER_ID) return;

          // Don't notify if viewing this conversation
          if (activeConvRef.current === newMsg.conversation_id) return;

          // Check if this message is in a conversation the user is part of
          const { data: conv } = await supabase
            .from('listing_conversations')
            .select('buyer_id, seller_id, conversation_code')
            .eq('id', newMsg.conversation_id)
            .single();

          if (!conv) return;
          if (conv.buyer_id !== effectiveUserId && conv.seller_id !== effectiveUserId) return;

          // Invalidate queries to update UI
          queryClient.invalidateQueries({ queryKey: ['listing-conversations'] });
          queryClient.invalidateQueries({ queryKey: ['last-messages'] });
          queryClient.invalidateQueries({ queryKey: ['marketplace-unread-users-count'] });

          // Show browser notification
          if (Notification.permission === 'granted') {
            const senderName = newMsg.sender_id === SUPPORT_USER_ID ? '🎧 خدمة العملاء' : 'مستخدم';
            const content = newMsg.content?.slice(0, 100) || '📷 وسائط';

            if ('serviceWorker' in navigator) {
              const reg = await navigator.serviceWorker.ready;
              reg.showNotification(`💬 ${senderName}`, {
                body: content,
                icon: '/icons/icon-192.png',
                badge: '/icons/icon-192.png',
                dir: 'rtl',
                lang: 'ar',
                tag: `msg-${newMsg.conversation_id}`,
                renotify: true,
                data: { url: `/community/messages?auto_open=${newMsg.conversation_id}` },
              } as NotificationOptions);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);
}
