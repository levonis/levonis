import { Clock, BadgePercent, Play, Droplets, Layers, Eye, Edit2, EyeOff, Sparkles, Trash2, ShoppingCart, Box, Clock3, Wallet, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AspectRatio } from "@/components/ui/aspect-ratio";

interface ProductCardEnhancedProps {
  product: {
    id: string;
    title: string;
    description: string | null;
    price_iqd: number | null;
    original_price_iqd: number | null;
    image_urls: string[] | null;
    video_url: string | null;
    primary_image_index: number;
    estimated_days: number | null;
    is_active?: boolean;
    is_featured?: boolean;
    material_type?: "resin" | "filament" | "both" | null;
    stock_quantity?: number | null;
    is_preorder?: boolean;
    preorder_queue_current?: number;
    preorder_queue_total?: number;
    allow_wallet_payment?: boolean;
    colors?: any[] | null;
    options?: any[] | null;
  };
  variant?: "client" | "merchant";
  viewMode?: "grid" | "list";
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onQuickOrder?: () => void;
  onContact?: () => void;
}

export default function ProductCardEnhanced({
  product,
  variant = "client",
  viewMode = "grid",
  onView,
  onEdit,
  onDelete,
  onQuickOrder,
  onContact,
}: ProductCardEnhancedProps) {
  const mainImage = product.image_urls?.[product.primary_image_index] || product.image_urls?.[0];
  const hasDiscount = product.original_price_iqd && product.price_iqd && product.original_price_iqd > product.price_iqd;
  const discountPercent = hasDiscount
    ? Math.round(((product.original_price_iqd! - product.price_iqd!) / product.original_price_iqd!) * 100)
    : 0;

  const isOutOfStock = product.stock_quantity !== null && product.stock_quantity !== undefined && product.stock_quantity <= 0;
  const colorsCount = Array.isArray(product.colors) ? product.colors.length : 0;
  const optionsCount = Array.isArray(product.options) ? product.options.length : 0;

  const getMaterialBadge = (type?: string | null) => {
    if (type === "resin") return { icon: Droplets, label: "رزن", className: "bg-blue-500/15 text-blue-400 border-blue-500/30" };
    if (type === "filament") return { icon: Layers, label: "فلمنت", className: "bg-orange-500/15 text-orange-400 border-orange-500/30" };
    return null;
  };

  const materialBadge = getMaterialBadge(product.material_type);

  // Order/Reserve button label
  const orderLabel = product.is_preorder ? "احجز" : "اطلب";
  const OrderIcon = product.is_preorder ? Clock3 : (product.allow_wallet_payment ? Wallet : ShoppingCart);

  if (viewMode === "list") {
    return (
      <div className="group relative flex gap-4 p-4 rounded-2xl border border-border/50 bg-gradient-to-r from-card to-card/80 hover:border-primary/30 hover:shadow-lg transition-all duration-300 cursor-pointer" onClick={onView}>
        <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-xl overflow-hidden flex-shrink-0 bg-muted">
          {mainImage ? (
            <img src={mainImage} alt={product.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
          ) : (
            <div className="w-full h-full flex items-center justify-center"><Sparkles className="h-8 w-8 text-muted-foreground/30" /></div>
          )}
          {product.is_preorder && <Badge className="absolute top-1 right-1 bg-amber-500 text-white text-[8px] h-4 px-1">حجز</Badge>}
          {isOutOfStock && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><span className="text-white text-[10px] font-bold">نفذ</span></div>}
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div>
            <div className="flex items-start gap-2 mb-1">
              <h3 className="font-bold text-foreground truncate flex-1">{product.title}</h3>
              {product.is_featured && <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 text-[10px] shrink-0"><Sparkles className="h-2.5 w-2.5 mr-0.5" />مميز</Badge>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {materialBadge && <Badge variant="outline" className={`text-[10px] ${materialBadge.className}`}><materialBadge.icon className="h-2.5 w-2.5 mr-0.5" />{materialBadge.label}</Badge>}
              {product.stock_quantity !== null && product.stock_quantity !== undefined && !isOutOfStock && <Badge variant="outline" className="text-[10px]"><Box className="h-2.5 w-2.5 mr-0.5" />{product.stock_quantity}</Badge>}
              {colorsCount > 0 && <Badge variant="outline" className="text-[10px]">{colorsCount} لون</Badge>}
              {optionsCount > 0 && <Badge variant="outline" className="text-[10px]">{optionsCount} خيار</Badge>}
              {variant === "merchant" && !product.is_active && <Badge variant="secondary" className="text-[10px]"><EyeOff className="h-2.5 w-2.5 mr-0.5" />مخفي</Badge>}
            </div>
          </div>

          <div className="flex items-center justify-between mt-3">
            <div className="flex items-baseline gap-2">
              {product.price_iqd ? (
                <><span className="text-lg font-bold text-primary">{product.price_iqd.toLocaleString()}</span><span className="text-xs text-muted-foreground">د.ع</span>
                {hasDiscount && <span className="text-xs text-muted-foreground line-through">{product.original_price_iqd?.toLocaleString()}</span>}</>
              ) : (
                <span className="text-sm text-muted-foreground">اتصل للسعر</span>
              )}
            </div>
            <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
              {variant === "client" && !isOutOfStock && (
                <>
                  {onContact && (
                    <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 px-2" onClick={onContact}>
                      <MessageCircle className="h-3 w-3" />
                    </Button>
                  )}
                  {onQuickOrder && (
                    <Button size="sm" className="h-7 text-[10px] gap-1 px-2" onClick={onQuickOrder}>
                      <OrderIcon className="h-3 w-3" />{orderLabel}
                    </Button>
                  )}
                </>
              )}
              {variant === "merchant" && (
                <>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onEdit}><Edit2 className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative rounded-2xl border border-border/50 bg-gradient-to-br from-card to-card/80 overflow-hidden hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 cursor-pointer" onClick={onView}>
      <div className="relative">
        <AspectRatio ratio={1}>
          {mainImage ? (
            <img src={mainImage} alt={product.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center"><Sparkles className="h-12 w-12 text-muted-foreground/20" /></div>
          )}
        </AspectRatio>

        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Top Badges */}
        <div className="absolute top-2 left-2 right-2 flex justify-between">
          <div className="flex gap-1.5">
            {hasDiscount && <Badge className="bg-red-500 text-white border-0 shadow-lg text-[10px] font-bold"><BadgePercent className="h-3 w-3 mr-0.5" />{discountPercent}%</Badge>}
            {product.is_featured && <Badge className="bg-amber-500 text-white border-0 shadow-lg text-[10px]"><Sparkles className="h-3 w-3" /></Badge>}
            {product.is_preorder && <Badge className="bg-amber-600 text-white border-0 shadow-lg text-[10px]"><Clock3 className="h-3 w-3 mr-0.5" />حجز</Badge>}
          </div>
          <div className="flex gap-1">
            {product.video_url && <Badge className="bg-black/60 backdrop-blur-sm text-white border-0"><Play className="h-3 w-3 fill-white" /></Badge>}
            {product.stock_quantity !== null && product.stock_quantity !== undefined && !isOutOfStock && (
              <Badge className="bg-black/60 backdrop-blur-sm text-white border-0 text-[10px]"><Box className="h-3 w-3 mr-0.5" />{product.stock_quantity}</Badge>
            )}
          </div>
        </div>

        {/* Material Badge */}
        {materialBadge && (
          <Badge variant="outline" className={`absolute bottom-2 right-2 text-[10px] backdrop-blur-sm ${materialBadge.className}`}>
            <materialBadge.icon className="h-3 w-3 mr-0.5" />{materialBadge.label}
          </Badge>
        )}

        {/* Client Action Buttons - Always visible at bottom */}
        {variant === "client" && !isOutOfStock && (
          <div className="absolute bottom-2 left-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
            {onContact && (
              <Button size="icon" className="h-7 w-7 rounded-full bg-white/90 hover:bg-white text-foreground shadow-lg" onClick={onContact}>
                <MessageCircle className="h-3 w-3" />
              </Button>
            )}
            {onQuickOrder && (
              <Button size="sm" className="h-7 text-[10px] gap-1 px-2 rounded-full shadow-lg" onClick={onQuickOrder}>
                <OrderIcon className="h-3 w-3" />{orderLabel}
              </Button>
            )}
          </div>
        )}

        {/* Merchant Actions */}
        {variant === "merchant" && (
          <div className="absolute bottom-2 left-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
            <Button size="icon" className="h-8 w-8 rounded-full bg-white/90 hover:bg-white text-foreground shadow-lg" onClick={onEdit}><Edit2 className="h-3.5 w-3.5" /></Button>
            <Button size="icon" className="h-8 w-8 rounded-full bg-destructive hover:bg-destructive/90 text-white shadow-lg" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        )}

        {/* Out of stock overlay */}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center">
            <Badge variant="secondary" className="text-sm font-medium">نفذت الكمية</Badge>
          </div>
        )}

        {/* Hidden Overlay */}
        {variant === "merchant" && !product.is_active && !isOutOfStock && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center">
            <Badge variant="secondary" className="text-sm font-medium"><EyeOff className="h-4 w-4 mr-1.5" />مخفي</Badge>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3 space-y-1.5">
        <h3 className="font-bold text-sm text-foreground line-clamp-1 group-hover:text-primary transition-colors">{product.title}</h3>

        {/* Color dots & options count */}
        {(colorsCount > 0 || optionsCount > 0) && (
          <div className="flex items-center gap-2">
            {colorsCount > 0 && (
              <div className="flex items-center gap-0.5">
                {(product.colors as any[]).slice(0, 5).map((c: any, i: number) => (
                  <span key={i} className="h-3 w-3 rounded-full border border-border/50" style={{ backgroundColor: c.hex_code }} />
                ))}
                {colorsCount > 5 && <span className="text-[9px] text-muted-foreground">+{colorsCount - 5}</span>}
              </div>
            )}
            {optionsCount > 0 && <span className="text-[10px] text-muted-foreground">{optionsCount} خيار</span>}
          </div>
        )}

        {/* Pre-order queue */}
        {product.is_preorder && product.preorder_queue_total && product.preorder_queue_total > 0 && (
          <div className="text-[10px] text-amber-600 flex items-center gap-1">
            <Clock3 className="h-2.5 w-2.5" />
            {product.preorder_queue_current || 0}/{product.preorder_queue_total} حجز
          </div>
        )}

        <div className="flex items-baseline gap-2 pt-0.5">
          {product.price_iqd ? (
            <>
              <span className="text-lg font-bold text-primary">{product.price_iqd.toLocaleString()}</span>
              <span className="text-xs text-muted-foreground">د.ع</span>
              {hasDiscount && <span className="text-xs text-muted-foreground line-through mr-auto">{product.original_price_iqd?.toLocaleString()}</span>}
            </>
          ) : (
            <span className="text-sm text-muted-foreground italic">اتصل للسعر</span>
          )}
        </div>

        {/* Client: Always visible order button */}
        {variant === "client" && !isOutOfStock && onQuickOrder && (
          <div className="flex gap-1.5 pt-1" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" className="flex-1 h-8 text-[11px] gap-1.5 font-bold" onClick={onQuickOrder}>
              <OrderIcon className="h-3.5 w-3.5" />{orderLabel}
            </Button>
            {onContact && (
              <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={onContact}>
                <MessageCircle className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
