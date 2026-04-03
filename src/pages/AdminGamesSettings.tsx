import { useState, lazy, Suspense } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { ADMIN_ROUTES } from "@/config/adminConfig";
import { Gamepad2, Music, Gift, Swords, ShoppingBag, Crosshair } from "lucide-react";

const GameMusicTab = lazy(() => import("@/components/admin/GameMusicTab"));
const MysteryCaseTab = lazy(() => import("@/components/admin/MysteryCaseTab"));
const SpaceBlasterTab = lazy(() => import("@/components/admin/SpaceBlasterTab"));
const StackGameTab = lazy(() => import("@/components/admin/StackGameTab"));
const GameStoreTab = lazy(() => import("@/components/admin/GameStoreTab"));
const KnifeRainTab = lazy(() => import("@/components/admin/KnifeRainTab"));

type TabId = "mystery-case" | "space-blaster" | "stack-tower" | "knife-rain" | "music" | "store";

const TABS: { id: TabId; label: string; icon: typeof Gamepad2 }[] = [
  { id: "mystery-case", label: "صندوق الغموض", icon: Gift },
  { id: "space-blaster", label: "حرب الفضاء", icon: Swords },
  { id: "stack-tower", label: "البرج", icon: Gamepad2 },
  { id: "knife-rain", label: "أمطار السكاكين", icon: Crosshair },
  { id: "store", label: "متجر الألعاب", icon: ShoppingBag },
  { id: "music", label: "الموسيقى", icon: Music },
];

export default function AdminGamesSettings() {
  const [activeTab, setActiveTab] = useState<TabId>("mystery-case");

  return (
    <AdminLayout
      title="إعدادات الألعاب"
      description="إدارة ألعاب الموقع والموسيقى والجوائز"
      icon={<Gamepad2 className="h-5 w-5" />}
      backTo={ADMIN_ROUTES.dashboard}
      maxWidth="4xl"
    >
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <Suspense fallback={<div className="py-12 text-center text-muted-foreground">جاري التحميل...</div>}>
        {activeTab === "mystery-case" && <MysteryCaseTab />}
        {activeTab === "space-blaster" && <SpaceBlasterTab />}
        {activeTab === "stack-tower" && <StackGameTab />}
        {activeTab === "store" && <GameStoreTab />}
        {activeTab === "music" && <GameMusicTab />}
      </Suspense>
    </AdminLayout>
  );
}
