import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout, { AdminSection, AdminCard, AdminCardHeader, AdminCardContent, AdminStatCard, AdminStatsGrid } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Store, FileText, AlertTriangle, Frame, Settings, BadgeCheck, ChevronLeft } from "lucide-react";
import { ADMIN_ROUTES } from "@/config/adminConfig";

export default function AdminCommunity() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch community stats
  const { data: stats } = useQuery({
    queryKey: ["admin-community-stats"],
    queryFn: async () => {
      const [merchantsRes, pendingRes, customersRes, productsRes] = await Promise.all([
        supabase.from("merchant_applications").select("*", { count: "exact", head: true }).eq("status", "approved"),
        supabase.from("merchant_applications").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("merchant_products").select("*", { count: "exact", head: true }).eq("is_active", true),
      ]);

      return {
        totalMerchants: merchantsRes.count || 0,
        pendingMerchants: pendingRes.count || 0,
        totalCustomers: customersRes.count || 0,
        totalProducts: productsRes.count || 0,
      };
    },
    staleTime: 60_000,
  });

  const sections = [
    {
      id: "merchants",
      title: "إدارة التجار",
      description: "طلبات التجار، الموافقة، الحظر",
      icon: <Store className="h-5 w-5" />,
      route: ADMIN_ROUTES.communityMerchants,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      id: "badges",
      title: "إعدادات الشارات",
      description: "شارات الأداء والتوثيق",
      icon: <BadgeCheck className="h-5 w-5" />,
      route: ADMIN_ROUTES.badgeSettings,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
    {
      id: "frames",
      title: "إطارات الأفتار",
      description: "إدارة إطارات الصور الشخصية",
      icon: <Frame className="h-5 w-5" />,
      route: ADMIN_ROUTES.avatarFrames,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
    },
  ];

  return (
    <AdminLayout
      title="إدارة مجتمع ليفو"
      description="إدارة التجار والزبائن والشارات"
      icon={<Users className="h-5 w-5" />}
    >
      {/* Stats Overview */}
      <AdminStatsGrid>
        <AdminStatCard
          icon={<Store className="h-5 w-5" />}
          value={stats?.totalMerchants || 0}
          label="تجار معتمدون"
          colorClass="text-blue-500"
          bgClass="bg-blue-500/10"
        />
        <AdminStatCard
          icon={<AlertTriangle className="h-5 w-5" />}
          value={stats?.pendingMerchants || 0}
          label="طلبات معلقة"
          colorClass="text-orange-500"
          bgClass="bg-orange-500/10"
        />
        <AdminStatCard
          icon={<Users className="h-5 w-5" />}
          value={stats?.totalCustomers || 0}
          label="إجمالي المستخدمين"
          colorClass="text-green-500"
          bgClass="bg-green-500/10"
        />
        <AdminStatCard
          icon={<FileText className="h-5 w-5" />}
          value={stats?.totalProducts || 0}
          label="منتجات نشطة"
          colorClass="text-purple-500"
          bgClass="bg-purple-500/10"
        />
      </AdminStatsGrid>

      {/* Quick Access Sections */}
      <AdminSection title="أقسام الإدارة" className="mt-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sections.map((section) => (
            <AdminCard
              key={section.id}
              className="cursor-pointer transition-all hover:scale-[1.02]"
              hover={false}
            >
              <div
                onClick={() => navigate(section.route)}
                className="p-4"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg ${section.bg} flex items-center justify-center shrink-0`}>
                    <span className={section.color}>{section.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-foreground">{section.title}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">{section.description}</p>
                  </div>
                  <ChevronLeft className="h-5 w-5 text-muted-foreground shrink-0" />
                </div>
              </div>
            </AdminCard>
          ))}
        </div>
      </AdminSection>
    </AdminLayout>
  );
}
