export const PRINT_FILES_BUCKET = 'print-files' as const;

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

export type Print3DFileKind = 'stl' | 'obj';

export function inferPrint3DFileKind(fileName: string): Print3DFileKind | null {
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  if (ext === 'stl') return 'stl';
  if (ext === 'obj') return 'obj';
  return null;
}

export function validatePrint3DFile(file: File): { ok: true } | { ok: false; error: string } {
  const kind = inferPrint3DFileKind(file.name);
  if (!kind) {
    return { ok: false, error: 'الملف يجب أن يكون بصيغة STL أو OBJ' };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { ok: false, error: 'حجم الملف يجب أن يكون أقل من 20MB' };
  }

  return { ok: true };
}

/**
 * Store under: {userId}/print-requests/{requestId}/{timestamp}.{ext}
 * We intentionally keep userId as the first path segment to match storage RLS.
 */
export function buildPrint3DStoragePath(params: {
  userId: string;
  requestId: string;
  file: File;
}): string {
  const ext = (params.file.name.split('.').pop() || 'bin').toLowerCase();
  return `${params.userId}/print-requests/${params.requestId}/${Date.now()}.${ext}`;
}
