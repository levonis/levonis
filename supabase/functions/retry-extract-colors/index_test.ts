import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { normalizeVariantName, buildBambuVariantImageMap } from "./index.ts";

Deno.test("normalizeVariantName: trims and lowercases", () => {
  assertEquals(normalizeVariantName("  Red  "), "red");
});

Deno.test("normalizeVariantName: collapses NBSP and whitespace", () => {
  assertEquals(normalizeVariantName("Red\u00A0\u00A0(13100)"), "red(13100)");
  assertEquals(normalizeVariantName("Red \t\n (13100)"), "red(13100)");
});

Deno.test("normalizeVariantName: decodes HTML entities", () => {
  assertEquals(normalizeVariantName("Black &amp; White"), "black & white");
  assertEquals(normalizeVariantName("Caf&#233;"), "café");
  assertEquals(normalizeVariantName("Mint&nbsp;Green"), "mint green");
});

Deno.test("normalizeVariantName: decodes JSON unicode escapes", () => {
  assertEquals(normalizeVariantName("Caf\\u00e9"), "café");
});

Deno.test("normalizeVariantName: strips zero-width chars", () => {
  assertEquals(normalizeVariantName("Red\u200B\u200C"), "red");
});

Deno.test("normalizeVariantName: tightens hyphen spacing", () => {
  assertEquals(normalizeVariantName("Cool - Gray"), "cool-gray");
});

Deno.test("buildBambuVariantImageMap: maps propertyValue to main image, skips swatches", () => {
  const html = `
    {"propertyValue":"Red (13100)","imageUrl":"https://store.bblcdn.com/main/red.png"}
    {"propertyValue":"Blue","imageUrl":"https://store.bblcdn.com/swatch/blue.png"}
    {"propertyValue":"Green","mainImage":"https://store.bblcdn.com/products/green-main.png"}
  `;
  const map = buildBambuVariantImageMap(html);
  assertEquals(map.get("red(13100)"), "https://store.bblcdn.com/main/red.png");
  assertEquals(map.has("blue"), false); // swatch path filtered
  assertEquals(map.get("green"), "https://store.bblcdn.com/products/green-main.png");
});

Deno.test("buildBambuVariantImageMap: handles protocol-relative URLs", () => {
  const html = `{"propertyValue":"Yellow","imageUrl":"//store.bblcdn.com/p/yellow.png"}`;
  const map = buildBambuVariantImageMap(html);
  assertEquals(map.get("yellow"), "https://store.bblcdn.com/p/yellow.png");
});

Deno.test("buildBambuVariantImageMap: matches names with NBSP / entities equivalently", () => {
  const html = `{"propertyValue":"Mint&nbsp;Green","imageUrl":"https://store.bblcdn.com/p/mint.png"}`;
  const map = buildBambuVariantImageMap(html);
  // Lookup using the visually equivalent normalized form
  assertEquals(map.get(normalizeVariantName("Mint Green")), "https://store.bblcdn.com/p/mint.png");
});

Deno.test("buildBambuVariantImageMap: reverse order (image then propertyValue)", () => {
  const html = `{"imageUrl":"https://store.bblcdn.com/p/orange.png","propertyValue":"Orange"}`;
  const map = buildBambuVariantImageMap(html);
  assertEquals(map.get("orange"), "https://store.bblcdn.com/p/orange.png");
});

Deno.test("buildBambuVariantImageMap: ignores duplicate, keeps first", () => {
  const html = `
    {"propertyValue":"Red","imageUrl":"https://store.bblcdn.com/p/red1.png"}
    {"propertyValue":"Red","imageUrl":"https://store.bblcdn.com/p/red2.png"}
  `;
  const map = buildBambuVariantImageMap(html);
  assertEquals(map.get("red"), "https://store.bblcdn.com/p/red1.png");
});
