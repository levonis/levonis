import { describe, it, expect } from "vitest";

/**
 * يحاكي منطق دالتي PostgreSQL:
 *   - get_user_card_cycle(p_card_id)
 *   - get_card_free_shipping_used(p_card_id)
 *
 * الهدف: التأكد أن عدد مرات الشحن المجاني المحسوب يقتصر على نافذة الدورة الحالية
 * [cycle_start, cycle_end) فقط، ولا يحتسب استخدامات الدورات السابقة، ويُعاد ضبط
 * المتبقي تلقائيًا عند بداية كل دورة جديدة.
 */

interface Card {
  purchasedAt: Date;
  expiresAt: Date;
  durationDays: number; // طول الدورة الواحدة (افتراضيًا 30)
}

interface CycleWindow {
  cycleStart: Date;
  cycleEnd: Date;
  cycleIndex: number;
  totalCycles: number;
}

/** يحاكي get_user_card_cycle */
function getUserCardCycle(card: Card, now: Date): CycleWindow {
  const dayMs = 86_400_000;
  const dur = Math.max(1, card.durationDays || 30);
  const total = Math.max(
    1,
    Math.ceil((card.expiresAt.getTime() - card.purchasedAt.getTime()) / (dur * dayMs))
  );
  let idx = Math.max(
    0,
    Math.floor((now.getTime() - card.purchasedAt.getTime()) / (dur * dayMs))
  );
  if (idx >= total) idx = total - 1;
  const start = new Date(card.purchasedAt.getTime() + idx * dur * dayMs);
  const end = new Date(card.purchasedAt.getTime() + (idx + 1) * dur * dayMs);
  return { cycleStart: start, cycleEnd: end, cycleIndex: idx, totalCycles: total };
}

/** يحاكي get_card_free_shipping_used: يعد فقط الاستخدامات داخل نافذة الدورة */
function countFreeShippingUsedInCycle(usages: Date[], cycle: CycleWindow): number {
  return usages.filter(
    (u) => u >= cycle.cycleStart && u < cycle.cycleEnd
  ).length;
}

/** المتبقي = max(0, max - used) */
function remaining(maxUses: number, used: number): number {
  return Math.max(0, maxUses - used);
}

