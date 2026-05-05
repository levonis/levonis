/**
 * Edge-case tests for wallet deduction logic.
 *
 * These tests model the server-side `deduct_wallet_balance` RPC
 * (see supabase migration: SECURITY DEFINER, FOR UPDATE row lock,
 *  idempotency_key UNIQUE per user) as a faithful in-memory simulator,
 * then exercise it across:
 *   1. balance == required amount   (exact-spend boundary)
 *   2. balance <  required amount   (insufficient funds)
 *   3. concurrent / repeated calls with the same idempotency key
 *      (double-click / retry protection)
 *   4. concurrent calls WITHOUT idempotency keys racing on the same wallet
 *   5. invalid amounts (0, negative)
 *   6. unauthorized user mismatch
 *
 * Keeping the simulator in lock-step with the real SQL means a future
 * regression in the RPC can be reproduced here before it hits production.
 */
import { describe, it, expect, beforeEach } from 'vitest';

// ---------- In-memory model of deduct_wallet_balance ----------

interface WalletTx {
  id: string;
  user_id: string;
  amount: number;
  idempotency_key: string | null;
}

class WalletServer {
  wallets = new Map<string, number>();
  txs: WalletTx[] = [];
  // Per-user mutex to emulate `SELECT ... FOR UPDATE`
  private locks = new Map<string, Promise<unknown>>();
  private nextId = 1;

  setBalance(userId: string, balance: number) {
    this.wallets.set(userId, balance);
  }

  getBalance(userId: string) {
    return this.wallets.get(userId) ?? 0;
  }

  countTxsForKey(userId: string, key: string) {
    return this.txs.filter(t => t.user_id === userId && t.idempotency_key === key).length;
  }

  private async withLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.locks.get(userId) ?? Promise.resolve();
    let release!: () => void;
    const next = new Promise<void>(r => (release = r));
    this.locks.set(userId, prev.then(() => next));
    await prev;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  async deduct(opts: {
    authUid: string | null;
    userId: string;
    amount: number;
    idempotencyKey?: string | null;
  }): Promise<string> {
    const { authUid, userId, amount, idempotencyKey = null } = opts;

    if (!authUid || authUid !== userId) {
      throw new Error('Unauthorized: Cannot deduct from other users wallet');
    }
    if (amount <= 0) {
      throw new Error('Invalid amount: Must be positive');
    }

    return this.withLock(userId, async () => {
      // Idempotency short-circuit
      if (idempotencyKey && idempotencyKey.trim().length > 0) {
        const existing = this.txs.find(
          t => t.user_id === userId && t.idempotency_key === idempotencyKey,
        );
        if (existing) return existing.id;
      }

      const balance = this.wallets.get(userId);
      if (balance == null) {
        this.wallets.set(userId, 0);
        throw new Error('Insufficient wallet balance');
      }
      if (balance < amount) {
        throw new Error('Insufficient wallet balance');
      }

      this.wallets.set(userId, balance - amount);
      const tx: WalletTx = {
        id: `tx_${this.nextId++}`,
        user_id: userId,
        amount,
        idempotency_key: idempotencyKey,
      };
      this.txs.push(tx);
      return tx.id;
    });
  }
}

// ---------- Tests ----------

const USER = 'user-1';

describe('deduct_wallet_balance — edge cases', () => {
  let server: WalletServer;

  beforeEach(() => {
    server = new WalletServer();
  });

  it('succeeds when balance equals the required amount and zeroes the wallet', async () => {
    server.setBalance(USER, 1000);
    const txId = await server.deduct({ authUid: USER, userId: USER, amount: 1000 });
    expect(txId).toBeTruthy();
    expect(server.getBalance(USER)).toBe(0);
    expect(server.txs).toHaveLength(1);
  });

  it('rejects when balance is short by 1 IQD and leaves wallet untouched', async () => {
    server.setBalance(USER, 999);
    await expect(
      server.deduct({ authUid: USER, userId: USER, amount: 1000 }),
    ).rejects.toThrow(/Insufficient/i);
    expect(server.getBalance(USER)).toBe(999);
    expect(server.txs).toHaveLength(0);
  });

  it('idempotency: 5 concurrent calls with the same key produce ONE transaction and ONE deduction', async () => {
    server.setBalance(USER, 500);
    const calls = Array.from({ length: 5 }).map(() =>
      server.deduct({
        authUid: USER,
        userId: USER,
        amount: 100,
        idempotencyKey: 'order:abc',
      }),
    );
    const ids = await Promise.all(calls);
    // All return the same tx id
    expect(new Set(ids).size).toBe(1);
    expect(server.getBalance(USER)).toBe(400); // deducted ONCE
    expect(server.countTxsForKey(USER, 'order:abc')).toBe(1);
  });

  it('idempotency: sequential retries (e.g. failed network re-submit) never double-charge', async () => {
    server.setBalance(USER, 300);
    const a = await server.deduct({
      authUid: USER, userId: USER, amount: 100, idempotencyKey: 'retry:1',
    });
    const b = await server.deduct({
      authUid: USER, userId: USER, amount: 100, idempotencyKey: 'retry:1',
    });
    const c = await server.deduct({
      authUid: USER, userId: USER, amount: 100, idempotencyKey: 'retry:1',
    });
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(server.getBalance(USER)).toBe(200);
  });

  it('concurrent DIFFERENT orders without idempotency: each deducts atomically and balance never goes negative', async () => {
    server.setBalance(USER, 250);
    // Three parallel orders of 100 each — only two should fit
    const results = await Promise.allSettled([
      server.deduct({ authUid: USER, userId: USER, amount: 100 }),
      server.deduct({ authUid: USER, userId: USER, amount: 100 }),
      server.deduct({ authUid: USER, userId: USER, amount: 100 }),
    ]);
    const fulfilled = results.filter(r => r.status === 'fulfilled').length;
    const rejected = results.filter(r => r.status === 'rejected').length;
    expect(fulfilled).toBe(2);
    expect(rejected).toBe(1);
    expect(server.getBalance(USER)).toBe(50);
    expect(server.getBalance(USER)).toBeGreaterThanOrEqual(0);
  });

  it('rejects amount = 0 and amount < 0', async () => {
    server.setBalance(USER, 100);
    await expect(
      server.deduct({ authUid: USER, userId: USER, amount: 0 }),
    ).rejects.toThrow(/positive/i);
    await expect(
      server.deduct({ authUid: USER, userId: USER, amount: -50 }),
    ).rejects.toThrow(/positive/i);
    expect(server.getBalance(USER)).toBe(100);
  });

  it('rejects when authenticated user tries to deduct from another user’s wallet', async () => {
    server.setBalance('victim', 1000);
    await expect(
      server.deduct({ authUid: 'attacker', userId: 'victim', amount: 10 }),
    ).rejects.toThrow(/Unauthorized/i);
    expect(server.getBalance('victim')).toBe(1000);
  });

  it('missing wallet row → auto-creates with 0 balance and rejects insufficient', async () => {
    expect(server.wallets.has(USER)).toBe(false);
    await expect(
      server.deduct({ authUid: USER, userId: USER, amount: 10 }),
    ).rejects.toThrow(/Insufficient/i);
    expect(server.getBalance(USER)).toBe(0);
    expect(server.wallets.has(USER)).toBe(true);
  });
});
