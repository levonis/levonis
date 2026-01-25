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

function AvatarWithFrameBase({
  imageUrl,
  frameUrl,
  size = "md",
  alt = "Avatar",
  animated = false,
}: AvatarWithFrameProps) {
  return (
    <div className={`relative flex items-center justify-center ${frameSizeClasses[size]}`}>
      {/* Animated Frame with multiple animation types */}
      {frameUrl && (
        <img
          src={frameUrl}
          alt="Frame"
          className={`absolute inset-0 w-full h-full pointer-events-none z-10 ${
            animated ? "animate-avatar-frame-pulse" : ""
          }`}
          style={animated ? {
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
          <Store className="h-1/2 w-1/2 text-muted-foreground" />
        )}
      </div>

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
