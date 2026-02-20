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
    <div className="relative mb-4 overflow-hidden">
      <div className="relative rounded-2xl border border-primary/20 bg-gradient-to-br from-card via-card/95 to-background overflow-hidden shadow-lg">
        {/* Subtle background */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.15),transparent_50%)]" />
        </div>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

        <div className="relative z-10 p-4 sm:p-5">
          <div className="flex gap-4 items-center">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="relative p-0.5 rounded-full bg-gradient-to-br from-primary/30 to-transparent">
                <AvatarWithFrame
                  imageUrl={merchantApp.store_image_url}
                  frameUrl={selectedFrame?.image_url}
                  size="lg"
                  animated
                />
              </div>
              {isOwner && onSettingsClick && (
                <Button
                  size="icon"
                  className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full shadow-lg bg-primary hover:bg-primary/90 border-2 border-background"
                  onClick={onSettingsClick}
                >
                  <Settings className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-black">
                  <span className="bg-gradient-to-l from-primary to-primary/60 bg-clip-text text-transparent">
                    {merchantApp.display_name}
                  </span>
                </h1>
                <CompactBadgesDisplay
                  isVerified={merchantApp.is_verified}
                  badgeTier={(merchantApp.badge_tier || "none") as BadgeTier}
                />
              </div>
              
              {username && <p className="text-[10px] text-muted-foreground">@{username}</p>}
              
              {merchantApp.bio && (
                <p className="text-[11px] text-foreground/70 line-clamp-2 leading-relaxed">{merchantApp.bio}</p>
              )}

              {/* Specialty + Social inline */}
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                {merchantApp.specialty && (
                  <Badge variant="outline" className="gap-1 px-2 py-0.5 text-[9px] font-medium border-primary/30">
                    {merchantApp.specialty === "resin" && <Droplets className="h-2.5 w-2.5 text-blue-400" />}
                    {merchantApp.specialty === "filament" && <Layers className="h-2.5 w-2.5 text-orange-400" />}
                    {merchantApp.specialty === "both" && <><Droplets className="h-2.5 w-2.5 text-blue-400" /><Layers className="h-2.5 w-2.5 text-orange-400" /></>}
                    {getSpecialtyLabel(merchantApp.specialty)}
                  </Badge>
                )}
                {socialLinks?.facebook && (
                  <a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="h-6 w-6 rounded-full bg-muted/50 flex items-center justify-center hover:bg-primary/10 transition-colors">
                    <Facebook className="h-3 w-3 text-blue-500" />
                  </a>
                )}
                {socialLinks?.instagram && (
                  <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="h-6 w-6 rounded-full bg-muted/50 flex items-center justify-center hover:bg-primary/10 transition-colors">
                    <Instagram className="h-3 w-3 text-pink-500" />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {(showContactButton || showBackButton) && (
            <div className="flex gap-2 mt-3 pt-3 border-t border-border/30">
              {showContactButton && onContactClick && (
                <Button size="sm" className="gap-1.5 h-8 text-xs flex-1" onClick={onContactClick}>
                  <MessageCircle className="h-3.5 w-3.5" />تواصل مع التاجر
                </Button>
              )}
              {showBackButton && (
                <Button variant="ghost" size="sm" className="gap-1 h-8 text-xs text-muted-foreground" onClick={() => navigate(-1)}>
                  رجوع<ArrowRight className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
