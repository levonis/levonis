import { supabase } from "@/integrations/supabase/client";

type NotificationType = 
  | 'new_message' 
  | 'order_status' 
  | 'admin_message' 
  | 'wallet_update'
  | 'merchant_update'
  | 'account_update'
  | 'general';

interface EmailNotificationParams {
  userId: string;
  notificationType: NotificationType;
  title: string;
  message: string;
  metadata?: {
    orderNumber?: string;
    senderName?: string;
    amount?: number;
    status?: string;
    link?: string;
  };
}

/**
 * Send email notification to user
 * This function calls the send-email-notification edge function
 * and handles errors gracefully (won't break the main flow)
 */
export async function sendEmailNotification({
  userId,
  notificationType,
  title,
  message,
  metadata,
}: EmailNotificationParams): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke('send-email-notification', {
      body: {
        user_id: userId,
        notification_type: notificationType,
        title,
        message,
        metadata: metadata ? {
          order_number: metadata.orderNumber,
          sender_name: metadata.senderName,
          amount: metadata.amount,
          status: metadata.status,
          link: metadata.link,
        } : undefined,
      },
    });

    if (error) {
      console.error('Email notification error:', error);
      return false;
    }

    if (data?.skipped) {
      console.log('Email skipped:', data.reason);
      return true;
    }

    console.log('Email sent successfully:', data?.email_id);
    return true;
  } catch (error) {
    console.error('Failed to send email notification:', error);
    return false;
  }
}

/**
 * Send all notifications (in-app and Telegram only)
 * Email is reserved ONLY for verification codes
 * Use this function instead of directly inserting into notifications table
 */
export async function sendAllNotifications({
  userId,
  title,
  message,
  type = 'info',
  relatedId,
}: {
  userId: string;
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  relatedId?: string;
}): Promise<void> {
  // 1. Create in-app notification
  await supabase.from('notifications').insert({
    user_id: userId,
    title,
    message,
    type,
    related_id: relatedId,
    is_general: false,
  });

  // 2. Send Telegram notification (fire and forget)
  // Email is NOT sent here - reserved only for verification codes
  supabase.functions.invoke('send-user-telegram-notification', {
    body: {
      user_id: userId,
      title,
      message,
      notification_type: type,
    },
  }).catch(err => console.error('Telegram notification failed:', err));
}
