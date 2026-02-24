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
        "z-[300] w-72 rounded-xl border border-[hsl(var(--border))] p-4 text-popover-foreground shadow-xl outline-none",
        "bg-popover",
        "shadow-[0_10px_30px_hsl(var(--foreground)/0.2)]",
        "data-[side=bottom]:animate-[dropdown-in-bottom_160ms_cubic-bezier(0.16,1,0.3,1)] data-[side=top]:animate-[dropdown-in-top_160ms_cubic-bezier(0.16,1,0.3,1)] data-[side=left]:animate-[dropdown-in-left_160ms_cubic-bezier(0.16,1,0.3,1)] data-[side=right]:animate-[dropdown-in-right_160ms_cubic-bezier(0.16,1,0.3,1)]",
        className,
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent };
