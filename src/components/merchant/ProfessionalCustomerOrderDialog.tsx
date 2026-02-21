import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ShoppingBag, Minus, Plus, AlertTriangle, Wallet, CreditCard,
  Truck, MapPin, Shield, ChevronDown, ChevronUp, Lock
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface PaymentCommission {
  rate: number;
  label_ar: string;
  description_ar: string;
}

interface Product {
  id: string;
  title: string;
  price_iqd: number | null;
  image_urls: string[] | null;
  primary_image_index: number;
}

interface UserAddress {
  id: string;
  full_name: string;
  governorate: string;
  area: string | null;
  nearest_landmark: string | null;
  is_default: boolean;
}

interface ProfessionalCustomerOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  merchantName: string;
  onSubmit: (data: {
    quantity: number;
    paymentMethod: string;
    addressId: string;
    governorate: string;
    commissionRate: number;
    totalWithCommission: number;
  }) => void;
  isSubmitting?: boolean;
}

type PaymentMethod = "full_advance" | "quarter_advance" | "half_advance" | "cod";

export default function ProfessionalCustomerOrderDialog({
  open,
  onOpenChange,
  product,
  merchantName,
  onSubmit,
  isSubmitting = false,
}: ProfessionalCustomerOrderDialogProps) {
  const { user } = useAuth();
  const [quantity, setQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("full_advance");
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const [acceptedWarning, setAcceptedWarning] = useState(false);
  const [showOtherPayments, setShowOtherPayments] = useState(false);

  // Fetch payment commissions
  const { data: commissions } = useQuery({
    queryKey: ["community-payment-commissions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("default_settings")
        .select("setting_value")
        .eq("setting_key", "community_payment_commissions")
        .maybeSingle();
      return (data?.setting_value as unknown) as Record<PaymentMethod, PaymentCommission> | null;
    },
  });

  // Fetch user addresses
  const { data: addresses = [] } = useQuery({
    queryKey: ["user-addresses", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_addresses")
        .select("id, full_name, governorate, area, nearest_landmark, is_default")
        .eq("user_id", user!.id)
        .order("is_default", { ascending: false });
      if (error) throw error;
      return data as unknown as UserAddress[];
    },
  });

  // Set default address
  useEffect(() => {
    if (addresses.length > 0 && !selectedAddressId) {
      const defaultAddr = addresses.find((a) => a.is_default) || addresses[0];
      setSelectedAddressId(defaultAddr.id);
    }
  }, [addresses, selectedAddressId]);

  // Reset warning when payment method changes
  useEffect(() => {
    setAcceptedWarning(false);
    if (paymentMethod === "full_advance") {
      setShowOtherPayments(false);
    }
  }, [paymentMethod]);

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId);
  const currentCommission = commissions?.[paymentMethod];
  const unitPrice = product?.price_iqd || 0;
  const subtotal = unitPrice * quantity;
  const commissionAmount = Math.round(subtotal * (currentCommission?.rate || 0));
  const total = subtotal + commissionAmount;

  const requiresWarning = paymentMethod !== "full_advance";
  const canSubmit = selectedAddressId && (!requiresWarning || acceptedWarning);

  const handleSubmit = () => {
    if (!selectedAddress || !canSubmit) return;
    onSubmit({
      quantity,
      paymentMethod,
      addressId: selectedAddressId,
      governorate: selectedAddress.governorate,
      commissionRate: currentCommission?.rate || 0,
      totalWithCommission: total,
    });
  };

  const mainImage = product?.image_urls?.[product.primary_image_index] || product?.image_urls?.[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm max-h-[90vh] overflow-hidden p-0">
        {/* Header */}
        <DialogHeader className="p-4 pb-3 border-b border-border/50">
          <DialogTitle className="text-sm font-bold flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-primary" />
            تأكيد الطلب
          </DialogTitle>
          <DialogDescription className="text-[11px]">من {merchantName}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto p-4">
          {/* Product Preview - Compact */}
          {product && (
            <div className="flex gap-2.5 p-2.5 rounded-xl bg-muted/30 border border-border/50">
              {mainImage && (
                <img src={mainImage} alt="" className="w-12 h-12 rounded-lg object-cover" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-xs truncate">{product.title}</p>
                {product.price_iqd && (
                  <p className="text-primary font-bold text-sm">{product.price_iqd.toLocaleString()} د.ع</p>
                )}
              </div>
            </div>
          )}

          {/* Quantity - Compact */}
          <div className="flex items-center justify-between p-2.5 rounded-xl border border-border/50">
            <span className="text-xs font-medium">الكمية</span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="w-8 text-center font-bold">{quantity}</span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => setQuantity(quantity + 1)}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Address Selection - Compact */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              عنوان التوصيل
            </Label>
            {addresses.length === 0 ? (
              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[10px] text-amber-600">
                لا توجد عناوين محفوظة
              </div>
            ) : (
              <Select value={selectedAddressId} onValueChange={setSelectedAddressId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="اختر العنوان" />
                </SelectTrigger>
                <SelectContent>
                  {addresses.map((addr) => (
                    <SelectItem key={addr.id} value={addr.id}>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs">{addr.full_name}</span>
                        <Badge variant="outline" className="text-[9px] h-4 px-1">{addr.governorate}</Badge>
                      </div>
                    </SelectItem>
                  ))}</SelectContent>
              </Select>
            )}
          </div>

          {/* Payment Method - Recommended First */}
          <div className="space-y-2">
            <Label className="text-[11px] font-medium flex items-center gap-1">
              <CreditCard className="h-3 w-3" />
              طريقة الدفع
            </Label>

            {/* Secure Payment - Always Visible */}
            <button
              type="button"
              onClick={() => { setPaymentMethod("full_advance"); setShowOtherPayments(false); }}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-right",
                paymentMethod === "full_advance"
                  ? "border-primary bg-primary/5"
                  : "border-border/50 hover:border-primary/40"
              )}
            >
              <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                <Shield className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold">دفع آمن عبر المنصة</span>
                  <Badge className="bg-emerald-500/20 text-emerald-600 text-[9px] h-4 px-1 border-0">موصى به</Badge>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">محمي بنظام الضمان - بدون عمولة إضافية</p>
              </div>
              {paymentMethod === "full_advance" && (
                <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <Lock className="h-3 w-3 text-white" />
                </div>
              )}
            </button>

            {/* Toggle Other Payments */}
            <button
              type="button"
              onClick={() => setShowOtherPayments(!showOtherPayments)}
              className="w-full flex items-center justify-center gap-1 py-2 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              خيارات دفع أخرى؟
              {showOtherPayments ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>

            {/* Other Payment Options - Collapsible */}
            {showOtherPayments && (
              <div className="space-y-2 pt-1">
                {/* Warning Banner */}
                <Alert className="border-destructive/30 bg-destructive/5 p-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                  <AlertDescription className="text-[10px] mr-2">
                    <strong>تحذير:</strong> الخيارات التالية غير محمية بنظام الضمان. المنصة لا تتحمل مسؤولية النزاعات.
                  </AlertDescription>
                </Alert>

                {/* Partial Payments */}
                {(["quarter_advance", "half_advance", "cod"] as const).map((method) => {
                  const config = {
                    quarter_advance: { label: "ربع المبلغ مقدماً", desc: "25% مقدماً والباقي عند الاستلام", commission: "6%" },
                    half_advance: { label: "نصف المبلغ مقدماً", desc: "50% مقدماً والباقي عند الاستلام", commission: "6%" },
                    cod: { label: "الدفع عند الاستلام", desc: "كامل المبلغ + العمولة عند التوصيل", commission: "10%" },
                  };
                  const c = config[method];

                  return (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={cn(
                        "w-full flex items-center gap-2.5 p-2.5 rounded-xl border-2 transition-all text-right",
                        paymentMethod === method
                          ? "border-amber-500 bg-amber-500/5"
                          : "border-border/50 hover:border-amber-500/40"
                      )}
                    >
                      <Truck className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-medium">{c.label}</span>
                          <Badge variant="outline" className="text-[9px] h-4 px-1 text-amber-600 border-amber-500/30">+{c.commission}</Badge>
                        </div>
                        <p className="text-[9px] text-muted-foreground">{c.desc}</p>
                      </div>
                    </button>
                  );
                })}

                {/* Acceptance Checkbox */}
                {requiresWarning && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/50 border border-border">
                    <Checkbox
                      id="accept-risk"
                      checked={acceptedWarning}
                      onCheckedChange={(c) => setAcceptedWarning(!!c)}
                      className="mt-0.5"
                    />
                    <label htmlFor="accept-risk" className="text-[10px] text-muted-foreground leading-relaxed cursor-pointer">
                      أفهم المخاطر وأوافق على المتابعة
                    </label>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Order Summary - Compact */}
          <div className="p-3 rounded-xl bg-muted/30 border border-border/50 space-y-1.5">
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">المجموع ({quantity}×)</span>
              <span>{subtotal.toLocaleString()} د.ع</span>
            </div>
            {commissionAmount > 0 && (
              <div className="flex justify-between text-[11px] text-amber-600">
                <span>عمولة</span>
                <span>+{commissionAmount.toLocaleString()} د.ع</span>
              </div>
            )}
            <div className="flex justify-between font-bold pt-1.5 border-t border-border/50">
              <span className="text-xs">الإجمالي</span>
              <span className="text-primary">{total.toLocaleString()} د.ع</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 pt-3 border-t border-border/50">
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting || !product?.price_iqd}
            className="w-full h-10"
          >
            {isSubmitting ? "جاري الإرسال..." : "تأكيد الطلب"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
