import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
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
  pending_review: { label: "قيد المراجعة", icon: Clock, color: "bg-amber-500/20 text-amber-600" },
  approved: { label: "منشور", icon: CheckCircle2, color: "bg-emerald-500/20 text-emerald-600" },
  rejected: { label: "مرفوض", icon: XCircle, color: "bg-destructive/20 text-destructive" },
  in_progress: { label: "قيد التنفيذ", icon: Package, color: "bg-blue-500/20 text-blue-600" },
  completed: { label: "مكتمل", icon: CheckCircle2, color: "bg-emerald-500/20 text-emerald-600" },
  delivered: { label: "تم التوصيل", icon: Truck, color: "bg-emerald-600/20 text-emerald-700" },
  cancelled: { label: "ملغي", icon: XCircle, color: "bg-muted text-muted-foreground" },
};

const MATERIAL_LABELS: Record<string, { label: string; color: string }> = {
  filament: { label: "فلمنت", color: "bg-blue-500/20 text-blue-600" },
  resin: { label: "رزن", color: "bg-purple-500/20 text-purple-600" },
  both: { label: "كلاهما", color: "bg-emerald-500/20 text-emerald-600" },
  any: { label: "أي نوع", color: "bg-muted text-muted-foreground" },
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
  const material = request.material_type ? MATERIAL_LABELS[request.material_type] : null;
  const isAccepted = !!request.accepted_offer_id;

  return (
    <div className="group rounded-xl border border-border bg-card overflow-hidden hover:border-primary/40 transition-all">
      <div className="flex gap-3 p-3">
        {/* Image */}
        <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted shrink-0 relative">
          {mainImage ? (
            <img src={mainImage} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="h-6 w-6 text-muted-foreground/40" />
            </div>
          )}
          
          {/* Offers Badge */}
          {offersCount > 0 && (
            <Badge className="absolute bottom-1 right-1 bg-primary text-[9px] h-4 px-1">
              {offersCount} عرض
            </Badge>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <h4 className="font-bold text-sm truncate flex-1">{request.title}</h4>
            <Badge className={`shrink-0 text-[9px] gap-0.5 ${status.color}`}>
              <StatusIcon className="h-2.5 w-2.5" />
              {status.label}
            </Badge>
          </div>

          {/* Quick Info */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
              <Ruler className="h-2.5 w-2.5" />
              {request.size}
            </span>
            <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
              <Palette className="h-2.5 w-2.5" />
              {request.colors}
            </span>
            {material && (
              <Badge className={`text-[9px] h-4 px-1 ${material.color}`}>
                <Layers className="h-2.5 w-2.5 mr-0.5" />
                {material.label}
              </Badge>
            )}
            {request.quantity && request.quantity > 1 && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                <Hash className="h-2.5 w-2.5" />
                {request.quantity}×
              </span>
            )}
          </div>

          {/* Meta & Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              {request.customer_governorate && (
                <span className="flex items-center gap-0.5 text-primary font-medium">
                  <MapPin className="h-2.5 w-2.5" />
                  {request.customer_governorate}
                </span>
              )}
              <span>{new Date(request.created_at).toLocaleDateString("ar-IQ")}</span>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-[10px]"
                onClick={() => onViewDetails(request)}
              >
                <Eye className="h-3 w-3 ml-1" />
                التفاصيل
              </Button>
              {offersCount > 0 && onViewOffers && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-[10px]"
                  onClick={() => onViewOffers(request)}
                >
                  <MessageCircle className="h-3 w-3 ml-1" />
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
