// Tests for the variant→main-image mapping logic in retry-extract-colors.
//
// These tests verify two things:
//   1. buildBambuVariantImageMap() correctly extracts propertyValue ↔ main-image
//      pairs from RSC/JSON payloads while skipping swatch thumbnails.
//   2. parseBambuLabUnified() picks the variant's main product image when one
//      exists, and only falls back to the swatch when no main image is mapped.
//
// We intentionally use protocol-relative ("//store.bblcdn.com/...") swatch
// URLs in fixtures so the parser's swatch-hex sampler skips network I/O
// (it gates on swatchUrl.startsWith('http')).

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  buildBambuVariantImageMap,
  parseBambuLabUnified,
} from './index.ts';

// ---------- buildBambuVariantImageMap ----------

Deno.test('buildBambuVariantImageMap: extracts propertyValue → imageUrl pairs', () => {
  const html = `
    {"propertyValue":"Titan Gray (13108)","imageUrl":"https:\\/\\/store.bblcdn.com\\/main\\/titan-gray.jpg"}
    {"propertyValue":"Rose Gold (13206)","imageUrl":"https:\\/\\/store.bblcdn.com\\/main\\/rose-gold.jpg"}
  `;
  const map = buildBambuVariantImageMap(html);
  assertEquals(map.size, 2);
  assertEquals(map.get('titan gray (13108)'), 'https://store.bblcdn.com/main/titan-gray.jpg');
  assertEquals(map.get('rose gold (13206)'), 'https://store.bblcdn.com/main/rose-gold.jpg');
});

Deno.test('buildBambuVariantImageMap: also matches reverse field order', () => {
  const html = `
    {"imageUrl":"https://store.bblcdn.com/main/blue.jpg","propertyValue":"Blue (13604)"}
  `;
  const map = buildBambuVariantImageMap(html);
  assertEquals(map.get('blue (13604)'), 'https://store.bblcdn.com/main/blue.jpg');
});

Deno.test('buildBambuVariantImageMap: accepts mainImage / productImage / picUrl / image keys', () => {
  const html = `
    {"propertyValue":"A","mainImage":"https://store.bblcdn.com/a.jpg"}
    {"propertyValue":"B","productImage":"https://store.bblcdn.com/b.jpg"}
    {"propertyValue":"C","picUrl":"https://store.bblcdn.com/c.jpg"}
    {"propertyValue":"D","image":"https://store.bblcdn.com/d.jpg"}
  `;
  const map = buildBambuVariantImageMap(html);
  assertEquals(map.get('a'), 'https://store.bblcdn.com/a.jpg');
  assertEquals(map.get('b'), 'https://store.bblcdn.com/b.jpg');
  assertEquals(map.get('c'), 'https://store.bblcdn.com/c.jpg');
  assertEquals(map.get('d'), 'https://store.bblcdn.com/d.jpg');
});

Deno.test('buildBambuVariantImageMap: skips swatch URLs', () => {
  const html = `
    {"propertyValue":"Gold","imageUrl":"https://store.bblcdn.com/swatch/gold.png"}
    {"propertyValue":"Gold","imageUrl":"https://store.bblcdn.com/refill_pla_silk-swatch.png"}
    {"propertyValue":"Gold","imageUrl":"https://store.bblcdn.com/main/gold.jpg"}
  `;
  const map = buildBambuVariantImageMap(html);
  // Only the main-image URL should win (first non-swatch match per name).
  assertEquals(map.get('gold'), 'https://store.bblcdn.com/main/gold.jpg');
});

Deno.test('buildBambuVariantImageMap: skips non-http URLs', () => {
  const html = `{"propertyValue":"Pink","imageUrl":"data:image/png;base64,abc"}`;
  const map = buildBambuVariantImageMap(html);
  assertEquals(map.size, 0);
});

Deno.test('buildBambuVariantImageMap: first occurrence wins (does not overwrite)', () => {
  const html = `
    {"propertyValue":"X","imageUrl":"https://store.bblcdn.com/first.jpg"}
    {"propertyValue":"X","imageUrl":"https://store.bblcdn.com/second.jpg"}
  `;
  const map = buildBambuVariantImageMap(html);
  assertEquals(map.get('x'), 'https://store.bblcdn.com/first.jpg');
});

// ---------- parseBambuLabUnified end-to-end image mapping ----------

Deno.test('parseBambuLabUnified: variant uses MAIN product image, not swatch', async () => {
  const html = `
    <ul>
      <li value="Titan Gray (13108)"><img src="//store.bblcdn.com/swatch/titan-gray.png"></li>
      <li value="Rose Gold (13206)"><img src="//store.bblcdn.com/swatch/rose-gold.png"></li>
    </ul>
    <script>
      {"propertyValue":"Titan Gray (13108)","imageUrl":"https://store.bblcdn.com/main/titan-gray.jpg"}
      {"propertyValue":"Rose Gold (13206)","imageUrl":"https://store.bblcdn.com/main/rose-gold.jpg"}
    </script>
  `;
  const { colors } = await parseBambuLabUnified(html);
  assertEquals(colors.length, 2);
  const titan = colors.find((c: { name: string }) => c.name === 'Titan Gray (13108)')!;
  const rose = colors.find((c: { name: string }) => c.name === 'Rose Gold (13206)')!;
  assertEquals(titan.image_url, 'https://store.bblcdn.com/main/titan-gray.jpg');
  assertEquals(rose.image_url, 'https://store.bblcdn.com/main/rose-gold.jpg');
  // Sanity: must NOT be the swatch path.
  assertEquals(/swatch/.test(titan.image_url || ''), false);
  assertEquals(/swatch/.test(rose.image_url || ''), false);
});

Deno.test('parseBambuLabUnified: falls back to swatch when no main image is mapped', async () => {
  const html = `
    <ul>
      <li value="Mystery Color"><img src="//store.bblcdn.com/swatch/mystery.png"></li>
    </ul>
  `;
  const { colors } = await parseBambuLabUnified(html);
  assertEquals(colors.length, 1);
  // No RSC pair → must fall back to swatch (kept as-is).
  assertEquals(colors[0].image_url, '//store.bblcdn.com/swatch/mystery.png');
});

Deno.test('parseBambuLabUnified: non-color OPTIONS also receive their main image when mapped', async () => {
  const html = `
    <ul>
      <li value="Refill"><span>Refill</span></li>
      <li value="1 kg"><span>1 kg</span></li>
    </ul>
    <script>
      {"propertyValue":"Refill","imageUrl":"https://cdn.example.com/refill.jpg"}
    </script>
  `;
  const { colors, options } = await parseBambuLabUnified(html);
  assertEquals(colors.length, 0);
  assertEquals(options.length, 2);
  const refill = options.find((o: { name: string }) => o.name === 'Refill')!;
  const oneKg = options.find((o: { name: string }) => o.name === '1 kg')!;
  assertEquals(refill.image_url, 'https://cdn.example.com/refill.jpg');
  assertEquals(oneKg.image_url, null); // no mapping → null, not the swatch
});

Deno.test('parseBambuLabUnified: case-insensitive variant matching', async () => {
  const html = `
    <ul>
      <li value="TITAN GRAY"><img src="//store.bblcdn.com/swatch/tg.png"></li>
    </ul>
    <script>
      {"propertyValue":"titan gray","imageUrl":"https://store.bblcdn.com/main/tg.jpg"}
    </script>
  `;
  const { colors } = await parseBambuLabUnified(html);
  assertEquals(colors[0].image_url, 'https://store.bblcdn.com/main/tg.jpg');
});
