import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Megaphone, Clock, Wallet, Users, Loader2, X, AlertCircle } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  merchantId: string;
}

export default function MerchantAdBookingDialog({ open, onOpenChange, merchantId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedPosition, setSelectedPosition] = useState<number | null>(null);
  const [hours, setHours] = useState("");

  // Fetch slot prices
  const { data: slots = [] } = useQuery({
    queryKey: ["ad-slots"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_ad_slots")
        .select("position, price_per_hour")
        .order("position", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch all bookings for queue info
  const { data: bookings = [] } = useQuery({
    queryKey: ["ad-bookings-all"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_ad_bookings")
        .select("*")
        .in("status", ["active", "queued"])
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Check if merchant already has an active/queued booking
  const myBooking = useMemo(() => 
    bookings.find(b => b.merchant_id === merchantId && (b.status === "active" || b.status === "queued")),
    [bookings, merchantId]
  );

  // Fetch wallet balance
  const { data: walletBalance = 0 } = useQuery({
    queryKey: ["wallet-balance-ad", user?.id],
    enabled: !!user?.id && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_wallets")
        .select("balance")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data?.balance || 0;
    },
  });

  const slotInfo = useMemo(() => {
    return slots.map(slot => {
      const slotBookings = bookings.filter(b => b.slot_position === slot.position);
      const activeBooking = slotBookings.find(b => b.status === "active");
      const queueCount = slotBookings.filter(b => b.status === "queued").length;
      const totalQueueHours = slotBookings
        .filter(b => b.status === "queued")
        .reduce((sum, b) => sum + b.hours_booked, 0);
      
      // Estimate wait time
      let waitHours = 0;
      if (activeBooking?.expires_at) {
        const remaining = Math.max(0, (new Date(activeBooking.expires_at).getTime() - Date.now()) / (1000 * 60 * 60));
        waitHours = remaining + totalQueueHours;
      } else {
        waitHours = totalQueueHours;
      }

      return {
        ...slot,
        activeBooking,
        queueCount,
        waitHours: Math.ceil(waitHours),
        isAvailable: !activeBooking && queueCount === 0,
      };
    });
  }, [slots, bookings]);

  const selectedSlot = slotInfo.find(s => s.position === selectedPosition);
  const totalCost = selectedSlot && hours ? selectedSlot.price_per_hour * parseInt(hours || "0") : 0;
  const canAfford = totalCost <= walletBalance;

  const bookMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !selectedPosition || !hours) throw new Error("بيانات ناقصة");
      const hoursNum = parseInt(hours);
      if (hoursNum < 1) throw new Error("الحد الأدنى ساعة واحدة");

      const slot = slots.find(s => s.position === selectedPosition);
      if (!slot) throw new Error("مركز غير صالح");

      const cost = slot.price_per_hour * hoursNum;
      
      // Check balance
      if (cost > walletBalance) throw new Error("رصيد غير كافي");

      // Deduct from wallet
      const { error: walletError } = await supabase
        .from("user_wallets")
        .update({ balance: walletBalance - cost })
        .eq("user_id", user.id);
      if (walletError) throw walletError;

      // Create booking
      const { error: bookingError } = await supabase
        .from("merchant_ad_bookings")
        .insert({
          merchant_id: merchantId,
          user_id: user.id,
          slot_position: selectedPosition,
          hours_booked: hoursNum,
          total_cost: cost,
          status: slotInfo.find(s => s.position === selectedPosition)?.isAvailable ? "active" : "queued",
          started_at: slotInfo.find(s => s.position === selectedPosition)?.isAvailable ? new Date().toISOString() : null,
          expires_at: slotInfo.find(s => s.position === selectedPosition)?.isAvailable 
            ? new Date(Date.now() + hoursNum * 60 * 60 * 1000).toISOString() 
            : null,
        });
      if (bookingError) throw bookingError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ad-bookings-all"] });
      queryClient.invalidateQueries({ queryKey: ["wallet-balance-ad"] });
      queryClient.invalidateQueries({ queryKey: ["active-merchant-ads"] });
      toast({ title: "تم الحجز", description: "تم حجز مركز الإعلان بنجاح" });
      onOpenChange(false);
      setSelectedPosition(null);
      setHours("");
    },
    onError: (err: any) => {
      toast({ title: "خطأ", description: err.message || "فشل الحجز", variant: "destructive" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!myBooking || !user?.id) throw new Error("لا يوجد حجز");
      
      let refund = 0;
      if (myBooking.status === "queued") {
        // Full refund for queued
        refund = myBooking.total_cost;
      } else if (myBooking.status === "active" && myBooking.started_at) {
        // Partial refund based on hours used
        const hoursUsed = Math.ceil((Date.now() - new Date(myBooking.started_at).getTime()) / (1000 * 60 * 60));
        const slot = slots.find(s => s.position === myBooking.slot_position);
        const costUsed = hoursUsed * (slot?.price_per_hour || 0);
        refund = Math.max(0, myBooking.total_cost - costUsed);
      }

      // Refund to wallet
      if (refund > 0) {
        const { error: walletErr } = await supabase
          .from("user_wallets")
          .update({ balance: walletBalance + refund })
          .eq("user_id", user.id);
        if (walletErr) throw walletErr;
      }

      // Cancel booking
      const { error } = await supabase
        .from("merchant_ad_bookings")
        .update({ status: "cancelled", cancelled_at: new Date().toISOString(), refund_amount: refund })
        .eq("id", myBooking.id);
      if (error) throw error;

      return refund;
    },
    onSuccess: (refund) => {
      queryClient.invalidateQueries({ queryKey: ["ad-bookings-all"] });
      queryClient.invalidateQueries({ queryKey: ["wallet-balance-ad"] });
      queryClient.invalidateQueries({ queryKey: ["active-merchant-ads"] });
      toast({ title: "تم الإلغاء", description: refund > 0 ? `تم استرجاع ${refund.toLocaleString()} نقطة` : "تم إلغاء الإعلان" });
    },
    onError: (err: any) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto rounded-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Megaphone className="h-4 w-4 text-primary" />
            حجز إعلان مميز
          </DialogTitle>
          <DialogDescription className="text-xs">
            اختر مركزك في قائمة التجار المميزين وحدد المدة
          </DialogDescription>
        </DialogHeader>

        {/* Wallet Balance */}
        <div className="flex items-center gap-2 p-2.5 rounded-xl border border-border/50 bg-muted/10">
          <Wallet className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium">رصيدك:</span>
          <span className="text-sm font-bold text-primary">{walletBalance.toLocaleString()}</span>
          <span className="text-xs text-muted-foreground">نقطة</span>
        </div>

        {/* Current booking */}
        {myBooking && (
          <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-600">إعلانك الحالي</span>
              <Badge variant="outline" className="text-[10px]">
                المركز {myBooking.slot_position} • {myBooking.status === "active" ? "نشط" : "في الانتظار"}
              </Badge>
            </div>
            <div className="text-[11px] text-muted-foreground">
              {myBooking.hours_booked} ساعة • {myBooking.total_cost.toLocaleString()} نقطة
            </div>
            <Button 
              size="sm" variant="destructive" className="w-full h-7 text-[11px]"
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "إلغاء الإعلان واسترجاع المبلغ المتبقي"}
            </Button>
          </div>
        )}

        {/* Position Grid */}
        {!myBooking && (
          <>
            <div className="space-y-2">
              <Label className="text-xs font-bold">اختر المركز</Label>
              <div className="grid grid-cols-2 gap-2">
                {slotInfo.map((slot) => (
                  <button
                    key={slot.position}
                    onClick={() => setSelectedPosition(slot.position)}
                    className={`relative p-3 rounded-xl border text-right transition-all ${
                      selectedPosition === slot.position
                        ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                        : "border-border/50 bg-card hover:border-primary/30"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="secondary" className="text-[10px] h-5">#{slot.position}</Badge>
                      <span className="text-xs font-bold text-primary">{slot.price_per_hour.toLocaleString()}/ساعة</span>
                    </div>
                    {slot.isAvailable ? (
                      <span className="text-[10px] text-green-500 font-medium">متاح الآن</span>
                    ) : (
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Users className="h-2.5 w-2.5" />
                        <span>{slot.queueCount + (slot.activeBooking ? 1 : 0)} في الطابور</span>
                        <span>• ~{slot.waitHours} ساعة</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Hours Input */}
            {selectedPosition && (
              <div className="space-y-2">
                <Label className="text-xs font-bold">عدد الساعات</Label>
                <Input
                  type="number"
                  min="1"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  placeholder="مثال: 10"
                  className="h-9 text-sm"
                />
                {totalCost > 0 && (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-muted/20">
                    <span className="text-xs text-muted-foreground">التكلفة الإجمالية:</span>
                    <span className={`text-sm font-bold ${canAfford ? "text-primary" : "text-destructive"}`}>
                      {totalCost.toLocaleString()} نقطة
                    </span>
                  </div>
                )}
                {!canAfford && totalCost > 0 && (
                  <div className="flex items-center gap-1.5 text-[11px] text-destructive">
                    <AlertCircle className="h-3 w-3" />
                    رصيد غير كافي
                  </div>
                )}
              </div>
            )}

            {/* Book Button */}
            <Button
              className="w-full gap-2"
              disabled={!selectedPosition || !hours || parseInt(hours) < 1 || !canAfford || bookMutation.isPending}
              onClick={() => bookMutation.mutate()}
            >
              {bookMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />}
              حجز الإعلان
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
