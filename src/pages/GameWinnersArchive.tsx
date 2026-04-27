import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Trophy, Crown, Medal, Award, Package, Calendar, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type GameKey = "crossy_road" | "stack" | "knife_rain";

interface ArchiveWinner {
  id: string;
  user_id: string;
  username: string;
  avatar_url?: string | null;
  position: number;
  score: number | null;
  season: number | null;
  prize_name: string;
  prize_type: string;
  awarded_at: string;
  product_id?: string | null;
  product_name?: string | null;
  product_image?: string | null;
  selected_color?: string | null;
}

const GAME_LABEL: Record<GameKey, string> = {
  crossy_road: "Crossy Road",
  stack: "Stack Tower",
  knife_rain: "Knife Rain",
};

const positionIcon = (pos: number) => {
  if (pos === 1) return <Crown className="h-4 w-4 text-yellow-500" />;
  if (pos === 2) return <Medal className="h-4 w-4 text-slate-400" />;
  if (pos === 3) return <Award className="h-4 w-4 text-amber-700" />;
  return <Trophy className="h-4 w-4 text-primary/70" />;
};

const positionLabel = (pos: number) => {
  if (pos === 1) return "المركز الأول";
  if (pos === 2) return "المركز الثاني";
  if (pos === 3) return "المركز الثالث";
  return `المركز ${pos}`;
};

async function fetchGameWinners(game: GameKey) {
  if (game === "crossy_road") {
    return supabase
      .from("crossy_road_winners")
      .select("id, user_id, position, score, season, prize_name_ar, prize_type, product_id, selected_color, awarded_at")
      .order("awarded_at", { ascending: false })
      .limit(500);
  }
  if (game === "stack") {
    return supabase
      .from("stack_game_winners")
      .select("id, user_id, position, score, season, prize_name_ar, prize_type, product_id, selected_color, awarded_at")
      .order("awarded_at", { ascending: false })
      .limit(500);
  }
  return supabase
    .from("knife_rain_winners")
    .select("id, user_id, position, score, season, prize_name_ar, prize_type, product_id, selected_color, awarded_at")
    .order("awarded_at", { ascending: false })
    .limit(500);
}

