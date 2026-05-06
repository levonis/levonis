import { supabase } from '@/integrations/supabase/client';

/**
 * Insert order_items with retry + rollback safety.
 *
 * If the insert fails after all retries, the order is deleted and the wallet
 * (if charged) is auto-refunded so the user is never left with a paid empty
 * order. Returns true on success, false on failure (caller already saw a toast).
 */
export interface InsertOrderItemsOptions {
  orderId: string;
  orderNumber?: string | null;
  userId: string;
  walletDeductedAmount?: number; // amount to refund on failure
  refundIdempotencyKey?: string; // unique key for refund RPC
  refundReason?: string;
  maxAttempts?: number;
}

export async function insertOrderItemsWithRollback(
  orderItems: any[],
  opts: InsertOrderItemsOptions,
): Promise<{ ok: true } | { ok: false; error: any }> {
  const max = opts.maxAttempts ?? 3;
  let lastError: any = null;

  for (let attempt = 1; attempt <= max; attempt++) {
    const { error } = await supabase.from('order_items').insert(orderItems);
    if (!error) return { ok: true };
    lastError = error;
    console.error(`order_items insert attempt ${attempt}/${max} failed:`, error);
    if (attempt < max) {
      await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }

  // All retries failed → rollback.
  console.error('order_items insert failed after retries, rolling back order', {
    orderId: opts.orderId,
    orderNumber: opts.orderNumber,
    error: lastError,
  });

  // 1) Refund wallet if we charged it.
  if (opts.walletDeductedAmount && opts.walletDeductedAmount > 0) {
    try {
      await supabase.rpc('refund_wallet_balance' as any, {
        p_user_id: opts.userId,
        p_amount: opts.walletDeductedAmount,
        p_description:
          opts.refundReason ||
          `استرجاع تلقائي - فشل حفظ عناصر الطلب ${opts.orderNumber || opts.orderId}`,
        p_idempotency_key:
          opts.refundIdempotencyKey ||
          `refund:order_items_failed:${opts.orderNumber || opts.orderId}`,
      });
    } catch (refundErr) {
      console.error('Auto-refund after order_items failure failed:', refundErr);
    }
  }

  // 2) Delete the empty order so it does not appear in My Orders.
  try {
    await supabase.from('orders').delete().eq('id', opts.orderId);
  } catch (delErr) {
    console.error('Failed to delete empty order during rollback:', delErr);
  }

  // 3) Server-side log for admin diagnostics (non-blocking).
  try {
    await (supabase as any).rpc('log_order_error', {
      p_context: 'order_items_insert_failed',
      p_error_code: lastError?.code || null,
      p_error_message: lastError?.message || 'order_items insert failed',
      p_details: {
        order_id: opts.orderId,
        order_number: opts.orderNumber,
        wallet_refunded: opts.walletDeductedAmount || 0,
        items_count: orderItems.length,
        hint: lastError?.hint || null,
        details: lastError?.details || null,
      },
    });
  } catch {}

  return { ok: false, error: lastError };
}
