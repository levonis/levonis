import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  ArrowRight,
  FileText,
  Package,
  Pencil,
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  ShieldAlert,
  DollarSign,
  Eye,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Star,
  Store,
  Scale,
  Layers,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  approved: { label: "مقبول - بانتظار العروض", icon: CheckCircle2, color: "bg-blue-500/15 text-blue-500 border-blue-500/30" },
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

  // Fetch requests
  const { data, isLoading } = useQuery({
    queryKey: ["my-print-requests", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_print_requests")
        .select("id, user_id, title, description, notes, size, colors, material_type, quantity, reference_links, images, image_url, status, admin_notes, created_at, updated_at, accepted_at, accepted_offer_id, delivered_at, customer_confirmed_at, escrow_amount")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return z.array(requestSchema).parse(data ?? []);
    },
    staleTime: 20_000,
  });

  // Fetch all offers for user's requests
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

  // Fetch merchant profiles for offers
  const traderIds = [...new Set(allOffers.map(o => o.trader_id))];
  const { data: merchantProfiles = [] } = useQuery({
    queryKey: ["offer-merchants", traderIds],
    enabled: traderIds.length > 0,
    queryFn: async () => {
      // Get merchant apps by user_id
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

  const canEditOrDelete = (r: PrintRequest) => r.status === "pending_review" || r.status === "pending" || r.status === "rejected";

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
          description: parsed.description?.trim() ? parsed.description.trim() : null,
          notes: parsed.notes?.trim() ? parsed.notes.trim() : null,
          size: parsed.size?.trim() ? parsed.size.trim() : null,
          colors: parsed.colors?.trim() ? parsed.colors.trim() : null,
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

  // Stats
  const stats = useMemo(() => ({
    total: requests.length,
    pending: requests.filter(r => r.status === "pending_review").length,
    inProgress: requests.filter(r => ["approved", "in_progress"].includes(r.status)).length,
    completed: requests.filter(r => ["completed", "delivered"].includes(r.status)).length,
    totalOffers: allOffers.length,
  }), [requests, allOffers]);

  return (
    <div className="min-h-screen bg-background/95 backdrop-blur-sm">
      <main className="container mx-auto px-4 py-8 pt-20 max-w-3xl">
        {/* Header */}
        <header className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-black text-foreground">طلباتي</h1>
              <p className="text-xs text-muted-foreground">{stats.total} طلب · {stats.totalOffers} عرض سعر</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => navigate("/community/customer/new")} className="gap-1.5">
              <Package className="h-3.5 w-3.5" />
              طلب جديد
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/community/customer')} className="gap-1.5">
              <ArrowRight className="h-3.5 w-3.5" />
              رجوع
            </Button>
          </div>
        </header>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          {[
            { label: "الكل", value: stats.total, color: "text-foreground" },
            { label: "قيد المراجعة", value: stats.pending, color: "text-amber-500" },
            { label: "نشط", value: stats.inProgress, color: "text-blue-500" },
            { label: "مكتمل", value: stats.completed, color: "text-emerald-500" },
          ].map(s => (
            <div key={s.label} className="p-3 rounded-xl bg-card border border-border/50 text-center">
              <div className={`text-lg font-black ${s.color}`}>{s.value}</div>
              <div className="text-[10px] text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Requests List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
          </div>
        ) : requests.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <Package className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
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
                <div key={r.id} className="rounded-2xl border border-border/50 bg-card overflow-hidden">
                  {/* Main Row */}
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
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-bold text-sm text-foreground truncate">{r.title}</h3>
                          <Badge variant="outline" className={`shrink-0 text-[9px] gap-1 ${config.color}`}>
                            <StatusIcon className="h-3 w-3" />
                            {config.label}
                          </Badge>
                        </div>

                        {/* Meta row */}
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(r.created_at).toLocaleDateString("ar-IQ")}
                          </span>
                          {r.material_type && (
                            <Badge variant="outline" className="text-[8px] h-4 px-1.5">
                              <Layers className="h-2.5 w-2.5 mr-0.5" />
                              {r.material_type === "filament" ? "فلمنت" : r.material_type === "resin" ? "رزن" : r.material_type}
                            </Badge>
                          )}
                          {r.quantity && (
                            <span className="text-[10px] text-muted-foreground">الكمية: {r.quantity}</span>
                          )}
                        </div>

                        {/* Pricing Summary */}
                        <div className="flex items-center gap-3 mt-2">
                          {/* Offers count */}
                          <div className="flex items-center gap-1 text-[10px]">
                            <DollarSign className="h-3 w-3 text-primary" />
                            <span className="font-bold text-foreground">{offers.length}</span>
                            <span className="text-muted-foreground">عرض</span>
                          </div>

                          {/* Lowest price */}
                          {lowestPrice && (
                            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20">
                              <span className="text-[10px] text-muted-foreground">أقل:</span>
                              <span className="text-xs font-bold text-primary">{lowestPrice.toLocaleString()}</span>
                              <span className="text-[8px] text-primary/70">د.ع</span>
                            </div>
                          )}

                          {/* Accepted offer price */}
                          {acceptedOffer && (
                            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                              <span className="text-xs font-bold text-emerald-500">{acceptedOffer.price_iqd.toLocaleString()}</span>
                              <span className="text-[8px] text-emerald-500/70">د.ع</span>
                            </div>
                          )}

                          {/* Escrow */}
                          {r.escrow_amount && (
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <ShieldAlert className="h-3 w-3" />
                              محجوز: {r.escrow_amount.toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action bar */}
                    <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border/30">
                      <div className="flex gap-1.5">
                        {editable && (
                          <>
                            <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={() => openEdit(r)}>
                              <Pencil className="h-3 w-3" />
                              تعديل
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1 text-destructive hover:text-destructive" disabled={deleteMutation.isPending}>
                                  <Trash2 className="h-3 w-3" />
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

                      {/* Expand offers */}
                      {offers.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-[10px] gap-1"
                          onClick={() => setExpandedId(isExpanded ? null : r.id)}
                        >
                          <Eye className="h-3 w-3" />
                          عروض الأسعار ({offers.length})
                          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </Button>
                      )}
                    </div>

                    {/* Rejection reason */}
                    {r.status === "rejected" && r.admin_notes?.trim() && (
                      <div className="mt-2 p-2.5 rounded-xl bg-destructive/5 border border-destructive/20">
                        <div className="flex items-center gap-1.5 mb-1">
                          <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
                          <span className="text-[11px] font-bold text-destructive">سبب الرفض</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">{r.admin_notes}</p>
                      </div>
                    )}
                  </div>

                  {/* Expanded Offers */}
                  {isExpanded && offers.length > 0 && (
                    <div className="border-t border-border/30 bg-muted/20 p-3 space-y-2">
                      <h4 className="text-[11px] font-bold text-foreground flex items-center gap-1.5 mb-2">
                        <DollarSign className="h-3.5 w-3.5 text-primary" />
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
                                : "bg-card border-border/50 hover:border-primary/30"
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              {/* Merchant avatar */}
                              <Avatar className="h-9 w-9 border border-border">
                                <AvatarImage src={offer.merchant?.store_image_url || undefined} />
                                <AvatarFallback className="bg-muted text-[10px]">
                                  <Store className="h-4 w-4" />
                                </AvatarFallback>
                              </Avatar>

                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] font-bold truncate">
                                    {offer.merchant?.display_name || "تاجر"}
                                  </span>
                                  {offer.merchant?.is_verified && (
                                    <CheckCircle2 className="h-3 w-3 text-primary shrink-0" />
                                  )}
                                  {isThisAccepted && (
                                    <Badge className="text-[7px] px-1.5 h-4 bg-emerald-500 text-white border-0">مقبول</Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="font-extrabold text-sm text-primary">{offer.price_iqd.toLocaleString()}</span>
                                  <span className="text-[9px] text-primary/70">د.ع</span>
                                  <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                                    <Clock className="h-2.5 w-2.5" />
                                    {offer.duration_days} يوم
                                  </span>
                                  {offer.grams && (
                                    <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                                      <Scale className="h-2.5 w-2.5" />
                                      {offer.grams}g
                                    </span>
                                  )}
                                </div>
                                {offer.notes && (
                                  <p className="text-[9px] text-muted-foreground mt-1 line-clamp-1">{offer.notes}</p>
                                )}
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-1.5 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => {
                                    if (offer.merchant?.id) {
                                      navigate(`/community/messages?merchant_id=${offer.merchant.id}&request_id=${r.id}`);
                                    }
                                  }}
                                  title="مراسلة"
                                >
                                  <MessageSquare className="h-3.5 w-3.5" />
                                </Button>

                                {!r.accepted_offer_id && (
                                  <Button
                                    size="sm"
                                    className="h-7 px-3 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                                    onClick={() => setAcceptOffer({
                                      offer: offer,
                                      requestId: r.id,
                                    })}
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

        {/* Edit Dialog */}
        <Dialog open={!!editingId} onOpenChange={(o) => (!o ? setEditingId(null) : null)}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>تعديل الطلب</DialogTitle>
              <DialogDescription>بعد الحفظ سيتم مراجعة طلبك من قبل الإدارة.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-semibold">العنوان</p>
                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} maxLength={120} />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold">الوصف</p>
                <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} maxLength={1500} className="min-h-24" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <p className="text-sm font-semibold">الحجم</p>
                  <Input value={editSize} onChange={(e) => setEditSize(e.target.value)} maxLength={120} />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold">الألوان</p>
                  <Input value={editColors} onChange={(e) => setEditColors(e.target.value)} maxLength={120} />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold">ملاحظات</p>
                <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} maxLength={500} className="min-h-20" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingId(null)}>إلغاء</Button>
              <Button
                onClick={() => editingId && updateMutation.mutate({
                  id: editingId,
                  values: { title: editTitle, description: editDescription, notes: editNotes, size: editSize, colors: editColors },
                })}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? "جارٍ الحفظ..." : "حفظ"}
              </Button>
            </DialogFooter>
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
