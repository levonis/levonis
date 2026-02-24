import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { cn } from "@/lib/utils";

const Popover = PopoverPrimitive.Root;

const PopoverTrigger = PopoverPrimitive.Trigger;

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, side = "bottom", ...props }, ref) => {
  const [isPositioned, setIsPositioned] = React.useState(false);

  React.useEffect(() => {
    let frame1 = 0;
    let frame2 = 0;

    frame1 = window.requestAnimationFrame(() => {
      frame2 = window.requestAnimationFrame(() => setIsPositioned(true));
    });

    return () => {
      window.cancelAnimationFrame(frame1);
      window.cancelAnimationFrame(frame2);
    };
  }, []);

  return (
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
          isPositioned
            ? "opacity-100 data-[side=bottom]:animate-[dropdown-in-bottom_160ms_cubic-bezier(0.16,1,0.3,1)] data-[side=top]:animate-[dropdown-in-top_160ms_cubic-bezier(0.16,1,0.3,1)] data-[side=left]:animate-[dropdown-in-left_160ms_cubic-bezier(0.16,1,0.3,1)] data-[side=right]:animate-[dropdown-in-right_160ms_cubic-bezier(0.16,1,0.3,1)]"
            : "opacity-0",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
});
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent };
