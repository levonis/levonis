import { Settings, Droplets, Layers, MessageCircle, ArrowRight, Shield, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AvatarWithFrame from "./AvatarWithFrame";
import type { BadgeTier } from "./CompactBadgesDisplay";

interface MinimalStoreHeroProps {
  merchantApp: {
    display_name: string;
    bio: string | null;
    store_image_url: string | null;
    specialty?: string | null;
    is_verified?: boolean;
    badge_tier?: string | null;
  };
  selectedFrame?: { image_url: string } | null;
  isOwner?: boolean;
  onSettingsClick?: () => void;
  onContactClick?: () => void;
  showContactButton?: boolean;
}

export default function MinimalStoreHero({
  merchantApp,
  selectedFrame,
  isOwner,
  onSettingsClick,
  onContactClick,
  showContactButton = true,
}: MinimalStoreHeroProps) {
  const navigate = useNavigate();

  const getSpecialtyBadge = (specialty?: string | null) => {
    if (specialty === "resin") return { icon: Droplets, label: "رزن", color: "text-blue-400" };
    if (specialty === "filament") return { icon: Layers, label: "فلمنت", color: "text-orange-400" };
    if (specialty === "both") return { icons: [Droplets, Layers], label: "رزن وفلمنت" };
    return null;
  };

  const specialtyBadge = getSpecialtyBadge(merchantApp.specialty);

  return (
    <div className="relative mb-6">
      <div className="relative rounded-2xl border border-border/50 bg-card overflow-hidden">
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
        
        <div className="relative p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center sm:items-start">
            {/* Avatar */}
            <div className="relative shrink-0">
              <AvatarWithFrame
                imageUrl={merchantApp.store_image_url}
                frameUrl={selectedFrame?.image_url}
                size="lg"
                animated
              />
              {isOwner && onSettingsClick && (
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full shadow-md"
                  onClick={onSettingsClick}
                >
                  <Settings className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 text-center sm:text-right min-w-0">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">
                  {merchantApp.display_name}
                </h1>
                <div className="flex items-center gap-1.5">
                  {merchantApp.is_verified && (
                    <Badge variant="secondary" className="gap-1 text-[10px] h-5">
                      <CheckCircle className="h-3 w-3 text-primary" />
                      موثق
                    </Badge>
                  )}
                  {merchantApp.badge_tier && merchantApp.badge_tier !== "none" && (
                    <Badge variant="outline" className="gap-1 text-[10px] h-5 capitalize">
                      <Shield className="h-3 w-3" />
                      {merchantApp.badge_tier}
                    </Badge>
                  )}
                </div>
              </div>

              {merchantApp.bio && (
                <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 max-w-md">
                  {merchantApp.bio}
                </p>
              )}

              <div className="flex flex-wrap gap-2 mt-3 justify-center sm:justify-start">
                {specialtyBadge && (
                  <Badge variant="outline" className="text-[10px] h-6 gap-1">
                    {"icons" in specialtyBadge ? (
                      <>
                        <Droplets className="h-3 w-3 text-blue-400" />
                        <Layers className="h-3 w-3 text-orange-400" />
                      </>
                    ) : (
                      <specialtyBadge.icon className={`h-3 w-3 ${specialtyBadge.color}`} />
                    )}
                    {specialtyBadge.label}
                  </Badge>
                )}

                {showContactButton && onContactClick && (
                  <Button size="sm" onClick={onContactClick} className="h-6 text-xs gap-1.5 px-3">
                    <MessageCircle className="h-3 w-3" />
                    تواصل
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs gap-1 px-2 text-muted-foreground"
                  onClick={() => navigate(-1)}
                >
                  رجوع
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
