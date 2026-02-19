import { Calendar, Award } from "lucide-react";
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
    <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border/30">
        <h3 className="font-bold text-sm flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Award className="h-4 w-4 text-primary" />
          </div>
          تفاصيل الحساب
        </h3>
      </div>

      <div className="p-5 space-y-3">
        <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/30">
          <span className="text-xs text-muted-foreground">مستوى العضوية</span>
          {userId && <LevelBadge userId={userId} size="md" />}
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/30">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Calendar className="h-3 w-3" />
            تاريخ الإنشاء
          </span>
          <span className="text-xs font-bold text-foreground">{createdAt ? formatDate(createdAt) : "-"}</span>
        </div>
      </div>
    </div>
  );
}
