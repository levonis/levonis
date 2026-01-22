import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Bell,
  ChevronDown,
  ChevronUp,
  FileText,
  Heart,
  MapPin,
  Package,
  Trophy,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

type ShortcutKey = "orders" | "requests" | "addresses" | "notifications" | "favorites" | "rewards";

type ShortcutConfig = {
  key: ShortcutKey;
  enabled: boolean;
};

const DEFAULT_SHORTCUTS: ShortcutConfig[] = [
  { key: "orders", enabled: true },
  { key: "requests", enabled: true },
  { key: "addresses", enabled: true },
  { key: "notifications", enabled: true },
  { key: "favorites", enabled: true },
  { key: "rewards", enabled: true },
];

function normalizeShortcuts(v: unknown): ShortcutConfig[] {
  const arr = Array.isArray(v) ? v : [];
  const map = new Map<ShortcutKey, ShortcutConfig>();

  for (const row of arr) {
    const key = (row as any)?.key as ShortcutKey;
    const enabled = Boolean((row as any)?.enabled);
    if (
      key === "orders" ||
      key === "requests" ||
      key === "addresses" ||
      key === "notifications" ||
      key === "favorites" ||
      key === "rewards"
    ) {
      map.set(key, { key, enabled });
    }
  }

  // Ensure all keys exist, keep stored order first
  const ordered: ShortcutConfig[] = [];
  for (const d of arr) {
    const key = (d as any)?.key as ShortcutKey;
    if (map.has(key)) ordered.push(map.get(key)!);
  }
  for (const d of DEFAULT_SHORTCUTS) {
    if (!map.has(d.key)) ordered.push(d);
  }
  return ordered;
}

export default function ProfileShortcuts() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: prefs, isLoading } = useQuery({
    queryKey: ["profile-preferences", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const client: any = supabase;
      const { data, error } = await client
        .from("user_profile_preferences")
        .select("user_id, quick_actions")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as { user_id: string; quick_actions: unknown } | null;
    },
    staleTime: 60_000,
  });

  const initial = useMemo(() => normalizeShortcuts(prefs?.quick_actions), [prefs?.quick_actions]);
  const [shortcuts, setShortcuts] = useState<ShortcutConfig[]>(DEFAULT_SHORTCUTS);
  const hydratedRef = useRef(false);

  // Hydrate once when prefs arrives
  useEffect(() => {
    if (!prefs || hydratedRef.current) return;
    setShortcuts(initial);
    hydratedRef.current = true;
  }, [prefs, initial]);

  const meta = useMemo(
    () =>
      ({
        orders: { label: "طلباتي", hint: "طلبات المتجر", icon: Package },
        requests: { label: "طلبات الطباعة", hint: "مجتمع الطباعة", icon: FileText },
        addresses: { label: "العناوين", hint: "العنوان الافتراضي", icon: MapPin },
        notifications: { label: "الإشعارات", hint: "تنبيهاتك", icon: Bell },
        favorites: { label: "المفضلة", hint: "محفوظاتك", icon: Heart },
        rewards: { label: "المكافآت", hint: "النقاط والجوائز", icon: Trophy },
      }) as const,
    []
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not authenticated");
      const client: any = supabase;

      // Upsert preferences
      const { error } = await client.from("user_profile_preferences").upsert(
        {
          user_id: user.id,
          quick_actions: shortcuts,
        },
        { onConflict: "user_id" }
      );
      if (error) throw error;
      return true;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["profile-preferences", user?.id] });
      await qc.invalidateQueries({ queryKey: ["profile-quick-actions", user?.id] });
      toast({ title: "تم حفظ الاختصارات" });
    },
    onError: (err: any) => {
      toast({ title: "تعذر الحفظ", description: err?.message ?? "حدث خطأ", variant: "destructive" });
    },
  });

  const move = (idx: number, dir: -1 | 1) => {
    setShortcuts((prev) => {
      const next = [...prev];
      const to = idx + dir;
      if (to < 0 || to >= next.length) return prev;
      const tmp = next[idx];
      next[idx] = next[to];
      next[to] = tmp;
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-background/95 backdrop-blur-sm">
      <main className="container mx-auto px-4 pt-24 pb-24 max-w-3xl">
        <header className="mb-6 flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2 h-9">
            <ArrowRight className="h-4 w-4" />
            رجوع
          </Button>
          <Button
            variant="outline"
            className="h-9"
            disabled={isLoading || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? "جارٍ الحفظ…" : "حفظ"}
          </Button>
        </header>

        <Card className="glass-effect border-border/50">
          <CardContent className="pt-6">
            <div>
              <h1 className="text-lg sm:text-xl font-black text-foreground">تخصيص الوصول السريع</h1>
              <p className="mt-1 text-xs text-muted-foreground">
                اختر ما يظهر داخل صفحة الملف، وغيّر الترتيب (أعلى/أسفل).
              </p>
            </div>

            <div className="mt-4 space-y-2">
              {shortcuts.map((s, idx) => {
                const m = meta[s.key];
                const Icon = m.icon;
                return (
                  <div
                    key={s.key}
                    className="rounded-2xl border border-border bg-card/60 p-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-foreground truncate">{m.label}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{m.hint}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 rounded-xl"
                          onClick={() => move(idx, -1)}
                          disabled={idx === 0}
                          aria-label="رفع"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 rounded-xl"
                          onClick={() => move(idx, 1)}
                          disabled={idx === shortcuts.length - 1}
                          aria-label="تنزيل"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </div>

                      <Switch
                        checked={s.enabled}
                        onCheckedChange={(v) =>
                          setShortcuts((prev) => prev.map((x) => (x.key === s.key ? { ...x, enabled: v } : x)))
                        }
                        aria-label="إظهار/إخفاء"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
