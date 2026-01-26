import { AlertTriangle } from "lucide-react";
import AdminLayout, { AdminSection, AdminEmptyState } from "@/components/admin/AdminLayout";
import { ADMIN_ROUTES } from "@/config/adminConfig";

interface Props {
  embedded?: boolean;
}

function ComplaintsContent() {
  return (
    <AdminSection>
      <AdminEmptyState
        icon={<AlertTriangle className="h-12 w-12" />}
        title="قريباً"
        description="سيتم إضافة نظام الشكاوى والنزاعات قريباً"
      />
    </AdminSection>
  );
}

export default function AdminCommunityComplaints({ embedded }: Props) {
  if (embedded) {
    return <ComplaintsContent />;
  }

  return (
    <AdminLayout
      title="الشكاوى والنزاعات"
      description="مراجعة الشكاوى والتدخل في النزاعات بين التجار والزبائن"
      icon={<AlertTriangle className="h-5 w-5" />}
      backTo={ADMIN_ROUTES.levoCommunity}
      maxWidth="6xl"
    >
      <ComplaintsContent />
    </AdminLayout>
  );
}
