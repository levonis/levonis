import { useQuery } from "@tanstack/react-query";
import {
  Package, Palette, Ruler, DollarSign, Layers, Eye, MapPin, Hash,
  Clock, CheckCircle2, XCircle, Truck, MessageCircle
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface PrintRequest {
  id: string;
  user_id: string;
  title: string;
  description: string;
  size: string;
  colors: string;
  material_type: string | null;
  images: string[] | null;
  image_url: string | null;
  status: string;
  created_at: string;
  accepted_offer_id: string | null;
  quantity?: number;
  customer_governorate?: string;
}

interface CustomerRequestCardProps {
  request: PrintRequest;
  onViewDetails: (request: PrintRequest) => void;
  onViewOffers?: (request: PrintRequest) => void;
}

const STATUS_UI: Record<string, { label: string; icon: any; color: string }> = {
  pending_review: { label: "قيد المراجعة", icon: Clock, color: "bg-amber-600/30 text-amber-300 border-amber-500/30" },
  approved: { label: "منشور", icon: CheckCircle2, color: "bg-emerald-600/30 text-emerald-300 border-emerald-500/30" },
  rejected: { label: "مرفوض", icon: XCircle, color: "bg-red-600/30 text-red-300 border-red-500/30" },
  in_progress: { label: "قيد التنفيذ", icon: Package, color: "bg-blue-600/30 text-blue-300 border-blue-500/30" },
  completed: { label: "مكتمل", icon: CheckCircle2, color: "bg-emerald-600/30 text-emerald-300 border-emerald-500/30" },
  delivered: { label: "تم التوصيل", icon: Truck, color: "bg-green-600/30 text-green-300 border-green-500/30" },
  cancelled: { label: "ملغي", icon: XCircle, color: "bg-slate-600/30 text-slate-300 border-slate-500/30" },
};

const MATERIAL_CONFIG: Record<string, { label: string; color: string }> = {
  filament: { label: "فلمنت", color: "bg-blue-600/30 text-blue-300 border-blue-500/30" },
  resin: { label: "رزن", color: "bg-purple-600/30 text-purple-300 border-purple-500/30" },
  both: { label: "كلاهما", color: "bg-emerald-600/30 text-emerald-300 border-emerald-500/30" },
  any: { label: "أي نوع", color: "bg-slate-600/30 text-slate-300 border-slate-500/30" },
};

export default function CustomerRequestCard({
  request,
  onViewDetails,
  onViewOffers,
}: CustomerRequestCardProps) {
  // Get offers count
  const { data: offersCount = 0 } = useQuery({
    queryKey: ["offers-count", request.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("print_offers")
        .select("id", { count: "exact", head: true })
        .eq("request_id", request.id);
      return count ?? 0;
    },
  });

  const mainImage = request.images?.[0] || request.image_url;
  const status = STATUS_UI[request.status] || STATUS_UI.pending_review;
  const StatusIcon = status.icon;
  const material = request.material_type ? MATERIAL_CONFIG[request.material_type] : null;

  return (
    <div className="group rounded-xl border border-border/50 bg-gradient-to-b from-card to-background overflow-hidden hover:border-primary/40 transition-all duration-300">
      <div className="flex gap-3 p-3">
        {/* Image */}
        <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted/30 shrink-0 relative border border-border/30">
          {mainImage ? (
            <img src={mainImage} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted/50 to-muted">
              <Package className="h-6 w-6 text-muted-foreground/30" />
            </div>
          )}
          
          {/* Offers Badge */}
          {offersCount > 0 && (
            <Badge className="absolute bottom-1 right-1 bg-primary/90 text-[8px] h-4 px-1 border-0">
              {offersCount} عرض
            </Badge>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <h4 className="font-bold text-xs truncate flex-1">{request.title}</h4>
            <Badge className={`shrink-0 text-[8px] gap-0.5 border ${status.color}`}>
              <StatusIcon className="h-2.5 w-2.5" />
              {status.label}
            </Badge>
          </div>

          {/* Quick Info Tags */}
          <div className="flex flex-wrap gap-1 mb-2">
            <span className="inline-flex items-center gap-0.5 text-[8px] text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">
              <Ruler className="h-2 w-2" />
              {request.size}
            </span>
            <span className="inline-flex items-center gap-0.5 text-[8px] text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">
              <Palette className="h-2 w-2" />
              {request.colors}
            </span>
            {material && (
              <Badge className={`text-[8px] h-4 px-1 border ${material.color}`}>
                <Layers className="h-2 w-2 ml-0.5" />
                {material.label}
              </Badge>
            )}
            {request.quantity && request.quantity > 1 && (
              <span className="inline-flex items-center gap-0.5 text-[8px] text-cyan-300 bg-cyan-600/30 px-1.5 py-0.5 rounded">
                <Hash className="h-2 w-2" />
                {request.quantity}×
              </span>
            )}
          </div>

          {/* Meta & Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
              {request.customer_governorate && (
                <span className="flex items-center gap-0.5 text-primary font-medium">
                  <MapPin className="h-2.5 w-2.5" />
                  {request.customer_governorate}
                </span>
              )}
              <span className="flex items-center gap-0.5">
                <Clock className="h-2.5 w-2.5" />
                {new Date(request.created_at).toLocaleDateString("ar-IQ")}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[9px]"
                onClick={() => onViewDetails(request)}
              >
                <Eye className="h-2.5 w-2.5 ml-0.5" />
                التفاصيل
              </Button>
              {offersCount > 0 && onViewOffers && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-[9px] border-primary/30 text-primary"
                  onClick={() => onViewOffers(request)}
                >
                  <MessageCircle className="h-2.5 w-2.5 ml-0.5" />
                  العروض
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
