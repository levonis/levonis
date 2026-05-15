import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import { Heart, Wallet, ShoppingCart, Gift, Download, ShieldCheck, AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface DonationRow {
  id: string;
  user_id: string | null;
  display_name: string | null;
  amount: number;
  source: string;
  order_id: string | null;
  created_at: string;
}

const fmt = (n: number) => Math.round(Number(n) || 0).toLocaleString("ar-IQ");
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("ar-IQ", { dateStyle: "short", timeStyle: "short" });

const SOURCE_LABEL: Record<string, string> = {
  wallet_direct: "تبرع مباشر من المحفظة",
  order_auto: "تبرع تلقائي 1٪ من طلب",
  order_extra: "تبرع اختياري من السلة",
};
const SOURCE_ICON: Record<string, JSX.Element> = {
  wallet_direct: <Wallet className="h-3.5 w-3.5" />,
  order_auto: <ShoppingCart className="h-3.5 w-3.5" />,
  order_extra: <Gift className="h-3.5 w-3.5" />,
};

export default function AdminDonations() {
  const [tab, setTab] = useState<"all" | "wallet_direct" | "order_auto" | "order_extra">("all");

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-donations-log"],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("donations_log")
        .select("id,user_id,display_name,amount,source,order_id,created_at")
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      const list = (rows || []) as DonationRow[];

      // Verify all referenced orders are actually delivered
      const orderIds = Array.from(new Set(list.map(r => r.order_id).filter(Boolean) as string[]));
      let statusMap = new Map<string, string>();
      if (orderIds.length) {
        const { data: orders } = await supabase
          .from("orders")
          .select("id,status")
          .in("id", orderIds);
        (orders || []).forEach((o: any) => statusMap.set(o.id, o.status));
      }
      return { list, statusMap };
    },
    staleTime: 30_000,
  });

  const list = data?.list || [];
  const statusMap = data?.statusMap || new Map<string, string>();

  const verified = (r: DonationRow) => {
    if (!r.order_id) return r.source === "wallet_direct";
    const st = statusMap.get(r.order_id);
    return st === "delivered";
  };

  const filtered = useMemo(() => {
    if (tab === "all") return list;
    return list.filter(r => r.source === tab);
  }, [list, tab]);

  const stats = useMemo(() => {
    const sum = (s: string) =>
      list.filter(r => r.source === s && verified(r)).reduce((a, b) => a + Number(b.amount || 0), 0);
    return {
      total: sum("wallet_direct") + sum("order_auto") + sum("order_extra"),
      wallet: sum("wallet_direct"),
      auto: sum("order_auto"),
      extra: sum("order_extra"),
      orphan: list.filter(r => r.order_id && !verified(r)).length,
    };
  }, [list, statusMap]);

  const downloadCSV = () => {
    const header = ["id", "created_at", "source", "display_name", "user_id", "order_id", "amount_iqd", "verified", "order_status"];
    const rows = filtered.map(r => [
      r.id,
      r.created_at,
      r.source,
      (r.display_name || "").replace(/[\r\n",]/g, " "),
      r.user_id || "",
      r.order_id || "",
      String(r.amount),
      verified(r) ? "yes" : "no",
      r.order_id ? (statusMap.get(r.order_id) || "unknown") : "n/a",
    ]);
    const csv = [header, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `donations-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "تم تنزيل الملف" });
  };

  return (
    <div className="container max-w-6xl mx-auto p-4 space-y-4" dir="rtl">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Heart className="h-6 w-6 text-rose-500" /> سجل التبرعات (إدارة)
          </h1>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            تبرعات الطلبات تُحتسب فقط بعد تسليم الطلب (status = delivered).
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ml-1 ${isFetching ? "animate-spin" : ""}`} />
            تحديث
          </Button>
          <Button size="sm" onClick={downloadCSV} disabled={!filtered.length}>
            <Download className="h-4 w-4 ml-1" /> تنزيل CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="الإجمالي المعتمد" value={stats.total} icon={<Heart className="h-4 w-4" />} />
        <StatCard label="من المحفظة" value={stats.wallet} icon={<Wallet className="h-4 w-4" />} />
        <StatCard label="تلقائي 1٪ (مسلّم)" value={stats.auto} icon={<ShoppingCart className="h-4 w-4" />} />
        <StatCard label="اختياري (مسلّم)" value={stats.extra} icon={<Gift className="h-4 w-4" />} />
      </div>

      {stats.orphan > 0 && (
        <Card className="p-3 border-amber-500/40 bg-amber-500/5 flex items-center gap-2 text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          يوجد {stats.orphan} سجل/سجلات لطلبات غير مسلّمة (لن تُحتسب ضمن الإجمالي).
        </Card>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="all">الكل</TabsTrigger>
          <TabsTrigger value="wallet_direct">محفظة</TabsTrigger>
          <TabsTrigger value="order_auto">تلقائي 1٪</TabsTrigger>
          <TabsTrigger value="order_extra">اختياري</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-3">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : !filtered.length ? (
            <Card className="p-8 text-center text-muted-foreground">لا توجد سجلات.</Card>
          ) : (
            <div className="space-y-2">
              {filtered.map((r) => {
                const ok = verified(r);
                const status = r.order_id ? statusMap.get(r.order_id) : null;
                return (
                  <Card key={r.id} className="p-3 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0">
                      <Badge variant="outline" className="gap-1 shrink-0">
                        {SOURCE_ICON[r.source]} {SOURCE_LABEL[r.source] || r.source}
                      </Badge>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{r.display_name || "متبرع كريم"}</div>
                        <div className="text-xs text-muted-foreground">{fmtDate(r.created_at)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      {r.order_id && (
                        <span className="text-xs font-mono text-muted-foreground">
                          #{r.order_id.slice(0, 8).toUpperCase()}
                        </span>
                      )}
                      {r.order_id && (
                        <Badge variant={ok ? "default" : "destructive"} className="text-xs">
                          {status || "غير معروف"}
                        </Badge>
                      )}
                      {ok ? (
                        <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 gap-1">
                          <ShieldCheck className="h-3 w-3" /> معتمد
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-amber-600 border-amber-500/30">
                          <AlertTriangle className="h-3 w-3" /> غير محتسب
                        </Badge>
                      )}
                      <div className="font-bold text-rose-500">{fmt(r.amount)} د.ع</div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: JSX.Element }) {
  return (
    <Card className="p-3">
      <div className="text-xs text-muted-foreground flex items-center gap-1">{icon} {label}</div>
      <div className="text-xl font-bold mt-1">{fmt(value)} <span className="text-xs font-normal text-muted-foreground">د.ع</span></div>
    </Card>
  );
}
