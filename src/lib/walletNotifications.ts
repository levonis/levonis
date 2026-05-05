import { supabase } from "@/integrations/supabase/client";

export interface WalletDeductionNotificationParams {
  userId: string;
  amount: number;
  summary: string; // short description of what was paid for
  link?: string; // in-app link to the order/booking
  relatedId?: string;
}

/**
 * Sends an instant in-app notification after a successful wallet deduction.
 * Includes amount, summary, and optional link to the related order/booking.
 * Non-blocking: errors are swallowed (notifications are a secondary side-effect).
 *
 * Uses the SECURITY DEFINER RPC create_notification_if_not_exists so it works
 * for regular users (notifications table INSERT is restricted to admins).
 */
export async function notifyWalletDeducted({
  userId,
  amount,
  summary,
  link,
  relatedId,
}: WalletDeductionNotificationParams): Promise<void> {
  try {
    const formattedAmount = `${Math.round(amount).toLocaleString()} د.ع`;
    const message = `${summary}\nالمبلغ المخصوم: ${formattedAmount}${link ? `\n🔗 ${link}` : ""}`;
    await supabase.rpc("create_notification_if_not_exists", {
      p_user_id: userId,
      p_title: "💳 تم الخصم من المحفظة",
      p_message: message,
      p_type: "wallet_update",
      p_related_id: relatedId ?? null,
      p_is_general: false,
    } as any);
  } catch (e) {
    console.error("notifyWalletDeducted failed:", e);
  }
}
