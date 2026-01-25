import { Users } from "lucide-react";
import AdminLayout, { AdminSection, AdminEmptyState } from "@/components/admin/AdminLayout";
import { ADMIN_ROUTES } from "@/config/adminConfig";

export default function AdminCommunityCustomers() {
  return (
    <AdminLayout
      title="إدارة الزبائن"
      description="عرض وإدارة حسابات زبائن مجتمع ليفو"
      icon={<Users className="h-5 w-5" />}
      backTo={ADMIN_ROUTES.levoCommunity}
      maxWidth="6xl"
    >
      <AdminSection>
        <AdminEmptyState
          icon={<Users className="h-12 w-12" />}
          title="قريباً"
          description="سيتم إضافة إدارة الزبائن قريباً"
        />
      </AdminSection>
    </AdminLayout>
  );
}
