import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  ArrowRight, FileText, Package, Pencil, Trash2, Clock, CheckCircle2, XCircle,
  Truck, ShieldAlert, DollarSign, Eye, MessageSquare, ChevronDown, ChevronUp,
  Star, Store, Scale, Layers, User, Calendar, MapPin, Hash
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import RateRequestButton from "@/components/merchant/RateRequestButton";
import AcceptOfferDialog from "@/components/community/AcceptOfferDialog";

const requestSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  size: z.string().nullable().optional(),
  colors: z.string().nullable().optional(),
  material_type: z.string().nullable().optional(),
  quantity: z.number().nullable().optional(),
  reference_links: z.array(z.string()).nullable().default([]),
  images: z.array(z.string()).nullable().optional(),
  image_url: z.string().nullable().optional(),
  status: z.string(),
  admin_notes: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  accepted_at: z.string().nullable().optional(),
  accepted_offer_id: z.string().nullable().optional(),
  delivered_at: z.string().nullable().optional(),
  customer_confirmed_at: z.string().nullable().optional(),
  escrow_amount: z.number().nullable().optional(),
  customer_governorate: z.string().nullable().optional(),
});
type PrintRequest = z.infer<typeof requestSchema>;

interface OfferRow {
  id: string;
  trader_id: string;
  price_iqd: number;
  duration_days: number;
  grams: number | null;
  notes: string | null;
  status: string;
  material_type: string | null;
  created_at: string;
  edit_count: number;
  merchant?: {
    id: string;
    display_name: string | null;
    store_image_url: string | null;
    is_verified?: boolean;
  } | null;
}

const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  pending_review: { label: "قيد المراجعة", icon: Clock, color: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
  approved: { label: "بانتظار العروض", icon: CheckCircle2, color: "bg-blue-500/15 text-blue-500 border-blue-500/30" },
  rejected: { label: "مرفوض", icon: XCircle, color: "bg-destructive/15 text-destructive border-destructive/30" },
  in_progress: { label: "قيد التنفيذ", icon: Package, color: "bg-purple-500/15 text-purple-500 border-purple-500/30" },
  completed: { label: "مكتمل", icon: CheckCircle2, color: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  delivered: { label: "تم التوصيل", icon: Truck, color: "bg-orange-500/15 text-orange-500 border-orange-500/30" },
  cancelled: { label: "ملغي", icon: XCircle, color: "bg-muted text-muted-foreground border-border" },
};

export default function CommunityCustomerRequests() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editSize, setEditSize] = useState("");
  const [editColors, setEditColors] = useState("");
  const [acceptOffer, setAcceptOffer] = useState<{ offer: OfferRow; requestId: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["my-print-requests", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_print_requests")
        .select("id, user_id, title, description, notes, size, colors, material_type, quantity, reference_links, images, image_url, status, admin_notes, created_at, updated_at, accepted_at, accepted_offer_id, delivered_at, customer_confirmed_at, escrow_amount, customer_governorate")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return z.array(requestSchema).parse(data ?? []);
    },
    staleTime: 20_000,
  });

  const requestIds = data?.map(r => r.id) ?? [];
  const { data: allOffers = [] } = useQuery({
    queryKey: ["my-requests-offers", requestIds],
    enabled: requestIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("print_offers")
        .select("id, request_id, trader_id, price_iqd, duration_days, grams, notes, status, material_type, created_at, edit_count")
        .in("request_id", requestIds)
        .order("price_iqd", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const traderIds = [...new Set(allOffers.map(o => o.trader_id))];
  const { data: merchantProfiles = [] } = useQuery({
    queryKey: ["offer-merchants", traderIds],
    enabled: traderIds.length > 0,
    queryFn: async () => {
      const { data: apps } = await supabase
        .from("merchant_applications")
        .select("id, user_id, display_name, store_image_url, is_verified")
        .in("user_id", traderIds)
        .eq("status", "approved");
      return apps ?? [];
    },
  });

  const merchantByUserId = useMemo(() => {
    const map = new Map<string, typeof merchantProfiles[0]>();
    merchantProfiles.forEach(m => map.set(m.user_id, m));
    return map;
  }, [merchantProfiles]);

  const getOffersForRequest = (requestId: string): OfferRow[] => {
    return allOffers
      .filter(o => o.request_id === requestId)
      .map(o => ({
        ...o,
        edit_count: o.edit_count ?? 0,
        merchant: merchantByUserId.get(o.trader_id) ? {
          id: merchantByUserId.get(o.trader_id)!.id,
          display_name: merchantByUserId.get(o.trader_id)!.display_name,
          store_image_url: merchantByUserId.get(o.trader_id)!.store_image_url,
          is_verified: merchantByUserId.get(o.trader_id)!.is_verified,
        } : null,
      }));
  };

  const requests = data ?? [];
  const canEditOrDelete = (r: PrintRequest) => ["pending_review", "pending", "rejected", "approved"].includes(r.status);

  const openEdit = (r: PrintRequest) => {
    setEditingId(r.id);
    setEditTitle(r.title ?? "");
    setEditDescription(r.description ?? "");
    setEditNotes(r.notes ?? "");
    setEditSize(r.size ?? "");
    setEditColors(r.colors ?? "");
  };

  const editSchema = z.object({
    title: z.string().trim().min(3).max(120),
    description: z.string().trim().max(1500).optional().or(z.literal("")),
    notes: z.string().trim().max(500).optional().or(z.literal("")),
    size: z.string().trim().max(120).optional().or(z.literal("")),
    colors: z.string().trim().max(120).optional().or(z.literal("")),
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string; values: z.infer<typeof editSchema> }) => {
      const parsed = editSchema.parse(payload.values);
      const { error } = await supabase
        .from("community_print_requests")
        .update({
          title: parsed.title,
          description: parsed.description?.trim() || null,
          notes: parsed.notes?.trim() || null,
          size: parsed.size?.trim() || null,
          colors: parsed.colors?.trim() || null,
        })
        .eq("id", payload.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["my-print-requests", user?.id] });
      toast({ title: "تم حفظ التعديل" });
      setEditingId(null);
    },
    onError: (err: any) => {
      toast({ title: "تعذر حفظ التعديل", description: err?.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("community_print_requests").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["my-print-requests", user?.id] });
      toast({ title: "تم حذف الطلب" });
    },
    onError: (err: any) => {
      toast({ title: "تعذر حذف الطلب", description: err?.message, variant: "destructive" });
    },
  });

  const stats = useMemo(() => ({
    total: requests.length,
    pending: requests.filter(r => r.status === "pending_review").length,
    inProgress: requests.filter(r => ["approved", "in_progress"].includes(r.status)).length,
    completed: requests.filter(r => ["completed", "delivered"].includes(r.status)).length,
    totalOffers: allOffers.length,
  }), [requests, allOffers]);

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 pt-20 max-w-3xl">
        {/* Header */}
        <header className="mb-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-black text-foreground">طلباتي</h1>
              <p className="text-xs text-muted-foreground">{stats.total} طلب · {stats.totalOffers} عرض سعر</p>
            </div>
          </div>
          <div className="flex gap-1.5">
            <Button size="sm" onClick={() => navigate("/community/customer/new")} className="gap-1.5 text-xs">
              <Package className="h-3.5 w-3.5" />
              طلب جديد
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(-1)} className="gap-1.5 text-xs">
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mb-5">
          {[
            { label: "الكل", value: stats.total, color: "text-foreground" },
            { label: "مراجعة", value: stats.pending, color: "text-amber-500" },
            { label: "نشط", value: stats.inProgress, color: "text-blue-500" },
            { label: "مكتمل", value: stats.completed, color: "text-emerald-500" },
          ].map(s => (
            <div key={s.label} className="p-2.5 rounded-xl bg-card border border-border/50 text-center">
              <div className={`text-lg font-black ${s.color}`}>{s.value}</div>
              <div className="text-[9px] text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Requests List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}
          </div>
        ) : requests.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center">
            <Package className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">لا توجد طلبات بعد</p>
            <Button onClick={() => navigate("/community/customer/new")}>إضافة طلب جديد</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((r) => {
              const config = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending_review;
              const StatusIcon = config.icon;
              const editable = canEditOrDelete(r);
              const offers = getOffersForRequest(r.id);
              const isExpanded = expandedId === r.id;
              const acceptedOffer = offers.find(o => o.id === r.accepted_offer_id);
              const lowestPrice = offers.length > 0 ? Math.min(...offers.map(o => o.price_iqd)) : null;
              const mainImage = r.images?.[0] || r.image_url;

              return (
                <div key={r.id} className="rounded-2xl border border-border/50 bg-card overflow-hidden hover:border-primary/20 transition-all">
                  <div className="p-3">
                    <div className="flex gap-3">
                      {/* Thumbnail */}
                      {mainImage && (
                        <div className="w-16 h-16 rounded-xl bg-muted overflow-hidden shrink-0">
                          <img src={mainImage} alt="" className="w-full h-full object-cover" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        {/* Title & Status */}
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="font-bold text-sm text-foreground truncate">{r.title}</h3>
                          <Badge variant="outline" className={`shrink-0 text-[8px] gap-0.5 ${config.color}`}>
                            <StatusIcon className="h-2.5 w-2.5" />
                            {config.label}
                          </Badge>
                        </div>

                        {/* Meta Row */}
                        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                          <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                            <Calendar className="h-2.5 w-2.5" />
                            {new Date(r.created_at).toLocaleDateString("ar-IQ")}
                          </span>
                          {r.material_type && (
                            <Badge variant="outline" className="text-[7px] h-3.5 px-1">
                              <Layers className="h-2 w-2 mr-0.5" />
                              {r.material_type === "filament" ? "FDM" : r.material_type === "resin" ? "SLA" : r.material_type}
                            </Badge>
                          )}
                          {r.customer_governorate && (
                            <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                              <MapPin className="h-2.5 w-2.5" />
                              {r.customer_governorate}
                            </span>
                          )}
                          {r.quantity && r.quantity > 1 && (
                            <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                              <Hash className="h-2.5 w-2.5" />
                              {r.quantity}
                            </span>
                          )}
                          {r.size && (
                            <span className="text-[9px] text-muted-foreground">{r.size}</span>
                          )}
                        </div>

                        {/* Pricing Summary */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="flex items-center gap-1 text-[10px]">
                            <DollarSign className="h-3 w-3 text-primary" />
                            <span className="font-bold">{offers.length}</span>
                            <span className="text-muted-foreground">عرض</span>
                          </div>
                          {lowestPrice && !acceptedOffer && (
                            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-primary/10 border border-primary/20">
                              <span className="text-[9px] text-muted-foreground">أقل:</span>
                              <span className="text-[10px] font-bold text-primary">{lowestPrice.toLocaleString()}</span>
                              <span className="text-[7px] text-primary/60">د.ع</span>
                            </div>
                          )}
                          {acceptedOffer && (
                            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                              <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" />
                              <span className="text-[10px] font-bold text-emerald-500">{acceptedOffer.price_iqd.toLocaleString()}</span>
                              <span className="text-[7px] text-emerald-500/60">د.ع</span>
                            </div>
                          )}
                          {r.escrow_amount && (
                            <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                              <ShieldAlert className="h-2.5 w-2.5" />
                              محجوز: {r.escrow_amount.toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-border/30">
                      <div className="flex gap-1">
                        {editable && (
                          <>
                            <Button variant="outline" size="sm" className="h-6 text-[9px] gap-0.5 px-2" onClick={() => openEdit(r)}>
                              <Pencil className="h-2.5 w-2.5" />
                              تعديل
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm" className="h-6 text-[9px] gap-0.5 px-2 text-destructive hover:text-destructive" disabled={deleteMutation.isPending}>
                                  <Trash2 className="h-2.5 w-2.5" />
                                  حذف
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>حذف الطلب؟</AlertDialogTitle>
                                  <AlertDialogDescription>سيتم حذف الطلب نهائياً.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteMutation.mutate(r.id)}>حذف</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                        <RateRequestButton requestId={r.id} requestStatus={r.status} />
                      </div>

                      {offers.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[9px] gap-0.5"
                          onClick={() => setExpandedId(isExpanded ? null : r.id)}
                        >
                          <Eye className="h-2.5 w-2.5" />
                          العروض ({offers.length})
                          {isExpanded ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
                        </Button>
                      )}
                    </div>

                    {/* Rejection reason */}
                    {r.status === "rejected" && r.admin_notes?.trim() && (
                      <div className="mt-2 p-2 rounded-xl bg-destructive/5 border border-destructive/20">
                        <div className="flex items-center gap-1 mb-0.5">
                          <ShieldAlert className="h-3 w-3 text-destructive" />
                          <span className="text-[10px] font-bold text-destructive">سبب الرفض</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">{r.admin_notes}</p>
                      </div>
                    )}
                  </div>

                  {/* Expanded Offers */}
                  {isExpanded && offers.length > 0 && (
                    <div className="border-t border-border/30 bg-muted/10 p-3 space-y-2">
                      <h4 className="text-[10px] font-bold text-foreground flex items-center gap-1 mb-1.5">
                        <DollarSign className="h-3 w-3 text-primary" />
                        عروض الأسعار
                      </h4>
                      {offers.map(offer => {
                        const isThisAccepted = r.accepted_offer_id === offer.id;
                        return (
                          <div
                            key={offer.id}
                            className={`rounded-xl border p-2.5 transition-all ${
                              isThisAccepted
                                ? "bg-emerald-500/10 border-emerald-500/30"
                                : "bg-card border-border/50 hover:border-primary/20"
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <Avatar className="h-8 w-8 border border-border">
                                <AvatarImage src={offer.merchant?.store_image_url || undefined} />
                                <AvatarFallback className="bg-muted text-[8px]">
                                  <Store className="h-3.5 w-3.5" />
                                </AvatarFallback>
                              </Avatar>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] font-bold truncate">{offer.merchant?.display_name || "تاجر"}</span>
                                  {offer.merchant?.is_verified && <CheckCircle2 className="h-2.5 w-2.5 text-primary shrink-0" />}
                                  {isThisAccepted && (
                                    <Badge className="text-[6px] px-1 h-3 bg-emerald-500 text-white border-0">مقبول</Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="font-extrabold text-xs text-primary">{offer.price_iqd.toLocaleString()}</span>
                                  <span className="text-[8px] text-primary/60">د.ع</span>
                                  <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                                    <Clock className="h-2 w-2" />
                                    {offer.duration_days} يوم
                                  </span>
                                  {offer.grams && (
                                    <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                                      <Scale className="h-2 w-2" />
                                      {offer.grams}g
                                    </span>
                                  )}
                                </div>
                                {offer.notes && (
                                  <p className="text-[8px] text-muted-foreground mt-0.5 line-clamp-1">{offer.notes}</p>
                                )}
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => {
                                    if (offer.merchant?.id) {
                                      navigate(`/community/messages?merchant_id=${offer.merchant.id}&request_id=${r.id}`);
                                    }
                                  }}
                                  title="مراسلة"
                                >
                                  <MessageSquare className="h-3 w-3" />
                                </Button>

                                {!r.accepted_offer_id && (
                                  <Button
                                    size="sm"
                                    className="h-6 px-2.5 text-[9px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                                    onClick={() => setAcceptOffer({ offer, requestId: r.id })}
                                  >
                                    قبول
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Edit Dialog - Professional Design */}
        <Dialog open={!!editingId} onOpenChange={(o) => (!o ? setEditingId(null) : null)}>
          <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden rounded-2xl border-border/50">
            {/* Header with gradient */}
            <div className="bg-gradient-to-l from-primary via-primary/95 to-primary/85 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-white/15 flex items-center justify-center">
                  <Pencil className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <DialogTitle className="text-base font-black text-primary-foreground">تعديل الطلب</DialogTitle>
                  <DialogDescription className="text-[11px] text-primary-foreground/60 mt-0.5">
                    بعد الحفظ سيتم مراجعة طلبك من قبل الإدارة
                  </DialogDescription>
                </div>
              </div>
            </div>

            {/* Current image preview */}
            {(() => {
              const editingRequest = requests.find(r => r.id === editingId);
              const previewImage = editingRequest?.images?.[0] || editingRequest?.image_url;
              return previewImage ? (
                <div className="px-5 pt-4">
                  <div className="relative rounded-xl overflow-hidden border border-border/40 bg-muted/30">
                    <img src={previewImage} alt="صورة الطلب" className="w-full h-32 object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    <div className="absolute bottom-2 right-2">
                      <Badge variant="outline" className="text-[8px] bg-black/40 text-white border-white/20 backdrop-blur-sm">
                        <Eye className="h-2 w-2 mr-0.5" />
                        الصورة الحالية
                      </Badge>
                    </div>
                    {editingRequest?.images && editingRequest.images.length > 1 && (
                      <div className="absolute bottom-2 left-2">
                        <Badge variant="outline" className="text-[8px] bg-black/40 text-white border-white/20 backdrop-blur-sm">
                          +{editingRequest.images.length - 1} صور
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              ) : null;
            })()}

            {/* Form fields */}
            <div className="px-5 py-4 space-y-3.5 max-h-[55vh] overflow-y-auto">
              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                  <FileText className="h-3 w-3 text-primary" />
                  العنوان
                </label>
                <Input 
                  value={editTitle} 
                  onChange={(e) => setEditTitle(e.target.value)} 
                  maxLength={120}
                  className="h-9 text-sm rounded-xl border-border/50 focus:border-primary/40"
                  placeholder="عنوان الطلب"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                  <FileText className="h-3 w-3 text-primary" />
                  الوصف
                </label>
                <Textarea 
                  value={editDescription} 
                  onChange={(e) => setEditDescription(e.target.value)} 
                  maxLength={1500} 
                  className="min-h-20 text-sm rounded-xl border-border/50 focus:border-primary/40 resize-none"
                  placeholder="وصف تفصيلي للطلب..."
                />
              </div>

              {/* Size & Colors - side by side */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                    <Layers className="h-3 w-3 text-primary" />
                    الحجم
                  </label>
                  <Input 
                    value={editSize} 
                    onChange={(e) => setEditSize(e.target.value)} 
                    maxLength={120}
                    className="h-9 text-sm rounded-xl border-border/50 focus:border-primary/40"
                    placeholder="مثال: 15×10 سم"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                    <Star className="h-3 w-3 text-primary" />
                    الألوان
                  </label>
                  <Input 
                    value={editColors} 
                    onChange={(e) => setEditColors(e.target.value)} 
                    maxLength={120}
                    className="h-9 text-sm rounded-xl border-border/50 focus:border-primary/40"
                    placeholder="مثال: أزرق وأبيض"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                  <MessageSquare className="h-3 w-3 text-primary" />
                  ملاحظات إضافية
                </label>
                <Textarea 
                  value={editNotes} 
                  onChange={(e) => setEditNotes(e.target.value)} 
                  maxLength={500} 
                  className="min-h-16 text-sm rounded-xl border-border/50 focus:border-primary/40 resize-none"
                  placeholder="أي ملاحظات تود إضافتها..."
                />
              </div>
            </div>

            {/* Footer actions */}
            <div className="px-5 py-3 border-t border-border/30 bg-muted/20 flex items-center justify-between gap-3">
              <Button variant="ghost" size="sm" onClick={() => setEditingId(null)} className="text-xs text-muted-foreground">
                إلغاء
              </Button>
              <Button
                size="sm"
                className="gap-1.5 text-xs bg-gradient-to-l from-primary to-primary/90 shadow-lg shadow-primary/20"
                onClick={() => editingId && updateMutation.mutate({
                  id: editingId,
                  values: { title: editTitle, description: editDescription, notes: editNotes, size: editSize, colors: editColors },
                })}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <>
                    <Clock className="h-3 w-3 animate-spin" />
                    جارٍ الحفظ...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3 w-3" />
                    حفظ التعديلات
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Accept Offer Dialog */}
        {acceptOffer && (
          <AcceptOfferDialog
            open={!!acceptOffer}
            onOpenChange={(isOpen) => {
              if (!isOpen) {
                qc.invalidateQueries({ queryKey: ["my-print-requests", user?.id] });
                qc.invalidateQueries({ queryKey: ["my-requests-offers"] });
                setAcceptOffer(null);
              }
            }}
            offer={{
              ...acceptOffer.offer,
              merchant: acceptOffer.offer.merchant ? {
                display_name: acceptOffer.offer.merchant.display_name,
                store_image_url: acceptOffer.offer.merchant.store_image_url,
              } : undefined,
            }}
            requestId={acceptOffer.requestId}
          />
        )}
      </main>
    </div>
  );
}
