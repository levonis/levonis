import { Crown, Gem, Star, Award, Shield, Zap, Sparkles, Gift, Percent, Truck, Headphones, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface LoyaltyCardPreviewProps {
  name_ar: string;
  name_en: string;
  color: string;
  discount_percentage?: number;
  bonus_points_percentage?: number;
  free_shipping?: boolean;
  free_shipping_min_order?: number;
  duration_days?: number;
  benefits?: Array<{ text_ar: string; text_en: string }>;
  is_purchasable?: boolean;
  purchase_price_points?: number;
  min_points?: number;
  vip_support?: boolean;
  special_name_style?: { enabled: boolean; color?: string; glow?: boolean; badge_icon?: string };
  profile_effects?: { enabled: boolean; border_color?: string; background_glow?: boolean; avatar_frame?: string };
  size?: "sm" | "md" | "lg";
  showUserView?: boolean;
}

const getCardIcon = (levelKey: string, color: string) => {
  const iconClass = "h-8 w-8 drop-shadow-lg";
  const normalizedKey = levelKey?.toLowerCase() || "";
  
  if (normalizedKey.includes("diamond") || normalizedKey.includes("الماس") || normalizedKey.includes("vip+")) {
    return <Gem className={iconClass} style={{ color }} />;
  }
  if (normalizedKey.includes("platinum") || normalizedKey.includes("بلاتين") || normalizedKey.includes("vip")) {
    return <Crown className={iconClass} style={{ color }} />;
  }
  if (normalizedKey.includes("gold") || normalizedKey.includes("ذهب") || normalizedKey.includes("برو")) {
    return <Star className={iconClass} style={{ color }} />;
  }
  if (normalizedKey.includes("silver") || normalizedKey.includes("فض") || normalizedKey.includes("كلاسك")) {
    return <Shield className={iconClass} style={{ color }} />;
  }
  if (normalizedKey.includes("bronze") || normalizedKey.includes("برونز")) {
    return <Award className={iconClass} style={{ color }} />;
  }
  return <Sparkles className={iconClass} style={{ color }} />;
};

const getGradientStyle = (color: string) => {
  const hex = color.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  const lighterR = Math.min(255, r + 50);
  const lighterG = Math.min(255, g + 50);
  const lighterB = Math.min(255, b + 50);
  
  const darkerR = Math.max(0, r - 50);
  const darkerG = Math.max(0, g - 50);
  const darkerB = Math.max(0, b - 50);

  const shimmerR = Math.min(255, r + 100);
  const shimmerG = Math.min(255, g + 100);
  const shimmerB = Math.min(255, b + 100);
  
  return {
    background: `linear-gradient(135deg, 
      rgb(${shimmerR}, ${shimmerG}, ${shimmerB}) 0%,
      rgb(${lighterR}, ${lighterG}, ${lighterB}) 25%, 
      rgb(${r}, ${g}, ${b}) 50%, 
      rgb(${darkerR}, ${darkerG}, ${darkerB}) 100%)`,
    boxShadow: `0 20px 40px -15px rgba(${r}, ${g}, ${b}, 0.5), 
                0 10px 20px -5px rgba(${r}, ${g}, ${b}, 0.3),
                inset 0 1px 0 rgba(255,255,255,0.2)`,
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
  free_shipping_min_order = 0,
  duration_days = 30,
  benefits = [],
  is_purchasable = false,
  purchase_price_points = 0,
  min_points = 0,
  vip_support = false,
  special_name_style,
  profile_effects,
  size = "md",
  showUserView = false,
}: LoyaltyCardPreviewProps) {
  const gradientStyle = getGradientStyle(color);
  const textColor = getTextColor(color);
  const secondaryTextColor = textColor === "#ffffff" ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.65)";
  
  const sizeClasses = {
    sm: "w-56 h-36",
    md: "w-80 h-48",
    lg: "w-[400px] h-60",
  };

  const hasGlowEffect = special_name_style?.glow || profile_effects?.background_glow;

  return (
    <div
      className={`${sizeClasses[size]} rounded-2xl relative overflow-hidden transition-all duration-500 hover:scale-[1.02] group`}
      style={{
        ...gradientStyle,
        ...(hasGlowEffect && {
          animation: "pulse 3s ease-in-out infinite",
        })
      }}
    >
      {/* Holographic effect overlay */}
      <div 
        className="absolute inset-0 opacity-30 bg-gradient-to-br from-transparent via-white/10 to-transparent 
                   transform -translate-x-full group-hover:translate-x-full transition-transform duration-1000"
      />
      
      {/* Top shine */}
      <div 
        className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-white/20 to-transparent"
      />

      {/* Decorative circles */}
      <div 
        className="absolute -top-16 -right-16 w-40 h-40 rounded-full opacity-20 blur-sm"
        style={{ backgroundColor: textColor }}
      />
      <div 
        className="absolute -bottom-12 -left-12 w-32 h-32 rounded-full opacity-15 blur-sm"
        style={{ backgroundColor: textColor }}
      />
      
      {/* Card pattern overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(circle at 20% 30%, ${textColor} 2px, transparent 2px),
                           radial-gradient(circle at 80% 70%, ${textColor} 2px, transparent 2px)`,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Chip / Logo area */}
      <div className="absolute top-4 left-4 flex flex-col gap-1">
        <div 
          className="w-10 h-7 rounded-md opacity-80"
          style={{
            background: `linear-gradient(135deg, ${textColor}40 0%, ${textColor}20 100%)`,
            backdropFilter: "blur(4px)"
          }}
        />
      </div>

      {/* Content */}
      <div className="relative h-full flex flex-col justify-between p-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 
              className="text-2xl font-bold mb-1 tracking-wide"
              style={{ 
                color: textColor,
                textShadow: special_name_style?.glow ? `0 0 10px ${textColor}` : 'none'
              }}
            >
              {name_ar}
            </h3>
            <p 
              className="text-xs uppercase tracking-[0.2em] font-medium"
              style={{ color: secondaryTextColor }}
            >
              {name_en}
            </p>
          </div>
          <div 
            className="p-3 rounded-2xl backdrop-blur-sm transition-transform group-hover:scale-110 group-hover:rotate-6"
            style={{ backgroundColor: `${textColor}15` }}
          >
            {getCardIcon(name_en, textColor)}
          </div>
        </div>

        {/* Middle - Benefits icons */}
        <div className="flex items-center gap-3">
          {vip_support && (
            <div 
              className="p-2 rounded-lg backdrop-blur-sm"
              style={{ backgroundColor: `${textColor}15` }}
              title="دعم عملاء مميز"
            >
              <Headphones className="h-4 w-4" style={{ color: textColor }} />
            </div>
          )}
          {special_name_style?.enabled && (
            <div 
              className="p-2 rounded-lg backdrop-blur-sm"
              style={{ backgroundColor: `${textColor}15` }}
              title="اسم مميز"
            >
              <User className="h-4 w-4" style={{ color: textColor }} />
            </div>
          )}
          {(discount_percentage || 0) > 0 && (
            <div 
              className="p-2 rounded-lg backdrop-blur-sm"
              style={{ backgroundColor: `${textColor}15` }}
              title={`خصم ${discount_percentage}%`}
            >
              <Percent className="h-4 w-4" style={{ color: textColor }} />
            </div>
          )}
          {(bonus_points_percentage || 0) > 0 && (
            <div 
              className="p-2 rounded-lg backdrop-blur-sm"
              style={{ backgroundColor: `${textColor}15` }}
              title={`نقاط إضافية ${bonus_points_percentage}%`}
            >
              <Zap className="h-4 w-4" style={{ color: textColor }} />
            </div>
          )}
        </div>

        {/* Footer badges */}
        <div className="flex flex-wrap gap-1.5 items-end justify-between">
          <div className="flex flex-wrap gap-1.5">
            {(discount_percentage || 0) > 0 && (
              <Badge 
                variant="secondary" 
                className="text-[10px] gap-1 bg-white/20 backdrop-blur-md border-0 font-semibold"
                style={{ color: textColor }}
              >
                <Percent className="h-3 w-3" />
                خصم {discount_percentage}%
              </Badge>
            )}
            {(bonus_points_percentage || 0) > 0 && (
              <Badge 
                variant="secondary" 
                className="text-[10px] gap-1 bg-white/20 backdrop-blur-md border-0 font-semibold"
                style={{ color: textColor }}
              >
                <Zap className="h-3 w-3" />
                +{bonus_points_percentage}% نقاط
              </Badge>
            )}
            {free_shipping && (
              <Badge 
                variant="secondary" 
                className="text-[10px] gap-1 bg-white/20 backdrop-blur-md border-0 font-semibold"
                style={{ color: textColor }}
              >
                <Truck className="h-3 w-3" />
                {free_shipping_min_order > 0 ? `شحن مجاني +${(free_shipping_min_order / 1000).toFixed(0)}ألف` : 'شحن مجاني'}
              </Badge>
            )}
          </div>
          <Badge 
            variant="secondary" 
            className="text-[10px] gap-1 bg-white/20 backdrop-blur-md border-0 font-semibold"
            style={{ color: textColor }}
          >
            {duration_days} يوم
          </Badge>
        </div>
      </div>

      {/* Price tag */}
      <div 
        className="absolute top-4 right-4 text-[11px] px-3 py-1.5 rounded-full font-bold"
        style={{ 
          backgroundColor: `${textColor}25`, 
          color: textColor,
          backdropFilter: "blur(8px)"
        }}
      >
        {is_purchasable ? `${purchase_price_points?.toLocaleString()} نقطة` : `${min_points?.toLocaleString()} نقطة`}
      </div>

      {/* VIP Support indicator */}
      {vip_support && (
        <div 
          className="absolute bottom-4 right-4 text-[9px] px-2 py-1 rounded-full flex items-center gap-1"
          style={{ 
            backgroundColor: `${textColor}20`, 
            color: textColor,
          }}
        >
          <Headphones className="h-3 w-3" />
          VIP
        </div>
      )}
    </div>
  );
}