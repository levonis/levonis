import { Ticket, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TicketProductBadgesProps {
  ticketCount: number;
  showDelayedShipping?: boolean;
  className?: string;
}

export default function TicketProductBadges({ 
  ticketCount, 
  showDelayedShipping = true,
  className = ""
}: TicketProductBadgesProps) {
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {ticketCount > 0 && (
        <Badge 
          variant="secondary" 
          className="bg-purple-500/20 text-purple-700 border-purple-500/30 text-[10px] px-2 py-0.5 gap-1"
        >
          <Ticket className="h-3 w-3" />
          +{ticketCount} تذكرة
        </Badge>
      )}
      {showDelayedShipping && (
        <Badge 
          variant="outline" 
          className="border-amber-500/40 text-amber-600 text-[10px] px-2 py-0.5 gap-1"
        >
          <Package className="h-3 w-3" />
          شحن لاحقًا
        </Badge>
      )}
    </div>
  );
}