describe("Card cycle — Free shipping usage window", () => {
  // بطاقة 10 أشهر = 300 يوم، دورة 30 يوم، أقصى 2 توصيل/دورة
  const purchasedAt = new Date("2026-01-01T00:00:00Z");
  const expiresAt = new Date("2026-10-28T00:00:00Z"); // ~300 يوم
  const card: Card = { purchasedAt, expiresAt, durationDays: 30 };
  const MAX_USES = 2;

  it("يحتسب استخدامات الدورة الحالية فقط ويتجاهل الدورات السابقة", () => {
    const now = new Date("2026-02-05T00:00:00Z"); // داخل الدورة 2 (يوم 35)
    const cycle = getUserCardCycle(card, now);

    const usages = [
      new Date("2026-01-05T00:00:00Z"), // الدورة 1
      new Date("2026-01-20T00:00:00Z"), // الدورة 1
      new Date("2026-02-02T00:00:00Z"), // الدورة 2
    ];

    const used = countFreeShippingUsedInCycle(usages, cycle);
    expect(cycle.cycleIndex).toBe(1); // دورة 2 (0-indexed)
    expect(used).toBe(1);
    expect(remaining(MAX_USES, used)).toBe(1);
  });

  it("يستنفد المتبقي عند الوصول للحد الأقصى داخل الدورة", () => {
    const now = new Date("2026-01-25T00:00:00Z"); // الدورة 1
    const cycle = getUserCardCycle(card, now);

    const usages = [
      new Date("2026-01-05T00:00:00Z"),
      new Date("2026-01-20T00:00:00Z"),
    ];
    const used = countFreeShippingUsedInCycle(usages, cycle);
    expect(used).toBe(2);
    expect(remaining(MAX_USES, used)).toBe(0); // ⇒ السلة لن تطبّق التوصيل المجاني
  });

  it("يُعاد ضبط العداد إلى 0 عند بداية الدورة التالية تلقائيًا", () => {
    const usages = [
      new Date("2026-01-05T00:00:00Z"),
      new Date("2026-01-20T00:00:00Z"), // كلاهما في الدورة 1
    ];

    // اليوم 31 — بداية الدورة 2
    const nowCycle2 = new Date("2026-02-01T00:00:00Z");
    const c2 = getUserCardCycle(card, nowCycle2);
    expect(c2.cycleIndex).toBe(1);

    const usedC2 = countFreeShippingUsedInCycle(usages, c2);
    expect(usedC2).toBe(0);
    expect(remaining(MAX_USES, usedC2)).toBe(MAX_USES); // عاد للسقف الكامل
  });

  it("لا يرحّل المتبقي غير المُستخدم من الدورة السابقة", () => {
    const usages = [new Date("2026-01-10T00:00:00Z")]; // 1 فقط في الدورة 1، تبقى 1

    const c2 = getUserCardCycle(card, new Date("2026-02-15T00:00:00Z"));
    const usedC2 = countFreeShippingUsedInCycle(usages, c2);
    // الدورة الجديدة سقفها 2 وليس 3
    expect(remaining(MAX_USES, usedC2)).toBe(2);
  });

  it("يحدّث العداد فورًا عند تسجيل استخدام جديد في الدورة الحالية", () => {
    const now = new Date("2026-02-10T00:00:00Z");
    const cycle = getUserCardCycle(card, now);

    const usages: Date[] = [];
    expect(countFreeShippingUsedInCycle(usages, cycle)).toBe(0);

    // محاكاة insert في loyalty_free_shipping_usage
    usages.push(new Date("2026-02-10T00:00:01Z"));
    expect(countFreeShippingUsedInCycle(usages, cycle)).toBe(1);
    expect(remaining(MAX_USES, 1)).toBe(1);

    usages.push(new Date("2026-02-10T00:00:02Z"));
    expect(countFreeShippingUsedInCycle(usages, cycle)).toBe(2);
    expect(remaining(MAX_USES, 2)).toBe(0); // استُنفد للدورة الحالية فقط
  });

  it("يستثني الاستخدامات على حدود النافذة بدقة (نهاية الدورة حصرية)", () => {
    const now = new Date("2026-01-15T00:00:00Z"); // الدورة 1
    const cycle = getUserCardCycle(card, now);
    expect(cycle.cycleStart.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(cycle.cycleEnd.toISOString()).toBe("2026-01-31T00:00:00.000Z");

    const usages = [
      new Date("2026-01-01T00:00:00Z"), // داخل (حد البداية شامل)
      new Date("2026-01-31T00:00:00Z"), // خارج (حد النهاية حصري)
    ];
    expect(countFreeShippingUsedInCycle(usages, cycle)).toBe(1);
  });

  it("يدعم 10 دورات متتابعة لبطاقة 10 أشهر بسقف مستقل لكل دورة", () => {
    const usagesAcrossCycles: Date[] = [];
    const usedPerCycle: number[] = [];
    for (let i = 0; i < 10; i++) {
      const midOfCycle = new Date(
        purchasedAt.getTime() + (i * 30 + 15) * 86_400_000
      );
      // محاكاة: استخدام 2 مرة في كل دورة
      usagesAcrossCycles.push(
        new Date(purchasedAt.getTime() + (i * 30 + 5) * 86_400_000),
        new Date(purchasedAt.getTime() + (i * 30 + 20) * 86_400_000)
      );
      const cycle = getUserCardCycle(card, midOfCycle);
      usedPerCycle.push(countFreeShippingUsedInCycle(usagesAcrossCycles, cycle));
    }
    // كل دورة ترى استخداميها فقط (2)، رغم تراكم 20 استخدامًا في القائمة
    expect(usedPerCycle).toEqual([2, 2, 2, 2, 2, 2, 2, 2, 2, 2]);
  });
});
