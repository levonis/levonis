import { Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import LevelBadge from "@/components/LevelBadge";
import { formatDate } from "@/lib/utils";

export default function UserInfoAccountDetailsCard({
  userId,
  createdAt,
}: {
  userId?: string;
  createdAt?: string;
}) {
  return (
    <Card className="glass-effect border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          تفاصيل الحساب
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-center justify-between py-2 border-b border-border/30">
          <span className="text-muted-foreground">مستوى العضوية</span>
          <div className="flex items-center gap-2">{userId && <LevelBadge userId={userId} size="md" />}</div>
        </div>

        <div className="flex items-center justify-between py-2">
          <span className="text-muted-foreground">تاريخ الإنشاء</span>
          <span className="font-medium text-foreground">{createdAt ? formatDate(createdAt) : "-"}</span>
        </div>
      </CardContent>
    </Card>
  );
}
