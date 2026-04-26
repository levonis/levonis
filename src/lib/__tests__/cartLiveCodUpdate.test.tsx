import { describe, it, expect } from "vitest";
import { useState } from "react";
import { render, screen, act } from "@testing-library/react";
import { getGuardedCartItemPrice } from "@/lib/priceGuard";

/**
 * يحاكي صفحة السلة: نفس عنصر DOM (بنفس key/data-testid) يجب أن يُحدّث قيمته
 * مباشرة عند تغيير codDefaults.value (محاكاة تغيير الإدارة لنسبة COD)،
 * بدون unmount/remount.
 */
const cartProduct = {
  link_direct_commission_to_cod: true,
  has_pre_order: true,
  shipping_type: "sea" as const,
  price_usd: 20,
  personal_delivery_cost: 0,
  referral_earnings_iqd: 0,
  commission_sea_iqd: 1500,
  commission_air_iqd: 0,
  sea_price: 0,
  air_price: 0,
  shipping_cost_iqd: 3000,
  round_up_price: false,
  direct_sale_price: 88888,
  price: 30000,
};

function CartRow({
  codValue,
}: {
  codValue: number;
}) {
  const item = { sale_type: "direct", products: cartProduct };
  const price = getGuardedCartItemPrice(item, 1500, {
    type: "percentage",
    value: codValue,
  });
  return (
    <div>
      <span data-testid="cart-row-id">stable-row-1</span>
      <span data-testid="cart-price">{price}</span>
    </div>
  );
}

function CartHarness() {
  const [cod, setCod] = useState(5);
  return (
    <div>
      <button data-testid="set-10" onClick={() => setCod(10)}>10</button>
      <button data-testid="set-20" onClick={() => setCod(20)}>20</button>
      {/* Stable key — never remounts */}
      <CartRow key="row-1" codValue={cod} />
    </div>
  );
}

describe("Cart price live-updates with COD% (no remount)", () => {
  it("نفس عنصر DOM يُحدّث القيمة عند تغيير codDefaults.value", () => {
    render(<CartHarness />);

    const rowIdEl = screen.getByTestId("cart-row-id");
    const priceEl = screen.getByTestId("cart-price");

    const initialPrice = Number(priceEl.textContent);
    expect(initialPrice).toBeGreaterThan(0);
    expect(initialPrice).not.toBe(88888); // تجاهل القيمة المخزّنة

    // التقاط مرجع DOM للتأكد لاحقاً أنه نفس العنصر (بدون remount)
    const sameRowIdRef = rowIdEl;
    const samePriceRef = priceEl;

    // تغيير COD% إلى 10 — محاكاة تحديث الإدارة
    act(() => {
      screen.getByTestId("set-10").click();
    });

    const priceAt10 = Number(screen.getByTestId("cart-price").textContent);
    expect(priceAt10).toBeGreaterThan(initialPrice);

    // ✅ نفس عقدة DOM (لم يحدث unmount/remount → key مستقر)
    expect(screen.getByTestId("cart-row-id")).toBe(sameRowIdRef);
    expect(screen.getByTestId("cart-price")).toBe(samePriceRef);

    // تغيير ثانٍ إلى 20 — يجب أن يرتفع السعر مرة أخرى
    act(() => {
      screen.getByTestId("set-20").click();
    });

    const priceAt20 = Number(screen.getByTestId("cart-price").textContent);
    expect(priceAt20).toBeGreaterThan(priceAt10);

    // ولا يزال نفس العنصر
    expect(screen.getByTestId("cart-row-id")).toBe(sameRowIdRef);
    expect(screen.getByTestId("cart-price")).toBe(samePriceRef);
  });
});
