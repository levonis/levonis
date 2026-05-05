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
 * Includes amount, summary and optional link to the order/booking.
 * Non-blocking: errors are swallowed (notifications are a secondary side-effect).
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
    const message = `${summary}\nالمبلغ المخصوم: ${formattedAmount}${link ? `\nالرابط: ${link}` : ""}`;
    await supabase.from("notifications").insert({
      user_id: userId,
      title: "💳 تم الخصم من المحفظة",
      message,
      type: "wallet_update",
      related_id: relatedId ?? null,
      link: link ?? null,
    } as any);
  } catch (e) {
    console.error("notifyWalletDeducted failed:", e);
  }
}
