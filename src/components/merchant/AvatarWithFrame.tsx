import { memo } from "react";
import { Store, User } from "lucide-react";
import { getFrameAnimationClass } from "@/hooks/useUserCardFrame";

export type FrameAnimationType = "pulse" | "shimmer" | "glow" | "rainbow" | "sparkle" | "rotate" | null;

interface AvatarWithFrameProps {
  imageUrl?: string | null;
  frameUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  alt?: string;
  animated?: boolean;
  animationType?: FrameAnimationType;
  /** Badge color for card holders */
  badgeColor?: string | null;
  /** Show user icon instead of store icon for non-merchants */
  isUser?: boolean;
}

// Container size = overall size including frame
const containerSizeClasses = {
  xs: "h-10 w-10",
  sm: "h-14 w-14",
  md: "h-18 w-18",
  lg: "h-24 w-24",
  xl: "h-32 w-32",
};

// Container pixel sizes for calculations
const containerSizes = {
  xs: 40,
  sm: 56,
  md: 72,
  lg: 96,
  xl: 128,
};

// Avatar should be 85% of container, leaving 7.5% on each side for frame (tighter fit)
const avatarPercentage = 0.85;

const badgeSizeClasses = {
  xs: "h-2.5 w-2.5 -bottom-0.5 -right-0.5",
  sm: "h-3 w-3 -bottom-0.5 -right-0.5",
  md: "h-4 w-4 -bottom-1 -right-1",
  lg: "h-5 w-5 -bottom-1.5 -right-1.5",
  xl: "h-6 w-6 -bottom-2 -right-2",
};

function AvatarWithFrameBase({
  imageUrl,
  frameUrl,
  size = "md",
  alt = "Avatar",
  animated = false,
  animationType = null,
  badgeColor = null,
  isUser = false,
}: AvatarWithFrameProps) {
  const animationClass = animated 
    ? getFrameAnimationClass(animationType) 
    : "";

  const FallbackIcon = isUser ? User : Store;
  const hasFrame = !!frameUrl;

  // Calculate avatar size based on container
  const containerPx = containerSizes[size];
  const avatarPx = Math.round(containerPx * avatarPercentage);

  return (
    <div 
      className={`relative flex items-center justify-center ${containerSizeClasses[size]}`}
      style={{ width: containerPx, height: containerPx }}
    >
      {/* Frame fills the entire container - this IS the border */}
      {hasFrame && (
        <img
          src={frameUrl}
          alt="Frame"
          className={`absolute inset-0 w-full h-full pointer-events-none z-10 ${animationClass}`}
          style={animated && !animationType ? {
            filter: "drop-shadow(0 0 4px hsl(var(--primary) / 0.5))",
          } : undefined}
        />
      )}

      {/* Avatar (Circular) - smaller than container, centered */}
      <div
        className={`rounded-full overflow-hidden ${
          hasFrame ? "border-0" : "border-2 border-border"
        } bg-muted/30 z-0 flex items-center justify-center`}
        style={{ 
          width: hasFrame ? avatarPx : avatarPx + 4, 
          height: hasFrame ? avatarPx : avatarPx + 4 
        }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={alt}
            className="h-full w-full object-cover"
          />
        ) : (
          <FallbackIcon className="h-1/2 w-1/2 text-muted-foreground" />
        )}
      </div>

      {/* Card badge indicator */}
      {badgeColor && (
        <div 
          className={`absolute ${badgeSizeClasses[size]} rounded-full border-2 border-background z-20`}
          style={{ backgroundColor: badgeColor }}
          title="حامل بطاقة"
        />
      )}

      {/* Glow effect behind avatar when animated */}
      {animated && hasFrame && (
        <div 
          className="absolute inset-0 rounded-full animate-avatar-frame-glow opacity-50 -z-10"
          style={{
            background: "radial-gradient(circle, hsl(var(--primary) / 0.3) 0%, transparent 70%)",
          }}
        />
      )}
    </div>
  );
}

const AvatarWithFrame = memo(AvatarWithFrameBase);
export default AvatarWithFrame;
