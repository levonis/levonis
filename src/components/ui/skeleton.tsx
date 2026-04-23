import { cn } from "@/lib/utils";

/**
 * Glassmorphism skeleton: frosted translucent surface with a soft shimmer
 * sweep. Auto-adapts to the active theme via semantic tokens, and falls back
 * to a quiet pulse when the user prefers reduced motion.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "skeleton-glass relative overflow-hidden rounded-md",
        "border border-foreground/5 bg-foreground/[0.04] backdrop-blur-xl",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
