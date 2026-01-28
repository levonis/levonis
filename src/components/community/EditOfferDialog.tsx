import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DollarSign, Clock, Scale, MessageSquare, Loader2, Percent, Edit3, AlertCircle } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface EditOfferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offerId: string;
  requestId: string;
  currentPrice: number;
  currentDuration: number;
  currentGrams?: number | null;
  currentNotes?: string | null;
  editCount: number;
  onSuccess: () => void;
}

export default function EditOfferDialog({
  open,
  onOpenChange,
  offerId,
  requestId,
  currentPrice,
  currentDuration,
  currentGrams,
  currentNotes,
  editCount,
  onSuccess,
}: EditOfferDialogProps) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [price, setPrice] = useState(currentPrice.toString());
  const [duration, setDuration] = useState(currentDuration.toString());
  const [grams, setGrams] = useState(currentGrams?.toString() || "");
  const [notes, setNotes] = useState(currentNotes || "");

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setPrice(currentPrice.toString());
      setDuration(currentDuration.toString());
      setGrams(currentGrams?.toString() || "");
      setNotes(currentNotes || "");
    }
  }, [open, currentPrice, currentDuration, currentGrams, currentNotes]);

  // Fetch platform commission rate
  const { data: commissionSetting } = useQuery({
    queryKey: ["platform-commission"],
    queryFn: async () => {
      const { data } = await supabase
        .from("default_settings")
        .select("setting_value")
        .eq("setting_key", "platform_commission_rate")
        .maybeSingle();
      return data?.setting_value as { rate: number } | null;
    },
  });

  const commissionRate = commissionSetting?.rate || 0.007;
  const priceNum = parseInt(price, 10) || 0;
  const platformFee = Math.floor(priceNum * commissionRate);
  const merchantPayout = priceNum - platformFee;

  const canEdit = editCount < 1; // Only allow 1 edit

  const updateOfferMutation = useMutation({
    mutationFn: async () => {
      if (!canEdit) {
        throw new Error("لا يمكنك تعديل العرض أكثر من مرة واحدة");
      }

      const priceNum = parseInt(price, 10);
      const durationNum = parseInt(duration, 10);
      const gramsNum = grams ? parseInt(grams, 10) : null;

      if (!priceNum || priceNum <= 0) {
        throw new Error("السعر مطلوب ويجب أن يكون أكبر من صفر");
      }
      if (!durationNum || durationNum <= 0) {
        throw new Error("مدة التنفيذ مطلوبة");
      }

      const { error } = await supabase
        .from("print_offers")
        .update({
          price_iqd: priceNum,
          duration_days: durationNum,
          grams: gramsNum,
          notes: notes.trim() || null,
          edit_count: editCount + 1,
        })
        .eq("id", offerId);

      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["request-offers", requestId] });
      qc.invalidateQueries({ queryKey: ["my-offer-on-request"] });
      toast({ title: "تم تعديل العرض بنجاح" });
      onSuccess();
    },
    onError: (err: any) => {
      toast({
        title: "تعذر تعديل العرض",
        description: err?.message,
        variant: "destructive",
      });
    },
  });

  const isValid = price && parseInt(price, 10) > 0 && duration && parseInt(duration, 10) > 0;
  const hasChanges = 
    parseInt(price, 10) !== currentPrice ||
    parseInt(duration, 10) !== currentDuration ||
    (grams ? parseInt(grams, 10) : null) !== currentGrams ||
    (notes.trim() || null) !== currentNotes;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit3 className="h-5 w-5 text-primary" />
            تعديل العرض
          </DialogTitle>
          <DialogDescription>
            {canEdit 
              ? "يمكنك تعديل العرض مرة واحدة فقط" 
              : "لقد استنفدت عدد مرات التعديل المسموح بها"}
          </DialogDescription>
        </DialogHeader>

        {!canEdit ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              لا يمكنك تعديل هذا العرض. لقد قمت بتعديله مسبقاً والحد الأقصى هو مرة واحدة.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4 py-2">
            {/* Commission Notice */}
            <Alert className="border-amber-500/30 bg-amber-500/10">
              <Percent className="h-4 w-4 text-amber-500" />
              <AlertDescription className="text-xs text-amber-600 dark:text-amber-400">
                عمولة المنصة: <strong>{(commissionRate * 100).toFixed(1)}%</strong> • 
                تنبيه: يمكنك التعديل مرة واحدة فقط!
              </AlertDescription>
            </Alert>

            {/* Price */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-semibold">
                <DollarSign className="h-4 w-4 text-primary" />
                السعر للزبون (دينار عراقي) <span className="text-destructive">*</span>
              </Label>
              <Input
                type="number"
                placeholder="مثال: 25000"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="text-lg font-bold"
                min={1}
              />
              {priceNum > 0 && (
                <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/30 border border-border">
                  <span className="text-muted-foreground">ستحصل على:</span>
                  <span className="font-bold text-green-500">
                    {merchantPayout.toLocaleString()} د.ع
                  </span>
                </div>
              )}
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-semibold">
                <Clock className="h-4 w-4 text-primary" />
                مدة التنفيذ (أيام) <span className="text-destructive">*</span>
              </Label>
              <Input
                type="number"
                placeholder="مثال: 3"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                min={1}
              />
            </div>

            {/* Grams (Optional) */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-semibold">
                <Scale className="h-4 w-4 text-muted-foreground" />
                الوزن التقريبي (غرام) <span className="text-muted-foreground text-xs">(اختياري)</span>
              </Label>
              <Input
                type="number"
                placeholder="مثال: 150"
                value={grams}
                onChange={(e) => setGrams(e.target.value)}
                min={1}
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-semibold">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                ملاحظات <span className="text-muted-foreground text-xs">(اختياري)</span>
              </Label>
              <Textarea
                placeholder="أي تفاصيل إضافية للزبون..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={500}
                className="min-h-20"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          {canEdit && (
            <Button
              onClick={() => updateOfferMutation.mutate()}
              disabled={!isValid || !hasChanges || updateOfferMutation.isPending}
              className="bg-gradient-to-b from-primary to-accent"
            >
              {updateOfferMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "حفظ التعديلات"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
