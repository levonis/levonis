import { Clock, BadgePercent, Play, Droplets, Layers, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CompactProductCardProps {
  product: {
    id: string;
    title: string;
    description?: string | null;
    price_iqd: number | null;
    original_price_iqd?: number | null;
    image_urls: string[] | null;
    video_url?: string | null;
    primary_image_index: number;
    estimated_days?: number | null;
    is_featured?: boolean;
    material_type?: "resin" | "filament" | "both" | null;
  };
  onView?: () => void;
}

export default function CompactProductCard({ product, onView }: CompactProductCardProps) {
  const mainImage = product.image_urls?.[product.primary_image_index] || product.image_urls?.[0];
  const hasDiscount = product.original_price_iqd && product.price_iqd && product.original_price_iqd > product.price_iqd;
  const discountPercent = hasDiscount
    ? Math.round(((product.original_price_iqd! - product.price_iqd!) / product.original_price_iqd!) * 100)
    : 0;

  return (
    <div 
      className="group relative rounded-xl border border-border/40 bg-card overflow-hidden hover:border-primary/40 hover:shadow-md transition-all duration-200 cursor-pointer"
      onClick={onView}
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-muted">
        {mainImage ? (
          <img
            src={mainImage}
            alt={product.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Sparkles className="h-8 w-8 text-muted-foreground/20" />
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-1.5 left-1.5 right-1.5 flex justify-between">
          <div className="flex gap-1">
            {hasDiscount && (
              <Badge className="bg-destructive text-white text-[9px] px-1.5 h-5">
                -{discountPercent}%
              </Badge>
            )}
            {product.is_featured && (
              <Badge className="bg-amber-500 text-white text-[9px] px-1.5 h-5">
                <Sparkles className="h-2.5 w-2.5" />
              </Badge>
            )}
          </div>
          {product.video_url && (
            <Badge className="bg-black/60 text-white text-[9px] px-1.5 h-5">
              <Play className="h-2.5 w-2.5 fill-white" />
            </Badge>
          )}
        </div>

        {/* Material */}
        {product.material_type && (
          <Badge 
            variant="secondary" 
            className="absolute bottom-1.5 right-1.5 text-[9px] px-1.5 h-5 bg-background/80 backdrop-blur-sm"
          >
            {product.material_type === "resin" && <Droplets className="h-2.5 w-2.5 mr-0.5 text-blue-400" />}
            {product.material_type === "filament" && <Layers className="h-2.5 w-2.5 mr-0.5 text-orange-400" />}
            {product.material_type === "both" && (
              <>
                <Droplets className="h-2.5 w-2.5 text-blue-400" />
                <Layers className="h-2.5 w-2.5 text-orange-400" />
              </>
            )}
          </Badge>
        )}
      </div>

      {/* Content */}
      <div className="p-2.5 space-y-1">
        <h3 className="font-semibold text-xs line-clamp-1 group-hover:text-primary transition-colors">
          {product.title}
        </h3>

        <div className="flex items-center justify-between">
          {product.price_iqd ? (
            <div className="flex items-baseline gap-1">
              <span className="text-sm font-bold text-primary">
                {product.price_iqd.toLocaleString()}
              </span>
              <span className="text-[10px] text-muted-foreground">د.ع</span>
            </div>
          ) : (
            <span className="text-[10px] text-muted-foreground">اتصل للسعر</span>
          )}

          {product.estimated_days && (
            <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Clock className="h-2.5 w-2.5" />
              {product.estimated_days}د
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
