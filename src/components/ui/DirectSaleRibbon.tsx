import { memo } from "react";

/**
 * Diagonal ribbon badge for "بيع مباشر" (Direct Sale) products.
 * Glassmorphism Professional style — translucent gradient with backdrop-blur.
 */
const DirectSaleRibbon = memo(() => (
  <div className="absolute top-0 left-0 z-30 overflow-hidden w-20 h-20 pointer-events-none">
    <div
      className="absolute top-[10px] -left-[22px] w-[110px] text-center rotate-[-45deg] py-[3px] text-[9px] font-bold tracking-wide"
      style={{
        background:
          "linear-gradient(135deg, hsl(var(--primary) / 0.85), hsl(var(--accent-red) / 0.6))",
        color: "hsl(var(--primary-foreground))",
        WebkitBackdropFilter: "blur(8px) saturate(1.4)",
        backdropFilter: "blur(8px) saturate(1.4)",
        border: "1px solid hsl(0 0% 100% / 0.18)",
        boxShadow:
          "0 4px 14px hsl(var(--primary) / 0.45), inset 0 1px 0 hsl(0 0% 100% / 0.25)",
        textShadow: "0 1px 2px rgba(0,0,0,0.25)",
      }}
    >
      بيع مباشر
    </div>
  </div>
));

DirectSaleRibbon.displayName = "DirectSaleRibbon";
export default DirectSaleRibbon;
