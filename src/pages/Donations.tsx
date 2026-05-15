import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Heart, Wallet, Sparkles, Users, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";

const QUICK = [1000, 2000, 5000, 10000];

const fmt = (n: number) => Math.round(n).toLocaleString("ar-IQ");
const timeAgo = (iso: string) => {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return "الآن";
  if (m < 60) return `قبل ${m} د`;
  const h = Math.floor(m / 60);
  if (h < 24) return `قبل ${h} س`;
  const d = Math.floor(h / 24);
  return `قبل ${d} يوم`;
};
const sourceLabel = (s: string) =>
  s === "wallet_direct"
    ? "تبرع مباشر من المحفظة"
    : s === "order_extra"
    ? "تبرع إضافي مع طلب"
    : "1% تلقائي من طلب";

interface DonorRow {
  user_id: string | null;
  display_name: string | null;
  total_amount: number;
  donation_count: number;
  last_donation_at: string;
}

export default function Donations() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [amount, setAmount] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [pulseId, setPulseId] = useState<string | null>(null);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["donations-stats"],
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_donations_stats" as any);
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return {
        total: Number(row?.total_amount ?? 0),
        count: Number(row?.total_count ?? 0),
        donors: Number(row?.donor_count ?? 0),
      };
    },
  });

  const { data: feed, isLoading: feedLoading } = useQuery({
    queryKey: ["donations-feed"],
    staleTime: 10_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_recent_donors" as any, { p_limit: 50 });
      if (error) throw error;
      return (data ?? []) as unknown as DonorRow[];
    },
  });

  const { data: wallet } = useQuery({
    queryKey: ["donations-wallet", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_wallets")
        .select("balance")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  // Realtime: live feed + auto-refresh stats
  useEffect(() => {
    const ch = supabase
      .channel("donations-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "donations_log" },
        (payload) => {
          const row = payload.new as DonationRow;
          qc.setQueryData<DonationRow[]>(["donations-feed"], (prev) =>
            prev ? [row, ...prev].slice(0, 50) : [row]
          );
          qc.invalidateQueries({ queryKey: ["donations-stats"] });
          setPulseId(row.id);
          setTimeout(() => setPulseId(null), 1800);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const submitWalletDonation = async (val: number) => {
    if (!user) {
      toast({ title: "يرجى تسجيل الدخول", variant: "destructive" });
      return;
    }
    if (!val || val <= 0) {
      toast({ title: "أدخل مبلغاً صحيحاً", variant: "destructive" });
      return;
    }
    if ((wallet?.balance ?? 0) < val) {
      toast({ title: "رصيد المحفظة غير كافٍ", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("donate_from_wallet" as any, { p_amount: val });
      if (error) throw error;
      toast({ title: "🤍 شكراً لتبرعك", description: `تم خصم ${fmt(val)} د.ع من محفظتك` });
      setAmount("");
      qc.invalidateQueries({ queryKey: ["donations-wallet", user.id] });
    } catch (e: any) {
      const msg = e?.message?.includes("INSUFFICIENT_BALANCE")
        ? "رصيد المحفظة غير كافٍ"
        : e?.message?.includes("NO_WALLET")
        ? "لا توجد محفظة مفعّلة"
        : "تعذر إتمام التبرع";
      toast({ title: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen pb-24" dir="rtl">
      <main className="container mx-auto max-w-2xl px-4 pt-6 space-y-5">
        {/* Hero / total */}
        <section className="relative overflow-hidden rounded-3xl border border-border/40 bg-gradient-to-br from-rose-500/15 via-pink-500/10 to-amber-400/10 p-6 text-center backdrop-blur-xl">
          <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-rose-500/20 blur-3xl" />
          <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-amber-400/20 blur-3xl" />
          <div className="relative">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/20 text-rose-500">
              <Heart className="h-7 w-7 fill-current" />
            </div>
            <h1 className="mt-3 text-base font-semibold text-foreground/80">
              إجمالي التبرعات لمؤسسة العين/ودور الأيتام
            </h1>
            {statsLoading ? (
              <Skeleton className="mx-auto mt-2 h-10 w-48" />
            ) : (
              <div className="mt-2 text-4xl font-extrabold tracking-tight tabular-nums text-foreground">
                {fmt(stats?.total ?? 0)}
                <span className="ms-2 text-base font-medium text-muted-foreground">د.ع</span>
              </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              يحدّث مباشرةً مع كل طلب جديد وكل تبرع
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-border/40 bg-background/50 p-3">
                <Hash className="mx-auto h-4 w-4 text-muted-foreground" />
                <div className="mt-1 text-lg font-bold tabular-nums">
                  {statsLoading ? "—" : fmt(stats?.count ?? 0)}
                </div>
                <div className="text-[10px] text-muted-foreground">عملية تبرع</div>
              </div>
              <div className="rounded-2xl border border-border/40 bg-background/50 p-3">
                <Users className="mx-auto h-4 w-4 text-muted-foreground" />
                <div className="mt-1 text-lg font-bold tabular-nums">
                  {statsLoading ? "—" : fmt(stats?.donors ?? 0)}
                </div>
                <div className="text-[10px] text-muted-foreground">متبرع</div>
              </div>
            </div>
          </div>
        </section>

        {/* Wallet donate */}
        <section className="rounded-3xl border border-border/40 bg-card/60 p-5 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            <h2 className="text-sm font-semibold">تبرّع من المحفظة</h2>
            {user && (
              <span className="ms-auto text-[11px] text-muted-foreground tabular-nums">
                الرصيد: {fmt(Number(wallet?.balance ?? 0))} د.ع
              </span>
            )}
          </div>

          <div className="mt-3 grid grid-cols-4 gap-2">
            {QUICK.map((v) => (
              <button
                key={v}
                onClick={() => setAmount(String(v))}
                className={`rounded-xl border px-2 py-2 text-xs font-semibold tabular-nums transition active:scale-95 ${
                  Number(amount) === v
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/50 bg-background/40 hover:bg-background/70"
                }`}
              >
                {fmt(v)}
              </button>
            ))}
          </div>

          <div className="mt-3 flex gap-2">
            <Input
              type="number"
              inputMode="numeric"
              placeholder="أو أدخل مبلغاً مخصصاً"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
              className="text-sm"
            />
            <Button
              onClick={() => submitWalletDonation(Number(amount))}
              disabled={submitting || !user || !amount}
              className="gap-1.5"
            >
              <Heart className="h-4 w-4" />
              تبرّع
            </Button>
          </div>

          {!user && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              سجّل الدخول للتبرع من محفظتك. التبرعات في الطلبات تعمل بدون تسجيل دخول.
            </p>
          )}
        </section>

        {/* Live feed */}
        <section className="rounded-3xl border border-border/40 bg-card/60 p-5 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            <h2 className="text-sm font-semibold">سجل التبرعات المباشر</h2>
            <span className="ms-auto inline-flex items-center gap-1 text-[10px] text-emerald-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              مباشر
            </span>
          </div>

          <div className="mt-3 space-y-2">
            {feedLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))
            ) : feed && feed.length > 0 ? (
              feed.map((d) => (
                <div
                  key={d.id}
                  className={`flex items-center gap-3 rounded-xl border border-border/40 bg-background/40 p-3 transition ${
                    pulseId === d.id ? "ring-2 ring-rose-400/60 scale-[1.01]" : ""
                  }`}
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-500/10 text-rose-500">
                    <Heart className="h-4 w-4 fill-current" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 truncate text-sm font-medium">
                      <span className="truncate">{d.display_name || "متبرع كريم"}</span>
                      {d.order_id && (
                        <span className="shrink-0 rounded-md border border-border/50 bg-background/60 px-1.5 py-0.5 text-[9px] font-mono tabular-nums text-muted-foreground">
                          #{shortOrderId(d.order_id)}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {d.source === "order_auto" && (
                        <span className="text-emerald-600">1% تلقائي من الطلب</span>
                      )}
                      {d.source === "order_extra" && (
                        <span className="text-amber-600">تبرع إضافي مع الطلب</span>
                      )}
                      {d.source === "wallet_direct" && <span>تبرع مباشر من المحفظة</span>}
                      {" · "}
                      {timeAgo(d.created_at)}
                    </div>
                  </div>
                  <div className="text-sm font-bold tabular-nums text-rose-500">
                    +{fmt(Number(d.amount))} د.ع
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-muted-foreground">
                لا توجد تبرعات بعد — كن أول المتبرعين 🤍
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
