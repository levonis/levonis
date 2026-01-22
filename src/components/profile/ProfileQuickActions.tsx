import { ArrowRight, Bell, FileText, Heart, MapPin, Package, Trophy, SlidersHorizontal } from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

type ActionItem = {
  key: string;
  label: string;
  hint: string;
  to: string;
  icon: any;
  enabled?: boolean;
};

type ShortcutKey = "orders" | "requests" | "addresses" | "notifications" | "favorites" | "rewards";
type ShortcutConfig = { key: ShortcutKey; enabled: boolean };

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
  const defaults: ShortcutConfig[] = [
    { key: "orders", enabled: true },
    { key: "requests", enabled: true },
    { key: "addresses", enabled: true },
    { key: "notifications", enabled: true },
    { key: "favorites", enabled: true },
    { key: "rewards", enabled: true },
  ];

  const ordered: ShortcutConfig[] = [];
  for (const d of arr) {
    const key = (d as any)?.key as ShortcutKey;
    if (map.has(key)) ordered.push(map.get(key)!);
  }
  for (const d of defaults) if (!map.has(d.key)) ordered.push(d);
  return ordered;
}

export default function ProfileQuickActions() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: prefs } = useQuery({
    queryKey: ["profile-quick-actions", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const client: any = supabase;
      const { data, error } = await client
        .from("user_profile_preferences")
        .select("quick_actions")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as { quick_actions?: unknown } | null;
    },
    staleTime: 60_000,
  });

  const items = useMemo<ActionItem[]>(() => {
    const base: Record<ShortcutKey, ActionItem> = {
      orders: {
        key: "orders",
        label: "طلباتي",
        hint: "تتبّع الطلبات والفواتير",
        icon: Package,
        to: "/my-orders",
      },
      requests: {
        key: "requests",
        label: "طلبات الطباعة",
        hint: "طلبات مجتمع الطباعة",
        icon: FileText,
        to: "/community/customer/requests",
      },
      addresses: {
        key: "addresses",
        label: "العناوين",
        hint: "إدارة العنوان الافتراضي",
        icon: MapPin,
        to: "/addresses",
      },
      notifications: {
        key: "notifications",
        label: "الإشعارات",
        hint: "آخر التنبيهات",
        icon: Bell,
        to: "/notifications",
      },
      favorites: {
        key: "favorites",
        label: "المفضلة",
        hint: "منتجات محفوظة",
        icon: Heart,
        to: "/favorites",
      },
      rewards: {
        key: "rewards",
        label: "المكافآت",
        hint: "النقاط والجوائز",
        icon: Trophy,
        to: "/rewards",
      },
    };

    const conf = normalizeShortcuts(prefs?.quick_actions);
    return conf
      .filter((c) => c.enabled)
      .map((c) => base[c.key]);
  }, [prefs?.quick_actions]);

  return (
    <section aria-label="وصول سريع" className="mt-6">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-black text-foreground">وصول سريع</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">اختصارات مرتبة لكل شيء مهم</p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 rounded-xl gap-2"
          onClick={() => navigate("/profile/shortcuts")}
        >
          <SlidersHorizontal className="h-4 w-4" />
          تخصيص
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {items.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.key}
              type="button"
              onClick={() => navigate(a.to)}
              className="group rounded-2xl border border-border bg-card/60 p-3 text-right hover:bg-card transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="h-9 w-9 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
              <div className="mt-2.5 text-sm font-bold text-foreground leading-none">{a.label}</div>
              <div className="mt-1 text-[11px] text-muted-foreground leading-snug">{a.hint}</div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

