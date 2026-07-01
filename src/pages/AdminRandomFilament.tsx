import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Trash2, Plus, Save, Sparkles, Package2, Ban, ShieldX,
  Search, Check, Image as ImageIcon, Upload, AlertTriangle,
  TrendingUp, Boxes, Pencil, Truck, Layers,
} from "lucide-react";
import WavyColors from "@/components/WavyColors";

type SaleType = "direct" | "preorder";
type ProductWeights = Record<string, {
  weight?: number;
  options?: Record<string, number>;
  colors?: Record<string, number>;
}>;

type Offer = {
  id: string;
  sale_type: SaleType;
  category_id: string | null;
  category_ids: string[];
  title_ar: string;
  description_ar: string | null;
  image_url: string | null;
  price_iqd: number;
  display_order: number;
  enabled: boolean;
  allowed_product_ids: string[];
  product_weights: ProductWeights;
};

const PRINTING_MATERIALS_ID = "c3177652-b079-46a5-9435-f641e4c5fd58";

const blankOffer = (): Partial<Offer> => ({
  sale_type: "direct",
  title_ar: "",
  description_ar: "",
  image_url: null,
  price_iqd: 0,
  display_order: 0,
  enabled: true,
  category_ids: [],
  allowed_product_ids: [],
  product_weights: {},
});

