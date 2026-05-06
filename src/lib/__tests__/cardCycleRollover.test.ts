import { describe, it, expect } from "vitest";

/**
 * يضمن أن الاستهلاك والحدود تُعاد تلقائياً عند الانتقال بين دورة وأخرى،
 * حتى لو تم تسجيل الاستخدام قبل/بعد منتصف الدورة بقليل، أو عند الحدود الدقيقة
 * (نهاية الدورة حصرية / بداية الدورة شاملة).
 */

interface Card {
  purchasedAt: Date;
  expiresAt: Date;
  durationDays: number;
}
interface Cycle {
  cycleStart: Date;
  cycleEnd: Date;
  cycleIndex: number;
  totalCycles: number;
}

const DAY = 86_400_000;

function getCycle(c: Card, now: Date): Cycle {
  const dur = Math.max(1, c.durationDays);
  const total = Math.max(1, Math.ceil((c.expiresAt.getTime() - c.purchasedAt.getTime()) / (dur * DAY)));
  let idx = Math.max(0, Math.floor((now.getTime() - c.purchasedAt.getTime()) / (dur * DAY)));
  if (idx >= total) idx = total - 1;
  return {
    cycleStart: new Date(c.purchasedAt.getTime() + idx * dur * DAY),
    cycleEnd: new Date(c.purchasedAt.getTime() + (idx + 1) * dur * DAY),
    cycleIndex: idx,
    totalCycles: total,
  };
}

function discountUsedInCycle(usages: Array<{ at: Date; amount: number }>, cy: Cycle) {
  return usages
    .filter((u) => u.at >= cy.cycleStart && u.at < cy.cycleEnd)
    .reduce((s, u) => s + u.amount, 0);
}
function shippingUsedInCycle(usages: Date[], cy: Cycle) {
  return usages.filter((u) => u >= cy.cycleStart && u < cy.cycleEnd).length;
}

