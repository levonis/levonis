import { Input } from "@/components/ui/input";
import { Calendar, Trophy, Timer } from "lucide-react";

interface Props {
  seasonName: string | null | undefined;
  seasonStartsAt: string | null | undefined;
  seasonEndsAt: string | null | undefined;
  onChange: (key: "season_name" | "season_starts_at" | "season_ends_at", value: string | null) => void;
}

const toLocal = (iso?: string | null) => {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const off = d.getTimezoneOffset();
    return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
  } catch { return ""; }
};

const fromLocal = (val: string) => val ? new Date(val).toISOString() : null;

export default function SeasonAdminFields({ seasonName, seasonStartsAt, seasonEndsAt, onChange }: Props) {
  return (
    <div className="border border-primary/20 bg-primary/5 rounded-lg p-4 space-y-3">
      <h4 className="text-sm font-bold text-primary flex items-center gap-1.5">
        <Trophy className="h-4 w-4" /> إدارة الموسم
      </h4>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <Trophy className="h-3 w-3" /> اسم الموسم
        </label>
        <Input
          value={seasonName ?? ""}
          onChange={e => onChange("season_name", e.target.value)}
          placeholder="مثلاً: الموسم الثاني"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" /> موعد بدء الموسم
          </label>
          <Input
            type="datetime-local"
            value={toLocal(seasonStartsAt)}
            onChange={e => onChange("season_starts_at", fromLocal(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Timer className="h-3 w-3" /> موعد انتهاء الموسم
          </label>
          <Input
            type="datetime-local"
            value={toLocal(seasonEndsAt)}
            onChange={e => onChange("season_ends_at", fromLocal(e.target.value))}
          />
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground">سيتم عرض اسم الموسم وعداد تنازلي للانتهاء في قائمة المتصدرين داخل اللعبة.</p>
    </div>
  );
}
