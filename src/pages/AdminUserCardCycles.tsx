import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, Loader2, RefreshCw, Search } from "lucide-react";
import { ADMIN_BASE_PATH } from "@/config/adminConfig";

interface SummaryRow {
  user_card_id: string;
  user_id: string;
  username: string | null;
  full_name: string | null;
  card_id: string;
  card_name_ar: string | null;
  card_name_en: string | null;
  card_key: string | null;
  purchased_at: string;
  expires_at: string | null;
  is_active: boolean;
  duration_days: number;
  total_cycles: number;
  current_cycle_index: number;
  cycle_start: string;
  cycle_end: string;
  days_left_in_cycle: number;
  days_left_in_card: number | null;
  validity_status: "active" | "expiring_soon" | "expired" | "inactive";
  redeemed_code: string | null;
  percentage_max_amount: number | null;
  percentage_used_in_cycle: number | null;
  percentage_remaining_in_cycle: number | null;
  free_shipping_max_uses: number | null;
  free_shipping_used_in_cycle: number;
  free_shipping_remaining_in_cycle: number | null;
}

const StatusBadge = ({ status }: { status: SummaryRow["validity_status"] }) => {
  const map: Record<string, { label: string; cls: string }> = {
    active:        { label: "فعّالة",         cls: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
    expiring_soon: { label: "تنتهي قريباً",   cls: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
    expired:       { label: "منتهية",          cls: "bg-rose-500/15 text-rose-700 border-rose-500/30" },
    inactive:      { label: "غير نشطة",       cls: "bg-muted text-muted-foreground border-border" },
  };
  const m = map[status] || map.active;
  return <Badge variant="outline" className={`text-[10px] ${m.cls}`}>{m.label}</Badge>;
};

const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString("ar-IQ") : "—";
const fmtNum = (n: number | null | undefined) => (n == null ? "—" : Number(n).toLocaleString("en-US"));

const AdminUserCardCycles = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [minDuration, setMinDuration] = useState<string>("0");
  const [onlyActive, setOnlyActive] = useState(true);

  const { data, isLoading, isFetching, refetch } = useQuery<SummaryRow[]>({
    queryKey: ["admin-user-card-cycles", search, minDuration, onlyActive],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc(
        "admin_get_user_card_cycles_summary",
        {
          p_search: search || null,
          p_min_duration_days: minDuration === "0" ? null : Number(minDuration),
          p_only_active: onlyActive,
        }
      );
      if (error) throw error;
      return (data || []) as SummaryRow[];
    },
    staleTime: 30 * 1000,
  });

  const rows = data || [];

  return (
    <div className="container max-w-7xl py-4 space-y-4" dir="rtl">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`${ADMIN_BASE_PATH}/loyalty-levels`)}
          >
            <ArrowRight className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">ملخص دورات بطاقات المستخدمين</h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="mr-1">تحديث</span>
        </Button>
      </div>

      <Card className="p-3 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <div className="md:col-span-2">
          <Label className="text-xs">بحث (اسم / username / user_id)</Label>
          <div className="flex gap-2 mt-1">
            <Input
              placeholder="اكتب ثم اضغط بحث..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setSearch(searchInput.trim())}
            />
            <Button size="icon" onClick={() => setSearch(searchInput.trim())}>
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div>
          <Label className="text-xs">الحد الأدنى لمدة البطاقة</Label>
          <Select value={minDuration} onValueChange={setMinDuration}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">الكل</SelectItem>
              <SelectItem value="60">≥ شهرين</SelectItem>
              <SelectItem value="180">≥ 6 أشهر</SelectItem>
              <SelectItem value="300">≥ 10 أشهر</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 pb-1">
          <Switch checked={onlyActive} onCheckedChange={setOnlyActive} id="active-only" />
          <Label htmlFor="active-only" className="text-xs cursor-pointer">
            البطاقات النشطة فقط
          </Label>
        </div>
      </Card>

      <Card className="p-3">
        <div className="text-xs text-muted-foreground mb-2">
          العدد: <span className="font-bold">{rows.length}</span> بطاقة
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">المستخدم</TableHead>
                <TableHead className="text-right">البطاقة</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-right">الدورة</TableHead>
                <TableHead className="text-right">أيام متبقية بالدورة</TableHead>
                <TableHead className="text-right">أيام متبقية بالبطاقة</TableHead>
                <TableHead className="text-right">سقف الخصم بالدورة</TableHead>
                <TableHead className="text-right">شحن مجاني بالدورة</TableHead>
                <TableHead className="text-right">الكود</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin inline" />
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground text-sm">
                    لا توجد بيانات
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => {
                const cyclePct = r.duration_days
                  ? Math.min(100, Math.max(0, ((r.duration_days - r.days_left_in_cycle) / r.duration_days) * 100))
                  : 0;
                const discPct = r.percentage_max_amount && r.percentage_max_amount > 0
                  ? Math.min(100, ((Number(r.percentage_used_in_cycle) || 0) / Number(r.percentage_max_amount)) * 100)
                  : 0;
                const shipPct = r.free_shipping_max_uses && r.free_shipping_max_uses > 0
                  ? Math.min(100, (r.free_shipping_used_in_cycle / r.free_shipping_max_uses) * 100)
                  : 0;
                return (
                  <TableRow key={r.user_card_id}>
                    <TableCell>
                      <div className="text-xs font-medium">{r.full_name || "—"}</div>
                      <div className="text-[10px] text-muted-foreground">@{r.username || r.user_id.slice(0, 8)}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs font-medium">{r.card_name_ar || r.card_name_en || r.card_key}</div>
                      <div className="text-[10px] text-muted-foreground">{r.duration_days} يوم/دورة</div>
                    </TableCell>
                    <TableCell><StatusBadge status={r.validity_status} /></TableCell>
                    <TableCell>
                      <div className="text-xs font-medium">
                        {r.current_cycle_index + 1} / {r.total_cycles}
                      </div>
                      <Progress value={cyclePct} className="h-1 mt-1 w-20" />
                    </TableCell>
                    <TableCell className="text-xs">
                      <span className={r.days_left_in_cycle <= 3 ? "text-amber-600 font-bold" : ""}>
                        {r.days_left_in_cycle} يوم
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.days_left_in_card == null ? "∞" : `${r.days_left_in_card} يوم`}
                    </TableCell>
                    <TableCell>
                      {r.percentage_max_amount == null ? (
                        <span className="text-[10px] text-muted-foreground">بلا سقف</span>
                      ) : (
                        <div className="text-xs">
                          <div>
                            {fmtNum(r.percentage_used_in_cycle)} / {fmtNum(r.percentage_max_amount)}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            متبقي: {fmtNum(r.percentage_remaining_in_cycle)}
                          </div>
                          <Progress value={discPct} className="h-1 mt-1 w-24" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.free_shipping_max_uses == null ? (
                        <span className="text-[10px] text-muted-foreground">—</span>
                      ) : (
                        <div className="text-xs">
                          <div>{r.free_shipping_used_in_cycle} / {r.free_shipping_max_uses}</div>
                          <div className="text-[10px] text-muted-foreground">
                            متبقي: {r.free_shipping_remaining_in_cycle}
                          </div>
                          <Progress value={shipPct} className="h-1 mt-1 w-24" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.redeemed_code ? (
                        <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">
                          {r.redeemed_code}
                        </code>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      <div className="text-[10px] text-muted-foreground text-center">
        البيانات محسوبة تلقائياً بناءً على نافذة الدورة الحالية (cycle window). الاستخدام السابق
        لدورات منتهية لا يُحسب ضمن المتبقي.
      </div>
    </div>
  );
};

export default AdminUserCardCycles;
