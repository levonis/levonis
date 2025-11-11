import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { useQueryClient } from '@tanstack/react-query';

// Create audio instance for notifications
const notificationSound = new Audio('/sounds/notification.mp3');
notificationSound.volume = 0.5; // Set volume to 50%

const playNotificationSound = () => {
  // Reset audio to start and play
  notificationSound.currentTime = 0;
  notificationSound.play().catch((error) => {
    console.log('Could not play notification sound:', error);
  });
};

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

          let shouldPlaySound = false;

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
              arrived_warehouse: {
                title: '📦 وصل طلبك للمخزن',
                description: `طلب رقم ${newOrder.order_number} وصل إلى المخزن`
              },
              shipped: {
                title: '🚚 تم شحن طلبك',
                description: `طلب رقم ${newOrder.order_number} في الطريق إليك`
              },
              arrived_iraq: {
                title: '🇮🇶 وصل طلبك للعراق',
                description: `طلب رقم ${newOrder.order_number} وصل إلى العراق`
              },
              delivered: {
                title: '🎉 تم توصيل طلبك',
                description: `طلب رقم ${newOrder.order_number} وصل بنجاح - يرجى تأكيد الاستلام`
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
              shouldPlaySound = true;
            }
          }

          // Check if tracking number was added
          if (!oldOrder.tracking_number && newOrder.tracking_number) {
            toast({
              title: '📦 تم إضافة رقم التتبع',
              description: `يمكنك الآن تتبع طلب رقم ${newOrder.order_number}`,
              duration: 5000,
            });
            shouldPlaySound = true;
          }

          // Check if serial number image was added
          if (!oldOrder.serial_number_image_url && newOrder.serial_number_image_url) {
            toast({
              title: '📸 تم إضافة صورة Serial Number',
              description: `تمت إضافة صورة Serial Number لطلب رقم ${newOrder.order_number}`,
              duration: 5000,
            });
            shouldPlaySound = true;
          }

          // Play notification sound if any update occurred
          if (shouldPlaySound) {
            playNotificationSound();
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
