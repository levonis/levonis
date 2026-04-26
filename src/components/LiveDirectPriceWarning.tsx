import { AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface LiveDirectPriceWarningProps {
  /** Whether the live computation returned null (missing inputs) */
  hasIssue: boolean;
  /** Snapshot of the inputs the calculator needs (for diagnostic display) */
  diagnostics: {
    price_usd?: number | null;
    usd_to_iqd_rate?: number | null;
    cod_value?: number | null;
    cod_type?: string | null;
  };
  /** Async refetch handler — re-fetches all inputs (settings + product) */
  onRetry: () => Promise<unknown> | unknown;
}

/**
 * Visual warning shown when a product is linked to global COD% but the
 * live direct sale price could not be computed (missing price_usd, exchange
 * rate, or COD settings). Includes a button to re-fetch and a status badge.
 */
const LiveDirectPriceWarning = ({
  hasIssue,
  diagnostics,
  onRetry,
}: LiveDirectPriceWarningProps) => {
  const [retrying, setRetrying] = useState(false);
  const [lastResult, setLastResult] = useState<'idle' | 'ok' | 'still-missing'>('idle');

  if (!hasIssue) return null;

  const missing: string[] = [];
  if (!diagnostics.price_usd || diagnostics.price_usd <= 0) missing.push('price_usd');
  if (!diagnostics.usd_to_iqd_rate || diagnostics.usd_to_iqd_rate <= 0) missing.push('usd_to_iqd_rate');
  if (!diagnostics.cod_value || diagnostics.cod_value <= 0) missing.push('COD %');

  const handleRetry = async () => {
    setRetrying(true);
    setLastResult('idle');
    try {
      await onRetry();
      // Caller should pass an updated `hasIssue` after refetch; we just
      // surface the latest status for UX feedback.
      setLastResult('still-missing');
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div
      role="alert"
      className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 my-2 flex flex-col gap-2"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
        <div className="flex-1 text-xs">
          <p className="font-bold text-destructive">
            تعذّر حساب السعر المباشر تلقائياً
          </p>
          <p className="text-foreground/70 mt-1">
            مدخلات ناقصة: <span className="font-mono">{missing.join('، ') || 'غير محدد'}</span>
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] text-muted-foreground font-mono">
          USD: {diagnostics.price_usd ?? '—'} · rate: {diagnostics.usd_to_iqd_rate ?? '—'} · COD: {diagnostics.cod_value ?? '—'}{diagnostics.cod_type === 'percentage' ? '%' : ''}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs gap-1"
          onClick={handleRetry}
          disabled={retrying}
        >
          {retrying ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              جارٍ المحاولة…
            </>
          ) : (
            <>
              <RefreshCw className="h-3 w-3" />
              إعادة المحاولة
            </>
          )}
        </Button>
      </div>

      {lastResult === 'still-missing' && !retrying && (
        <p className="text-[10px] text-destructive/80">
          لا تزال البيانات ناقصة. تواصل مع الإدارة لتحديث الإعدادات.
        </p>
      )}
    </div>
  );
};

export default LiveDirectPriceWarning;
