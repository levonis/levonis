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

const frameSizeClasses = {
  xs: "h-10 w-10",
  sm: "h-14 w-14",
  md: "h-20 w-20",
  lg: "h-28 w-28",
  xl: "h-36 w-36",
};

const avatarSizeClasses = {
  xs: "h-7 w-7",
  sm: "h-10 w-10",
  md: "h-14 w-14",
  lg: "h-20 w-20",
  xl: "h-26 w-26",
};

const badgeSizeClasses = {
  xs: "h-3 w-3 -bottom-0.5 -right-0.5",
  sm: "h-4 w-4 -bottom-0.5 -right-0.5",
  md: "h-5 w-5 -bottom-1 -right-1",
  lg: "h-6 w-6 -bottom-1 -right-1",
  xl: "h-8 w-8 -bottom-2 -right-2",
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

  return (
    <div className={`relative flex items-center justify-center ${frameSizeClasses[size]}`}>
      {/* Animated Frame with multiple animation types */}
      {frameUrl && (
        <img
          src={frameUrl}
          alt="Frame"
          className={`absolute inset-0 w-full h-full pointer-events-none z-10 ${animationClass}`}
          style={animated && !animationType ? {
            filter: "drop-shadow(0 0 6px hsl(var(--primary) / 0.6))",
          } : undefined}
        />
      )}

      {/* Avatar (Circular) */}
      <div
        className={`${avatarSizeClasses[size]} rounded-full overflow-hidden border-2 border-border bg-muted/30 z-0 flex items-center justify-center`}
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
      {animated && frameUrl && (
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
