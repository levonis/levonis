/**
 * Chat Commerce Hook - Taobao Style Order Management
 * Handles order creation, price modifications, approvals, and system messages
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

// Order Status Types
export type ChatOrderStatus = 
  | 'created'
  | 'waiting_seller_confirmation'
  | 'modification_proposed'
  | 'waiting_customer_approval'
  | 'approved'
  | 'waiting_payment'
  | 'paid'
  | 'shipped'
  | 'completed'
  | 'canceled';

// Role Types
export type ChatRole = 'seller' | 'customer';

// Message Types
export type ChatMessageType = 
  | 'text'
  | 'system'
  | 'product_card'
  | 'order_card'
  | 'confirmation_card'
  | 'media';

// Confirmation Change Types
export type ConfirmationChangeType = 'price_change' | 'notes_change' | 'shipping_change';

// Chat Order Interface
export interface ChatOrder {
  id: string;
  conversation_id: string;
  product_id: string;
  product_title: string;
  product_image?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes?: string;
  status: ChatOrderStatus;
  seller_id: string;
  customer_id: string;
  created_at: string;
  updated_at: string;
}

// Pending Modification Interface
export interface PendingModification {
  id: string;
  order_id: string;
  change_type: ConfirmationChangeType;
  old_value: string;
  new_value: string;
  seller_note?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

interface UseChatCommerceProps {
  conversationId: string | null;
  sellerId?: string;
  buyerId?: string;
}

export const useChatCommerce = ({ conversationId, sellerId, buyerId }: UseChatCommerceProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(false);

  // Determine user role
  const userRole: ChatRole = user?.id === sellerId ? 'seller' : 'customer';
  const isSeller = userRole === 'seller';
  const isCustomer = userRole === 'customer';

  // Fetch orders for this conversation using raw query
  const { data: orders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ['chat-orders', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      
      const { data, error } = await supabase
        .from('chat_orders' as any)
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching orders:', error);
        return [];
      }
      return (data || []) as unknown as ChatOrder[];
    },
    enabled: !!conversationId,
  });

  // Fetch pending modifications
  const { data: pendingModifications = [] } = useQuery({
    queryKey: ['chat-order-modifications', conversationId],
    queryFn: async () => {
      if (!conversationId || !orders.length) return [];
      
      const orderIds = orders.map(o => o.id);

      const { data, error } = await supabase
        .from('chat_order_modifications' as any)
        .select('*')
        .in('order_id', orderIds)
        .eq('status', 'pending');
      
      if (error) return [];
      return (data || []) as unknown as PendingModification[];
    },
    enabled: !!conversationId && orders.length > 0,
  });

  // Send System Message
  const sendSystemMessage = async (content: string) => {
    if (!conversationId || !user) return;

    await supabase.from('listing_messages').insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: `🔔 ${content}`,
    });

    queryClient.invalidateQueries({ queryKey: ['listing-messages', conversationId] });
  };

  // Create Order Mutation
  const createOrderMutation = useMutation({
    mutationFn: async ({ 
      productId, 
      productTitle, 
      productImage, 
      price, 
      quantity = 1 
    }: {
      productId: string;
      productTitle: string;
      productImage?: string;
      price: number;
      quantity?: number;
    }) => {
      if (!conversationId || !user) throw new Error('غير مصرح');
      
      setIsProcessing(true);

      // Create order using raw insert
      const { data: order, error } = await supabase
        .from('chat_orders' as any)
        .insert({
          conversation_id: conversationId,
          product_id: productId,
          product_title: productTitle,
          product_image: productImage,
          quantity,
          unit_price: price,
          total_price: price * quantity,
          seller_id: sellerId,
          customer_id: user.id,
          status: 'created',
        })
        .select()
        .single();

      if (error) throw error;

      // Send order card message
      const orderData = order as unknown as ChatOrder;
      await supabase.from('listing_messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: JSON.stringify({
          type: 'order_card',
          order_id: orderData.id,
          product_title: productTitle,
          product_image: productImage,
          quantity,
          total_price: price * quantity,
          status: 'created',
        }),
      });

      // Send system message
      await sendSystemMessage('تم إنشاء الطلب بنجاح. يمكن للبائع تأكيد التفاصيل أو تعديل السعر قبل الدفع.');

      // Send Telegram notification to merchant about new order
      if (sellerId) {
        supabase.functions.invoke('send-user-telegram-notification', {
          body: {
            user_id: sellerId,
            title: '🛒 طلب جديد',
            message: `لديك طلب جديد: ${productTitle} (${quantity} قطعة) بقيمة ${(price * quantity).toLocaleString()} د.ع`,
            notification_type: 'info',
          },
        }).catch(err => console.error('Telegram notify merchant failed:', err));
      }

      return orderData;
    },
    onSuccess: () => {
      toast.success('تم إنشاء الطلب بنجاح');
      queryClient.invalidateQueries({ queryKey: ['chat-orders', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['listing-messages', conversationId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
    onSettled: () => {
      setIsProcessing(false);
    },
  });

  // Propose Price Change Mutation (Seller Only)
  const proposePriceChangeMutation = useMutation({
    mutationFn: async ({ 
      orderId, 
      newPrice, 
      reason 
    }: {
      orderId: string;
      newPrice: number;
      reason?: string;
    }) => {
      if (!isSeller) throw new Error('غير مصرح - التاجر فقط يمكنه تعديل السعر');
      if (!conversationId || !user) throw new Error('غير مصرح');

      const order = orders.find(o => o.id === orderId);
      if (!order) throw new Error('الطلب غير موجود');

      setIsProcessing(true);

      // Create modification record
      const { data: modification, error: modError } = await supabase
        .from('chat_order_modifications' as any)
        .insert({
          order_id: orderId,
          change_type: 'price_change',
          old_value: order.total_price.toString(),
          new_value: newPrice.toString(),
          seller_note: reason,
          status: 'pending',
        })
        .select()
        .single();

      if (modError) throw modError;

      // Update order status
      await supabase
        .from('chat_orders' as any)
        .update({ status: 'waiting_customer_approval' })
        .eq('id', orderId);

      const modData = modification as unknown as PendingModification;

      // Send confirmation card message
      await supabase.from('listing_messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: JSON.stringify({
          type: 'confirmation_card',
          modification_id: modData.id,
          order_id: orderId,
          change_type: 'price_change',
          old_value: `${order.total_price.toLocaleString()} د.ع`,
          new_value: `${newPrice.toLocaleString()} د.ع`,
          seller_note: reason,
        }),
      });

      // Send system message
      await sendSystemMessage('تم اقتراح تعديل السعر. يرجى مراجعة التعديل والموافقة أو الرفض.');

      return modData;
    },
    onSuccess: () => {
      toast.success('تم إرسال اقتراح تعديل السعر');
      queryClient.invalidateQueries({ queryKey: ['chat-orders', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['chat-order-modifications', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['listing-messages', conversationId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
    onSettled: () => {
      setIsProcessing(false);
    },
  });

  // Approve Modification Mutation (Customer Only)
  const approveModificationMutation = useMutation({
    mutationFn: async ({ modificationId }: { modificationId: string }) => {
      if (!isCustomer) throw new Error('غير مصرح - الزبون فقط يمكنه الموافقة');
      if (!conversationId || !user) throw new Error('غير مصرح');

      const modification = pendingModifications.find(m => m.id === modificationId);
      if (!modification) throw new Error('التعديل غير موجود');

      setIsProcessing(true);

      // Update modification status
      await supabase
        .from('chat_order_modifications' as any)
        .update({ status: 'approved' })
        .eq('id', modificationId);

      // Apply the change to the order
      if (modification.change_type === 'price_change') {
        const newPrice = parseFloat(modification.new_value);
        await supabase
          .from('chat_orders' as any)
          .update({ 
            total_price: newPrice,
            status: 'waiting_payment' 
          })
          .eq('id', modification.order_id);
      }

      // Send system message
      await sendSystemMessage('تمت الموافقة على التعديل. يمكنك الآن إكمال الدفع.');
    },
    onSuccess: () => {
      toast.success('تمت الموافقة على التعديل');
      queryClient.invalidateQueries({ queryKey: ['chat-orders', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['chat-order-modifications', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['listing-messages', conversationId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
    onSettled: () => {
      setIsProcessing(false);
    },
  });

  // Reject Modification Mutation (Customer Only)
  const rejectModificationMutation = useMutation({
    mutationFn: async ({ modificationId }: { modificationId: string }) => {
      if (!isCustomer) throw new Error('غير مصرح - الزبون فقط يمكنه الرفض');
      if (!conversationId || !user) throw new Error('غير مصرح');

      const modification = pendingModifications.find(m => m.id === modificationId);
      if (!modification) throw new Error('التعديل غير موجود');

      setIsProcessing(true);

      // Update modification status
      await supabase
        .from('chat_order_modifications' as any)
        .update({ status: 'rejected' })
        .eq('id', modificationId);

      // Revert order status
      await supabase
        .from('chat_orders' as any)
        .update({ status: 'created' })
        .eq('id', modification.order_id);

      // Send system message
      await sendSystemMessage('تم رفض التعديل. الطلب يعود للحالة السابقة.');
    },
    onSuccess: () => {
      toast.success('تم رفض التعديل');
      queryClient.invalidateQueries({ queryKey: ['chat-orders', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['chat-order-modifications', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['listing-messages', conversationId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
    onSettled: () => {
      setIsProcessing(false);
    },
  });

  // Update Order Status Mutation
  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ 
      orderId, 
      status 
    }: {
      orderId: string;
      status: ChatOrderStatus;
    }) => {
      if (!conversationId || !user) throw new Error('غير مصرح');

      // Permission checks based on status
      const statusPermissions: Record<ChatOrderStatus, ChatRole[]> = {
        'created': ['customer'],
        'waiting_seller_confirmation': ['customer'],
        'modification_proposed': ['seller'],
        'waiting_customer_approval': ['seller'],
        'approved': ['customer'],
        'waiting_payment': ['customer', 'seller'],
        'paid': ['customer'],
        'shipped': ['seller'],
        'completed': ['customer'],
        'canceled': ['customer', 'seller'],
      };

      if (!statusPermissions[status]?.includes(userRole)) {
        throw new Error('غير مصرح لتغيير هذه الحالة');
      }

      setIsProcessing(true);

      // Fetch order details for notification
      const { data: orderDetail } = await supabase
        .from('chat_orders' as any)
        .select('product_title, customer_id, seller_id')
        .eq('id', orderId)
        .single();

      await supabase
        .from('chat_orders' as any)
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', orderId);

      // Status-specific messages
      const statusMessages: Partial<Record<ChatOrderStatus, string>> = {
        'paid': 'تم استلام الدفع بنجاح.',
        'shipped': 'تم شحن الطلب.',
        'completed': 'تم إكمال الطلب بنجاح. شكرًا لتعاملك معنا!',
        'canceled': 'تم إلغاء الطلب.',
      };

      if (statusMessages[status]) {
        await sendSystemMessage(statusMessages[status]!);
      }

      // Send Telegram notification to the other party
      if (orderDetail) {
        const od = orderDetail as any;
        const notifyUserId = isSeller ? od.customer_id : od.seller_id;
        const statusLabels: Partial<Record<ChatOrderStatus, string>> = {
          'approved': '✅ تم تأكيد طلبك',
          'shipped': '🚚 تم شحن طلبك',
          'completed': '🎉 تم إكمال الطلب',
          'canceled': '❌ تم إلغاء الطلب',
          'paid': '💰 تم استلام الدفع',
          'waiting_payment': '💳 بانتظار الدفع',
        };
        const notifTitle = statusLabels[status];
        if (notifTitle && notifyUserId) {
          supabase.functions.invoke('send-user-telegram-notification', {
            body: {
              user_id: notifyUserId,
              title: notifTitle,
              message: `طلب: ${od.product_title || 'منتج'}`,
              notification_type: status === 'canceled' ? 'error' : 'success',
            },
          }).catch(err => console.error('Telegram order status notify failed:', err));
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-orders', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['listing-messages', conversationId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
    onSettled: () => {
      setIsProcessing(false);
    },
  });

  // Send Welcome Message
  const sendWelcomeMessage = async () => {
    if (!conversationId || !user) return;

    await supabase.from('listing_messages').insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: 'مرحبًا 👋 أهلًا بك في متجرنا، كيف يمكنني مساعدتك اليوم؟',
    });

    queryClient.invalidateQueries({ queryKey: ['listing-messages', conversationId] });
  };

  return {
    // State
    userRole,
    isSeller,
    isCustomer,
    orders,
    loadingOrders,
    pendingModifications,
    isProcessing,

    // Actions
    createOrder: createOrderMutation.mutate,
    proposePriceChange: proposePriceChangeMutation.mutate,
    approveModification: approveModificationMutation.mutate,
    rejectModification: rejectModificationMutation.mutate,
    updateOrderStatus: updateOrderStatusMutation.mutate,
    sendSystemMessage,
    sendWelcomeMessage,

    // Mutation States
    isCreatingOrder: createOrderMutation.isPending,
    isProposingPrice: proposePriceChangeMutation.isPending,
    isApproving: approveModificationMutation.isPending,
    isRejecting: rejectModificationMutation.isPending,
  };
};

export default useChatCommerce;
