import { useNavigate } from "react-router-dom";
import {
  Truck,
  Heart,
  Store,
  History,
  MapPin,
  Headphones,
  Settings,
  Gift,
  BellRing,
} from "lucide-react";

const SERVICES = [
  { icon: Truck, label: "تتبع الشحنات", path: "/my-orders", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  { icon: Heart, label: "المفضلة", path: "/favorites", color: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  { icon: Store, label: "المتاجر", path: "/community", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  { icon: History, label: "سجل التصفح", path: "/products", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  { icon: MapPin, label: "العناوين", path: "/addresses", color: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  { icon: Headphones, label: "خدمة العملاء", path: "/chats", color: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400" },
  { icon: Gift, label: "الجوائز", path: "/rewards", color: "bg-orange-500/10 text-orange-600 dark:text-orange-400" },
  { icon: BellRing, label: "الإشعارات", path: "/notifications", color: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400" },
  { icon: Settings, label: "الإعدادات", path: "/profile/settings", color: "bg-slate-500/10 text-slate-600 dark:text-slate-400" },
];

export default function QuickServicesGrid() {
  const navigate = useNavigate();

  return (
    <div className="rounded-3xl bg-card border border-border/40 shadow-sm p-4">
      <h2 className="text-base font-bold text-foreground mb-3">خدمات سريعة</h2>

      <div className="grid grid-cols-4 gap-3">
        {SERVICES.map((s) => (
          <button
            key={s.label}
            onClick={() => navigate(s.path)}
            className="flex flex-col items-center gap-2 py-2 rounded-2xl transition-all duration-200 active:scale-[0.93]"
          >
            <div className={`flex items-center justify-center h-11 w-11 rounded-2xl ${s.color}`}>
              <s.icon className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <span className="text-[11px] text-muted-foreground text-center leading-tight">
              {s.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
