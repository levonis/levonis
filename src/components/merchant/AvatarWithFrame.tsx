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

// Container size = frame size (frame IS the border)
const containerSizeClasses = {
  xs: "h-8 w-8",
  sm: "h-11 w-11",
  md: "h-14 w-14",
  lg: "h-20 w-20",
  xl: "h-28 w-28",
};

// Avatar fills the container completely, frame overlays as border
const avatarSizeClasses = {
  xs: "h-6 w-6",
  sm: "h-9 w-9",
  md: "h-12 w-12",
  lg: "h-16 w-16",
  xl: "h-24 w-24",
};

const badgeSizeClasses = {
  xs: "h-2.5 w-2.5 -bottom-0 -right-0",
  sm: "h-3 w-3 -bottom-0 -right-0",
  md: "h-4 w-4 -bottom-0.5 -right-0.5",
  lg: "h-5 w-5 -bottom-1 -right-1",
  xl: "h-6 w-6 -bottom-1 -right-1",
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

  return (
    <div className={`relative flex items-center justify-center ${containerSizeClasses[size]}`}>
      {/* Frame overlays exactly on the avatar edge - acting as the border */}
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

      {/* Avatar (Circular) - no border when frame exists */}
      <div
        className={`${avatarSizeClasses[size]} rounded-full overflow-hidden ${
          hasFrame ? "border-0" : "border-2 border-border"
        } bg-muted/30 z-0 flex items-center justify-center`}
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
