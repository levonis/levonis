import { supabase } from '@/integrations/supabase/client';
import { PRINT_FILES_BUCKET } from '@/lib/printFiles';

/**
 * Lazy download: no file is fetched until the user explicitly clicks.
 */
export function usePrintFileDownload() {
  const download = async (storagePath: string, fileName?: string) => {
    const { data, error } = await supabase.storage
      .from(PRINT_FILES_BUCKET)
      .createSignedUrl(storagePath, 60);

    if (error || !data?.signedUrl) {
      throw error || new Error('Failed to create download link');
    }

    // Force a download without preloading the file.
    const a = document.createElement('a');
    a.href = data.signedUrl;
    if (fileName) a.download = fileName;
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return { download };
}