describe("Cycle rollover — auto reset of consumption & limits", () => {
  // بطاقة 10 أشهر = 300 يوم، دورة 30 يوم
  const card: Card = {
    purchasedAt: new Date("2026-01-01T00:00:00Z"),
    expiresAt: new Date("2026-10-28T00:00:00Z"),
    durationDays: 30,
  };
  const DISC_CAP = 50_000;
  const SHIP_CAP = 2;

  it("استخدام قبل منتصف الدورة بقليل لا يُرحَّل للدورة التالية", () => {
    // الدورة 1: يوم 14 (قبل منتصف الدورة بـيوم)
    const usagesDisc = [{ at: new Date("2026-01-15T00:00:00Z"), amount: 40_000 }];
    const usagesShip = [new Date("2026-01-15T12:00:00Z")];

    const c1 = getCycle(card, new Date("2026-01-20T00:00:00Z"));
    expect(discountUsedInCycle(usagesDisc, c1)).toBe(40_000);
    expect(shippingUsedInCycle(usagesShip, c1)).toBe(1);

    // الدورة 2: العداد يجب أن يكون 0
    const c2 = getCycle(card, new Date("2026-02-01T00:00:01Z"));
    expect(c2.cycleIndex).toBe(1);
    expect(discountUsedInCycle(usagesDisc, c2)).toBe(0);
    expect(shippingUsedInCycle(usagesShip, c2)).toBe(0);
  });

  it("استخدام بعد منتصف الدورة بقليل (يوم 16) لا يُرحَّل أيضاً", () => {
    const usagesDisc = [{ at: new Date("2026-01-17T00:00:00Z"), amount: 35_000 }];
    const usagesShip = [new Date("2026-01-17T08:00:00Z"), new Date("2026-01-25T08:00:00Z")];

    const c1 = getCycle(card, new Date("2026-01-28T00:00:00Z"));
    expect(discountUsedInCycle(usagesDisc, c1)).toBe(35_000);
    expect(shippingUsedInCycle(usagesShip, c1)).toBe(2); // مستنفد

    const c2 = getCycle(card, new Date("2026-02-05T00:00:00Z"));
    expect(discountUsedInCycle(usagesDisc, c2)).toBe(0); // ✅ تجدد كامل
    expect(shippingUsedInCycle(usagesShip, c2)).toBe(0); // ✅ تجدد كامل
    expect(SHIP_CAP - shippingUsedInCycle(usagesShip, c2)).toBe(2);
    expect(DISC_CAP - discountUsedInCycle(usagesDisc, c2)).toBe(50_000);
  });

  it("استخدام تماماً عند نهاية الدورة (حد حصري) يُحسب على الدورة الجديدة", () => {
    // الحد cycleEnd حصري — استخدام عند 2026-01-31T00:00:00Z يجب أن يقع في الدورة 2
    const u = { at: new Date("2026-01-31T00:00:00Z"), amount: 10_000 };

    const c1 = getCycle(card, new Date("2026-01-20T00:00:00Z"));
    expect(c1.cycleEnd.toISOString()).toBe("2026-01-31T00:00:00.000Z");
    expect(discountUsedInCycle([u], c1)).toBe(0); // غير محسوب في الدورة 1

    const c2 = getCycle(card, new Date("2026-02-05T00:00:00Z"));
    expect(c2.cycleStart.toISOString()).toBe("2026-01-31T00:00:00.000Z");
    expect(discountUsedInCycle([u], c2)).toBe(10_000); // محسوب في الدورة 2
  });

  it("استخدام لحظي قبل ميلي ثانية من نهاية الدورة يبقى في الدورة الحالية", () => {
    const u = { at: new Date("2026-01-30T23:59:59.999Z"), amount: 7_500 };

    const c1 = getCycle(card, new Date("2026-01-30T20:00:00Z"));
    expect(discountUsedInCycle([u], c1)).toBe(7_500);

    const c2 = getCycle(card, new Date("2026-02-02T00:00:00Z"));
    expect(discountUsedInCycle([u], c2)).toBe(0); // ✅ لا يُرحَّل
  });

  it("التجدد التلقائي: ثلاث دورات متتابعة كل واحدة بسقفها المستقل", () => {
    const usagesDisc = [
      { at: new Date("2026-01-10T00:00:00Z"), amount: 50_000 }, // الدورة 1: مستنفد
      { at: new Date("2026-02-05T00:00:00Z"), amount: 20_000 }, // الدورة 2
      { at: new Date("2026-02-20T00:00:00Z"), amount: 25_000 }, // الدورة 2
      { at: new Date("2026-03-10T00:00:00Z"), amount: 5_000 },  // الدورة 3
    ];
    const usagesShip = [
      new Date("2026-01-05T00:00:00Z"), new Date("2026-01-25T00:00:00Z"), // الدورة 1: مستنفد
      new Date("2026-02-10T00:00:00Z"),                                    // الدورة 2: 1
      // الدورة 3: 0 — كامل
    ];

    const c1 = getCycle(card, new Date("2026-01-15T00:00:00Z"));
    const c2 = getCycle(card, new Date("2026-02-15T00:00:00Z"));
    const c3 = getCycle(card, new Date("2026-03-15T00:00:00Z"));

    expect([c1.cycleIndex, c2.cycleIndex, c3.cycleIndex]).toEqual([0, 1, 2]);

    // خصم
    expect(DISC_CAP - discountUsedInCycle(usagesDisc, c1)).toBe(0);     // مستنفد
    expect(DISC_CAP - discountUsedInCycle(usagesDisc, c2)).toBe(5_000); // 50K-45K
    expect(DISC_CAP - discountUsedInCycle(usagesDisc, c3)).toBe(45_000);

    // شحن مجاني
    expect(SHIP_CAP - shippingUsedInCycle(usagesShip, c1)).toBe(0);     // مستنفد
    expect(SHIP_CAP - shippingUsedInCycle(usagesShip, c2)).toBe(1);
    expect(SHIP_CAP - shippingUsedInCycle(usagesShip, c3)).toBe(2);     // كامل
  });

  it("الانتقال خلال نفس الثانية (يوم 30 → يوم 31): تجدّد فوري", () => {
    const usagesShip = [
      new Date("2026-01-30T23:59:00Z"), // الدورة 1
      new Date("2026-01-30T23:59:30Z"), // الدورة 1 — مستنفد
    ];

    const justBefore = getCycle(card, new Date("2026-01-30T23:59:59Z"));
    expect(shippingUsedInCycle(usagesShip, justBefore)).toBe(2);
    expect(SHIP_CAP - shippingUsedInCycle(usagesShip, justBefore)).toBe(0);

    const justAfter = getCycle(card, new Date("2026-01-31T00:00:00Z"));
    expect(justAfter.cycleIndex).toBe(1);
    expect(shippingUsedInCycle(usagesShip, justAfter)).toBe(0);
    expect(SHIP_CAP - shippingUsedInCycle(usagesShip, justAfter)).toBe(2); // ✅ كامل فوراً
  });

  it("الانتقال يحدث بدقة كل 30 يوم بصرف النظر عن أرقام الشهر الميلادي", () => {
    // البطاقة بدأت 1 يناير، لذا الدورات تنتهي في 31 يناير، 2 مارس، 1 أبريل…
    // (وليس بنهاية كل شهر تقويمي).
    const c2Start = getCycle(card, new Date("2026-02-15T00:00:00Z")).cycleStart;
    const c3Start = getCycle(card, new Date("2026-03-15T00:00:00Z")).cycleStart;

    expect(c2Start.toISOString()).toBe("2026-01-31T00:00:00.000Z");
    expect(c3Start.toISOString()).toBe("2026-03-02T00:00:00.000Z");
    // الفرق بالضبط 30 يوماً
    expect((c3Start.getTime() - c2Start.getTime()) / DAY).toBe(30);
  });
});
