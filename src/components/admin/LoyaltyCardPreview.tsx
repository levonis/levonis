import { Crown, Gem, Star, Award, Shield, Zap, Sparkles, Gift, Percent, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface LoyaltyCardPreviewProps {
  name_ar: string;
  name_en: string;
  color: string;
  discount_percentage?: number;
  bonus_points_percentage?: number;
  free_shipping?: boolean;
  duration_days?: number;
  benefits?: Array<{ text_ar: string; text_en: string }>;
  is_purchasable?: boolean;
  purchase_price_points?: number;
  min_points?: number;
  size?: "sm" | "md" | "lg";
}

const getCardIcon = (levelKey: string, color: string) => {
  const iconClass = "h-8 w-8 drop-shadow-lg";
  const normalizedKey = levelKey?.toLowerCase() || "";
  
  if (normalizedKey.includes("diamond") || normalizedKey.includes("الماس")) {
    return <Gem className={iconClass} style={{ color }} />;
  }
  if (normalizedKey.includes("platinum") || normalizedKey.includes("بلاتين")) {
    return <Crown className={iconClass} style={{ color }} />;
  }
  if (normalizedKey.includes("gold") || normalizedKey.includes("ذهب")) {
    return <Star className={iconClass} style={{ color }} />;
  }
  if (normalizedKey.includes("silver") || normalizedKey.includes("فض")) {
    return <Shield className={iconClass} style={{ color }} />;
  }
  if (normalizedKey.includes("bronze") || normalizedKey.includes("برونز")) {
    return <Award className={iconClass} style={{ color }} />;
  }
  return <Sparkles className={iconClass} style={{ color }} />;
};

const getGradientStyle = (color: string) => {
  // Parse hex color to RGB
  const hex = color.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // Create lighter and darker variants
  const lighterR = Math.min(255, r + 40);
  const lighterG = Math.min(255, g + 40);
  const lighterB = Math.min(255, b + 40);
  
  const darkerR = Math.max(0, r - 40);
  const darkerG = Math.max(0, g - 40);
  const darkerB = Math.max(0, b - 40);
  
  return {
    background: `linear-gradient(135deg, 
      rgb(${lighterR}, ${lighterG}, ${lighterB}) 0%, 
      rgb(${r}, ${g}, ${b}) 50%, 
      rgb(${darkerR}, ${darkerG}, ${darkerB}) 100%)`,
    boxShadow: `0 10px 30px -10px rgba(${r}, ${g}, ${b}, 0.5), 0 4px 6px -2px rgba(${r}, ${g}, ${b}, 0.3)`,
  };
};

const getTextColor = (color: string) => {
  const hex = color.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#1a1a1a" : "#ffffff";
};

export default function LoyaltyCardPreview({
  name_ar,
  name_en,
  color,
  discount_percentage = 0,
  bonus_points_percentage = 0,
  free_shipping = false,
  duration_days = 30,
  benefits = [],
  is_purchasable = false,
  purchase_price_points = 0,
  min_points = 0,
  size = "md",
}: LoyaltyCardPreviewProps) {
  const gradientStyle = getGradientStyle(color);
  const textColor = getTextColor(color);
  const secondaryTextColor = textColor === "#ffffff" ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.6)";
  
  const sizeClasses = {
    sm: "w-56 h-36",
    md: "w-72 h-44",
    lg: "w-96 h-56",
  };

  return (
    <div
      className={`${sizeClasses[size]} rounded-2xl p-5 relative overflow-hidden transition-all duration-300 hover:scale-105`}
      style={gradientStyle}
    >
      {/* Decorative elements */}
      <div 
        className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-20"
        style={{ backgroundColor: textColor }}
      />
      <div 
        className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full opacity-10"
        style={{ backgroundColor: textColor }}
      />
      
      {/* Card pattern overlay */}
      <div 
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `radial-gradient(circle at 20% 30%, ${textColor} 1px, transparent 1px),
                           radial-gradient(circle at 80% 70%, ${textColor} 1px, transparent 1px)`,
          backgroundSize: "30px 30px",
        }}
      />

      {/* Content */}
      <div className="relative h-full flex flex-col justify-between">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 
              className="text-xl font-bold mb-0.5"
              style={{ color: textColor }}
            >
              {name_ar}
            </h3>
            <p 
              className="text-xs uppercase tracking-wider"
              style={{ color: secondaryTextColor }}
            >
              {name_en}
            </p>
          </div>
          <div className="p-2 rounded-xl" style={{ backgroundColor: `${textColor}15` }}>
            {getCardIcon(name_en, textColor)}
          </div>
        </div>

        {/* Footer badges */}
        <div className="flex flex-wrap gap-1.5">
          {discount_percentage > 0 && (
            <Badge 
              variant="secondary" 
              className="text-[10px] gap-1 bg-white/20 backdrop-blur-sm border-0"
              style={{ color: textColor }}
            >
              <Percent className="h-3 w-3" />
              {discount_percentage}%
            </Badge>
          )}
          {bonus_points_percentage > 0 && (
            <Badge 
              variant="secondary" 
              className="text-[10px] gap-1 bg-white/20 backdrop-blur-sm border-0"
              style={{ color: textColor }}
            >
              <Zap className="h-3 w-3" />
              +{bonus_points_percentage}%
            </Badge>
          )}
          {free_shipping && (
            <Badge 
              variant="secondary" 
              className="text-[10px] gap-1 bg-white/20 backdrop-blur-sm border-0"
              style={{ color: textColor }}
            >
              <Truck className="h-3 w-3" />
              مجاني
            </Badge>
          )}
          <Badge 
            variant="secondary" 
            className="text-[10px] gap-1 bg-white/20 backdrop-blur-sm border-0 mr-auto"
            style={{ color: textColor }}
          >
            {duration_days} يوم
          </Badge>
        </div>
      </div>

      {/* Price tag */}
      <div 
        className="absolute top-3 left-3 text-[10px] px-2 py-1 rounded-full"
        style={{ 
          backgroundColor: `${textColor}20`, 
          color: textColor,
          backdropFilter: "blur(4px)"
        }}
      >
        {is_purchasable ? `${purchase_price_points?.toLocaleString()} نقطة` : `${min_points?.toLocaleString()} نقطة`}
      </div>
    </div>
  );
}
