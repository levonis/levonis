import { describe, it, expect } from 'vitest';

/**
 * Timezone safety tests for cycle_index computation.
 *
 * The SQL function get_user_card_cycle uses EXTRACT(EPOCH FROM ...) which is
 * timezone-independent (epoch seconds since UTC). The JS mirror below also
 * uses Date.getTime() which returns UTC ms. These tests assert the result
 * is invariant across TZ changes via process.env.TZ.
 */

const DAY = 24 * 60 * 60 * 1000;

function computeCycleIndex(
  purchasedAt: Date,
  durationDays: number,
  now: Date,
  expiresAt: Date | null = null
): { cycle_index: number; total_cycles: number; cycle_start: Date; cycle_end: Date } {
  const elapsedSec = (now.getTime() - purchasedAt.getTime()) / 1000;
  const periodSec = durationDays * 86400;
  let idx = Math.max(0, Math.floor(elapsedSec / periodSec));
  let total = 1;
  if (expiresAt) {
    total = Math.max(
      1,
      Math.ceil((expiresAt.getTime() - purchasedAt.getTime()) / 1000 / periodSec)
    );
    if (idx >= total) idx = total - 1;
  }
  return {
    cycle_index: idx,
    total_cycles: total,
    cycle_start: new Date(purchasedAt.getTime() + idx * durationDays * DAY),
    cycle_end: new Date(purchasedAt.getTime() + (idx + 1) * durationDays * DAY),
  };
}

function withTZ<T>(tz: string, fn: () => T): T {
  const prev = process.env.TZ;
  process.env.TZ = tz;
  try {
    return fn();
  } finally {
    process.env.TZ = prev;
  }
}

const TIMEZONES = [
  'UTC',
  'Asia/Baghdad', // +03
  'America/Los_Angeles', // -08/-07
  'Asia/Tokyo', // +09
  'Pacific/Kiritimati', // +14
  'Pacific/Pago_Pago', // -11
  'Europe/London',
  'Australia/Sydney',
];

describe('Cycle index — timezone invariance', () => {
  it.each(TIMEZONES)('cycle_index identical at day 31 in TZ=%s', (tz) => {
    const purchased = new Date('2026-01-01T00:00:00Z');
    const expires = new Date('2026-11-01T00:00:00Z');
    const now = new Date('2026-02-01T00:00:00Z'); // exactly day 31

    const result = withTZ(tz, () =>
      computeCycleIndex(purchased, 30, now, expires)
    );
    expect(result.cycle_index).toBe(1);
    expect(result.total_cycles).toBe(11);
  });

  it('produces identical cycle_index across all TZs at multiple checkpoints', () => {
    const purchased = new Date('2026-01-01T00:00:00Z');
    const expires = new Date('2026-11-01T00:00:00Z');
    const checkpoints = [
      new Date('2026-01-15T00:00:00Z'), // day 14 → 0
      new Date('2026-02-01T00:00:00Z'), // day 31 → 1
      new Date('2026-04-15T00:00:00Z'), // day 104 → 3
      new Date('2026-09-30T00:00:00Z'), // day 272 → 9
    ];
    for (const now of checkpoints) {
      const results = TIMEZONES.map((tz) =>
        withTZ(tz, () => computeCycleIndex(purchased, 30, now, expires).cycle_index)
      );
      // All TZs must agree
      expect(new Set(results).size).toBe(1);
    }
  });

  it('cycle boundary near local midnight does not flip cycle in any TZ', () => {
    // Purchased Jan 1 UTC. Day 30 ends at Jan 31 00:00 UTC.
    // In Asia/Baghdad that's Jan 31 03:00 local; in LA that's Jan 30 16:00 local.
    // Cycle math must follow UTC, not local calendar.
    const purchased = new Date('2026-01-01T00:00:00Z');
    const justBefore = new Date('2026-01-30T23:59:59.999Z');
    const justAfter = new Date('2026-01-31T00:00:00Z');

    for (const tz of TIMEZONES) {
      const before = withTZ(tz, () =>
        computeCycleIndex(purchased, 30, justBefore).cycle_index
      );
      const after = withTZ(tz, () =>
        computeCycleIndex(purchased, 30, justAfter).cycle_index
      );
      expect(before).toBe(0);
      expect(after).toBe(1);
    }
  });

  it('DST spring-forward does not skip or duplicate a cycle (LA, Mar 2026)', () => {
    // DST in LA on 2026-03-08. Use a card whose cycle boundary falls inside.
    const purchased = new Date('2026-02-06T00:00:00Z');
    const beforeDst = new Date('2026-03-07T00:00:00Z'); // day 29 → 0
    const afterDst = new Date('2026-03-09T00:00:00Z'); // day 31 → 1

    const a = withTZ('America/Los_Angeles', () =>
      computeCycleIndex(purchased, 30, beforeDst).cycle_index
    );
    const b = withTZ('America/Los_Angeles', () =>
      computeCycleIndex(purchased, 30, afterDst).cycle_index
    );
    const aUtc = withTZ('UTC', () =>
      computeCycleIndex(purchased, 30, beforeDst).cycle_index
    );
    const bUtc = withTZ('UTC', () =>
      computeCycleIndex(purchased, 30, afterDst).cycle_index
    );
    expect(a).toBe(aUtc);
    expect(b).toBe(bUtc);
    expect(a).toBe(0);
    expect(b).toBe(1);
  });

  it('10-month card: cycle_index sequence over 300 days is identical across TZs', () => {
    const purchased = new Date('2026-01-01T00:00:00Z');
    const expires = new Date(purchased.getTime() + 300 * DAY);
    const sequences = TIMEZONES.map((tz) =>
      withTZ(tz, () => {
        const seq: number[] = [];
        for (let d = 0; d < 300; d++) {
          const now = new Date(purchased.getTime() + d * DAY);
          seq.push(computeCycleIndex(purchased, 30, now, expires).cycle_index);
        }
        return seq;
      })
    );
    // All sequences identical
    const ref = JSON.stringify(sequences[0]);
    for (let i = 1; i < sequences.length; i++) {
      expect(JSON.stringify(sequences[i])).toBe(ref);
    }
    // Sanity: index increments every 30 days
    expect(sequences[0][0]).toBe(0);
    expect(sequences[0][29]).toBe(0);
    expect(sequences[0][30]).toBe(1);
    expect(sequences[0][299]).toBe(9);
  });

  it('cycle_start and cycle_end timestamps match across TZs (epoch ms equal)', () => {
    const purchased = new Date('2026-01-01T00:00:00Z');
    const now = new Date('2026-04-15T12:34:56Z');
    const results = TIMEZONES.map((tz) =>
      withTZ(tz, () => computeCycleIndex(purchased, 30, now))
    );
    const refStart = results[0].cycle_start.getTime();
    const refEnd = results[0].cycle_end.getTime();
    for (const r of results) {
      expect(r.cycle_start.getTime()).toBe(refStart);
      expect(r.cycle_end.getTime()).toBe(refEnd);
    }
  });

  it('day-count between purchased_at and now is TZ-invariant', () => {
    const purchased = new Date('2026-01-01T00:00:00Z');
    const now = new Date('2026-06-15T18:00:00Z');
    const days = TIMEZONES.map((tz) =>
      withTZ(tz, () =>
        Math.floor((now.getTime() - purchased.getTime()) / DAY)
      )
    );
    expect(new Set(days).size).toBe(1);
    expect(days[0]).toBe(165);
  });
});
