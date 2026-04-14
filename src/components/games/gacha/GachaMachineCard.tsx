import { Ticket } from "lucide-react";

interface Props {
  machine: any;
  onSelect: () => void;
}

const THEME_GRADIENTS: Record<string, string> = {
  default: "from-purple-600/30 via-purple-500/10 to-blue-600/20",
  coupon: "from-green-600/30 via-emerald-500/10 to-teal-600/20",
  doll: "from-pink-600/30 via-rose-500/10 to-red-600/20",
  event: "from-amber-600/30 via-yellow-500/10 to-orange-600/20",
  premium: "from-amber-500/30 via-yellow-400/10 to-amber-600/20",
};

const THEME_EMOJIS: Record<string, string> = {
  default: "🎰",
  coupon: "🎟️",
  doll: "🧸",
  event: "🎪",
  premium: "💎",
};

export default function GachaMachineCard({ machine, onSelect }: Props) {
  const gradient = THEME_GRADIENTS[machine.theme] || THEME_GRADIENTS.default;
  const emoji = THEME_EMOJIS[machine.theme] || THEME_EMOJIS.default;

  const isTimeLimited = machine.is_limited && machine.available_until;
  const timeLeft = isTimeLimited ? getTimeLeft(machine.available_until) : null;

  return (
    <button
      onClick={onSelect}
      className="group relative rounded-2xl overflow-hidden border border-border/30 hover:border-primary/50 transition-all duration-300 text-right"
    >
      {/* Background */}
      <div className={`aspect-[3/4] bg-gradient-to-br ${gradient} p-4 flex flex-col justify-between`}>
        {/* Neon glow effect */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[radial-gradient(circle_at_50%_50%,rgba(168,85,247,0.1),transparent_70%)]" />
        
        {/* Top badges */}
        <div className="flex items-start justify-between relative">
          {isTimeLimited && timeLeft && (
            <span className="px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/30 text-[10px] font-medium text-red-300">
              ⏰ {timeLeft}
            </span>
          )}
          <span className="px-2 py-0.5 rounded-full bg-primary/20 border border-primary/30 text-[10px] font-medium text-primary flex items-center gap-1">
            <Ticket className="h-3 w-3" /> {machine.ticket_cost}
          </span>
        </div>

        {/* Machine visual */}
        <div className="flex-1 flex items-center justify-center">
          {machine.image_url ? (
            <img 
              src={machine.image_url} 
              alt={machine.name_ar} 
              className="w-24 h-24 object-contain drop-shadow-lg group-hover:scale-110 transition-transform duration-300" 
            />
          ) : (
            <span className="text-6xl group-hover:scale-110 transition-transform duration-300 drop-shadow-lg">
              {emoji}
            </span>
          )}
        </div>

        {/* Name */}
        <div className="relative">
          <h3 className="font-bold text-sm text-foreground mb-0.5">{machine.name_ar}</h3>
          {machine.description_ar && (
            <p className="text-[10px] text-muted-foreground line-clamp-2">{machine.description_ar}</p>
          )}
        </div>
      </div>

      {/* Glossy overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
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
