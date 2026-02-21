import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ShoppingBag, Settings2, Palette, Plus, Minus, CalendarClock, Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface ProductColor {
  name: string;
  hex_code: string;
  image_url: string | null;
  stock_quantity: number | null;
}

interface ProductOption {
  name: string;
  image_url: string | null;
  price_adjustment: number;
  stock_quantity: number | null;
}

interface CartProduct {
  id: string;
  merchant_id: string;
  title: string;
  price_iqd: number | null;
  image_urls: string[] | null;
  primary_image_index: number;
  sale_type?: string;
  max_queue_slots?: number | null;
  current_queue_count?: number;
  preorder_deposit_percent?: number | null;
  preorder_available_date?: string | null;
  preorder_note?: string | null;
}

interface AddToCartSheetProps {
  product: CartProduct | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddToCartSheet({ product, open, onOpenChange }: AddToCartSheetProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [selectedColor, setSelectedColor] = useState<number | null>(null);
  const [cartQuantity, setCartQuantity] = useState(1);

  // Fetch full product details (with colors/options/sale_type)
  const { data: fullProduct } = useQuery({
    queryKey: ["product-cart-details", product?.id],
    enabled: !!product?.id && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_products")
        .select("colors, options, sale_type, max_queue_slots, current_queue_count, preorder_deposit_percent, preorder_available_date, preorder_note")
        .eq("id", product!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const productColors = (fullProduct?.colors || []) as unknown as ProductColor[];
  const productOptions = (fullProduct?.options || []) as unknown as ProductOption[];
  const saleType = fullProduct?.sale_type || product?.sale_type || "normal";
  const isPreorder = saleType === "preorder";
  const isWaitlist = saleType === "waitlist";
  const queueFull = (fullProduct?.max_queue_slots ?? null) !== null &&
    (fullProduct?.current_queue_count ?? 0) >= (fullProduct?.max_queue_slots ?? 0);

  const currentPrice = useMemo(() => {
    const base = product?.price_iqd || 0;
    const adj = selectedOption !== null && productOptions[selectedOption] ? productOptions[selectedOption].price_adjustment : 0;
    return base + adj;
  }, [product?.price_iqd, selectedOption, productOptions]);

  const depositAmount = useMemo(() => {
    if (!isPreorder || !fullProduct?.preorder_deposit_percent) return 0;
    return Math.round(currentPrice * (fullProduct.preorder_deposit_percent / 100));
  }, [isPreorder, currentPrice, fullProduct?.preorder_deposit_percent]);

  // Reset on open
  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setSelectedOption(null);
      setSelectedColor(null);
      setCartQuantity(1);
    }
    onOpenChange(v);
  };

  const addToCartMutation = useMutation({
    mutationFn: async () => {
      if (!user || !product) throw new Error("يجب تسجيل الدخول");

      // Check different merchant
      const { data: existingCartItems } = await supabase
        .from("community_cart_items")
        .select("id, merchant_id, merchant_name")
        .eq("user_id", user.id)
        .limit(1);

      if (existingCartItems && existingCartItems.length > 0 && existingCartItems[0].merchant_id !== product.merchant_id) {
        throw new Error(`DIFFERENT_MERCHANT:${existingCartItems[0].merchant_name || 'متجر آخر'}`);
      }

      const selectedOpt = selectedOption !== null ? productOptions[selectedOption] : null;
      const selectedCol = selectedColor !== null ? productColors[selectedColor] : null;
      const priceAdj = selectedOpt?.price_adjustment || 0;

      const variantTitle = product.title + (selectedOpt ? ` - ${selectedOpt.name}` : '') + (selectedCol ? ` (${selectedCol.name})` : '');
      const { data: existing } = await supabase
        .from("community_cart_items")
        .select("id, quantity")
        .eq("user_id", user.id)
        .eq("product_id", product.id)
        .eq("product_title", variantTitle)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("community_cart_items")
          .update({ quantity: existing.quantity + cartQuantity })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { data: merchant } = await supabase
          .from("merchant_applications")
          .select("display_name")
          .eq("id", product.merchant_id)
          .maybeSingle();

        const { error } = await supabase.from("community_cart_items").insert({
          user_id: user.id,
          merchant_id: product.merchant_id,
          merchant_name: merchant?.display_name || "متجر",
          product_id: product.id,
          product_title: variantTitle,
          product_image: product.image_urls?.[product.primary_image_index] || product.image_urls?.[0] || null,
          product_price: (product.price_iqd || 0) + priceAdj,
          quantity: cartQuantity,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("تمت الإضافة للسلة 🛒");
      queryClient.invalidateQueries({ queryKey: ["community-cart"] });
      handleOpenChange(false);
    },
    onError: (e: Error) => {
      if (e.message === "يجب تسجيل الدخول") {
        navigate("/auth");
      } else if (e.message.startsWith("DIFFERENT_MERCHANT:")) {
        const merchantName = e.message.split(":")[1];
        toast.error(`لديك بالفعل منتجات من متجر "${merchantName}"`, {
          description: "هل ترغب بتفريغ السلة والإضافة؟",
          action: {
            label: "تفريغ وإضافة",
            onClick: async () => {
              await supabase.from("community_cart_items").delete().eq("user_id", user!.id);
              queryClient.invalidateQueries({ queryKey: ["community-cart"] });
              addToCartMutation.mutate();
            },
          },
        });
      } else {
        toast.error("حدث خطأ");
      }
    },
  });

  // Booking mutation for preorder/waitlist
  const bookingMutation = useMutation({
    mutationFn: async () => {
      if (!user || !product) throw new Error("يجب تسجيل الدخول");

      // Check if already booked
      const { data: existingBooking } = await supabase
        .from("product_bookings")
        .select("id")
        .eq("product_id", product.id)
        .eq("user_id", user.id)
        .in("status", ["pending", "confirmed"])
        .maybeSingle();

      if (existingBooking) throw new Error("ALREADY_BOOKED");

      const nextPosition = (fullProduct?.current_queue_count ?? 0) + 1;

      const { error } = await supabase.from("product_bookings").insert({
        product_id: product.id,
        user_id: user.id,
        merchant_id: product.merchant_id,
        booking_type: saleType,
        queue_position: nextPosition,
        deposit_amount: isPreorder ? depositAmount : 0,
        status: "pending",
      });
      if (error) throw error;

      // Increment queue count
      await supabase
        .from("merchant_products")
        .update({ current_queue_count: nextPosition })
        .eq("id", product.id);
    },
    onSuccess: () => {
      toast.success(isPreorder ? "تم الحجز المسبق بنجاح ✅" : "تمت إضافتك للطابور ✅");
      queryClient.invalidateQueries({ queryKey: ["product-cart-details", product?.id] });
      handleOpenChange(false);
    },
    onError: (e: Error) => {
      if (e.message === "يجب تسجيل الدخول") navigate("/auth");
      else if (e.message === "ALREADY_BOOKED") toast.error("لديك حجز مسبق لهذا المنتج بالفعل");
      else toast.error("حدث خطأ");
    },
  });

  if (!product) return null;

  const mainImage = product.image_urls?.[product.primary_image_index] || product.image_urls?.[0];

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl p-0 max-h-[80vh]">
        <div className="p-5 space-y-4">
          <div className="w-10 h-1 rounded-full bg-border mx-auto -mt-1 mb-2" />

          <SheetHeader className="text-right">
            <SheetTitle className="text-sm font-black flex items-center gap-2">
              {isPreorder && <CalendarClock className="h-4 w-4 text-amber-500" />}
              {isWaitlist && <Users className="h-4 w-4 text-blue-500" />}
              {!isPreorder && !isWaitlist && <ShoppingBag className="h-4 w-4 text-primary" />}
              {isPreorder ? "حجز مسبق" : isWaitlist ? "الانضمام للطابور" : "اختر الخيارات"}
            </SheetTitle>
          </SheetHeader>

          {/* Product summary */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 border border-border/30">
            {mainImage && (
              <img src={mainImage} alt="" className="h-12 w-12 rounded-lg object-cover" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold line-clamp-1">{product.title}</p>
              <p className="text-sm font-black text-primary tabular-nums">{currentPrice.toLocaleString()} د.ع</p>
            </div>
            {(isPreorder || isWaitlist) && (
              <Badge variant="secondary" className="text-[9px] shrink-0">
                {isPreorder ? "حجز مسبق" : "طابور"}
              </Badge>
            )}
          </div>

          {/* Preorder/Waitlist Info */}
          {(isPreorder || isWaitlist) && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-1.5">
              {isPreorder && fullProduct?.preorder_available_date && (
                <p className="text-xs flex items-center gap-1.5">
                  <CalendarClock className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-muted-foreground">تاريخ التوفر:</span>
                  <span className="font-bold">{new Date(fullProduct.preorder_available_date).toLocaleDateString('ar-IQ')}</span>
                </p>
              )}
              {isPreorder && depositAmount > 0 && (
                <p className="text-xs flex items-center gap-1.5">
                  <ShoppingBag className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-muted-foreground">مبلغ العربون:</span>
                  <span className="font-bold text-primary">{depositAmount.toLocaleString()} د.ع ({fullProduct?.preorder_deposit_percent}%)</span>
                </p>
              )}
              {fullProduct?.max_queue_slots && (
                <p className="text-xs flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-blue-500" />
                  <span className="text-muted-foreground">الأماكن:</span>
                  <span className="font-bold">{fullProduct.current_queue_count ?? 0} / {fullProduct.max_queue_slots}</span>
                </p>
              )}
              {fullProduct?.preorder_note && (
                <p className="text-[11px] text-muted-foreground mt-1">{fullProduct.preorder_note}</p>
              )}
              {queueFull && (
                <Badge variant="destructive" className="text-[10px]">الأماكن ممتلئة</Badge>
              )}
            </div>
          )}

          {/* Options Selection */}
          {productOptions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold flex items-center gap-1.5">
                <Settings2 className="h-3.5 w-3.5 text-primary" />
                اختر الخيار <span className="text-destructive">*</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {productOptions.map((opt, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelectedOption(i)}
                    className={`px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                      selectedOption === i
                        ? "bg-primary text-primary-foreground border-primary shadow-md"
                        : "bg-card border-border hover:border-primary/50"
                    }`}
                  >
                    <span>{opt.name}</span>
                    {opt.price_adjustment !== 0 && (
                      <span className="text-[10px] opacity-80 mr-1">
                        ({opt.price_adjustment > 0 ? '+' : ''}{opt.price_adjustment.toLocaleString()})
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Colors Selection */}
          {productColors.length > 0 && (
            <div className={`space-y-2 transition-opacity ${productOptions.length > 0 && selectedOption === null ? 'opacity-40 pointer-events-none' : ''}`}>
              <p className="text-xs font-bold flex items-center gap-1.5">
                <Palette className="h-3.5 w-3.5 text-primary" />
                اختر اللون
                {productOptions.length > 0 && selectedOption === null && (
                  <span className="text-[9px] text-muted-foreground font-normal">(اختر الخيار أولاً)</span>
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                {productColors.map((color, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelectedColor(i)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                      selectedColor === i
                        ? "bg-primary/10 border-primary shadow-md ring-1 ring-primary/30"
                        : "bg-card border-border hover:border-primary/50"
                    }`}
                  >
                    <span className="h-5 w-5 rounded-full border-2 border-border/50 shrink-0" style={{ backgroundColor: color.hex_code }} />
                    <span>{color.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity selector - only for normal products */}
          {!isPreorder && !isWaitlist && (
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold">الكمية</p>
              <div className="flex items-center rounded-xl border border-border/40 overflow-hidden bg-muted/30">
                <button
                  className="h-8 w-9 flex items-center justify-center hover:bg-muted transition-colors"
                  onClick={() => setCartQuantity(q => Math.max(1, q - 1))}
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span className="w-8 text-center text-xs font-black">{cartQuantity}</span>
                <button
                  className="h-8 w-9 flex items-center justify-center hover:bg-muted transition-colors"
                  onClick={() => setCartQuantity(q => q + 1)}
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}

          {/* Action button */}
          {isPreorder || isWaitlist ? (
            <Button
              className="w-full h-12 rounded-2xl gap-2 text-sm font-black shadow-lg"
              onClick={() => bookingMutation.mutate()}
              disabled={bookingMutation.isPending || queueFull || (productOptions.length > 0 && selectedOption === null)}
            >
              {isPreorder ? (
                <><CalendarClock className="h-4 w-4" />احجز الآن{depositAmount > 0 ? ` · ${depositAmount.toLocaleString()} د.ع` : ''}</>
              ) : (
                <><Users className="h-4 w-4" />انضم للطابور</>
              )}
            </Button>
          ) : (
            <Button
              className="w-full h-12 rounded-2xl gap-2 text-sm font-black shadow-lg"
              onClick={() => addToCartMutation.mutate()}
              disabled={addToCartMutation.isPending || (productOptions.length > 0 && selectedOption === null)}
            >
              <ShoppingBag className="h-4 w-4" />
              أضف للسلة · {(currentPrice * cartQuantity).toLocaleString()} د.ع
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
