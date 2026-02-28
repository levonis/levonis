import { useNavigate } from "react-router-dom";
import { User, MessageSquare, Star, ChevronLeft, ExternalLink, Crown } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface CustomerProfile {
  full_name?: string | null;
  avatar_url?: string | null;
  username?: string | null;
}

interface CustomerRequestStripProps {
  customerId: string;
  customerProfile?: CustomerProfile | null;
  isOwner?: boolean;
  onViewProfile?: () => void;
}

export default function CustomerRequestStrip({
  customerId,
  customerProfile,
  isOwner = false,
  onViewProfile,
}: CustomerRequestStripProps) {
  const navigate = useNavigate();

  const displayName = customerProfile?.full_name || customerProfile?.username || "عميل";
  const initials = displayName.slice(0, 2);

  const handleViewProfile = () => {
    if (onViewProfile) {
      onViewProfile();
    } else {
      navigate(`/profile/${customerId}`);
    }
  };

  const handleMessage = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/chats?user_id=${customerId}`);
  };

  return (
    <div 
      className="flex items-center gap-3 p-2.5 rounded-xl bg-gradient-to-l from-[hsl(var(--primary)/0.12)] via-[hsl(var(--primary)/0.06)] to-transparent border border-[hsl(var(--primary)/0.2)] cursor-pointer hover:border-[hsl(var(--primary)/0.4)] transition-all group"
      onClick={handleViewProfile}
    >
      {/* Avatar with decorative ring */}
      <div className="relative">
        <Avatar className="h-10 w-10 border-2 border-[hsl(var(--primary)/0.4)] shadow-lg shadow-[hsl(var(--primary)/0.1)]">
          <AvatarImage src={customerProfile?.avatar_url || undefined} />
          <AvatarFallback className="bg-gradient-to-br from-[hsl(var(--primary)/0.3)] to-[hsl(var(--primary)/0.1)] text-primary text-xs font-bold">
            {initials}
          </AvatarFallback>
        </Avatar>
        {isOwner && (
          <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
            <Crown className="h-2.5 w-2.5 text-primary-foreground" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="font-bold text-sm text-foreground truncate group-hover:text-primary transition-colors">
            {displayName}
          </p>
          {isOwner && (
            <Badge variant="outline" className="text-[8px] px-1.5 py-0 h-4 border-[hsl(var(--primary)/0.4)] text-primary font-bold">
              طلبك
            </Badge>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Star className="h-2.5 w-2.5 fill-amber-500/30 text-amber-500/30" />
          صاحب الطلب
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {!isOwner && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-primary hover:bg-[hsl(var(--primary)/0.1)] rounded-full"
            onClick={handleMessage}
            title="مراسلة"
          >
            <MessageSquare className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 gap-1 text-xs text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-full"
          onClick={(e) => {
            e.stopPropagation();
            handleViewProfile();
          }}
          title="عرض الملف الشخصي"
        >
          <span className="hidden sm:inline">عرض</span>
          <ExternalLink className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
