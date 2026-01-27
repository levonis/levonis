import { Settings, Droplets, Layers, MessageCircle, Facebook, Instagram, ArrowRight, Shield, Award, Zap, Crown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AvatarWithFrame from "./AvatarWithFrame";
import CompactBadgesDisplay from "./CompactBadgesDisplay";
import type { BadgeTier } from "./CompactBadgesDisplay";

interface StoreHeroSectionProps {
  merchantApp: {
    display_name: string;
    bio: string | null;
    store_image_url: string | null;
    specialty?: string | null;
    is_verified?: boolean;
    badge_tier?: string | null;
  };
  selectedFrame?: { image_url: string } | null;
  socialLinks?: { facebook?: string; instagram?: string } | null;
  isOwner?: boolean;
  username?: string;
  onSettingsClick?: () => void;
  onContactClick?: () => void;
  showContactButton?: boolean;
  showBackButton?: boolean;
}

export default function StoreHeroSection({
  merchantApp,
  selectedFrame,
  socialLinks,
  isOwner,
  username,
  onSettingsClick,
  onContactClick,
  showContactButton = true,
  showBackButton = true,
}: StoreHeroSectionProps) {
  const navigate = useNavigate();

  const getSpecialtyLabel = (specialty?: string | null) => {
    if (specialty === "resin") return "متخصص رزن";
    if (specialty === "filament") return "متخصص فلمنت";
    if (specialty === "both") return "رزن وفلمنت";
    return null;
  };

  const getBadgeTierIcon = (tier?: string | null) => {
    if (tier === "gold" || tier === "emerald") return Crown;
    if (tier === "silver") return Award;
    return Shield;
  };

  const TierIcon = getBadgeTierIcon(merchantApp.badge_tier);

  return (
    <div className="relative mb-8 overflow-hidden">
      {/* Premium Glass Container */}
      <div className="relative rounded-[2rem] border border-primary/20 bg-gradient-to-br from-card via-card/95 to-background overflow-hidden shadow-2xl shadow-primary/5">
        {/* Animated Background Pattern */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.15),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,hsl(var(--primary)/0.1),transparent_50%)]" />
          <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(135deg,transparent_40%,hsl(var(--primary)/0.03)_50%,transparent_60%)]" />
        </div>
        
        {/* Decorative Orbs */}
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-primary/15 rounded-full blur-3xl" />
        
        {/* Accent Lines */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

        <div className="relative z-10 p-6 sm:p-10 lg:p-12">
          <div className="flex flex-col lg:flex-row gap-8 items-center lg:items-start">
            {/* Avatar Section */}
            <div className="flex flex-col items-center gap-4">
              <div className="relative group">
                {/* Glow Effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/40 to-primary/10 rounded-full blur-2xl scale-110 opacity-0 group-hover:opacity-100 transition-all duration-700" />
                
                {/* Avatar Ring */}
                <div className="relative p-1 rounded-full bg-gradient-to-br from-primary/30 via-primary/10 to-transparent">
                  <AvatarWithFrame
                    imageUrl={merchantApp.store_image_url}
                    frameUrl={selectedFrame?.image_url}
                    size="xl"
                    animated
                  />
                </div>
                
                {/* Settings Button */}
                {isOwner && onSettingsClick && (
                  <Button
                    size="icon"
                    className="absolute -bottom-1 -right-1 h-11 w-11 rounded-full shadow-xl bg-primary hover:bg-primary/90 border-4 border-background hover:scale-110 transition-all duration-300"
                    onClick={onSettingsClick}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Specialty Badge */}
              {merchantApp.specialty && (
                <Badge 
                  variant="outline" 
                  className="gap-1.5 px-4 py-2 text-xs font-medium bg-gradient-to-r from-background/80 to-background/60 backdrop-blur-md border-primary/30 shadow-lg"
                >
                  {merchantApp.specialty === "resin" && <Droplets className="h-3.5 w-3.5 text-blue-400" />}
                  {merchantApp.specialty === "filament" && <Layers className="h-3.5 w-3.5 text-orange-400" />}
                  {merchantApp.specialty === "both" && (
                    <>
                      <Droplets className="h-3.5 w-3.5 text-blue-400" />
                      <Layers className="h-3.5 w-3.5 text-orange-400" />
                    </>
                  )}
                  <span className="text-foreground/80">{getSpecialtyLabel(merchantApp.specialty)}</span>
                </Badge>
              )}
            </div>

            {/* Store Info */}
            <div className="flex-1 text-center lg:text-right space-y-4">
              {/* Name & Badges */}
              <div className="space-y-2">
                <div className="flex flex-col lg:flex-row items-center lg:items-start gap-3">
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight">
                    <span className="bg-gradient-to-l from-primary via-primary to-primary/60 bg-clip-text text-transparent">
                      {merchantApp.display_name}
                    </span>
                  </h1>
                  <CompactBadgesDisplay
                    isVerified={merchantApp.is_verified}
                    badgeTier={(merchantApp.badge_tier || "none") as BadgeTier}
                  />
                </div>
                
                {username && (
                  <p className="text-sm text-muted-foreground font-medium">@{username}</p>
                )}
                
                <p className="text-xs text-muted-foreground/70 flex items-center gap-2 justify-center lg:justify-start">
                  <Zap className="h-3 w-3 text-primary" />
                  متجر معتمد في مجتمع ليفو للطباعة ثلاثية الأبعاد
                </p>
              </div>

              {/* Bio */}
              {merchantApp.bio && (
                <div className="relative max-w-2xl mx-auto lg:mx-0">
                  <div className="absolute -right-4 top-0 bottom-0 w-1 bg-gradient-to-b from-primary/50 via-primary/20 to-transparent rounded-full hidden lg:block" />
                  <p className="text-sm text-foreground/75 leading-relaxed whitespace-pre-wrap lg:pr-6">
                    {merchantApp.bio}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3 justify-center lg:justify-start pt-2">
                {showContactButton && onContactClick && (
                  <Button
                    size="lg"
                    className="gap-2.5 h-12 px-6 text-sm font-semibold shadow-xl hover:shadow-2xl hover:shadow-primary/20 transition-all duration-300 bg-gradient-to-r from-primary to-primary/90"
                    onClick={onContactClick}
                  >
                    <MessageCircle className="h-4 w-4" />
                    تواصل مع التاجر
                  </Button>
                )}
                
                {socialLinks?.facebook && (
                  <Button
                    variant="outline"
                    size="lg"
                    className="gap-2 h-12 bg-background/50 backdrop-blur-sm border-border/50 hover:bg-primary/5 hover:border-primary/30 transition-all"
                    asChild
                  >
                    <a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer">
                      <Facebook className="h-4 w-4 text-blue-500" />
                      فيسبوك
                    </a>
                  </Button>
                )}
                
                {socialLinks?.instagram && (
                  <Button
                    variant="outline"
                    size="lg"
                    className="gap-2 h-12 bg-background/50 backdrop-blur-sm border-border/50 hover:bg-primary/5 hover:border-primary/30 transition-all"
                    asChild
                  >
                    <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer">
                      <Instagram className="h-4 w-4 text-pink-500" />
                      إنستقرام
                    </a>
                  </Button>
                )}
                
                {showBackButton && (
                  <Button 
                    variant="ghost" 
                    size="lg" 
                    className="gap-2 h-12 text-muted-foreground hover:text-foreground"
                    onClick={() => navigate(-1)}
                  >
                    رجوع
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
