/**
 * Signed URL helper for PRIVATE storage buckets.
 *
 * Legacy code (and rows already stored in DB) hold full public URLs shaped like:
 *   https://<ref>.supabase.co/storage/v1/object/public/<bucket>/<path>
 *
 * Once we flip those buckets to private, that URL 404s. This helper extracts
 * bucket + path from the stored URL and returns a short-lived signed URL,
 * so display sites don't need to change how uploads are stored.
 *
 * Buckets NOT in PRIVATE_BUCKETS are returned unchanged (no wasted round-trip).
 */
import { supabase } from "@/integrations/supabase/client";

export const PRIVATE_BUCKETS = new Set<string>([
  "chat-images",
  "order-files",
  "serial-number-images",
]);

const SIGNED_TTL_SECONDS = 60 * 60; // 1 hour
const cache = new Map<string, { url: string; expiresAt: number }>();

function parseStorageUrl(input: string): { bucket: string; path: string } | null {
  // Match both public and signed URL patterns; also raw "bucket/path".
  const m = input.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/?#]+)\/([^?#]+)/);
  if (m) {
    return { bucket: m[1], path: decodeURIComponent(m[2]) };
  }
  return null;
}

export async function toSignedStorageUrl(
  input: string | null | undefined,
): Promise<string | null> {
  if (!input) return null;
  // Pass through data:/blob:/relative or non-storage URLs.
  if (input.startsWith("data:") || input.startsWith("blob:")) return input;
  const parsed = parseStorageUrl(input);
  if (!parsed) return input;
  if (!PRIVATE_BUCKETS.has(parsed.bucket)) return input;

  const key = `${parsed.bucket}/${parsed.path}`;
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now + 60_000) return cached.url;

  const { data, error } = await supabase.storage
    .from(parsed.bucket)
    .createSignedUrl(parsed.path, SIGNED_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    // Fallback to the original URL so behaviour degrades gracefully.
    return input;
  }
  cache.set(key, {
    url: data.signedUrl,
    expiresAt: now + SIGNED_TTL_SECONDS * 1000,
  });
  return data.signedUrl;
}
