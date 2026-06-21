import { describe, it, expect } from "vitest";
import {
  computeLinkedDirectSalePrice,
  getGuardedCartItemPrice,
} from "@/lib/priceGuard";

/**
 * سيناريو: يحاكي تغيير نسبة COD من صفحة الإدارة (قيمة codDefaults.value)
 * ويتأكد أن السعر المباشر (direct_sale_price) المحسوب لايف يتغير فوراً
 * بدون أي قراءة من قاعدة البيانات أو إعادة تحميل.
 */

const baseProduct = {
  link_direct_commission_to_cod: true,
  has_pre_order: true,
  shipping_type: "sea" as const,
  price_usd: 10,
  personal_delivery_cost: 0,
  referral_earnings_iqd: 0,
  commission_sea_iqd: 1000,
  commission_air_iqd: 0,
  sea_price: 20000,
  air_price: 0,
  shipping_cost_iqd: 2000,
  round_up_price: false,
  direct_sale_price: 99999, // قيمة قديمة مخزّنة — يجب تجاهلها لمّا الربط مفعّل
  price: 15000,
};

const shipping = { usd_to_iqd_rate: 1500 };

describe("COD% live sync — direct sale price", () => {
  it("computeLinkedDirectSalePrice يتغير فوراً عند تغيير codDefaults.value", () => {
    const at5 = computeLinkedDirectSalePrice(baseProduct, shipping, {
      type: "percentage",
      value: 5,
    });
    const at10 = computeLinkedDirectSalePrice(baseProduct, shipping, {
      type: "percentage",
      value: 10,
    });
    const at20 = computeLinkedDirectSalePrice(baseProduct, shipping, {
      type: "percentage",
      value: 20,
    });

    expect(at5).not.toBeNull();
    expect(at10).not.toBeNull();
    expect(at20).not.toBeNull();
    // كلما زادت النسبة، زاد السعر
    expect(at10!).toBeGreaterThan(at5!);
    expect(at20!).toBeGreaterThan(at10!);
  });

  it("getGuardedCartItemPrice في وضع direct يطبّق COD% الحالي ويتجاهل القيمة المخزّنة", () => {
    const cartItem = {
      sale_type: "direct",
      products: baseProduct,
    };

    const priceAt5 = getGuardedCartItemPrice(cartItem, 1500, {
      type: "percentage",
      value: 5,
    });
    const priceAt15 = getGuardedCartItemPrice(cartItem, 1500, {
      type: "percentage",
      value: 15,
    });

    // لازم يتجاهل direct_sale_price المخزّن (99999) ويعتمد على الحساب الحي
    expect(priceAt5).not.toBe(99999);
    expect(priceAt15).not.toBe(99999);
    // التغيير في النسبة ينعكس فوراً على السعر
    expect(priceAt15).toBeGreaterThan(priceAt5);
  });

  it("النوع 'fixed' يُطبَّق مباشرة على رسوم COD", () => {
    const fixed500 = computeLinkedDirectSalePrice(baseProduct, shipping, {
      type: "fixed",
      value: 500,
    });
    const fixed5000 = computeLinkedDirectSalePrice(baseProduct, shipping, {
      type: "fixed",
      value: 5000,
    });
    expect(fixed5000! - fixed500!).toBe(5000 - 500);
  });

  it("بدون codDefaults أو سعر حي مع تفعيل الربط: يستخدم السعر المخزّن كاحتياط", () => {
    const cartItem = { sale_type: "direct", products: baseProduct };
    const guarded = getGuardedCartItemPrice(cartItem, 1500, null);
    expect(guarded).toBe(99999);
  });

  it("عندما الربط معطّل: يُستخدم direct_sale_price المخزّن كالمعتاد", () => {
    const unlinked = { ...baseProduct, link_direct_commission_to_cod: false };
    const cartItem = { sale_type: "direct", products: unlinked };
    const guarded = getGuardedCartItemPrice(cartItem, 1500, null);
    expect(guarded).toBe(99999);
  });

  it("سيناريو إدارة: محاكاة تغيير COD% من 5 → 8 → 12 على عدة منتجات في السلة", () => {
    const cart = [
      { sale_type: "direct", products: { ...baseProduct, price_usd: 10 } },
      { sale_type: "direct", products: { ...baseProduct, price_usd: 25 } },
      { sale_type: "direct", products: { ...baseProduct, price_usd: 50 } },
    ];

    const totals: number[] = [];
    for (const codValue of [5, 8, 12]) {
      const total = cart.reduce(
        (sum, item) =>
          sum +
          getGuardedCartItemPrice(item, 1500, {
            type: "percentage",
            value: codValue,
          }),
        0,
      );
      totals.push(total);
    }

    // كل تغيير في النسبة ينعكس فوراً على إجمالي السلة (تصاعدي)
    expect(totals[0]).toBeLessThan(totals[1]);
    expect(totals[1]).toBeLessThan(totals[2]);
  });
});
