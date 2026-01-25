import { MessageCircle } from "lucide-react";
import AdminLayout, { AdminSection, AdminEmptyState } from "@/components/admin/AdminLayout";
import { ADMIN_ROUTES } from "@/config/adminConfig";

export default function AdminCommunityMessages() {
  return (
    <AdminLayout
      title="محادثات المجتمع"
      description="مراقبة محادثات مجتمع ليفو بين التجار والزبائن"
      icon={<MessageCircle className="h-5 w-5" />}
      backTo={ADMIN_ROUTES.levoCommunity}
      maxWidth="6xl"
    >
      <AdminSection>
        <AdminEmptyState
          icon={<MessageCircle className="h-12 w-12" />}
          title="قريباً"
          description="سيتم إضافة مراقبة المحادثات قريباً"
        />
      </AdminSection>
    </AdminLayout>
  );
}
