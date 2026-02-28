import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Gift, Ticket, Trophy, ChevronLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export default function CommunityGiftsButton() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  // Check if user is an approved merchant
  const { data: isMerchant } = useQuery({
    queryKey: ["is-merchant-for-gifts", user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data } = await supabase
        .from("merchant_applications")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "approved")
        .maybeSingle();
      return !!data;
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          className="fixed bottom-6 left-20 sm:left-[5.5rem] h-11 w-11 rounded-full shadow-lg z-50 bg-accent hover:bg-accent/90 border border-accent-foreground/10"
          size="icon"
        >
          <Gift className="h-5 w-5 text-accent-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-48 p-1.5 rounded-xl">
        {isMerchant && (
          <button
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-bold hover:bg-primary/10 transition-colors text-right"
            onClick={() => { navigate("/merchant-giveaways"); setOpen(false); }}
          >
            <Gift className="h-4 w-4 text-primary shrink-0" />
            <span className="flex-1">المساعدات</span>
            <ChevronLeft className="h-3 w-3 text-muted-foreground" />
          </button>
        )}
        <button
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-bold hover:bg-primary/10 transition-colors text-right"
          onClick={() => { navigate("/rewards?tab=competitions"); setOpen(false); }}
        >
          <Trophy className="h-4 w-4 text-primary shrink-0" />
          <span className="flex-1">المسابقات</span>
          <ChevronLeft className="h-3 w-3 text-muted-foreground" />
        </button>
        <button
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-bold hover:bg-primary/10 transition-colors text-right"
          onClick={() => { navigate("/special-coupons"); setOpen(false); }}
        >
          <Ticket className="h-4 w-4 text-primary shrink-0" />
          <span className="flex-1">خصومات العملاء</span>
          <ChevronLeft className="h-3 w-3 text-muted-foreground" />
        </button>
      </PopoverContent>
    </Popover>
  );
}
