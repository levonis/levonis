import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { useQueryClient } from '@tanstack/react-query';

export const useOrderRealtimeNotifications = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;

    console.log('Setting up realtime subscription for orders...');

    const channel = supabase
      .channel('order-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Order update received:', payload);
          
          const newOrder = payload.new as any;
          const oldOrder = payload.old as any;

          // Check if status changed
          if (oldOrder.status !== newOrder.status) {
            const statusMessages: Record<string, { title: string; description: string }> = {
              confirmed: {
                title: '✅ تم تأكيد طلبك',
                description: `تم تأكيد طلب رقم ${newOrder.order_number}`
              },
              processing: {
                title: '⚙️ جاري تجهيز طلبك',
                description: `طلب رقم ${newOrder.order_number} قيد التجهيز`
              },
              shipped: {
                title: '🚚 تم شحن طلبك',
                description: `طلب رقم ${newOrder.order_number} في الطريق إليك`
              },
              delivered: {
                title: '🎉 تم توصيل طلبك',
                description: `طلب رقم ${newOrder.order_number} وصل بنجاح`
              },
              cancelled: {
                title: '❌ تم إلغاء الطلب',
                description: `طلب رقم ${newOrder.order_number} تم إلغاؤه`
              }
            };

            const message = statusMessages[newOrder.status];
            if (message) {
              toast({
                title: message.title,
                description: message.description,
                duration: 5000,
              });
            }
          }

          // Check if tracking number was added
          if (!oldOrder.tracking_number && newOrder.tracking_number) {
            toast({
              title: '📦 تم إضافة رقم التتبع',
              description: `يمكنك الآن تتبع طلب رقم ${newOrder.order_number}`,
              duration: 5000,
            });
          }

          // Invalidate queries to refresh data
          queryClient.invalidateQueries({ queryKey: ['my-orders'] });
          queryClient.invalidateQueries({ queryKey: ['order-detail', newOrder.id] });
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    return () => {
      console.log('Cleaning up realtime subscription...');
      supabase.removeChannel(channel);
    };
  }, [user, toast, queryClient]);
};
