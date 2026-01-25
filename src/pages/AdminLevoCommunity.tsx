import { useNavigate } from "react-router-dom";
import { Store, Users, MessageCircle, AlertTriangle, Award, ImageIcon } from "lucide-react";
import AdminLayout, { AdminSection, AdminCard, AdminCardHeader, AdminCardContent } from "@/components/admin/AdminLayout";
import { ADMIN_ROUTES } from "@/config/adminConfig";

interface CommunitySection {
  icon: React.ElementType;
  title: string;
  description: string;
  path: string;
  colorClass: string;
  bgClass: string;
}

const sections: CommunitySection[] = [
  {
    icon: Store,
    title: "إدارة التجار",
    description: "مراجعة طلبات التسجيل والموافقة/الرفض",
    path: ADMIN_ROUTES.communityMerchants,
    colorClass: "text-emerald-500",
    bgClass: "bg-emerald-500/10",
  },
  {
    icon: Users,
    title: "إدارة الزبائن",
    description: "عرض وإدارة حسابات الزبائن",
    path: ADMIN_ROUTES.communityCustomers,
    colorClass: "text-blue-500",
    bgClass: "bg-blue-500/10",
  },
  {
    icon: AlertTriangle,
    title: "الشكاوى والنزاعات",
    description: "مراجعة الشكاوى والتدخل في النزاعات",
    path: ADMIN_ROUTES.communityComplaints,
    colorClass: "text-amber-500",
    bgClass: "bg-amber-500/10",
  },
  {
    icon: MessageCircle,
    title: "المحادثات",
    description: "مراقبة محادثات المجتمع",
    path: ADMIN_ROUTES.communityMessages,
    colorClass: "text-purple-500",
    bgClass: "bg-purple-500/10",
  },
  {
    icon: Award,
    title: "إعدادات الشارات",
    description: "تخصيص شارات ورتب التجار",
    path: ADMIN_ROUTES.badgeSettings,
    colorClass: "text-primary",
    bgClass: "bg-primary/10",
  },
  {
    icon: ImageIcon,
    title: "إطارات الأفتار",
    description: "إدارة الإطارات المتحركة للصور",
    path: ADMIN_ROUTES.avatarFrames,
    colorClass: "text-pink-500",
    bgClass: "bg-pink-500/10",
  },
];

export default function AdminLevoCommunity() {
  const navigate = useNavigate();

  return (
    <AdminLayout
      title="مجتمع ليفو"
      description="إدارة التجار والزبائن والمحادثات والشكاوى"
      icon={<Users className="h-5 w-5" />}
      backTo={ADMIN_ROUTES.dashboard}
      maxWidth="4xl"
    >
      <AdminSection>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sections.map((section) => (
            <AdminCard key={section.path} className="cursor-pointer" hover>
              <button
                onClick={() => navigate(section.path)}
                className="w-full text-right p-5 block"
              >
                <div className={`w-12 h-12 rounded-xl ${section.bgClass} flex items-center justify-center mb-4`}>
                  <section.icon className={`h-6 w-6 ${section.colorClass}`} />
                </div>
                <h3 className="text-base font-bold text-foreground mb-1">
                  {section.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {section.description}
                </p>
              </button>
            </AdminCard>
          ))}
        </div>
      </AdminSection>
    </AdminLayout>
  );
}
