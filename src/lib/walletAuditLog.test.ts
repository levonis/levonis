import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the supabase client BEFORE importing the module under test.
const rpcMock = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: (...args: any[]) => rpcMock(...args) },
}));

import { linkWalletDeductionToOrder } from './walletAuditLog';

/**
 * Simulates the SQL behaviour of `link_wallet_tx_to_order`:
 *   UPDATE wallet_transactions
 *      SET order_id      = COALESCE(order_id, p_order_id),
 *          breakdown     = COALESCE(breakdown, p_breakdown),
 *          balance_before= COALESCE(balance_before, p_balance_before)
 *
 * This is the contract every caller (Cart, Direct Sale, Chat, Preorder,
 * Community Offer, Merchant Ad) relies on.
 */
function makeFakeRpc() {
  const store = new Map<
    string,
    { order_id: string | null; breakdown: any; balance_before: number | null }
  >();
  return {
    store,
    rpc: vi.fn(async (_name: string, args: any) => {
      const row = store.get(args.p_transaction_id) ?? {
        order_id: null,
        breakdown: null,
        balance_before: null,
      };
      store.set(args.p_transaction_id, {
        order_id: row.order_id ?? args.p_order_id,
        breakdown: row.breakdown ?? args.p_breakdown,
        balance_before: row.balance_before ?? args.p_balance_before ?? null,
      });
      return { data: null, error: null };
    }),
  };
}

beforeEach(() => {
  rpcMock.mockReset();
});

describe('linkWalletDeductionToOrder — idempotency', () => {
  it('no-ops when transactionId or orderId is missing (all sources)', async () => {
    await linkWalletDeductionToOrder({
      transactionId: null,
      orderId: 'o1',
      breakdown: { source: 'cart_direct_sale' },
    });
    await linkWalletDeductionToOrder({
      transactionId: 't1',
      orderId: undefined,
      breakdown: { source: 'chat_order' },
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it.each([
    'cart_direct_sale',
    'chat_order',
    'preorder',
    'community_offer',
    'merchant_ad',
  ] as const)(
    'links once and ignores re-links for source=%s (COALESCE semantics)',
    async (source) => {
      const fake = makeFakeRpc();
      rpcMock.mockImplementation(fake.rpc);

      const tx = `tx-${source}`;
      const breakdown = {
        source,
        subtotal: 1000,
        delivery_fee: 0,
        balance_before: 5000,
        balance_after: 4000,
      };

      await linkWalletDeductionToOrder({
        transactionId: tx,
        orderId: 'order-A',
        breakdown,
        balanceBefore: 5000,
      });

      // Second invocation simulates a retry (network blip, double-submit, etc.).
      await linkWalletDeductionToOrder({
        transactionId: tx,
        orderId: 'order-B', // attempts to overwrite
        breakdown: { source, subtotal: 9999 },
        balanceBefore: 1,
      });

      const row = fake.store.get(tx);
      expect(rpcMock).toHaveBeenCalledTimes(2);
      // First-write-wins on every column (mirrors SQL COALESCE).
      expect(row?.order_id).toBe('order-A');
      expect(row?.breakdown).toEqual(breakdown);
      expect(row?.balance_before).toBe(5000);
    },
  );

  it('swallows RPC errors so order flow is not blocked', async () => {
    rpcMock.mockRejectedValueOnce(new Error('network down'));
    await expect(
      linkWalletDeductionToOrder({
        transactionId: 'tx1',
        orderId: 'o1',
        breakdown: { source: 'cart_direct_sale' },
      }),
    ).resolves.toBeUndefined();
  });
});
