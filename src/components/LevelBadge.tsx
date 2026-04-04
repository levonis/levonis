import { Award, Star, Crown, Trophy, Gem } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface LevelBadgeProps {
  userId: string;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

const getLevelIcon = (levelKey: string, size: number, isVipPlus?: boolean) => {
  const iconProps = { size, className: "inline" };
  
  if (isVipPlus) {
    return <img src="/frames/levo-vip-badge.png" alt="VIP+" width={size} height={size} className="inline" />;
  }
  
  switch (levelKey) {
    case "bronze":
      return <Award {...iconProps} />;
    case "silver":
      return <Star {...iconProps} />;
    case "gold":
      return <Crown {...iconProps} />;
    case "platinum":
      return <Trophy {...iconProps} />;
    default:
      return <Award {...iconProps} />;
  }
};

export default function LevelBadge({ 
  userId, 
  size = "md", 
  showLabel = true,
  className = ""
}: LevelBadgeProps) {
  const { data: userPoints } = useQuery({
    queryKey: ["userPoints", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc("get_user_level", { p_user_id: userId });
      
      if (error) throw error;
      return { level: data || "0" };
    },
    enabled: !!userId,
  });

  const { data: levelInfo } = useQuery({
    queryKey: ["levelInfo", userPoints?.level],
    queryFn: async () => {
      if (!userPoints?.level) return null;
      
      const { data, error } = await supabase
        .from("loyalty_levels")
        .select("*")
        .eq("level_key", userPoints.level)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!userPoints?.level,
  });

  if (!levelInfo) return null;

  const sizeMap = {
    sm: { badge: "text-[10px] px-1.5 py-0.5", icon: 12 },
    md: { badge: "text-xs px-2 py-1", icon: 14 },
    lg: { badge: "text-sm px-3 py-1.5", icon: 16 },
  };

  const badgeSize = sizeMap[size];

  return (
    <Badge
      className={`${badgeSize.badge} font-bold border-2 ${className}`}
      style={{
        backgroundColor: `${levelInfo.color}15`,
        borderColor: levelInfo.color,
        color: levelInfo.color,
      }}
    >
      {getLevelIcon(levelInfo.level_key, badgeSize.icon)}
      {showLabel && (
        <span className="mr-1">{levelInfo.name_ar}</span>
      )}
    </Badge>
  );
}