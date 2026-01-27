import { Clock, BadgePercent, Play, Droplets, Layers, Eye, Edit2, EyeOff, Sparkles, Trash2 } from "lucide-react";
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
  };
  variant?: "client" | "merchant";
  viewMode?: "grid" | "list";
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function ProductCardEnhanced({
  product,
  variant = "client",
  viewMode = "grid",
  onView,
  onEdit,
  onDelete,
}: ProductCardEnhancedProps) {
  const mainImage = product.image_urls?.[product.primary_image_index] || product.image_urls?.[0];
  const hasDiscount = product.original_price_iqd && product.price_iqd && product.original_price_iqd > product.price_iqd;
  const discountPercent = hasDiscount
    ? Math.round(((product.original_price_iqd! - product.price_iqd!) / product.original_price_iqd!) * 100)
    : 0;

  const getMaterialBadge = (type?: string | null) => {
    if (type === "resin") return { icon: Droplets, label: "رزن", className: "bg-blue-500/15 text-blue-400 border-blue-500/30" };
    if (type === "filament") return { icon: Layers, label: "فلمنت", className: "bg-orange-500/15 text-orange-400 border-orange-500/30" };
    return null;
  };

  const materialBadge = getMaterialBadge(product.material_type);

  if (viewMode === "list") {
    return (
      <div 
        className="group relative flex gap-4 p-4 rounded-2xl border border-border/50 bg-gradient-to-r from-card to-card/80 hover:border-primary/30 hover:shadow-lg transition-all duration-300 cursor-pointer"
        onClick={onView}
      >
        {/* Image */}
        <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-xl overflow-hidden flex-shrink-0 bg-muted">
          {mainImage ? (
            <img
              src={mainImage}
              alt={product.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-muted-foreground/30" />
            </div>
          )}
          
          {product.video_url && (
            <div className="absolute top-2 right-2 h-6 w-6 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center">
              <Play className="h-3 w-3 text-white fill-white" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div>
            <div className="flex items-start gap-2 mb-1">
              <h3 className="font-bold text-foreground truncate flex-1">{product.title}</h3>
              {product.is_featured && (
                <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 text-[10px] shrink-0">
                  <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                  مميز
                </Badge>
              )}
            </div>
            
            {product.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{product.description}</p>
            )}
            
            <div className="flex flex-wrap gap-1.5">
              {materialBadge && (
                <Badge variant="outline" className={`text-[10px] ${materialBadge.className}`}>
                  <materialBadge.icon className="h-2.5 w-2.5 mr-0.5" />
                  {materialBadge.label}
                </Badge>
              )}
              {product.estimated_days && (
                <Badge variant="outline" className="text-[10px] bg-muted/50">
                  <Clock className="h-2.5 w-2.5 mr-0.5" />
                  {product.estimated_days} أيام
                </Badge>
              )}
              {variant === "merchant" && !product.is_active && (
                <Badge variant="secondary" className="text-[10px]">
                  <EyeOff className="h-2.5 w-2.5 mr-0.5" />
                  مخفي
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between mt-3">
            <div className="flex items-baseline gap-2">
              {product.price_iqd ? (
                <>
                  <span className="text-lg font-bold text-primary">
                    {product.price_iqd.toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground">د.ع</span>
                  {hasDiscount && (
                    <span className="text-xs text-muted-foreground line-through">
                      {product.original_price_iqd?.toLocaleString()}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-sm text-muted-foreground">اتصل للسعر</span>
              )}
            </div>

            {variant === "merchant" && (
              <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onEdit}>
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={onDelete}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="group relative rounded-2xl border border-border/50 bg-gradient-to-br from-card to-card/80 overflow-hidden hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 cursor-pointer"
      onClick={onView}
    >
      {/* Image Container */}
      <div className="relative">
        <AspectRatio ratio={1}>
          {mainImage ? (
            <img
              src={mainImage}
              alt={product.title}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
              <Sparkles className="h-12 w-12 text-muted-foreground/20" />
            </div>
          )}
        </AspectRatio>

        {/* Overlay Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Top Badges */}
        <div className="absolute top-2 left-2 right-2 flex justify-between">
          <div className="flex gap-1.5">
            {hasDiscount && (
              <Badge className="bg-red-500 text-white border-0 shadow-lg text-[10px] font-bold">
                <BadgePercent className="h-3 w-3 mr-0.5" />
                {discountPercent}%
              </Badge>
            )}
            {product.is_featured && (
              <Badge className="bg-amber-500 text-white border-0 shadow-lg text-[10px]">
                <Sparkles className="h-3 w-3" />
              </Badge>
            )}
          </div>
          
          {product.video_url && (
            <Badge className="bg-black/60 backdrop-blur-sm text-white border-0">
              <Play className="h-3 w-3 fill-white" />
            </Badge>
          )}
        </div>

        {/* Material Badge */}
        {materialBadge && (
          <Badge 
            variant="outline" 
            className={`absolute bottom-2 right-2 text-[10px] backdrop-blur-sm ${materialBadge.className}`}
          >
            <materialBadge.icon className="h-3 w-3 mr-0.5" />
            {materialBadge.label}
          </Badge>
        )}

        {/* Merchant Actions */}
        {variant === "merchant" && (
          <div 
            className="absolute bottom-2 left-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <Button size="icon" className="h-8 w-8 rounded-full bg-white/90 hover:bg-white text-foreground shadow-lg" onClick={onEdit}>
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" className="h-8 w-8 rounded-full bg-destructive hover:bg-destructive/90 text-white shadow-lg" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* Hidden Overlay */}
        {variant === "merchant" && !product.is_active && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center">
            <Badge variant="secondary" className="text-sm font-medium">
              <EyeOff className="h-4 w-4 mr-1.5" />
              مخفي
            </Badge>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-2">
        <h3 className="font-bold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
          {product.title}
        </h3>

        {product.estimated_days && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>التنفيذ: {product.estimated_days} أيام</span>
          </div>
        )}

        <div className="flex items-baseline gap-2 pt-1">
          {product.price_iqd ? (
            <>
              <span className="text-xl font-bold text-primary">
                {product.price_iqd.toLocaleString()}
              </span>
              <span className="text-xs text-muted-foreground">د.ع</span>
              {hasDiscount && (
                <span className="text-xs text-muted-foreground line-through mr-auto">
                  {product.original_price_iqd?.toLocaleString()}
                </span>
              )}
            </>
          ) : (
            <span className="text-sm text-muted-foreground italic">اتصل للسعر</span>
          )}
        </div>
      </div>
    </div>
  );
}
