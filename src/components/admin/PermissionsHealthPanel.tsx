import { useEffect, useState } from 'react';
import '@/styles/admin.css';
import { supabase } from '@/integrations/supabase/client';
import { ShieldAlert, ShieldCheck, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Permissions Health Panel
 * -------------------------
 * Runs lightweight probe SELECTs against admin pages' likely queries to detect
 * 403 / column-revoked errors (PostgREST 42501 / "permission denied"), and
 * shows which view should be used instead.
 *
 * Pure diagnostics: read-only, limit(1), no side effects.
 */

type Severity = 'ok' | 'fail' | 'warn';

interface ProbeResult {
  page: string;
  route: string;
  table: string;
  columns: string;
  status: Severity;
  message?: string;
  recommendedView?: string;
}

interface Probe {
  page: string;
  route: string;
  table: string;
  columns: string;
  recommendedView?: string;
}

// Probes mirror real admin queries. Each picks the most "sensitive" columns
// for that page so a column-revoked error is detected immediately.
const PROBES: Probe[] = [
  {
    page: 'إدارة الطلبات',
    route: '/orders',
    table: 'orders_admin',
    columns: 'id, total_amount, profit_amount, admin_product_cost, admin_shipping_cost',
  },
  {
    page: 'بنود الطلبات',
    route: '/orders',
    table: 'order_items_admin',
    columns: 'id, unit_price, total_price, cost_price',
  },
  {
    page: 'المنتجات / المخزون',
    route: '/inventory',
    table: 'products_admin',
    columns: 'id, name_ar, price, cost_price, commission_direct_iqd, shipping_cost_iqd',
  },
  {
    page: 'المالية',
    route: '/financials',
    table: 'products_admin',
    columns: 'id, price, cost_price, other_costs_iqd, personal_delivery_cost',
  },
  {
    page: 'المستخدمين',
    route: '/users',
    table: 'profiles',
    columns: 'id, username, full_name, phone_number',
  },
  {
    page: 'أدوار المستخدمين',
    route: '/users',
    table: 'user_roles',
    columns: 'user_id, role',
  },
  {
    page: 'المحفظة',
    route: '/wallet',
    table: 'wallet_transactions',
    columns: 'id, user_id, amount, type',
  },
  {
    page: 'الكوبونات',
    route: '/coupons',
    table: 'coupons',
    columns: 'id, code, discount_value, discount_type',
  },
  {
    page: 'بطاقات العضوية',
    route: '/loyalty-levels',
    table: 'membership_cards',
    columns: 'id, card_key, name_ar',
  },
];

const isPermissionError = (err: any): boolean => {
  if (!err) return false;
  const code = String(err.code || '');
  const msg = String(err.message || '').toLowerCase();
  return (
    code === '42501' ||
    code === 'PGRST301' ||
    msg.includes('permission denied') ||
    msg.includes('row-level security') ||
    msg.includes('not allowed')
  );
};

const runProbe = async (probe: Probe): Promise<ProbeResult> => {
  try {
    const { error } = await (supabase as any)
      .from(probe.table)
      .select(probe.columns)
      .limit(1);

    if (!error) {
      return { ...probe, status: 'ok' };
    }

    if (isPermissionError(error)) {
      return {
        ...probe,
        status: 'fail',
        message: error.message || 'permission denied (403)',
      };
    }

    return {
      ...probe,
      status: 'warn',
      message: error.message || 'unknown error',
    };
  } catch (e: any) {
    return {
      ...probe,
      status: 'warn',
      message: e?.message || 'network error',
    };
  }
};

export default function PermissionsHealthPanel() {
  const [results, setResults] = useState<ProbeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [lastRun, setLastRun] = useState<Date | null>(null);

  const run = async () => {
    setLoading(true);
    const out = await Promise.all(PROBES.map(runProbe));
    setResults(out);
    setLastRun(new Date());
    setLoading(false);
  };

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const failed = results.filter((r) => r.status === 'fail');
  const warned = results.filter((r) => r.status === 'warn');
  const allOk = results.length > 0 && failed.length === 0 && warned.length === 0;

  return (
    <div className="admin-card mb-6">
      <div className="admin-card-header">
        <div className="admin-card-title">
          {allOk ? (
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          ) : (
            <ShieldAlert className="h-4 w-4 text-amber-500" />
          )}
          حالة صلاحيات لوحة الإدارة
          {results.length > 0 && (
            <span className="ms-2 text-xs text-muted-foreground">
              {failed.length > 0
                ? `${failed.length} فشل`
                : warned.length > 0
                ? `${warned.length} تحذير`
                : 'جميع الفحوص ناجحة'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={run}
            disabled={loading}
            className="text-xs px-2 py-1 rounded-md border bg-background hover:bg-muted disabled:opacity-50 flex items-center gap-1"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            إعادة الفحص
          </button>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs px-2 py-1 rounded-md border bg-background hover:bg-muted flex items-center gap-1"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}
          </button>
        </div>
      </div>
      <div className="admin-card-content">
        {loading && results.length === 0 && (
          <div className="text-sm text-muted-foreground py-4 text-center">جاري فحص الصلاحيات...</div>
        )}

        {/* Failure summary always visible */}
        {failed.length > 0 && (
          <div className="space-y-2 mb-3">
            {failed.map((r, i) => (
              <div
                key={i}
                className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm"
              >
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="font-semibold text-destructive">
                    {r.page} <span className="text-xs font-normal opacity-70">({r.route})</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive text-destructive-foreground">
                    403
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground break-words">
                  <span className="font-mono">{r.table}</span> — {r.message}
                </div>
                {r.recommendedView && (
                  <div className="mt-2 text-xs">
                    استخدم بدلاً منها:{' '}
                    <code className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono">
                      {r.recommendedView}
                    </code>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Full table when expanded */}
        {expanded && results.length > 0 && (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-start p-2">الحالة</th>
                  <th className="text-start p-2">الصفحة</th>
                  <th className="text-start p-2">الجدول</th>
                  <th className="text-start p-2">الـ View الموصى به</th>
                  <th className="text-start p-2">الرسالة</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2">
                      {r.status === 'ok' && (
                        <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                          OK
                        </span>
                      )}
                      {r.status === 'fail' && (
                        <span className="px-1.5 py-0.5 rounded-full bg-destructive text-destructive-foreground">
                          403
                        </span>
                      )}
                      {r.status === 'warn' && (
                        <span className="px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
                          تحذير
                        </span>
                      )}
                    </td>
                    <td className="p-2">{r.page}</td>
                    <td className="p-2 font-mono">{r.table}</td>
                    <td className="p-2 font-mono text-emerald-600 dark:text-emerald-400">
                      {r.recommendedView || '—'}
                    </td>
                    <td className="p-2 text-muted-foreground break-all">{r.message || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {lastRun && (
          <div className="mt-3 text-[10px] text-muted-foreground text-end">
            آخر فحص: {lastRun.toLocaleTimeString('ar-IQ')}
          </div>
        )}
      </div>
    </div>
  );
}
