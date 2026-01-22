import { Button } from '@/components/ui/button';
import { usePrintFileDownload } from '@/hooks/usePrintFileDownload';
import { Download, FileText } from 'lucide-react';
import { toast } from 'sonner';

export type PrintAttachment = {
  id: string;
  file_name: string;
  storage_path: string;
  file_size_bytes?: number | null;
  mime_type?: string | null;
};

function formatBytes(bytes?: number | null) {
  if (!bytes || bytes <= 0) return '';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)}MB`;
  const kb = bytes / 1024;
  return `${kb.toFixed(0)}KB`;
}

export function PrintAttachmentsList({ attachments }: { attachments: PrintAttachment[] }) {
  const { download } = usePrintFileDownload();

  if (!attachments?.length) return null;

  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold text-foreground">ملفات الطباعة</div>
      <div className="space-y-2">
        {attachments.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2"
          >
            <div className="min-w-0 flex items-center gap-2">
              <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center">
                <FileText className="h-4 w-4 text-foreground/70" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-foreground">{a.file_name}</div>
                <div className="text-xs text-muted-foreground">
                  {formatBytes(a.file_size_bytes)}
                </div>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-2"
              onClick={async () => {
                try {
                  await download(a.storage_path, a.file_name);
                } catch {
                  toast.error('تعذر تحميل الملف');
                }
              }}
            >
              <Download className="h-4 w-4" />
              تحميل
            </Button>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        ملاحظة: الملفات لا تُحمّل تلقائياً لتخفيف الضغط على الجهاز—يتم التحميل فقط عند الضغط.
      </p>
    </div>
  );
}
