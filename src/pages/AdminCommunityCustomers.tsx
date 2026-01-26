import { Users } from "lucide-react";
import AdminLayout, { AdminSection, AdminEmptyState } from "@/components/admin/AdminLayout";
import { ADMIN_ROUTES } from "@/config/adminConfig";

interface Props {
  embedded?: boolean;
}

function CustomersContent() {
  return (
    <AdminSection>
      <AdminEmptyState
        icon={<Users className="h-12 w-12" />}
        title="قريباً"
        description="سيتم إضافة إدارة الزبائن قريباً"
      />
    </AdminSection>
  );
}

export default function AdminCommunityCustomers({ embedded }: Props) {
  if (embedded) {
    return <CustomersContent />;
  }

  return (
    <AdminLayout
      title="إدارة الزبائن"
      description="عرض وإدارة حسابات زبائن مجتمع ليفو"
      icon={<Users className="h-5 w-5" />}
      backTo={ADMIN_ROUTES.levoCommunity}
      maxWidth="6xl"
    >
      <CustomersContent />
    </AdminLayout>
  );
}
