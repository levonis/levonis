/**
 * Background image utilities for merchant store wallpapers.
 *
 * - `compressBackgroundToBest`: re-encodes user-uploaded images to the smallest
 *   modern format the current browser can produce (AVIF → WebP → JPEG fallback).
 * - `pickBackgroundUrl` / `buildBackgroundSrcSet`: leverage Supabase image
 *   transformations to serve right-sized variants without re-uploading.
 */
import { resizeSupabaseImage } from "./imageUtils";

export interface CompressedBackground {
  blob: Blob;
  mime: "image/avif" | "image/webp" | "image/jpeg";
  ext: "avif" | "webp" | "jpg";
  /** Original file size in bytes, for UX reporting. */
  originalBytes: number;
  /** Compressed size in bytes. */
  compressedBytes: number;
}

const MAX_INPUT_BYTES = 10 * 1024 * 1024; // 10 MB safety cap on the source file.

/** Snap viewport-derived widths to a small CDN-friendly ladder for caching. */
const RESPONSIVE_WIDTHS = [640, 960, 1280, 1600, 1920, 2560] as const;

async function loadBitmap(file: File): Promise<{ width: number; height: number; draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void; dispose: () => void }> {
  // Prefer createImageBitmap — handles EXIF orientation and decodes off-thread.
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, {
        imageOrientation: "from-image",
        premultiplyAlpha: "default",
      } as ImageBitmapOptions);
      return {
        width: bmp.width,
        height: bmp.height,
        draw: (ctx, w, h) => ctx.drawImage(bmp, 0, 0, w, h),
        dispose: () => bmp.close?.(),
      };
    } catch {
      /* fall through to <img> */
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
        draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
        dispose: () => URL.revokeObjectURL(url),
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), mime, quality));
}

/**
 * Re-encode an uploaded image into the smallest modern format the browser can
 * actually produce. Tries AVIF → WebP → JPEG. Always downscales the longest
 * edge to `maxSide` (default 1920) so we never store an oversized wallpaper.
 */
export async function compressBackgroundToBest(
  file: File,
  maxSide = 1920,
): Promise<CompressedBackground> {
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error(`حجم الصورة كبير جداً (${(file.size / 1024 / 1024).toFixed(1)}MB). الحد الأقصى 10MB.`);
  }

  const bmp = await loadBitmap(file);
  try {
    let w = bmp.width;
    let h = bmp.height;
    const longest = Math.max(w, h);
    if (longest > maxSide) {
      const ratio = maxSide / longest;
      w = Math.round(w * ratio);
      h = Math.round(h * ratio);
    }
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas غير مدعوم");
    bmp.draw(ctx, w, h);

    // Try formats in order of best compression. canvas.toBlob silently returns
    // null when the mime isn't supported, so we just chain fallbacks.
    const attempts: Array<{ mime: CompressedBackground["mime"]; ext: CompressedBackground["ext"]; quality: number }> = [
      { mime: "image/avif", ext: "avif", quality: 0.6 },
      { mime: "image/webp", ext: "webp", quality: 0.78 },
      { mime: "image/jpeg", ext: "jpg", quality: 0.85 },
    ];

    for (const a of attempts) {
      const blob = await canvasToBlob(canvas, a.mime, a.quality);
      if (blob && blob.type === a.mime && blob.size > 0) {
        return {
          blob,
          mime: a.mime,
          ext: a.ext,
          originalBytes: file.size,
          compressedBytes: blob.size,
        };
      }
    }
    throw new Error("فشل ضغط الصورة");
  } finally {
    bmp.dispose();
  }
}

/**
 * Pick the best Supabase-rendered URL for the current viewport.
 * Falls back to the original URL for non-Supabase storage hosts.
 */
export function pickBackgroundUrl(
  baseUrl: string | null | undefined,
  viewportWidth: number,
  dpr: number = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
  quality = 72,
): string | null {
  if (!baseUrl) return null;
  const target = Math.ceil(viewportWidth * Math.min(dpr, 2));
  const width = RESPONSIVE_WIDTHS.find((w) => w >= target) ?? RESPONSIVE_WIDTHS[RESPONSIVE_WIDTHS.length - 1];
  return resizeSupabaseImage(baseUrl, width, quality) ?? baseUrl;
}

/**
 * Build a `srcSet` string covering the responsive ladder. Returns empty string
 * for non-Supabase URLs (no transforms available).
 */
export function buildBackgroundSrcSet(
  baseUrl: string | null | undefined,
  quality = 72,
): string {
  if (!baseUrl) return "";
  if (!baseUrl.includes("supabase.co/storage")) return "";
  return RESPONSIVE_WIDTHS
    .map((w) => `${resizeSupabaseImage(baseUrl, w, quality)} ${w}w`)
    .join(", ");
}

export const BACKGROUND_RESPONSIVE_WIDTHS = RESPONSIVE_WIDTHS;
