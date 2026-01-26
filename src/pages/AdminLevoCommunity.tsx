import { useState } from "react";
import { Store, Users, MessageCircle, AlertTriangle, Award, ImageIcon } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { ADMIN_ROUTES } from "@/config/adminConfig";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Suspense, lazy } from "react";
import { Loader2 } from "lucide-react";

// Lazy load the tab content components
const AdminCommunityMerchants = lazy(() => import("@/pages/AdminCommunityMerchants"));
const AdminCommunityCustomers = lazy(() => import("@/pages/AdminCommunityCustomers"));
const AdminCommunityComplaints = lazy(() => import("@/pages/AdminCommunityComplaints"));
const AdminCommunityMessages = lazy(() => import("@/pages/AdminCommunityMessages"));
const AdminBadgeSettings = lazy(() => import("@/pages/AdminBadgeSettings"));
const AdminAvatarFrames = lazy(() => import("@/pages/AdminAvatarFrames"));

interface TabConfig {
  value: string;
  icon: React.ElementType;
  label: string;
  colorClass: string;
}

const tabs: TabConfig[] = [
  {
    value: "merchants",
    icon: Store,
    label: "التجار",
    colorClass: "text-emerald-500",
  },
  {
    value: "customers",
    icon: Users,
    label: "الزبائن",
    colorClass: "text-blue-500",
  },
  {
    value: "complaints",
    icon: AlertTriangle,
    label: "الشكاوى",
    colorClass: "text-amber-500",
  },
  {
    value: "messages",
    icon: MessageCircle,
    label: "المحادثات",
    colorClass: "text-purple-500",
  },
  {
    value: "badges",
    icon: Award,
    label: "الشارات",
    colorClass: "text-primary",
  },
  {
    value: "frames",
    icon: ImageIcon,
    label: "الإطارات",
    colorClass: "text-pink-500",
  },
];

function TabLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

export default function AdminLevoCommunity() {
  const [activeTab, setActiveTab] = useState("merchants");

  return (
    <AdminLayout
      title="مجتمع ليفو"
      description="إدارة التجار والزبائن والمحادثات والشكاوى"
      icon={<Users className="h-5 w-5" />}
      backTo={ADMIN_ROUTES.dashboard}
      maxWidth="7xl"
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* Scrollable Tabs Bar */}
        <div className="sticky top-[calc(4rem+4.5rem)] z-30 bg-background/95 backdrop-blur-sm border-b border-border/50 -mx-4 md:-mx-6 px-4 md:px-6 mb-6">
          <TabsList className="h-auto p-1 bg-transparent justify-start gap-1 overflow-x-auto flex-nowrap w-full scrollbar-hide">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary whitespace-nowrap shrink-0"
              >
                <tab.icon className={`h-4 w-4 ${activeTab === tab.value ? "text-primary" : tab.colorClass}`} />
                <span className="text-sm font-medium">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Tab Contents */}
        <Suspense fallback={<TabLoader />}>
          <TabsContent value="merchants" className="mt-0">
            <AdminCommunityMerchants embedded />
          </TabsContent>
          
          <TabsContent value="customers" className="mt-0">
            <AdminCommunityCustomers embedded />
          </TabsContent>
          
          <TabsContent value="complaints" className="mt-0">
            <AdminCommunityComplaints embedded />
          </TabsContent>
          
          <TabsContent value="messages" className="mt-0">
            <AdminCommunityMessages embedded />
          </TabsContent>
          
          <TabsContent value="badges" className="mt-0">
            <AdminBadgeSettings embedded />
          </TabsContent>
          
          <TabsContent value="frames" className="mt-0">
            <AdminAvatarFrames embedded />
          </TabsContent>
        </Suspense>
      </Tabs>
    </AdminLayout>
  );
}
