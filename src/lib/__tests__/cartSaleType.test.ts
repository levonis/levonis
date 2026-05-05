import { describe, it, expect } from "vitest";
import {
  deriveCartSaleType,
  getItemSaleType,
  isSaleTypeBearingItem,
} from "../cartSaleType";

describe("isSaleTypeBearingItem", () => {
  it("returns true for product_id items", () => {
    expect(isSaleTypeBearingItem({ product_id: "p1" })).toBe(true);
  });
  it("returns true for bundle_id items", () => {
    expect(isSaleTypeBearingItem({ bundle_id: "b1" })).toBe(true);
  });
  it("returns true for rf_offer_id items", () => {
    expect(isSaleTypeBearingItem({ rf_offer_id: "rf1" })).toBe(true);
  });
  it("returns false for null/undefined", () => {
    expect(isSaleTypeBearingItem(null)).toBe(false);
    expect(isSaleTypeBearingItem(undefined)).toBe(false);
  });
  it("returns false when no linkable id is present", () => {
    expect(isSaleTypeBearingItem({ sale_type: "direct" })).toBe(false);
    expect(
      isSaleTypeBearingItem({
        product_id: null,
        bundle_id: null,
        rf_offer_id: null,
      }),
    ).toBe(false);
  });
});

describe("getItemSaleType", () => {
  it("returns 'direct' for explicit direct", () => {
    expect(getItemSaleType({ sale_type: "direct" })).toBe("direct");
  });
  it("returns 'preorder' for explicit preorder", () => {
    expect(getItemSaleType({ sale_type: "preorder" })).toBe("preorder");
  });
  it("falls back to 'preorder' when missing/null/unknown", () => {
    expect(getItemSaleType(null)).toBe("preorder");
    expect(getItemSaleType(undefined)).toBe("preorder");
    expect(getItemSaleType({})).toBe("preorder");
    expect(getItemSaleType({ sale_type: null })).toBe("preorder");
    expect(getItemSaleType({ sale_type: "weird" as any })).toBe("preorder");
  });
});

describe("deriveCartSaleType", () => {
  it("returns null for empty/null/undefined cart", () => {
    expect(deriveCartSaleType([])).toBeNull();
    expect(deriveCartSaleType(null)).toBeNull();
    expect(deriveCartSaleType(undefined)).toBeNull();
  });

  it("returns null when no item has a linkable id", () => {
    expect(
      deriveCartSaleType([{ sale_type: "direct" }, { sale_type: "preorder" }]),
    ).toBeNull();
  });

  it("derives from product_id item", () => {
    expect(
      deriveCartSaleType([{ product_id: "p1", sale_type: "direct" }]),
    ).toBe("direct");
  });

  it("derives from bundle_id item", () => {
    expect(
      deriveCartSaleType([{ bundle_id: "b1", sale_type: "preorder" }]),
    ).toBe("preorder");
  });

  it("derives from rf_offer_id item", () => {
    expect(
      deriveCartSaleType([{ rf_offer_id: "rf1", sale_type: "direct" }]),
    ).toBe("direct");
  });

  it("skips non-bearing items and uses the first bearer", () => {
    expect(
      deriveCartSaleType([
        { sale_type: "direct" }, // no link → skipped
        { rf_offer_id: "rf1", sale_type: "preorder" },
        { product_id: "p1", sale_type: "direct" },
      ]),
    ).toBe("preorder");
  });

  it("falls back to 'preorder' when bearer has no sale_type", () => {
    expect(deriveCartSaleType([{ product_id: "p1" }])).toBe("preorder");
    expect(
      deriveCartSaleType([{ rf_offer_id: "rf1", sale_type: null }]),
    ).toBe("preorder");
  });
});
