import { describe, it, expect } from 'vitest';

/**
 * Mirrors the SQL logic of public.notify_card_cycle_rollovers and the
 * BEFORE INSERT trigger notify_user_card_activated:
 *
 * - On new card insertion: emit "activation" notification, set
 *   last_notified_cycle_index = 0.
 * - Daily job: for each active card, compute current cycle_index from
 *   purchased_at + duration_days. If cycle_index > last_notified_cycle_index,
 *   emit "rollover" notification and bump last_notified_cycle_index.
 */

type Card = {
  id: string;
  purchased_at: Date;
  expires_at: Date | null;
  duration_days: number;
  is_active: boolean;
  last_notified_cycle_index: number;
};

type Notif = { card_id: string; kind: 'activation' | 'rollover'; cycle_index: number };

function getCycleIndex(card: Card, now: Date): number {
  const elapsedDays =
    (now.getTime() - card.purchased_at.getTime()) / (1000 * 60 * 60 * 24);
  const idx = Math.max(0, Math.floor(elapsedDays / card.duration_days));
  if (card.expires_at) {
    const total = Math.max(
      1,
      Math.ceil(
        (card.expires_at.getTime() - card.purchased_at.getTime()) /
          (1000 * 60 * 60 * 24 * card.duration_days)
      )
    );
    return Math.min(idx, total - 1);
  }
  return idx;
}

function activateCard(c: Omit<Card, 'last_notified_cycle_index'>, notifs: Notif[]): Card {
  notifs.push({ card_id: c.id, kind: 'activation', cycle_index: 0 });
  return { ...c, last_notified_cycle_index: 0 };
}

function runRolloverJob(cards: Card[], now: Date, notifs: Notif[]): number {
  let count = 0;
  for (const c of cards) {
    if (!c.is_active) continue;
    if (c.expires_at && c.expires_at <= now) continue;
    if (c.duration_days <= 0) continue;
    const idx = getCycleIndex(c, now);
    if (idx > c.last_notified_cycle_index) {
      notifs.push({ card_id: c.id, kind: 'rollover', cycle_index: idx });
      c.last_notified_cycle_index = idx;
      count++;
    }
  }
  return count;
}

const DAY = 24 * 60 * 60 * 1000;

