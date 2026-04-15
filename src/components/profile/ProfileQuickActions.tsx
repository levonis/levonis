import { ArrowRight, Bell, FileText, Heart, MapPin, Package, Trophy } from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/lib/i18n";

type ActionItem = {
  key: string;
  labelKey: string;
  hintKey: string;
  to: string;
  icon: any;
};

export default function ProfileQuickActions() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const items = useMemo<ActionItem[]>(
    () => [
      {
        key: "orders",
        labelKey: "menu_my_orders",
        hintKey: "order_desc",
        icon: Package,
        to: "/my-orders",
      },
      {
        key: "requests",
        labelKey: "menu_custom_requests",
        hintKey: "community_browse_requests",
        icon: FileText,
        to: "/community/customer/requests",
      },
      {
        key: "addresses",
        labelKey: "menu_addresses",
        hintKey: "settings_default_address",
        icon: MapPin,
        to: "/addresses",
      },
      {
        key: "notifications",
        labelKey: "menu_notifications",
        hintKey: "notif_title",
        icon: Bell,
        to: "/notifications",
      },
      {
        key: "favorites",
        labelKey: "menu_favorites",
        hintKey: "favorites_desc",
        icon: Heart,
        to: "/favorites",
      },
      {
        key: "rewards",
        labelKey: "menu_rewards",
        hintKey: "rewards_title",
        icon: Trophy,
        to: "/rewards",
      },
    ],
    []
  );

  return (
    <section aria-label={t('profile_quick_access')} className="mt-6">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-black text-foreground">{t('profile_quick_access')}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{t('profile_quick_access_desc')}</p>
        </div>
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
              <div className="mt-2.5 text-sm font-bold text-foreground leading-none">{t(a.labelKey as any)}</div>
              <div className="mt-1 text-[11px] text-muted-foreground leading-snug">{t(a.hintKey as any)}</div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
