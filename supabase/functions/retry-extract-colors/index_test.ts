import { assertEquals, assert } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  normalizeVariantName,
  buildBambuVariantImageMap,
  parseBambuLabUnified,
} from "./index.ts";

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

Deno.test("buildBambuVariantImageMap: prefers JSON-LD variant product images over swatch colorUrl", () => {
  const html = `
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "ProductGroup",
            "hasVariant": [
              {
                "@type": "Product",
                "name": "PLA Silk+ - Titan Gray (13108) / Filament with spool / 1 kg",
                "image": "https://store.bblcdn.com/products/titan-gray-main.jpg"
              }
            ]
          }
        ]
      }
    </script>
    {"propertyValue":"Titan Gray (13108)","colorUrl":"https://store.bblcdn.com/swatch/titan-gray.png"}
  `;
  const map = buildBambuVariantImageMap(html);
  assertEquals(map.get("titan gray(13108)"), "https://store.bblcdn.com/products/titan-gray-main.jpg");
});

Deno.test({
  name:
    "parseBambuLabUnified: never returns a /swatch/ image_url when a mapped main image exists",
  // The parser fires fetch() against swatch URLs to sample hex codes. Those are
  // unrelated to this assertion and would otherwise trip Deno's leak detector.
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    // Two variants ("Red", "Blue") expose swatch <img> tags inside <li value="...">
    // AND a non-swatch main product image via the JSON propertyValue mapping.
    // A third variant ("Yellow") only has a swatch — it should fall back to the swatch URL.
    const html = `
      <ul>
        <li value="Red"><img src="https://store.bblcdn.com/swatch/red-swatch.png" /></li>
        <li value="Blue"><img src="https://store.bblcdn.com/swatch/blue-swatch.png" /></li>
        <li value="Yellow"><img src="https://store.bblcdn.com/swatch/yellow-swatch.png" /></li>
      </ul>
      <script>
        {"propertyValue":"Red","imageUrl":"https://store.bblcdn.com/products/red-main.png"}
        {"propertyValue":"Blue","mainImage":"https://store.bblcdn.com/products/blue-main.png"}
      </script>
    `;
    const { colors } = await parseBambuLabUnified(html);

    // Sanity: all three variants parsed.
    assertEquals(colors.length, 3);

    const byName: Record<string, string | null> = {};
    for (const c of colors) byName[c.name] = c.image_url;

    // For variants with a mapped main image, the swatch path MUST NOT be used.
    const redImg = byName["Red"]!;
    const blueImg = byName["Blue"]!;
    assert(
      !redImg.includes("/swatch/"),
      `Red image should not be a swatch, got: ${redImg}`,
    );
    assert(
      !blueImg.includes("/swatch/"),
      `Blue image should not be a swatch, got: ${blueImg}`,
    );
    assertEquals(redImg, "https://store.bblcdn.com/products/red-main.png");
    assertEquals(blueImg, "https://store.bblcdn.com/products/blue-main.png");

    // Stronger global invariant: no color whose normalized name has a mapped main
    // image should ever surface a /swatch/ URL.
    const variantImages = buildBambuVariantImageMap(html);
    for (const c of colors) {
      const key = normalizeVariantName(c.name);
      if (variantImages.has(key)) {
        assert(
          !!c.image_url && !c.image_url.includes("/swatch/"),
          `Variant "${c.name}" has a mapped main image but parser kept swatch: ${c.image_url}`,
        );
      }
    }

    // Yellow has no main mapping, swatch fallback is acceptable.
    assert(byName["Yellow"]?.includes("/swatch/"));
  },
});
