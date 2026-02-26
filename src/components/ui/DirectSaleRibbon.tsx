import { memo } from "react";

/**
 * Diagonal ribbon badge for "بيع مباشر" (Direct Sale) products.
 * Positioned at the top-left corner of a relatively-positioned parent.
 */
const DirectSaleRibbon = memo(() => (
  <div className="absolute top-0 left-0 z-30 overflow-hidden w-20 h-20 pointer-events-none">
    <div
      className="absolute top-[10px] -left-[22px] w-[110px] text-center rotate-[-45deg] py-[3px] text-[9px] font-bold tracking-wide shadow-md"
      style={{
        background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))",
        color: "hsl(var(--primary-foreground))",
        boxShadow: "0 2px 8px hsl(var(--primary) / 0.35)",
        textShadow: "0 1px 2px rgba(0,0,0,0.15)",
      }}
    >
      بيع مباشر
    </div>
  </div>
));

DirectSaleRibbon.displayName = "DirectSaleRibbon";
export default DirectSaleRibbon;
