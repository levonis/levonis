import { memo } from "react";
import { Store } from "lucide-react";

interface AvatarWithFrameProps {
  imageUrl?: string | null;
  frameUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  alt?: string;
  animated?: boolean;
}

const frameSizeClasses = {
  xs: "h-12 w-12",
  sm: "h-16 w-16",
  md: "h-24 w-24",
  lg: "h-32 w-32",
  xl: "h-40 w-40",
};

const avatarSizeClasses = {
  xs: "h-8 w-8",
  sm: "h-11 w-11",
  md: "h-17 w-17",
  lg: "h-23 w-23",
  xl: "h-29 w-29",
};

const iconSizeClasses = {
  xs: "h-3.5 w-3.5",
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
  xl: "h-10 w-10",
};

function AvatarWithFrameBase({
  imageUrl,
  frameUrl,
  size = "md",
  alt = "Avatar",
  animated = false,
}: AvatarWithFrameProps) {
  return (
    <div className={`relative flex items-center justify-center ${frameSizeClasses[size]}`}>
      {/* Animated Frame with multiple effects */}
      {frameUrl && (
        <img
          src={frameUrl}
          alt="Frame"
          className={`absolute inset-0 w-full h-full pointer-events-none z-10 ${
            animated 
              ? "animate-avatar-frame-glow" 
              : ""
          }`}
          style={{
            filter: animated ? undefined : "drop-shadow(0 0 2px hsl(var(--primary) / 0.3))",
          }}
        />
      )}

      {/* Secondary glow layer for enhanced effect */}
      {frameUrl && animated && (
        <div 
          className="absolute inset-0 w-full h-full pointer-events-none z-[5] animate-avatar-frame-pulse opacity-60"
          style={{
            background: "radial-gradient(circle, hsl(var(--primary) / 0.15) 0%, transparent 70%)",
          }}
        />
      )}

      {/* Avatar (Circular) */}
      <div
        className={`${avatarSizeClasses[size]} rounded-full overflow-hidden border-2 border-border/50 bg-muted/30 z-0 flex items-center justify-center shadow-inner`}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={alt}
            className="h-full w-full object-cover"
          />
        ) : (
          <Store className={`${iconSizeClasses[size]} text-muted-foreground`} />
        )}
      </div>
    </div>
  );
}

const AvatarWithFrame = memo(AvatarWithFrameBase);
export default AvatarWithFrame;
