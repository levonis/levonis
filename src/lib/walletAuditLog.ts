import { supabase } from "@/integrations/supabase/client";

export interface WalletDeductionBreakdown {
  subtotal?: number;          // products total deducted from wallet
  delivery_fee?: number;      // delivery portion deducted from wallet (0 if COD)
  discount?: number;          // coupon / discount applied
  coupon_code?: string | null;
  balance_before?: number;    // wallet balance before this deduction
  balance_after?: number;     // wallet balance after this deduction
  source: 'cart_direct_sale' | 'chat_order' | 'preorder' | 'community_offer' | 'merchant_ad' | string;
  notes?: string;
}

/**
 * Persist the link between a wallet_transactions row and its order, plus the
 * full breakdown of what was deducted. Non-blocking: errors are swallowed
 * because the actual money movement already succeeded.
 */
export async function linkWalletDeductionToOrder(params: {
  transactionId: string | null | undefined;
  orderId: string | null | undefined;
  breakdown: WalletDeductionBreakdown;
  balanceBefore?: number | null;
}): Promise<void> {
  const { transactionId, orderId, breakdown, balanceBefore } = params;
  if (!transactionId || !orderId) return;
  try {
    await supabase.rpc('link_wallet_tx_to_order' as any, {
      p_transaction_id: transactionId,
      p_order_id: orderId,
      p_breakdown: breakdown as any,
      p_balance_before: balanceBefore ?? breakdown.balance_before ?? null,
    });
  } catch (e) {
    console.error('linkWalletDeductionToOrder failed:', e);
  }
}
