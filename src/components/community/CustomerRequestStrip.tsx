import { useNavigate } from "react-router-dom";
import { User, ExternalLink, MessageSquare, Star, ChevronLeft } from "lucide-react";
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

  const handleViewProfile = () => {
    if (onViewProfile) {
      onViewProfile();
    } else {
      navigate(`/profile/${customerId}`);
    }
  };

  const handleMessage = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/community/messages?user_id=${customerId}`);
  };

  return (
    <div 
      className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-l from-primary/10 via-primary/5 to-transparent border border-primary/20 cursor-pointer hover:border-primary/40 transition-all group"
      onClick={handleViewProfile}
    >
      {/* Avatar */}
      <Avatar className="h-11 w-11 border-2 border-primary/40 shadow-lg shadow-primary/10">
        <AvatarImage src={customerProfile?.avatar_url || undefined} />
        <AvatarFallback className="bg-gradient-to-br from-primary/30 to-primary/10 text-primary">
          <User className="h-5 w-5" />
        </AvatarFallback>
      </Avatar>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-bold text-sm text-foreground truncate group-hover:text-primary transition-colors">
            {displayName}
          </p>
          {isOwner && (
            <Badge variant="outline" className="text-[8px] px-1.5 py-0 h-4 border-primary/40 text-primary font-bold">
              طلبك
            </Badge>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Star className="h-2.5 w-2.5" />
          صاحب الطلب
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        {!isOwner && (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full"
            onClick={handleMessage}
            title="مراسلة"
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-full"
          onClick={(e) => {
            e.stopPropagation();
            handleViewProfile();
          }}
          title="عرض الملف الشخصي"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
