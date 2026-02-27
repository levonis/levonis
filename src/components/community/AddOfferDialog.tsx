import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  DollarSign, Clock, Scale, MessageSquare, Loader2, 
  Percent, Layers, Droplets, ChevronDown, Plus, X, Check
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { FILAMENT_MATERIALS, RESIN_MATERIALS, MaterialType } from "@/lib/printingMaterials";

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
import { Badge } from "@/components/ui/badge";
import { FormattedNumberInput } from "@/components/ui/formatted-number-input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface AddOfferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  requestTitle: string;
  merchantId: string; // Keep for reference but use auth.uid() for trader_id
  onSuccess: () => void;
}

export default function AddOfferDialog({
  open,
  onOpenChange,
  requestId,
  requestTitle,
  merchantId,
  onSuccess,
}: AddOfferDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [priceNum, setPriceNum] = useState(0);
  const [duration, setDuration] = useState("");
  const [grams, setGrams] = useState("");
  const [notes, setNotes] = useState("");
  
  // Material selection state
  const [materialType, setMaterialType] = useState<MaterialType | null>(null);
  const [selectedSubtypes, setSelectedSubtypes] = useState<string[]>([]);
  const [subtypeOpen, setSubtypeOpen] = useState(false);

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
  const platformFee = Math.floor(priceNum * commissionRate);
  const merchantPayout = priceNum - platformFee;

  const availableMaterials = materialType === "filament" 
    ? FILAMENT_MATERIALS 
    : materialType === "resin" 
    ? RESIN_MATERIALS 
    : [];

  const handleToggleSubtype = (value: string) => {
    setSelectedSubtypes(prev => 
      prev.includes(value) 
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
  };

  const createOfferMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("يجب تسجيل الدخول");
      
      const durationNum = parseInt(duration, 10);
      const gramsNum = grams ? parseInt(grams, 10) : null;

      if (!priceNum || priceNum <= 0) {
        throw new Error("السعر مطلوب ويجب أن يكون أكبر من صفر");
      }
      if (!durationNum || durationNum <= 0) {
        throw new Error("مدة التنفيذ مطلوبة");
      }

      // Check if merchant already has an offer on this request (DB constraint also enforces this)
      const { data: existingOffer } = await supabase
        .from("print_offers")
        .select("id")
        .eq("request_id", requestId)
        .eq("trader_id", user.id)
        .maybeSingle();

      if (existingOffer) {
        throw new Error("لقد قمت بتسعير هذا الطلب مسبقاً. لا يمكنك التسعير أكثر من مرة واحدة.");
      }

      // Use user.id (auth.uid()) as trader_id, NOT merchantId
      const { data, error } = await supabase
        .from("print_offers")
        .insert({
          request_id: requestId,
          trader_id: user.id, // IMPORTANT: Use actual user ID for RLS
          price_iqd: priceNum,
          duration_days: durationNum,
          grams: gramsNum,
          notes: notes.trim() || null,
          material_type: materialType,
          material_subtypes: selectedSubtypes.length > 0 ? selectedSubtypes : null,
        } as any)
        .select("id")
        .single();

      if (error) {
        // Handle unique constraint violation gracefully
        if (error.code === '23505') {
          throw new Error("لقد قمت بتسعير هذا الطلب مسبقاً.");
        }
        throw error;
      }
      // Notify request owner about new offer (fire and forget)
      const { data: request } = await supabase
        .from("community_print_requests")
        .select("user_id, title")
        .eq("id", requestId)
        .single();

      if (request && request.user_id !== user.id) {
        const { data: merchantProfile } = await supabase
          .from("merchant_applications")
          .select("display_name")
          .eq("user_id", user.id)
          .maybeSingle();
        
        const merchantName = merchantProfile?.display_name || "تاجر";
        
        supabase.functions.invoke('send-user-telegram-notification', {
          body: {
            user_id: request.user_id,
            title: "عرض جديد على طلبك 💰",
            message: `قدّم ${merchantName} عرضاً بسعر ${priceNum.toLocaleString()} د.ع على طلبك "${request.title}"`,
            notification_type: "info",
          },
        }).catch(() => {});

        supabase.from('notifications').insert({
          user_id: request.user_id,
          title: "عرض جديد على طلبك 💰",
          message: `قدّم ${merchantName} عرضاً بسعر ${priceNum.toLocaleString()} د.ع على طلبك "${request.title}"`,
          type: 'info',
          related_id: requestId,
          is_general: false,
        }).then(() => {});
      }

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["request-offers", requestId] });
      qc.invalidateQueries({ queryKey: ["my-offer-on-request", requestId, merchantId] });
      qc.invalidateQueries({ queryKey: ["my-offer-check"] });
      qc.invalidateQueries({ queryKey: ["offers-count", requestId] });
      toast({ title: "تم إضافة التسعير بنجاح" });
      // Reset form
      setPriceNum(0);
      setDuration("");
      setGrams("");
      setNotes("");
      setMaterialType(null);
      setSelectedSubtypes([]);
      onSuccess();
    },
    onError: (err: any) => {
      toast({
        title: "تعذر إضافة التسعير",
        description: err?.message,
        variant: "destructive",
      });
    },
  });

  const isValid = priceNum > 0 && duration && parseInt(duration, 10) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            تسعير الطلب
          </DialogTitle>
          <DialogDescription className="truncate">{requestTitle}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 max-h-[55vh] overflow-y-auto">
          {/* Commission Notice */}
          <Alert className="border-amber-500/30 bg-amber-500/10">
            <Percent className="h-4 w-4 text-amber-500" />
            <AlertDescription className="text-xs text-amber-600 dark:text-amber-400">
              عمولة المنصة: <strong>{(commissionRate * 100).toFixed(1)}%</strong> تُخصم من السعر
            </AlertDescription>
          </Alert>

          {/* Price */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-semibold">
              <DollarSign className="h-4 w-4 text-primary" />
              السعر للزبون (دينار عراقي) <span className="text-destructive">*</span>
            </Label>
            <FormattedNumberInput
              placeholder="مثال: 25,000"
              value={priceNum}
              onChange={setPriceNum}
              className="text-lg font-bold"
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

          {/* Material Type Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-semibold">
              <Layers className="h-4 w-4 text-primary" />
              نوع مادة الطباعة
            </Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setMaterialType("filament");
                  setSelectedSubtypes([]);
                }}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                  materialType === "filament"
                    ? "bg-blue-500/20 border-blue-500/50 text-blue-300"
                    : "bg-background border-border hover:border-blue-500/30"
                }`}
              >
                <Layers className="h-4 w-4" />
                فلمنت (FDM)
              </button>
              <button
                type="button"
                onClick={() => {
                  setMaterialType("resin");
                  setSelectedSubtypes([]);
                }}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                  materialType === "resin"
                    ? "bg-purple-500/20 border-purple-500/50 text-purple-300"
                    : "bg-background border-border hover:border-purple-500/30"
                }`}
              >
                <Droplets className="h-4 w-4" />
                رزن (SLA)
              </button>
            </div>
          </div>

          {/* Material Subtypes */}
          {materialType && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                نوع المادة المحدد (اختياري)
              </Label>
              
              {/* Selected subtypes */}
              {selectedSubtypes.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedSubtypes.map(subtype => {
                    const material = availableMaterials.find(m => m.value === subtype);
                    return (
                      <Badge
                        key={subtype}
                        variant="secondary"
                        className="gap-1 px-2 py-1 text-xs"
                      >
                        {material?.label || subtype}
                        <button
                          onClick={() => handleToggleSubtype(subtype)}
                          className="hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              )}

              <Popover open={subtypeOpen} onOpenChange={setSubtypeOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-between text-xs"
                  >
                    <span className="flex items-center gap-1.5">
                      <Plus className="h-3 w-3" />
                      إضافة نوع مادة
                    </span>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2 max-h-60 overflow-y-auto">
                  <div className="space-y-1">
                    {availableMaterials.map((material) => {
                      const isSelected = selectedSubtypes.includes(material.value);
                      return (
                        <button
                          key={material.value}
                          onClick={() => handleToggleSubtype(material.value)}
                          className={`w-full text-right px-2 py-1.5 text-xs rounded-md transition-colors flex items-center justify-between ${
                            isSelected
                              ? "bg-primary/10 text-primary"
                              : "hover:bg-muted"
                          }`}
                        >
                          {material.label}
                          {isSelected && <Check className="h-3 w-3" />}
                        </button>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}

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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button
            onClick={() => createOfferMutation.mutate()}
            disabled={!isValid || createOfferMutation.isPending}
            className="bg-gradient-to-b from-primary to-accent"
          >
            {createOfferMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "إضافة التسعير"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
