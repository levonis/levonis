import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Package, Play, DollarSign, Clock, Layers, Sparkles, Trash2,
  Pencil, ChevronLeft, ChevronRight, MessageCircle, ShoppingBag
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface MerchantProduct {
  id: string;
  title: string;
  description: string | null;
  price_iqd: number | null;
  original_price_iqd: number | null;
  image_urls: string[] | null;
  video_url: string | null;
  primary_image_index: number;
  estimated_days: number | null;
  is_featured?: boolean;
  material_type?: "resin" | "filament" | "both" | null;
}

interface ProductDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: MerchantProduct | null;
  merchantId: string;
  isOwner?: boolean;
  merchantName?: string;
  onEdit?: (product: MerchantProduct) => void;
  onOrder?: () => void;
  onContact?: () => void;
}

const MATERIAL_LABELS: Record<string, { label: string; color: string }> = {
  filament: { label: "فلمنت (FDM)", color: "bg-blue-500/20 text-blue-600" },
  resin: { label: "رزن (SLA)", color: "bg-purple-500/20 text-purple-600" },
  both: { label: "كلاهما", color: "bg-emerald-500/20 text-emerald-600" },
};

export default function ProductDetailSheet({
  open,
  onOpenChange,
  product,
  merchantId,
  isOwner = false,
  merchantName,
  onEdit,
  onOrder,
  onContact,
}: ProductDetailSheetProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!product) return;
      const { error } = await supabase
        .from("merchant_products")
        .delete()
        .eq("id", product.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["merchant-store-products", merchantId] });
      toast({ title: "تم حذف المنتج" });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({ title: "تعذر حذف المنتج", description: err?.message, variant: "destructive" });
    },
  });

  if (!product) return null;

  const images = product.image_urls || [];
  const hasVideo = !!product.video_url;
  const totalMedia = images.length + (hasVideo ? 1 : 0);
  const material = product.material_type ? MATERIAL_LABELS[product.material_type] : null;
  const hasDiscount = product.original_price_iqd && product.price_iqd && product.original_price_iqd > product.price_iqd;
  const discountPercent = hasDiscount
    ? Math.round((1 - product.price_iqd! / product.original_price_iqd!) * 100)
    : 0;

  const prevMedia = () => setActiveMediaIndex((i) => (i - 1 + totalMedia) % totalMedia);
  const nextMedia = () => setActiveMediaIndex((i) => (i + 1) % totalMedia);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="p-4 pb-3 border-b border-border/50 shrink-0">
          <SheetTitle className="text-sm font-bold truncate pr-6">{product.title}</SheetTitle>
          <SheetDescription className="text-[11px] text-muted-foreground">
            {merchantName ? `من ${merchantName}` : "تفاصيل المنتج"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 p-4">
          {/* Media Gallery */}
          {totalMedia > 0 && (
            <div className="space-y-2">
              <div className="relative rounded-xl overflow-hidden bg-muted">
                <AspectRatio ratio={1}>
                  {hasVideo && activeMediaIndex === images.length ? (
                    <video src={product.video_url!} controls className="w-full h-full object-contain bg-black" />
                  ) : (
                    <img
                      src={images[activeMediaIndex]}
                      alt={product.title}
                      className="w-full h-full object-contain"
                    />
                  )}
                </AspectRatio>

                {totalMedia > 1 && (
                  <>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full"
                      onClick={prevMedia}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full"
                      onClick={nextMedia}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>

                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                      {Array.from({ length: totalMedia }).map((_, i) => (
                        <button
                          key={i}
                          className={`h-1.5 rounded-full transition-all ${
                            i === activeMediaIndex ? "w-4 bg-primary" : "w-1.5 bg-white/60"
                          }`}
                          onClick={() => setActiveMediaIndex(i)}
                        />
                      ))}
                    </div>
                  </>
                )}

                {/* Badges */}
                <div className="absolute top-2 right-2 left-2 flex items-start justify-between">
                  {product.is_featured && (
                    <Badge className="bg-amber-500/20 text-amber-600 border-0 text-[10px] gap-1">
                      <Sparkles className="h-3 w-3" />
                      مميز
                    </Badge>
                  )}
                  {hasDiscount && (
                    <Badge className="bg-destructive text-white text-[10px] mr-auto">
                      خصم {discountPercent}%
                    </Badge>
                  )}
                </div>
              </div>

              {/* Thumbnails */}
              {totalMedia > 1 && (
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {images.map((url, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveMediaIndex(i)}
                      className={`w-12 h-12 rounded-lg overflow-hidden shrink-0 border-2 transition-all ${
                        activeMediaIndex === i ? "border-primary" : "border-transparent opacity-60"
                      }`}
                    >
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                  {hasVideo && (
                    <button
                      onClick={() => setActiveMediaIndex(images.length)}
                      className={`w-12 h-12 rounded-lg overflow-hidden shrink-0 border-2 bg-black flex items-center justify-center ${
                        activeMediaIndex === images.length ? "border-primary" : "border-transparent opacity-60"
                      }`}
                    >
                      <Play className="h-4 w-4 text-white fill-white" />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Price Card */}
          <div className="p-3 rounded-xl bg-primary/5 border border-primary/20">
            <div className="flex items-baseline gap-2">
              {product.price_iqd ? (
                <>
                  <span className="text-xl font-bold text-primary">{product.price_iqd.toLocaleString()}</span>
                  <span className="text-sm text-muted-foreground">د.ع</span>
                  {hasDiscount && (
                    <span className="text-sm text-muted-foreground line-through mr-auto">
                      {product.original_price_iqd!.toLocaleString()}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-sm text-muted-foreground">السعر غير محدد</span>
              )}
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-2">
            {product.estimated_days && (
              <div className="p-2.5 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <Clock className="h-3 w-3" />
                  <span className="text-[10px]">مدة التنفيذ</span>
                </div>
                <p className="font-medium text-xs">{product.estimated_days} أيام</p>
              </div>
            )}
            {material && (
              <div className="p-2.5 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <Layers className="h-3 w-3" />
                  <span className="text-[10px]">نوع المادة</span>
                </div>
                <Badge className={`text-[10px] ${material.color}`}>{material.label}</Badge>
              </div>
            )}
          </div>

          {/* Description */}
          {product.description && (
            <div className="space-y-1.5">
              <h4 className="font-medium text-xs">الوصف</h4>
              <p className="text-[11px] text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {product.description}
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 pt-3 border-t border-border/50 shrink-0">
          {isOwner ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 h-9 text-xs gap-1.5"
                onClick={() => product && onEdit?.(product)}
              >
                <Pencil className="h-3.5 w-3.5" />
                تعديل
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="icon" className="h-9 w-9 shrink-0">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>حذف المنتج؟</AlertDialogTitle>
                    <AlertDialogDescription>سيتم حذف المنتج نهائياً.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteMutation.mutate()}>
                      حذف
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ) : (
            <div className="flex gap-2">
              {product.price_iqd && onOrder && (
                <Button className="flex-1 h-9 text-xs gap-1.5" onClick={onOrder}>
                  <ShoppingBag className="h-3.5 w-3.5" />
                  طلب الآن
                </Button>
              )}
              {onContact && (
                <Button
                  variant={product.price_iqd ? "outline" : "default"}
                  className="flex-1 h-9 text-xs gap-1.5"
                  onClick={onContact}
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  تواصل
                </Button>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