export default function AdminRandomFilament() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Offer> | null>(null);

  const { data: settings } = useQuery({
    queryKey: ["admin-rf-settings"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("random_filament_settings").select("*").limit(1).maybeSingle();
      return data;
    },
  });

  const { data: offers, refetch: refetchOffers } = useQuery<Offer[]>({
    queryKey: ["admin-rf-offers"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("random_filament_offers").select("*")
        .order("sale_type").order("display_order");
      return (data || []) as Offer[];
    },
  });

  const { data: bans } = useQuery({
    queryKey: ["admin-rf-bans"],
    queryFn: async () => {
      const { data: banRows } = await (supabase as any)
        .from("random_filament_bans")
        .select("user_id, reason, banned_at")
        .order("banned_at", { ascending: false });
      const ids = (banRows || []).map((b: any) => b.user_id);
      if (!ids.length) return [];
      const { data: profs } = await supabase
        .from("profiles").select("id, full_name, email").in("id", ids);
      const map = new Map((profs || []).map((p: any) => [p.id, p]));
      return (banRows || []).map((b: any) => ({ ...b, profile: map.get(b.user_id) || null }));
    },
  });

  // Realtime: refresh stock summaries + dialog product list whenever a random
  // filament order is placed OR a product's colors JSON changes (server RPC
  // mutates products.colors when deducting direct-sale stock).
  useEffect(() => {
    const channel = supabase
      .channel("admin-rf-sync")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "random_filament_orders" },
        () => {
          qc.invalidateQueries({ queryKey: ["rf-offer-summary"] });
          qc.invalidateQueries({ queryKey: ["rf-dialog-products"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "products" },
        (payload: any) => {
          const oldColors = JSON.stringify(payload.old?.colors ?? null);
          const newColors = JSON.stringify(payload.new?.colors ?? null);
          if (oldColors !== newColors) {
            qc.invalidateQueries({ queryKey: ["rf-offer-summary"] });
            qc.invalidateQueries({ queryKey: ["rf-dialog-products"] });
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const toggleSectionEnabled = async (v: boolean) => {
    if (!settings?.id) return;
    const { error } = await (supabase as any)
      .from("random_filament_settings").update({ enabled: v }).eq("id", settings.id);
    if (error) { toast.error("فشل"); return; }
    toast.success(v ? "القسم مفعّل" : "القسم متوقف");
    qc.invalidateQueries({ queryKey: ["admin-rf-settings"] });
    qc.invalidateQueries({ queryKey: ["random-filament-settings-public"] });
    qc.invalidateQueries({ queryKey: ["random-filament-settings-page"] });
  };

  const deleteOffer = async (id: string) => {
    if (!confirm("حذف هذا العرض؟")) return;
    const { error } = await (supabase as any).from("random_filament_offers").delete().eq("id", id);
    if (error) toast.error("فشل الحذف");
    else { toast.success("حُذف"); refetchOffers(); }
  };

  const toggleOfferEnabled = async (id: string, v: boolean) => {
    const { error } = await (supabase as any)
      .from("random_filament_offers").update({ enabled: v }).eq("id", id);
    if (error) toast.error("فشل التحديث");
    else refetchOffers();
  };

  const removeBan = async (uid: string) => {
    const { error } = await (supabase as any)
      .from("random_filament_bans").delete().eq("user_id", uid);
    if (error) toast.error("فشل");
    else { toast.success("تم رفع الحظر"); qc.invalidateQueries({ queryKey: ["admin-rf-bans"] }); }
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6 max-w-5xl">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-border/50 glass-panel p-6 sm:p-8">
        <div className="absolute inset-0 -z-10 opacity-40 pointer-events-none">
          <WavyColors />
        </div>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black flex items-center gap-2">
              <Sparkles className="size-6 text-primary" />
              إدارة الفلمنت العشوائي
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              أنشئ عروضاً مخصصة، اربطها بأقسام ومنتجات متعددة، وتحكم بالمخزون.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button asChild variant="outline" size="sm">
              <a href="random-filament-targeting">
                <Layers className="size-4 ml-1" /> إدارة الاستهداف
              </a>
            </Button>
            <div className="flex items-center gap-2 rounded-xl border bg-card/60 px-3 py-2">
              <Switch checked={!!settings?.enabled} onCheckedChange={toggleSectionEnabled} />
              <span className="text-xs">{settings?.enabled ? "القسم مفعّل" : "القسم متوقف"}</span>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="offers" className="space-y-4">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="offers"><Sparkles className="size-3.5 ml-1" /> العروض</TabsTrigger>
          <TabsTrigger value="bans"><ShieldX className="size-3.5 ml-1" /> المحظورون</TabsTrigger>
        </TabsList>

        {/* OFFERS */}
        <TabsContent value="offers" className="space-y-4">
          <div className="flex items-center justify-end">
            <Button onClick={() => setEditing(blankOffer())}>
              <Plus className="size-4 ml-1" /> إضافة عرض جديد
            </Button>
          </div>

          {(["direct", "preorder"] as const).map((st) => (
            <div key={st} className="space-y-3">
              <h2 className="text-sm font-bold flex items-center gap-2 text-muted-foreground">
                {st === "direct" ? <Truck className="size-4" /> : <Package2 className="size-4" />}
                عروض {st === "direct" ? "البيع المباشر" : "الحجز المسبق"}
              </h2>

              {(offers || []).filter((o) => o.sale_type === st).length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded-xl">
                  لا عروض بعد
                </p>
              )}

              <div className="grid sm:grid-cols-2 gap-3">
                {(offers || []).filter((o) => o.sale_type === st).map((o) => (
                  <OfferCard
                    key={o.id}
                    offer={o}
                    onEdit={() => setEditing(o)}
                    onDelete={() => deleteOffer(o.id)}
                    onToggle={(v) => toggleOfferEnabled(o.id, v)}
                  />
                ))}
              </div>
            </div>
          ))}
        </TabsContent>

        {/* BANS */}
        <TabsContent value="bans" className="space-y-2">
          {(!bans || bans.length === 0) && (
            <p className="text-center text-muted-foreground py-8">لا محظورين</p>
          )}
          {bans?.map((b: any) => (
            <Card key={b.user_id} className="glass-panel">
              <CardContent className="p-4 flex items-center justify-between gap-3 text-sm flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="font-bold truncate">
                    {b.profile?.full_name || "—"}
                  </div>
                  <div className="text-muted-foreground text-xs truncate">
                    {b.profile?.email || b.user_id}
                  </div>
                  <div className="mt-1 inline-flex items-center gap-1 text-xs text-destructive">
                    <AlertTriangle className="size-3.5" />
                    <span className="truncate">{b.reason || "بدون سبب"}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {b.banned_at ? new Date(b.banned_at).toLocaleString("ar-IQ") : ""}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => removeBan(b.user_id)}>
                  <Trash2 className="size-3.5 ml-1" /> رفع الحظر
                </Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      <OfferDialog
        offer={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          refetchOffers();
          qc.invalidateQueries({ queryKey: ["rf-offers-public"] });
        }}
      />
    </div>
  );
}

function OfferCard({
  offer, onEdit, onDelete, onToggle,
}: {
  offer: Offer;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: (v: boolean) => void;
}) {
  const { data: summary } = useQuery({
    queryKey: ["rf-offer-summary", offer.id],
    queryFn: async () => {
      const { data } = await (supabase as any).rpc("rf_offer_stock_summary", {
        p_offer_id: offer.id,
      });
      return data as {
        direct_stock_total: number;
        sales_count: number;
        eligible_products: number;
        eligible_colors: number;
      };
    },
    staleTime: 30_000,
  });

  const isDirect = offer.sale_type === "direct";
  const stock = Number(summary?.direct_stock_total ?? 0);
  const sales = Number(summary?.sales_count ?? 0);
  const eligibleProducts = Number(summary?.eligible_products ?? 0);
  const eligibleColors = Number(summary?.eligible_colors ?? 0);
  const isOutOfStock = isDirect && stock <= 0;
  const whitelistCount = offer.allowed_product_ids?.length || 0;

  return (
    <Card className={`glass-panel overflow-hidden ${isOutOfStock ? "opacity-80" : ""}`}>
      <div className="relative h-28 w-full bg-muted overflow-hidden">
        {offer.image_url ? (
          <img src={offer.image_url} alt={offer.title_ar} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <WavyColors seed={offer.id} />
        )}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-background/70 backdrop-blur-sm flex items-center justify-center">
            <Badge variant="destructive" className="text-xs font-bold">انتهى العرض</Badge>
          </div>
        )}
      </div>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-sm leading-tight line-clamp-2">{offer.title_ar}</h3>
          <Badge variant="secondary" className="shrink-0">
            {Number(offer.price_iqd).toLocaleString()} د.ع
          </Badge>
        </div>

        {/* Eligibility row — visible BEFORE order placement */}
        <div className="grid grid-cols-2 gap-2 text-center">
          <Stat
            icon={<Package2 className="size-3.5" />}
            label={`مؤهل / مسموح`}
            value={`${eligibleProducts} / ${whitelistCount || "∞"}`}
            accent={eligibleProducts > 0 ? "ok" : "bad"}
          />
          <Stat
            icon={<Sparkles className="size-3.5" />}
            label="ألوان مؤهلة"
            value={eligibleColors}
            accent={eligibleColors > 0 ? "ok" : "bad"}
          />
        </div>

        <div className="grid grid-cols-2 gap-2 text-center">
          {isDirect ? (
            <Stat icon={<Boxes className="size-3.5" />} label="المخزون" value={stock} accent={stock > 0 ? "ok" : "bad"} />
          ) : (
            <Stat icon={<Boxes className="size-3.5" />} label="حجز" value="—" />
          )}
          <Stat icon={<TrendingUp className="size-3.5" />} label="مبيعات" value={sales} />
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2">
            <Switch checked={offer.enabled} onCheckedChange={onToggle} disabled={isOutOfStock} />
            <span className="text-xs text-muted-foreground">{offer.enabled ? "مفعّل" : "متوقف"}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil className="size-3.5 ml-1" /> تعديل
            </Button>
            <Button variant="ghost" size="icon" className="text-destructive" onClick={onDelete}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: any; accent?: "ok" | "bad" }) {
  const cls = accent === "ok" ? "text-emerald-600" : accent === "bad" ? "text-destructive" : "";
  return (
    <div className="rounded-lg border bg-card/60 px-2 py-1.5">
      <div className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">{icon}{label}</div>
      <div className={`text-sm font-black ${cls}`}>{value}</div>
    </div>
  );
}

/* ----------------------------- Offer Dialog ----------------------------- */

function OfferDialog({
  offer, onClose, onSaved,
}: {
  offer: Partial<Offer> | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<Partial<Offer>>({});
  const [mainSectionId, setMainSectionId] = useState<string>(PRINTING_MATERIALS_ID);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [productSearch, setProductSearch] = useState("");

  useEffect(() => {
    if (!offer) return;
    setDraft({
      ...offer,
      category_ids: offer.category_ids?.length ? offer.category_ids : (offer.category_id ? [offer.category_id] : []),
      allowed_product_ids: offer.allowed_product_ids || [],
      product_weights: (offer as any).product_weights || {},
    });
    setProductSearch("");
  }, [offer]);

  const { data: mainSections } = useQuery({
    queryKey: ["main-sections-rf"],
    queryFn: async () => {
      const { data } = await supabase.from("main_sections").select("id, name_ar").order("display_order");
      return data || [];
    },
  });

  const { data: subCategories } = useQuery({
    queryKey: ["rf-subcats-by-main", mainSectionId],
    enabled: !!mainSectionId,
    queryFn: async () => {
      const { data } = await supabase
        .from("categories").select("id, name_ar")
        .eq("main_section_id", mainSectionId).order("name_ar");
      return data || [];
    },
  });

  const { data: products } = useQuery({
    queryKey: ["rf-dialog-products", draft.sale_type, draft.category_ids],
    enabled: !!offer && !!draft.category_ids?.length,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("products_admin")
        .select(`
          id, name_ar, image_url, category_id, in_stock, direct_stock, colors,
          product_options (id, available_for_direct_sale, available_for_pre_order, stock_quantity)
        `)
        .in("category_id", draft.category_ids as string[])
        .order("name_ar")
        .limit(500);
      return (data || []) as any[];
    },
  });

  const filteredProducts = useMemo(() => {
    const list = (products || []).map((p: any) => {
      const opts = p.product_options || [];
      const colors = Array.isArray(p.colors) ? p.colors : [];

      // Direct stock — MIRROR server logic in create_random_filament_order:
      // Only colors[].option_stocks values are counted (V3 strict).
      // No fallback to color.stock_quantity, product_options or direct_stock —
      // the RPC will reject those products anyway, so they must be hidden.
      let directStock = 0;
      for (const c of colors) {
        if (c?.available_for_direct_sale !== true) continue;
        const stocks = c?.option_stocks;
        if (stocks && typeof stocks === "object") {
          for (const v of Object.values(stocks)) {
            const n = Number(v) || 0;
            if (n > 0) directStock += n;
          }
        }
      }

      // Preorder eligibility mirrors server: any product in the category is eligible
      // (server doesn't require option flags for preorder products without options).
      const hasPreorder =
        opts.length === 0 && colors.length === 0
          ? true
          : opts.some((o: any) => o?.available_for_pre_order !== false) ||
            colors.some((c: any) => c?.available_for_pre_order !== false);

      return { ...p, directStock, hasPreorder };
    });

    let res = list;
    if (draft.sale_type === "direct") {
      res = res.filter((p: any) => p.in_stock !== false && p.directStock > 0);
    } else {
      res = res.filter((p: any) => p.hasPreorder);
    }
    if (productSearch.trim()) {
      const q = productSearch.toLowerCase();
      res = res.filter((p: any) => (p.name_ar || "").toLowerCase().includes(q));
    }
    return res;
  }, [products, draft.sale_type, productSearch]);

  const toggleCat = (id: string) => {
    setDraft((d) => {
      const cur = d.category_ids || [];
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      // remove allowed products that are not in selected categories anymore
      const allowedProductIds = (d.allowed_product_ids || []);
      return { ...d, category_ids: next, allowed_product_ids: allowedProductIds };
    });
  };

  const toggleProduct = (id: string) => {
    setDraft((d) => {
      const cur = d.allowed_product_ids || [];
      return { ...d, allowed_product_ids: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] };
    });
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `offers/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("random-filament-offers").upload(path, file, { upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("random-filament-offers").getPublicUrl(path);
      setDraft((d) => ({ ...d, image_url: data.publicUrl }));
      toast.success("تم رفع الصورة");
    } catch (e: any) {
      toast.error("فشل الرفع: " + (e?.message || ""));
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!draft.title_ar?.trim()) { toast.error("أدخل اسم العرض"); return; }
    if (!draft.price_iqd || Number(draft.price_iqd) <= 0) { toast.error("أدخل السعر"); return; }
    if (!draft.sale_type) { toast.error("اختر نوع البيع"); return; }
    if (!(draft.category_ids?.length)) { toast.error("اختر قسماً فرعياً واحداً على الأقل"); return; }

    setSaving(true);
    try {
      const payload: any = {
        sale_type: draft.sale_type,
        title_ar: draft.title_ar.trim(),
        description_ar: draft.description_ar || null,
        image_url: draft.image_url || null,
        price_iqd: Number(draft.price_iqd) || 0,
        display_order: Number(draft.display_order) || 0,
        enabled: draft.enabled !== false,
        category_ids: draft.category_ids,
        category_id: draft.category_ids?.[0] || null, // legacy compatibility
        allowed_product_ids: draft.allowed_product_ids || [],
        product_weights: draft.product_weights || {},
      };

      if (draft.id) {
        const { error } = await (supabase as any)
          .from("random_filament_offers").update(payload).eq("id", draft.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("random_filament_offers").insert(payload);
        if (error) throw error;
      }
      toast.success("تم الحفظ");
      onSaved();
    } catch (e: any) {
      toast.error("فشل الحفظ: " + (e?.message || ""));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!offer} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="!overflow-hidden !max-h-[90vh] max-w-3xl flex flex-col p-0">
        <DialogHeader className="p-6 pb-2 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            {draft.id ? "تعديل عرض" : "إضافة عرض جديد"}
          </DialogTitle>
          <DialogDescription>
            املأ بيانات العرض، اختر الأقسام الفرعية، ثم حدد المنتجات.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6">
          <div className="space-y-4 px-1 pb-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">اسم العرض *</Label>
                <Input value={draft.title_ar || ""} onChange={(e) => setDraft({ ...draft, title_ar: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">السعر (د.ع) *</Label>
                <Input type="number" value={draft.price_iqd ?? ""} onChange={(e) => setDraft({ ...draft, price_iqd: Number(e.target.value) || 0 })} />
              </div>
            </div>

            {/* image upload */}
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1"><ImageIcon className="size-3.5" /> صورة العرض</Label>
              <div className="flex items-center gap-3">
                <div className="relative w-28 h-20 rounded-xl overflow-hidden border bg-muted shrink-0">
                  {draft.image_url ? (
                    <img src={draft.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <WavyColors seed={(draft as any).id || draft.title_ar || "draft"} />
                  )}
                </div>
                <div className="flex flex-col gap-2 flex-1">
                  <label className="inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-xs cursor-pointer hover:bg-muted">
                    <Upload className="size-3.5" />
                    {uploading ? "جاري الرفع..." : "رفع صورة"}
                    <input
                      type="file" accept="image/*" hidden
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }}
                    />
                  </label>
                  {draft.image_url && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setDraft({ ...draft, image_url: null })}>
                      <Trash2 className="size-3.5 ml-1" /> حذف الصورة
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">الوصف (اختياري)</Label>
              <Textarea rows={2} value={draft.description_ar || ""} onChange={(e) => setDraft({ ...draft, description_ar: e.target.value })} />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">نوع البيع *</Label>
                <Select value={draft.sale_type} onValueChange={(v: SaleType) => setDraft({ ...draft, sale_type: v, allowed_product_ids: [] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="direct">بيع مباشر</SelectItem>
                    <SelectItem value="preorder">حجز مسبق</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">القسم الرئيسي</Label>
                <Select value={mainSectionId} onValueChange={setMainSectionId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(mainSections || []).map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.name_ar}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">الأقسام الفرعية * (اختر واحد أو أكثر)</Label>
              <div className="flex flex-wrap gap-2">
                {(subCategories || []).map((c: any) => {
                  const on = (draft.category_ids || []).includes(c.id);
                  return (
                    <Badge key={c.id}
                      variant={on ? "default" : "outline"}
                      className="cursor-pointer hover:scale-105 transition"
                      onClick={() => toggleCat(c.id)}>
                      {on && <Check className="size-3 ml-1" />}
                      {c.name_ar}
                    </Badge>
                  );
                })}
                {(!subCategories || subCategories.length === 0) && (
                  <p className="text-xs text-muted-foreground">لا أقسام فرعية</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs flex items-center justify-between">
                <span>المنتجات * ({(draft.allowed_product_ids || []).length} مختار)</span>
                {draft.sale_type === "direct" && (
                  <span className="text-[10px] text-muted-foreground">يظهر فقط ما له مخزون متاح</span>
                )}
              </Label>

              <div className="relative">
                <Search className="size-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input className="pr-9" placeholder="ابحث باسم المنتج..."
                  value={productSearch} onChange={(e) => setProductSearch(e.target.value)} />
              </div>

              <div className="max-h-72 overflow-y-auto rounded-lg border p-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {filteredProducts.map((p: any) => {
                    const isOn = (draft.allowed_product_ids || []).includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleProduct(p.id)}
                        className={`text-right rounded-xl border p-2 flex items-center gap-2 transition ${
                          isOn ? "border-primary bg-primary/10" : "hover:border-primary/40"
                        }`}
                      >
                        {p.image_url ? (
                          <img src={p.image_url} alt="" className="w-10 h-10 rounded object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded bg-muted" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold truncate">{p.name_ar}</div>
                          {draft.sale_type === "direct" && (
                            <div className="text-[10px] text-muted-foreground">
                              مخزون: {p.directStock}
                            </div>
                          )}
                        </div>
                        {isOn && <Check className="size-4 text-primary shrink-0" />}
                      </button>
                    );
                  })}
                  {filteredProducts.length === 0 && (
                    <p className="col-span-full text-center text-xs text-muted-foreground py-6">
                      {draft.category_ids?.length ? "لا منتجات متاحة" : "اختر قسماً فرعياً أولاً"}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">ترتيب العرض</Label>
                <Input type="number" value={draft.display_order ?? 0}
                  onChange={(e) => setDraft({ ...draft, display_order: Number(e.target.value) || 0 })} />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <Switch checked={draft.enabled !== false} onCheckedChange={(v) => setDraft({ ...draft, enabled: v })} />
                <Label className="text-xs">{draft.enabled !== false ? "مفعّل" : "متوقف"}</Label>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 p-6 pt-3 border-t shrink-0">
          <Button variant="outline" onClick={onClose} disabled={saving}>إلغاء</Button>
          <Button onClick={save} disabled={saving || uploading}>
            <Save className="size-4 ml-1" />
            {saving ? "جاري الحفظ..." : "حفظ العرض"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