function useGameArchive(game: GameKey) {
  return useQuery({
    queryKey: ["winners-archive", game],
    staleTime: 60_000,
    queryFn: async (): Promise<ArchiveWinner[]> => {
      const { data, error } = await fetchGameWinners(game);
      if (error) throw error;
      const winners = (data ?? []) as Array<{
        id: string;
        user_id: string;
        position: number | null;
        score: number | null;
        season: number | null;
        prize_name_ar: string;
        prize_type: string;
        product_id: string | null;
        selected_color: string | null;
        awarded_at: string;
      }>;

      const userIds = Array.from(new Set(winners.map((w) => w.user_id))).filter(Boolean);
      const productIds = Array.from(new Set(winners.map((w) => w.product_id).filter(Boolean))) as string[];

      const [profilesRes, productsRes] = await Promise.all([
        userIds.length
          ? supabase.from("profiles").select("id, username, full_name, avatar_url").in("id", userIds)
          : Promise.resolve({ data: [] as any[] }),
        productIds.length
          ? supabase.from("products").select("id, name, name_ar, image_url").in("id", productIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const pMap = new Map((profilesRes.data || []).map((p: any) => [p.id, p]));
      const prodMap = new Map((productsRes.data || []).map((p: any) => [p.id, p]));

      return winners.map((w): ArchiveWinner => {
        const prof = pMap.get(w.user_id);
        const prod = w.product_id ? prodMap.get(w.product_id) : undefined;
        return {
          id: w.id,
          user_id: w.user_id,
          username: prof?.username || prof?.full_name || "لاعب",
          avatar_url: prof?.avatar_url ?? null,
          position: w.position ?? 0,
          score: w.score ?? null,
          season: w.season ?? null,
          prize_name: w.prize_name_ar || "جائزة",
          prize_type: w.prize_type || "leaderboard",
          awarded_at: w.awarded_at,
          product_id: w.product_id ?? null,
          product_name: prod?.name_ar || prod?.name || null,
          product_image: prod?.image_url || null,
          selected_color: w.selected_color ?? null,
        };
      });
    },
  });
}

function GameArchive({ game }: { game: GameKey }) {
  const { data: rows, isLoading } = useGameArchive(game);
  const [seasonFilter, setSeasonFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  // Group by season (descending). NULL season → "غير محدد".
  const grouped = useMemo(() => {
    const filtered = (rows || []).filter((r) => {
      if (seasonFilter !== "all") {
        const key = r.season == null ? "none" : String(r.season);
        if (key !== seasonFilter) return false;
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hay = `${r.username} ${r.prize_name} ${r.product_name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const map = new Map<string, ArchiveWinner[]>();
    for (const r of filtered) {
      const key = r.season == null ? "none" : String(r.season);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    // Sort each season's rows by position asc.
    map.forEach((arr) => arr.sort((a, b) => a.position - b.position));
    // Sort seasons descending; "none" last.
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === "none") return 1;
      if (b === "none") return -1;
      return Number(b) - Number(a);
    });
  }, [rows, seasonFilter, search]);

  const allSeasons = useMemo(() => {
    const s = new Set<string>();
    (rows || []).forEach((r) => s.add(r.season == null ? "none" : String(r.season)));
    return Array.from(s).sort((a, b) => {
      if (a === "none") return 1;
      if (b === "none") return -1;
      return Number(b) - Number(a);
    });
  }, [rows]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-muted/30 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <div className="text-center py-16">
        <Trophy className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-muted-foreground">لا يوجد فائزون مؤرشفون لهذه اللعبة بعد</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث عن لاعب أو جائزة"
            className="pr-9 h-10 rounded-xl"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <Button
            size="sm"
            variant={seasonFilter === "all" ? "default" : "outline"}
            onClick={() => setSeasonFilter("all")}
            className="h-9 rounded-xl shrink-0"
          >
            كل المواسم
          </Button>
          {allSeasons.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={seasonFilter === s ? "default" : "outline"}
              onClick={() => setSeasonFilter(s)}
              className="h-9 rounded-xl shrink-0"
            >
              {s === "none" ? "بدون موسم" : `موسم ${s}`}
            </Button>
          ))}
        </div>
      </div>

      {/* Grouped list */}
      {grouped.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-10">لا توجد نتائج مطابقة</p>
      ) : (
        grouped.map(([seasonKey, list]) => {
          const dateRange = (() => {
            const ts = list.map((r) => new Date(r.awarded_at).getTime()).filter(Boolean);
            if (!ts.length) return "";
            const min = new Date(Math.min(...ts));
            const max = new Date(Math.max(...ts));
            const same = format(min, "yyyy-MM-dd") === format(max, "yyyy-MM-dd");
            return same
              ? format(max, "d MMM yyyy", { locale: ar })
              : `${format(min, "d MMM", { locale: ar })} — ${format(max, "d MMM yyyy", { locale: ar })}`;
          })();

          return (
            <section
              key={seasonKey}
              className="rounded-2xl border border-border/40 bg-card/40 backdrop-blur-sm overflow-hidden"
            >
              <header className="flex items-center justify-between gap-3 px-4 py-3 bg-gradient-to-l from-primary/10 to-transparent border-b border-border/30">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-black text-foreground">
                    {seasonKey === "none" ? "جوائز متفرقة" : `الموسم ${seasonKey}`}
                  </h3>
                  <span className="text-[10px] text-muted-foreground bg-muted/50 rounded-full px-2 py-0.5">
                    {list.length} فائز
                  </span>
                </div>
                {dateRange && (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {dateRange}
                  </div>
                )}
              </header>

              <ul className="divide-y divide-border/20">
                {list.map((w) => (
                  <li key={w.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                    {/* Position badge */}
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex flex-col items-center justify-center shrink-0">
                      {positionIcon(w.position)}
                      <span className="text-[8px] text-muted-foreground font-bold mt-0.5">#{w.position}</span>
                    </div>

                    {/* Player + prize info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-foreground truncate">{w.username}</p>
                        <span className="text-[9px] text-primary bg-primary/10 rounded-full px-1.5 py-0.5 shrink-0">
                          {positionLabel(w.position)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5 mt-0.5">
                        <Package className="h-3 w-3 shrink-0" />
                        <span className="truncate">{w.prize_name}</span>
                        {w.selected_color && (
                          <span className="text-[10px] text-muted-foreground/70">• {w.selected_color}</span>
                        )}
                      </p>
                      {w.score != null && (
                        <p className="text-[10px] text-muted-foreground/80 mt-0.5">النتيجة: {w.score.toLocaleString()}</p>
                      )}
                    </div>

                    {/* Product thumbnail */}
                    {w.product_image && (
                      <img
                        src={w.product_image}
                        alt={w.product_name || w.prize_name}
                        loading="lazy"
                        className="w-12 h-12 rounded-lg object-cover border border-border/30 shrink-0 bg-muted/20"
                      />
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}

export default function GameWinnersArchive() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<GameKey>("crossy_road");

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border/30">
        <div className="container mx-auto max-w-3xl px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-9 w-9 rounded-xl">
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Trophy className="h-5 w-5 text-yellow-500" />
          <div className="flex-1">
            <h1 className="text-lg font-black text-foreground leading-tight">أرشيف الفائزين</h1>
            <p className="text-[10px] text-muted-foreground">سجل كامل للمتوّجين عبر جميع المواسم</p>
          </div>
        </div>
      </div>

      <main className="container mx-auto max-w-3xl px-4 pt-4 pb-24">
        <Tabs value={tab} onValueChange={(v) => setTab(v as GameKey)}>
          <TabsList className="grid grid-cols-3 w-full mb-4 rounded-xl">
            {(Object.keys(GAME_LABEL) as GameKey[]).map((g) => (
              <TabsTrigger key={g} value={g} className="rounded-lg text-xs sm:text-sm">
                {GAME_LABEL[g]}
              </TabsTrigger>
            ))}
          </TabsList>
          {(Object.keys(GAME_LABEL) as GameKey[]).map((g) => (
            <TabsContent key={g} value={g} className="mt-0">
              <GameArchive game={g} />
            </TabsContent>
          ))}
        </Tabs>
      </main>
    </div>
  );
}
