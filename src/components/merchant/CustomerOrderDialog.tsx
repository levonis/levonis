import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  ShoppingBag, Minus, Plus, AlertTriangle, Wallet, CreditCard, 
  Truck, MapPin, ChevronDown, Shield, Info
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Checkbox } from "@/components/ui/checkbox";
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

interface CustomerOrderDialogProps {
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

type PaymentMethod = "full_advance" | "quarter_advance" | "half_advance";

export default function CustomerOrderDialog({
  open,
  onOpenChange,
  product,
  merchantName,
  onSubmit,
  isSubmitting = false,
}: CustomerOrderDialogProps) {
  const { user } = useAuth();
  const [quantity, setQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("full_advance");
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const [acceptedWarning, setAcceptedWarning] = useState(false);

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

  // Fetch wallet balance
  const { data: wallet } = useQuery({
    queryKey: ["user-wallet", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_wallets")
        .select("balance")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
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

  // Reset warning acceptance when payment method changes
  useEffect(() => {
    setAcceptedWarning(false);
  }, [paymentMethod]);

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId);
  const currentCommission = commissions?.[paymentMethod];
  const unitPrice = product?.price_iqd || 0;
  const subtotal = unitPrice * quantity;
  const commissionAmount = Math.round(subtotal * (currentCommission?.rate || 0));
  const total = subtotal + commissionAmount;
  const walletBalance = wallet?.balance || 0;
  const amountToPay = paymentMethod === "full_advance" ? total : 
    paymentMethod === "quarter_advance" ? Math.ceil(total * 0.25) : Math.ceil(total * 0.5);
  const hasEnoughBalance = walletBalance >= amountToPay;

  const requiresWarning = paymentMethod !== "full_advance";
  const canSubmit = selectedAddressId && (!requiresWarning || acceptedWarning) && hasEnoughBalance;

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
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-hidden">
        <DialogHeader className="pb-3 border-b border-border/50">
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-primary" />
            تأكيد الطلب
          </DialogTitle>
          <DialogDescription className="text-xs">
            أكمل بيانات طلبك من {merchantName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto py-3">
          {/* Product Preview */}
          {product && (
            <div className="flex gap-3 p-3 rounded-xl bg-muted/30 border border-border/50">
              {mainImage && (
                <img
                  src={mainImage}
                  alt=""
                  className="w-14 h-14 rounded-lg object-cover"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{product.title}</p>
                {product.price_iqd && (
                  <p className="text-primary font-bold text-sm">
                    {product.price_iqd.toLocaleString()} د.ع
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Quantity */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">الكمية</Label>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-12 text-center font-bold text-lg">{quantity}</span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => setQuantity(quantity + 1)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Address Selection */}
          <div className="space-y-2">
            <Label className="text-xs font-medium flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              عنوان التوصيل
            </Label>
            {addresses.length === 0 ? (
              <Alert className="border-amber-500/30 bg-amber-500/5">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <AlertDescription className="text-xs">
                  لا توجد عناوين محفوظة. يرجى إضافة عنوان من صفحة الملف الشخصي.
                </AlertDescription>
              </Alert>
            ) : (
              <Select value={selectedAddressId} onValueChange={setSelectedAddressId}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="اختر العنوان" />
                </SelectTrigger>
                <SelectContent>
                  {addresses.map((addr) => (
                    <SelectItem key={addr.id} value={addr.id}>
                      <div className="flex items-center gap-2">
                        <span>{addr.full_name}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {addr.governorate}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <Label className="text-xs font-medium flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5" />
              طريقة الدفع
            </Label>
            <RadioGroup
              value={paymentMethod}
              onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
              className="space-y-2"
            >
              {/* Full Advance - Recommended */}
              <label
                className={cn(
                  "flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all",
                  paymentMethod === "full_advance"
                    ? "border-primary bg-primary/5"
                    : "border-border/50 hover:border-primary/30"
                )}
              >
                <RadioGroupItem value="full_advance" className="mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-sm">دفع كامل مقدماً</span>
                    <Badge className="bg-primary/20 text-primary text-[10px]">
                      <Shield className="h-2.5 w-2.5 ml-0.5" />
                      موصى به
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    الدفع الكامل عبر المنصة - محمي بنظام الضمان
                  </p>
                </div>
              </label>

              {/* Quarter Advance */}
              <label
                className={cn(
                  "flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all",
                  paymentMethod === "quarter_advance"
                    ? "border-amber-500 bg-amber-500/5"
                    : "border-border/50 hover:border-amber-500/30"
                )}
              >
                <RadioGroupItem value="quarter_advance" className="mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">ربع المبلغ مقدماً</span>
                    <Badge variant="outline" className="text-[10px] text-amber-600">
                      +6% عمولة
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    دفع 25% مقدماً والباقي عند الاستلام
                  </p>
                </div>
              </label>

              {/* Half Advance */}
              <label
                className={cn(
                  "flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all",
                  paymentMethod === "half_advance"
                    ? "border-amber-500 bg-amber-500/5"
                    : "border-border/50 hover:border-amber-500/30"
                )}
              >
                <RadioGroupItem value="half_advance" className="mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">نصف المبلغ مقدماً</span>
                    <Badge variant="outline" className="text-[10px] text-amber-600">
                      +6% عمولة
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    دفع 50% مقدماً والباقي عند الاستلام
                  </p>
                </div>
              </label>
            </RadioGroup>

            {/* Warning for non-platform payments */}
            {requiresWarning && (
              <Alert className="border-destructive/30 bg-destructive/5 mt-3">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <AlertDescription className="text-[11px]">
                  <strong className="block mb-1">تحذير مهم:</strong>
                  المنصة لا تتحمل مسؤولية المعاملات خارج نظام الضمان. في حال الدفع الجزئي أو عند الاستلام، لن تكون محمياً بالكامل في حالة حدوث نزاع.
                </AlertDescription>
              </Alert>
            )}

            {requiresWarning && (
              <div className="flex items-start gap-2 mt-2">
                <Checkbox
                  id="accept-warning"
                  checked={acceptedWarning}
                  onCheckedChange={(c) => setAcceptedWarning(!!c)}
                />
                <label
                  htmlFor="accept-warning"
                  className="text-[11px] text-muted-foreground cursor-pointer leading-relaxed"
                >
                  أفهم المخاطر وأوافق على المتابعة بطريقة الدفع المختارة
                </label>
              </div>
            )}
          </div>

          {/* Order Summary */}
          <div className="p-3 rounded-xl bg-muted/30 border border-border/50 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">المجموع الفرعي</span>
              <span>{subtotal.toLocaleString()} د.ع</span>
            </div>
            {commissionAmount > 0 && (
              <div className="flex justify-between text-xs text-amber-600">
                <span>عمولة ({((currentCommission?.rate || 0) * 100).toFixed(0)}%)</span>
                <span>+{commissionAmount.toLocaleString()} د.ع</span>
              </div>
            )}
            <div className="flex justify-between font-bold pt-2 border-t border-border/50">
              <span>الإجمالي</span>
              <span className="text-primary text-lg">{total.toLocaleString()} د.ع</span>
            </div>
          </div>

          {/* Merchant Notification Info */}
          <div className="flex items-start gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
            <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="text-[10px] text-muted-foreground">
              سيتم إخطار التاجر بطريقة الدفع المختارة وموقعك (المحافظة فقط)
            </p>
          </div>
        </div>

        <div className="pt-3 border-t border-border/50">
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting || !product?.price_iqd}
            className="w-full h-11"
          >
            {isSubmitting ? "جاري الإرسال..." : "تأكيد الطلب"}
          </Button>
          </div>

          {/* Wallet Balance */}
          <div className={cn("p-3 rounded-xl border space-y-1", hasEnoughBalance ? "bg-primary/5 border-primary/20" : "bg-destructive/5 border-destructive/30")}>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1"><Wallet className="h-3 w-3" /> رصيد المحفظة</span>
              <span className={cn("font-bold", hasEnoughBalance ? "text-primary" : "text-destructive")}>{walletBalance.toLocaleString()} د.ع</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">المطلوب دفعه الآن</span>
              <span className="font-bold">{amountToPay.toLocaleString()} د.ع</span>
            </div>
            {!hasEnoughBalance && (
              <p className="text-[10px] text-destructive mt-1">رصيد المحفظة غير كافٍ. تحتاج {(amountToPay - walletBalance).toLocaleString()} د.ع إضافية</p>
            )}
          </div>
      </DialogContent>
    </Dialog>
  );
}
