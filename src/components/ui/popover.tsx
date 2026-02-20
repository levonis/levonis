import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { cn } from "@/lib/utils";

const Popover = PopoverPrimitive.Root;

const PopoverTrigger = PopoverPrimitive.Trigger;

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, side = "bottom", ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      side={side}
      sideOffset={sideOffset}
      className={cn(
        "z-[100] w-72 rounded-xl border border-[hsl(var(--border))] p-4 text-popover-foreground shadow-xl outline-none",
        // Professional background matching site theme
        "bg-gradient-to-b from-[hsl(160_52%_18%)] to-[hsl(160_48%_14%)]",
        // Enhanced shadow
        "shadow-[0_8px_24px_hsl(160_50%_8%/0.4),0_2px_8px_hsl(0_0%_0%/0.2)]",
        // Animations with proper side-aware sliding
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        "data-[side=bottom]:slide-in-from-bottom-2 data-[side=left]:slide-in-from-left-2 data-[side=right]:slide-in-from-right-2 data-[side=top]:slide-in-from-top-2",
        className,
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent };
