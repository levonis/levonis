import { ShieldCheck, TrendingDown, Clock, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface PriceProtectionCardProps {
  payload: {
    claim_id?: string;
    order_id?: string;
    order_number?: string | null;
    product_name_ar?: string | null;
    product_image?: string | null;
    purchase_date?: string;
    old_price?: number;
    new_price?: number;
    price_difference?: number;
    quantity?: number;
    total_refund?: number;
    status?: string;
  };
  isMe: boolean;
  timestamp: string;
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  awaiting_admin: { label: "بانتظار الإدارة", cls: "bg-blue-500/15 text-blue-600 border-blue-500/30" },
  processed: { label: "تم الاسترداد", cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
  rejected: { label: "مرفوض", cls: "bg-rose-500/15 text-rose-600 border-rose-500/30" },
  pending: { label: "متاح", cls: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
};

export default function PriceProtectionCard({ payload, isMe, timestamp }: PriceProtectionCardProps) {
  const status = payload.status ?? "awaiting_admin";
  const meta = STATUS_LABEL[status] ?? STATUS_LABEL.awaiting_admin;

  return (
    <div className={cn("flex my-2", isMe ? "justify-start" : "justify-end")}>
      <div className="w-[300px] rounded-2xl overflow-hidden shadow-lg border border-border/40 bg-gradient-to-br from-background/80 via-background/60 to-emerald-500/5 backdrop-blur-xl">
        {/* Header */}
        <div className="px-3 py-2.5 flex items-center justify-between border-b border-border/30 bg-emerald-500/5">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <span className="text-xs font-bold text-foreground">حماية السعر</span>
              {payload.order_number && (
                <p className="text-[10px] text-muted-foreground font-mono">#{payload.order_number}</p>
              )}
            </div>
          </div>
          <Badge variant="outline" className={`${meta.cls} text-[10px] gap-1`}>
            {status === "processed" ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
            {meta.label}
          </Badge>
        </div>

        {/* Body */}
        <div className="p-3">
          <div className="flex gap-2.5 items-center">
            {payload.product_image ? (
              <img src={payload.product_image} alt="" className="h-14 w-14 rounded-xl object-cover border border-border/40 shrink-0" loading="lazy" />
            ) : (
              <div className="h-14 w-14 rounded-xl bg-muted shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-bold text-foreground line-clamp-2">{payload.product_name_ar ?? "منتج"}</h4>
              {payload.purchase_date && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {new Date(payload.purchase_date).toLocaleDateString("ar-IQ", { year: "numeric", month: "short", day: "numeric" })}
                </p>
              )}
              {(payload.quantity ?? 0) > 1 && (
                <p className="text-[10px] text-muted-foreground">×{payload.quantity}</p>
              )}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-xl bg-muted/30 p-2">
            <div className="text-center">
              <p className="text-[9px] text-muted-foreground">السعر السابق</p>
              <p className="text-[11px] font-bold text-foreground line-through opacity-70 tabular-nums">
                {Number(payload.old_price ?? 0).toLocaleString("ar-IQ")}
              </p>
            </div>
            <div className="text-center border-x border-border/30">
              <p className="text-[9px] text-muted-foreground">السعر الحالي</p>
              <p className="text-[11px] font-bold text-foreground tabular-nums">
                {Number(payload.new_price ?? 0).toLocaleString("ar-IQ")}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[9px] text-emerald-700">الفرق</p>
              <p className="text-[11px] font-bold text-emerald-600 tabular-nums flex items-center justify-center gap-0.5">
                <TrendingDown className="h-3 w-3" />
                {Number(payload.total_refund ?? payload.price_difference ?? 0).toLocaleString("ar-IQ")}
              </p>
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground mt-2 text-center">{timestamp}</p>
        </div>
      </div>
    </div>
  );
}
