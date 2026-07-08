import { useEffect, useState } from "react";
import { toSignedStorageUrl } from "@/lib/signedStorageUrl";

/**
 * Resolves a stored (public-shaped) storage URL to a short-lived signed URL
 * for buckets in PRIVATE_BUCKETS. Non-private buckets are returned unchanged.
 */
export function useSignedStorageUrl(
  url: string | null | undefined,
): string | null {
  const [signed, setSigned] = useState<string | null>(url ?? null);

  useEffect(() => {
    let cancelled = false;
    if (!url) {
      setSigned(null);
      return;
    }
    // Optimistically render the original URL so we don't flash empty.
    setSigned(url);
    toSignedStorageUrl(url).then((u) => {
      if (!cancelled) setSigned(u);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return signed;
}
