import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { PauseCircle, PlayCircle, Calendar } from "lucide-react";

interface StorePauseControlProps {
  merchantId: string;
  storePaused: boolean;
  storePauseEndDate: string | null;
  storePauseMessage: string | null;
}

export default function StorePauseControl({ merchantId, storePaused, storePauseEndDate, storePauseMessage }: StorePauseControlProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [paused, setPaused] = useState(storePaused);
  const [endDate, setEndDate] = useState(storePauseEndDate?.split("T")[0] || "");
  const [message, setMessage] = useState(storePauseMessage || "");

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("merchant_applications").update({
        store_paused: paused,
        store_pause_end_date: endDate ? new Date(endDate).toISOString() : null,
        store_pause_message: message.trim() || null,
      }).eq("id", merchantId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["merchant-app"] });
      toast({ title: paused ? "تم إيقاف المتجر مؤقتاً" : "تم تفعيل المتجر" });
    },
  });

  return (
    <div className={`p-4 rounded-xl border transition-colors ${paused ? "border-amber-500/30 bg-amber-500/5" : "border-border/50 bg-muted/10"}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {paused ? <PauseCircle className="h-4 w-4 text-amber-500" /> : <PlayCircle className="h-4 w-4 text-green-500" />}
          <Label className="text-sm font-medium">{paused ? "المتجر متوقف مؤقتاً" : "المتجر نشط"}</Label>
        </div>
        <Switch checked={paused} onCheckedChange={setPaused} />
      </div>

      {paused && (
        <div className="space-y-2 pt-2 border-t border-border/30">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">تاريخ العودة</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-8 text-xs mt-1" />
            </div>
            <div>
              <Label className="text-[10px]">رسالة للعملاء</Label>
              <Input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="سأعود قريباً..." className="h-8 text-xs mt-1" />
            </div>
          </div>
          <p className="text-[10px] text-amber-600">⏸️ جميع المنتجات ستظهر كحجز مسبق أثناء التوقف</p>
        </div>
      )}

      <Button size="sm" className="w-full mt-3 h-8 text-xs" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
        {mutation.isPending ? "جاري الحفظ..." : "حفظ"}
      </Button>
    </div>
  );
}
