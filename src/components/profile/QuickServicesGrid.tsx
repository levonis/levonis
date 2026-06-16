import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Truck,
  Heart,
  BellRing,
  ShieldCheck,
  MapPin,
  Headphones,
  Settings,
  Gift,
  LayoutDashboard,
} from "lucide-react";
import { ADMIN_BASE_PATH } from "@/config/adminConfig";
import { useLanguage } from "@/lib/i18n";
import type { TranslationKeys } from "@/lib/i18n/types";

const SERVICES: Array<{
  icon: typeof Truck;
  labelKey: keyof TranslationKeys;
  path: string;
  color: string;
  key: string;
}> = [
  { icon: Truck, labelKey: "qs_track_shipments", path: "/my-orders", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400", key: "shipping" },
  { icon: Heart, labelKey: "qs_favorites", path: "/favorites", color: "bg-rose-500/10 text-rose-600 dark:text-rose-400", key: "favorites" },
  { icon: BellRing, labelKey: "qs_notifications", path: "/notifications", color: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400", key: "notifications" },
  { icon: ShieldCheck, labelKey: "qs_price_protection", path: "/price-protection", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", key: "price_protection" },
  { icon: MapPin, labelKey: "qs_addresses", path: "/addresses", color: "bg-violet-500/10 text-violet-600 dark:text-violet-400", key: "addresses" },
  { icon: Headphones, labelKey: "qs_customer_service", path: "/chats", color: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400", key: "support" },
  { icon: Gift, labelKey: "qs_prizes", path: "/rewards", color: "bg-orange-500/10 text-orange-600 dark:text-orange-400", key: "rewards" },
  { icon: Settings, labelKey: "qs_settings", path: "/profile/settings", color: "bg-slate-500/10 text-slate-600 dark:text-slate-400", key: "settings" },
];

export default function QuickServicesGrid() {
  const navigate = useNavigate();
  const { user, isAdmin, isAssistant } = useAuth();
  const { t } = useLanguage();
  const showAdminEntry = isAdmin || isAssistant;

  const { data: unreadCount } = useQuery({
    queryKey: ["unread-notifications-count", user?.id],
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("read", false);
      if (error) throw error;
      return count ?? 0;
    },
  });

  return (
    <div className="glass-card p-4">
      <h2 className="text-base font-bold text-foreground mb-3">{t('profile_quick_services')}</h2>

      <div className="grid grid-cols-4 gap-3">
        {showAdminEntry && (
          <button
            onClick={() => navigate(ADMIN_BASE_PATH)}
            className="relative flex flex-col items-center gap-2 py-2 rounded-2xl transition-all duration-200 active:scale-[0.93]"
          >
            <div className="relative flex items-center justify-center h-11 w-11 rounded-2xl bg-primary/15 text-primary">
              <LayoutDashboard className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <span className="text-[11px] text-muted-foreground text-center leading-tight">
              {isAdmin ? 'لوحة الإدارة' : 'لوحة المساعد'}
            </span>
          </button>
        )}
        {SERVICES.map((s) => {
          const Icon = s.icon;
          const badge = s.key === "notifications" && unreadCount ? unreadCount : 0;
          return (
            <button
              key={s.key}
              onClick={() => navigate(s.path)}
              className="relative flex flex-col items-center gap-2 py-2 rounded-2xl transition-all duration-200 active:scale-[0.93]"
            >
              <div className={`relative flex items-center justify-center h-11 w-11 rounded-2xl ${s.color}`}>
                <Icon className="h-5 w-5" strokeWidth={1.5} />
                {badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-black px-1 border-2 border-card">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] text-muted-foreground text-center leading-tight">
                {t(s.labelKey)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
