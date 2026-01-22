import { ArrowRight, Bell, FileText, Heart, MapPin, Package, Trophy } from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

type ActionItem = {
  key: string;
  label: string;
  hint: string;
  to: string;
  icon: any;
};

export default function ProfileQuickActions() {
  const navigate = useNavigate();

  const items = useMemo<ActionItem[]>(
    () => [
      {
        key: "orders",
        label: "طلباتي",
        hint: "تتبّع الطلبات والفواتير",
        icon: Package,
        to: "/my-orders",
      },
      {
        key: "requests",
        label: "طلباتي (طباعة)",
        hint: "طلبات مجتمع الطباعة",
        icon: FileText,
        to: "/community/customer/requests",
      },
      {
        key: "addresses",
        label: "العناوين",
        hint: "إدارة العنوان الافتراضي",
        icon: MapPin,
        to: "/addresses",
      },
      {
        key: "notifications",
        label: "الإشعارات",
        hint: "آخر التنبيهات",
        icon: Bell,
        to: "/notifications",
      },
      {
        key: "favorites",
        label: "المفضلة",
        hint: "منتجات محفوظة",
        icon: Heart,
        to: "/favorites",
      },
      {
        key: "rewards",
        label: "المكافآت",
        hint: "النقاط والجوائز",
        icon: Trophy,
        to: "/rewards",
      },
    ],
    []
  );

  return (
    <section aria-label="وصول سريع" className="mt-6">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-black text-foreground">وصول سريع</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">اختصارات مرتبة لكل شيء مهم</p>
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
              <div className="mt-2.5 text-sm font-bold text-foreground leading-none">{a.label}</div>
              <div className="mt-1 text-[11px] text-muted-foreground leading-snug">{a.hint}</div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