describe('Card cycle notifications — last_notified_cycle_index dedup & trigger conditions', () => {
  it('emits activation notification once on new card insert', () => {
    const notifs: Notif[] = [];
    const card = activateCard(
      {
        id: 'c1',
        purchased_at: new Date('2026-01-01T00:00:00Z'),
        expires_at: new Date('2026-11-01T00:00:00Z'), // ~10 months
        duration_days: 30,
        is_active: true,
      },
      notifs
    );
    expect(card.last_notified_cycle_index).toBe(0);
    expect(notifs.filter(n => n.kind === 'activation')).toHaveLength(1);
  });

  it('does NOT emit rollover when still inside the first cycle', () => {
    const notifs: Notif[] = [];
    const card = activateCard(
      {
        id: 'c1',
        purchased_at: new Date('2026-01-01T00:00:00Z'),
        expires_at: new Date('2026-11-01T00:00:00Z'),
        duration_days: 30,
        is_active: true,
      },
      notifs
    );
    // Day 14
    const sent = runRolloverJob([card], new Date('2026-01-15T00:00:00Z'), notifs);
    expect(sent).toBe(0);
    expect(notifs.filter(n => n.kind === 'rollover')).toHaveLength(0);
    expect(card.last_notified_cycle_index).toBe(0);
  });

  it('emits exactly ONE rollover when crossing into cycle 2', () => {
    const notifs: Notif[] = [];
    const card = activateCard(
      {
        id: 'c1',
        purchased_at: new Date('2026-01-01T00:00:00Z'),
        expires_at: new Date('2026-11-01T00:00:00Z'),
        duration_days: 30,
        is_active: true,
      },
      notifs
    );
    // Day 31 — start of cycle 2 (index 1)
    runRolloverJob([card], new Date('2026-02-01T00:00:00Z'), notifs);
    expect(notifs.filter(n => n.kind === 'rollover')).toHaveLength(1);
    expect(card.last_notified_cycle_index).toBe(1);
  });

  it('does NOT re-emit rollover for the same cycle if job runs multiple times', () => {
    const notifs: Notif[] = [];
    const card = activateCard(
      {
        id: 'c1',
        purchased_at: new Date('2026-01-01T00:00:00Z'),
        expires_at: new Date('2026-11-01T00:00:00Z'),
        duration_days: 30,
        is_active: true,
      },
      notifs
    );
    runRolloverJob([card], new Date('2026-02-01T00:00:00Z'), notifs);
    runRolloverJob([card], new Date('2026-02-05T00:00:00Z'), notifs);
    runRolloverJob([card], new Date('2026-02-15T00:00:00Z'), notifs);
    runRolloverJob([card], new Date('2026-02-28T00:00:00Z'), notifs);
    expect(notifs.filter(n => n.kind === 'rollover')).toHaveLength(1);
    expect(card.last_notified_cycle_index).toBe(1);
  });

  it('emits one rollover per cycle across all 10 cycles of a 10-month card', () => {
    const notifs: Notif[] = [];
    const card = activateCard(
      {
        id: 'c1',
        purchased_at: new Date('2026-01-01T00:00:00Z'),
        expires_at: new Date(new Date('2026-01-01T00:00:00Z').getTime() + 300 * DAY),
        duration_days: 30,
        is_active: true,
      },
      notifs
    );
    // Run job daily for 300 days
    for (let d = 1; d <= 300; d++) {
      runRolloverJob([card], new Date(card.purchased_at.getTime() + d * DAY), notifs);
    }
    // Cycles 1..9 (indices 1..9) trigger rollover; index 0 was the activation
    const rollovers = notifs.filter(n => n.kind === 'rollover');
    expect(rollovers).toHaveLength(9);
    expect(rollovers.map(r => r.cycle_index)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(card.last_notified_cycle_index).toBe(9);
  });

  it('does not emit rollover for inactive or expired cards', () => {
    const notifs: Notif[] = [];
    const inactive: Card = {
      id: 'c1',
      purchased_at: new Date('2026-01-01T00:00:00Z'),
      expires_at: new Date('2026-11-01T00:00:00Z'),
      duration_days: 30,
      is_active: false,
      last_notified_cycle_index: 0,
    };
    const expired: Card = {
      id: 'c2',
      purchased_at: new Date('2026-01-01T00:00:00Z'),
      expires_at: new Date('2026-02-01T00:00:00Z'),
      duration_days: 30,
      is_active: true,
      last_notified_cycle_index: 0,
    };
    const sent = runRolloverJob(
      [inactive, expired],
      new Date('2026-06-01T00:00:00Z'),
      notifs
    );
    expect(sent).toBe(0);
    expect(notifs).toHaveLength(0);
  });

  it('redeeming a NEW code (separate user_card row) emits a fresh activation notification', () => {
    const notifs: Notif[] = [];
    // Old card runs through several cycles
    const oldCard = activateCard(
      {
        id: 'old',
        purchased_at: new Date('2026-01-01T00:00:00Z'),
        expires_at: new Date('2026-04-01T00:00:00Z'),
        duration_days: 30,
        is_active: true,
      },
      notifs
    );
    runRolloverJob([oldCard], new Date('2026-02-15T00:00:00Z'), notifs);
    expect(oldCard.last_notified_cycle_index).toBe(1);

    // User redeems code -> old card deactivated, new card row inserted
    oldCard.is_active = false;
    const newCard = activateCard(
      {
        id: 'new',
        purchased_at: new Date('2026-02-15T00:00:00Z'),
        expires_at: new Date(new Date('2026-02-15T00:00:00Z').getTime() + 300 * DAY),
        duration_days: 30,
        is_active: true,
      },
      notifs
    );
    expect(newCard.last_notified_cycle_index).toBe(0);
    const activations = notifs.filter(n => n.kind === 'activation');
    expect(activations).toHaveLength(2);
    expect(activations[1].card_id).toBe('new');

    // The new card should NOT immediately fire a rollover on insert day
    runRolloverJob([oldCard, newCard], new Date('2026-02-16T00:00:00Z'), notifs);
    expect(notifs.filter(n => n.kind === 'rollover' && n.card_id === 'new')).toHaveLength(0);
  });

  it('backfill semantics: existing card with last_notified_cycle_index=current does not re-fire', () => {
    const notifs: Notif[] = [];
    // Simulate backfill: card already in cycle 3, last_notified set to 3
    const card: Card = {
      id: 'c1',
      purchased_at: new Date('2026-01-01T00:00:00Z'),
      expires_at: new Date('2026-11-01T00:00:00Z'),
      duration_days: 30,
      is_active: true,
      last_notified_cycle_index: 3,
    };
    // Day 95 — still cycle 3 (index 3)
    runRolloverJob([card], new Date(card.purchased_at.getTime() + 95 * DAY), notifs);
    expect(notifs).toHaveLength(0);
    // Day 121 — crosses into cycle 5 (index 4)
    runRolloverJob([card], new Date(card.purchased_at.getTime() + 121 * DAY), notifs);
    expect(notifs.filter(n => n.kind === 'rollover')).toHaveLength(1);
    expect(card.last_notified_cycle_index).toBe(4);
  });

  it('skipping a day still emits exactly one rollover for the missed cycle', () => {
    const notifs: Notif[] = [];
    const card = activateCard(
      {
        id: 'c1',
        purchased_at: new Date('2026-01-01T00:00:00Z'),
        expires_at: new Date('2026-11-01T00:00:00Z'),
        duration_days: 30,
        is_active: true,
      },
      notifs
    );
    // Job runs 5 days late on day 35 — still only 1 rollover for cycle index 1
    runRolloverJob([card], new Date(card.purchased_at.getTime() + 35 * DAY), notifs);
    expect(notifs.filter(n => n.kind === 'rollover')).toHaveLength(1);
    expect(card.last_notified_cycle_index).toBe(1);
  });

  it('jumping multiple cycles (e.g. dormant 90 days) emits ONE rollover at the latest cycle', () => {
    const notifs: Notif[] = [];
    const card = activateCard(
      {
        id: 'c1',
        purchased_at: new Date('2026-01-01T00:00:00Z'),
        expires_at: new Date('2026-11-01T00:00:00Z'),
        duration_days: 30,
        is_active: true,
      },
      notifs
    );
    // Job runs once on day 95 → cycle index 3
    runRolloverJob([card], new Date(card.purchased_at.getTime() + 95 * DAY), notifs);
    const rollovers = notifs.filter(n => n.kind === 'rollover');
    expect(rollovers).toHaveLength(1);
    expect(rollovers[0].cycle_index).toBe(3);
    expect(card.last_notified_cycle_index).toBe(3);
  });
});
