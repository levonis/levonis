import { Ticket } from "lucide-react";
import GachaMachineVisual from "./GachaMachineVisual";
import { useLanguage } from "@/lib/i18n";
import { pickI18n } from "@/lib/i18nField";

interface Props {
  machine: any;
  onSelect: () => void;
}

export default function GachaMachineCard({ machine, onSelect }: Props) {
  const { language } = useLanguage();
  const isTimeLimited = machine.is_limited && machine.available_until;
  const timeLeft = isTimeLimited ? getTimeLeft(machine.available_until) : null;
  const name = pickI18n(machine, "name", language);
  const description = pickI18n(machine, "description", language);

  return (
    <button
      onClick={onSelect}
      className="group relative rounded-2xl overflow-hidden border border-border/30 hover:border-primary/50 transition-all duration-300 text-right bg-card"
    >
      <div className="aspect-[3/4] p-3 flex flex-col items-center justify-between">
        {/* Top badges */}
        <div className="flex items-start justify-between w-full relative z-10">
          {isTimeLimited && timeLeft && (
            <span className="px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/30 text-[10px] font-medium text-red-300">
              ⏰ {timeLeft}
            </span>
          )}
          <span className="px-2 py-0.5 rounded-full bg-primary/20 border border-primary/30 text-[10px] font-medium text-primary flex items-center gap-1 mr-auto">
            <Ticket className="h-3 w-3" /> {machine.ticket_cost}
          </span>
        </div>

        {/* Machine visual */}
        <div className="flex-1 flex items-center justify-center py-2">
          <GachaMachineVisual
            theme={machine.theme || "default"}
            size="sm"
            className="group-hover:scale-105 transition-transform duration-300"
          />
        </div>

        {/* Name */}
        <div className="w-full">
          <h3 className="font-bold text-xs text-foreground mb-0.5 text-center">{name}</h3>
          {description && (
            <p className="text-[9px] text-muted-foreground line-clamp-1 text-center">{description}</p>
          )}
        </div>
      </div>
    </button>
  );
}

function getTimeLeft(until: string): string | null {
  const diff = new Date(until).getTime() - Date.now();
  if (diff <= 0) return null;
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days} يوم`;
  return `${hours} ساعة`;
}
