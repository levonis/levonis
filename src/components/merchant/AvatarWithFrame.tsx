import { memo } from "react";
import { Store } from "lucide-react";

interface AvatarWithFrameProps {
  imageUrl?: string | null;
  frameUrl?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  alt?: string;
  className?: string;
}

const sizeClasses = {
  sm: "h-12 w-12",
  md: "h-16 w-16",
  lg: "h-24 w-24",
  xl: "h-32 w-32",
};

const frameSizeClasses = {
  sm: "h-14 w-14",
  md: "h-20 w-20",
  lg: "h-28 w-28",
  xl: "h-36 w-36",
};

function AvatarWithFrameBase({
  imageUrl,
  frameUrl,
  size = "md",
  alt = "Avatar",
  className = "",
}: AvatarWithFrameProps) {
  const avatarSize = sizeClasses[size];
  const frameSize = frameSizeClasses[size];

  return (
    <div className={`relative flex items-center justify-center ${frameSizeClasses[size]} ${className}`}>
      {/* Frame (behind) */}
      {frameUrl && (
        <img
          src={frameUrl}
          alt="Frame"
          className={`absolute inset-0 ${frameSize} pointer-events-none z-10`}
        />
      )}
      
      {/* Avatar (center, circular) */}
      <div className={`${avatarSize} rounded-full overflow-hidden bg-muted/20 border-2 border-border z-0`}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={alt}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center bg-muted/30">
            <Store className="h-1/2 w-1/2 text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
}

const AvatarWithFrame = memo(AvatarWithFrameBase);
export default AvatarWithFrame;
