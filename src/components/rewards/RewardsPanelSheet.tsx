import { ReactNode } from "react";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
  SheetClose 
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface RewardsPanelSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}

export default function RewardsPanelSheet({ 
  open, 
  onOpenChange, 
  title, 
  children 
}: RewardsPanelSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom" 
        className="h-[85vh] rounded-t-2xl px-0 pb-0"
      >
        <SheetHeader className="sticky top-0 z-10 bg-background px-4 pb-3 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base">{title}</SheetTitle>
            <SheetClose asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <X className="h-4 w-4" />
              </Button>
            </SheetClose>
          </div>
        </SheetHeader>
        <div className="overflow-y-auto h-full px-4 py-4 pb-20">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}
