import { Crown, Gem, Star, Award, Shield, Zap, Sparkles, Percent, Truck, Headphones, Check, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface UserLoyaltyCardProps {
  level: {
    id: string;
    name_ar: string;
    name_en: string;
    color: string;
    discount_percentage?: number;
    bonus_points_percentage?: number;
    free_shipping?: boolean;
    free_shipping_min_order?: number;
    duration_days?: number;
    benefits?: Array<{ text_ar: string; text_en: string }>;
    vip_support?: boolean;
    special_name_style?: { enabled: boolean; color?: string; glow?: boolean; badge_icon?: string };
    profile_effects?: { enabled: boolean; border_color?: string; background_glow?: boolean; avatar_frame?: string };
    priority_shipping?: boolean;
    early_access?: boolean;
    exclusive_products?: boolean;
  };
  expiresAt?: string;
  isActive?: boolean;
  showDetails?: boolean;
  className?: string;
}

const getCardIcon = (levelKey: string, size: string = "h-6 w-6") => {
  const normalizedKey = levelKey?.toLowerCase() || "";
  
  if (normalizedKey.includes("diamond") || normalizedKey.includes("الماس") || normalizedKey.includes("vip+")) {
    return <Gem className={size} />;
  }
  if (normalizedKey.includes("platinum") || normalizedKey.includes("بلاتين") || normalizedKey.includes("vip")) {
    return <Crown className={size} />;
  }
  if (normalizedKey.includes("gold") || normalizedKey.includes("ذهب") || normalizedKey.includes("برو")) {
    return <Star className={size} />;
  }
  if (normalizedKey.includes("silver") || normalizedKey.includes("فض") || normalizedKey.includes("كلاسك")) {
    return <Shield className={size} />;
  }
  if (normalizedKey.includes("bronze") || normalizedKey.includes("برونز")) {
    return <Award className={size} />;
  }
  return <Sparkles className={size} />;
};

const getGradientStyle = (color: string) => {
  const hex = color.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
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
    boxShadow: `0 10px 30px -10px rgba(${r}, ${g}, ${b}, 0.4)`,
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

export default function UserLoyaltyCard({
  level,
  expiresAt,
  isActive = true,
  showDetails = true,
  className,
}: UserLoyaltyCardProps) {
  const gradientStyle = getGradientStyle(level.color);
  const textColor = getTextColor(level.color);
  const secondaryTextColor = textColor === "#ffffff" ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.65)";
  
  const daysRemaining = expiresAt 
    ? Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const benefits = [
    ...(level.discount_percentage && level.discount_percentage > 0 
      ? [{ icon: Percent, text: `خصم ${level.discount_percentage}% على جميع المنتجات` }] 
      : []),
    ...(level.bonus_points_percentage && level.bonus_points_percentage > 0 
      ? [{ icon: Zap, text: `نقاط إضافية ${level.bonus_points_percentage}%` }] 
      : []),
    ...(level.free_shipping 
      ? [{ icon: Truck, text: level.free_shipping_min_order && level.free_shipping_min_order > 0 
          ? `شحن مجاني للطلبات أكثر من ${level.free_shipping_min_order.toLocaleString()} د.ع` 
          : 'شحن مجاني على جميع الطلبات' }] 
      : []),
    ...(level.vip_support 
      ? [{ icon: Headphones, text: 'دعم عملاء مميز وأولوية الرد' }] 
      : []),
    ...(level.priority_shipping 
      ? [{ icon: Truck, text: 'أولوية في الشحن والتوصيل' }] 
      : []),
    ...(level.early_access 
      ? [{ icon: Sparkles, text: 'الوصول المبكر للمنتجات الجديدة' }] 
      : []),
    ...(level.exclusive_products 
      ? [{ icon: Crown, text: 'منتجات حصرية لحاملي البطاقة' }] 
      : []),
    ...(level.benefits || []).map((b: { text_ar: string }) => ({ icon: Check, text: b.text_ar })),
  ];

  return (
    <div className={cn("space-y-4", className)}>
      {/* Card visual */}
      <div
        className="w-full aspect-[1.6/1] max-w-sm mx-auto rounded-2xl relative overflow-hidden transition-all duration-300 hover:scale-[1.02]"
        style={gradientStyle}
      >
        {/* Top shine */}
        <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-white/20 to-transparent" />
        
        {/* Decorative elements */}
        <div 
          className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-20"
          style={{ backgroundColor: textColor }}
        />
        <div 
          className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full opacity-15"
          style={{ backgroundColor: textColor }}
        />

        {/* Content */}
        <div className="relative h-full flex flex-col justify-between p-5">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h3 
                className="text-xl font-bold mb-0.5"
                style={{ color: textColor }}
              >
                {level.name_ar}
              </h3>
              <p 
                className="text-xs uppercase tracking-wider opacity-75"
                style={{ color: secondaryTextColor }}
              >
                {level.name_en}
              </p>
            </div>
            <div 
              className="p-2.5 rounded-xl"
              style={{ backgroundColor: `${textColor}15`, color: textColor }}
            >
              {getCardIcon(level.name_en, "h-7 w-7")}
            </div>
          </div>

          {/* Status badges */}
          <div className="flex flex-wrap gap-1.5 items-end justify-between mt-auto">
            <div className="flex flex-wrap gap-1.5">
              {isActive && (
                <Badge 
                  className="text-[10px] gap-1 bg-green-500/80 border-0 font-medium text-white"
                >
                  <Check className="h-3 w-3" />
                  نشطة
                </Badge>
              )}
              {level.vip_support && (
                <Badge 
                  className="text-[10px] gap-1 bg-white/20 backdrop-blur-sm border-0"
                  style={{ color: textColor }}
                >
                  <Headphones className="h-3 w-3" />
                  VIP
                </Badge>
              )}
            </div>
            {daysRemaining !== null && (
              <Badge 
                className="text-[10px] gap-1 bg-white/20 backdrop-blur-sm border-0"
                style={{ color: textColor }}
              >
                <Clock className="h-3 w-3" />
                {daysRemaining} يوم متبقي
              </Badge>
            )}
          </div>
        </div>

        {/* Chip */}
        <div className="absolute top-5 left-5">
          <div 
            className="w-9 h-6 rounded opacity-60"
            style={{
              background: `linear-gradient(135deg, ${textColor}40 0%, ${textColor}20 100%)`,
            }}
          />
        </div>
      </div>

      {/* Benefits list */}
      {showDetails && benefits.length > 0 && (
        <div className="space-y-2 px-1">
          <h4 className="text-sm font-semibold text-muted-foreground">مزايا البطاقة</h4>
          <div className="grid gap-2">
            {benefits.map((benefit, idx) => (
              <div 
                key={idx}
                className="flex items-start gap-2.5 p-2.5 rounded-lg bg-muted/50"
              >
                <div 
                  className="p-1.5 rounded-md shrink-0"
                  style={{ backgroundColor: `${level.color}20` }}
                >
                  <benefit.icon className="h-3.5 w-3.5" style={{ color: level.color }} />
                </div>
                <span className="text-sm">{benefit.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}