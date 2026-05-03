import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Trash2, Plus, Save, Sparkles, Settings, Package2, Ban, Filter,
  Truck, ClipboardList, ShieldX, Search, Check,
} from "lucide-react";
import WavyColors from "@/components/WavyColors";

const PRINTING_MATERIALS_ID = "c3177652-b079-46a5-9435-f641e4c5fd58";

type Offer = {
  id?: string;
  sale_type: "direct" | "preorder";
  category_id: string | null;
  title_ar: string;
  description_ar: string | null;
  image_url: string | null;
  price_iqd: number;
  display_order: number;
  enabled: boolean;
  allowed_product_ids: string[];
};

export default function AdminRandomFilament() {
  const qc = useQueryClient();
  const [enabled, setEnabled] = useState(false);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [productPickerFor, setProductPickerFor] = useState<Offer | null>(null);

  const { data: settings } = useQuery({
    queryKey: ["admin-rf-settings"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("random_filament_settings").select("*").limit(1).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (!settings) return;
    setEnabled(!!settings.enabled);
    setSelectedCats(settings.category_ids || []);
    setTitle(settings.title_ar || "");
    setDesc(settings.description_ar || "");
  }, [settings]);

  const { data: categories } = useQuery({
    queryKey: ["admin-rf-printing-categories"],
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("id, name_ar")
        .eq("main_section_id", PRINTING_MATERIALS_ID)
        .order("name_ar");
      return data || [];
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

  const { data: orders } = useQuery({
    queryKey: ["admin-rf-orders"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("random_filament_orders")
        .select("id, user_id, sale_type, selected_color, price_iqd, revealed_at, created_at, order_id, products(name_ar), categories(name_ar)")
        .order("created_at", { ascending: false }).limit(200);
      return data || [];
    },
  });

  const { data: bans } = useQuery({
    queryKey: ["admin-rf-bans"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("random_filament_bans").select("user_id, reason, banned_at")
        .order("banned_at", { ascending: false });
      return data || [];
    },
  });

  const saveSettings = async () => {
    if (!settings?.id) return;
    const { error } = await (supabase as any)
      .from("random_filament_settings")
      .update({ enabled, category_ids: selectedCats, title_ar: title, description_ar: desc })
      .eq("id", settings.id);
    if (error) { toast.error("فشل الحفظ"); return; }
    toast.success("تم الحفظ");
    qc.invalidateQueries({ queryKey: ["admin-rf-settings"] });
    qc.invalidateQueries({ queryKey: ["random-filament-settings-public"] });
    qc.invalidateQueries({ queryKey: ["random-filament-settings-page"] });
  };

  const addOffer = async (sale_type: "direct" | "preorder") => {
    const { error } = await (supabase as any).from("random_filament_offers").insert({
      sale_type, title_ar: "عرض جديد", price_iqd: 0,
      display_order: (offers?.length || 0) + 1, allowed_product_ids: [],
    });
    if (error) toast.error("فشل الإضافة");
    else { toast.success("أُضيف عرض"); refetchOffers(); }
  };

  const updateOffer = async (id: string, patch: Partial<Offer>) => {
    const { error } = await (supabase as any).from("random_filament_offers").update(patch).eq("id", id);
    if (error) toast.error("فشل التحديث");
    else { refetchOffers(); qc.invalidateQueries({ queryKey: ["rf-offers-public"] }); }
  };

  const deleteOffer = async (id: string) => {
    if (!confirm("حذف هذا العرض؟")) return;
    const { error } = await (supabase as any).from("random_filament_offers").delete().eq("id", id);
    if (error) toast.error("فشل الحذف");
    else { toast.success("حُذف"); refetchOffers(); }
  };

  const removeBan = async (uid: string) => {
    const { error } = await (supabase as any).from("random_filament_bans").delete().eq("user_id", uid);
    if (error) toast.error("فشل");
    else { toast.success("تم رفع الحظر"); qc.invalidateQueries({ queryKey: ["admin-rf-bans"] }); }
  };

  const toggleCat = (id: string) =>
    setSelectedCats((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const stats = useMemo(() => {
    const total = orders?.length || 0;
    const paid = (orders || []).filter((o: any) => !!o.order_id).length;
    return {
      offers: offers?.length || 0,
      orders: total,
      paid,
      bans: bans?.length || 0,
    };
  }, [offers, orders, bans]);

  return (
    <div className="container mx-auto px-4 py-6 space-y-6 max-w-5xl">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-border/50 glass-panel p-6 sm:p-8">
        <div className="absolute inset-0 -z-10 opacity-40 pointer-events-none">
          <WavyColors />
        </div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black flex items-center gap-2">
              <Sparkles className="size-6 text-primary" />
              إدارة الفلمنت العشوائي
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              ضع عروضك، اربط منتجات محددة لكل عرض، وراقب الطلبات والمحظورين.
            </p>
          </div>
          <Badge variant={enabled ? "default" : "secondary"} className="text-xs">
            {enabled ? "القسم مفعّل" : "موقوف"}
          </Badge>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-5">
          <StatChip icon={<Package2 className="size-4" />} label="العروض" value={stats.offers} />
          <StatChip icon={<ClipboardList className="size-4" />} label="الطلبات" value={stats.orders} />
          <StatChip icon={<Truck className="size-4" />} label="مدفوعة" value={stats.paid} />
          <StatChip icon={<Ban className="size-4" />} label="محظورون" value={stats.bans} />
        </div>
      </div>

      <Tabs defaultValue="offers" className="space-y-4">
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="offers"><Sparkles className="size-3.5 ml-1" /> العروض</TabsTrigger>
          <TabsTrigger value="settings"><Settings className="size-3.5 ml-1" /> الإعدادات</TabsTrigger>
          <TabsTrigger value="orders"><ClipboardList className="size-3.5 ml-1" /> الطلبات</TabsTrigger>
          <TabsTrigger value="bans"><ShieldX className="size-3.5 ml-1" /> المحظورون</TabsTrigger>
        </TabsList>

        {/* SETTINGS */}
        <TabsContent value="settings" className="space-y-4">
          <Card className="glass-panel">
            <CardHeader><CardTitle className="text-base">الإعدادات العامة</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border p-3">
                <div>
                  <Label className="text-sm">تفعيل القسم</Label>
                  <p className="text-xs text-muted-foreground">عند الإيقاف لن يظهر القسم في الواجهة</p>
                </div>
                <Switch checked={enabled} onCheckedChange={setEnabled} />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">عنوان القسم</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">وصف القسم</Label>
                  <Input value={desc} onChange={(e) => setDesc(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1"><Filter className="size-3.5" /> الأقسام الفرعية المسموح بها</Label>
                <div className="flex flex-wrap gap-2">
                  {categories?.map((c: any) => (
                    <Badge key={c.id}
                      variant={selectedCats.includes(c.id) ? "default" : "outline"}
                      className="cursor-pointer hover:scale-105 transition" onClick={() => toggleCat(c.id)}>
                      {selectedCats.includes(c.id) && <Check className="size-3 ml-1" />}
                      {c.name_ar}
                    </Badge>
                  ))}
                </div>
              </div>
              <Button onClick={saveSettings} className="w-full sm:w-auto">
                <Save className="size-4 ml-1" /> حفظ الإعدادات
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* OFFERS */}
        <TabsContent value="offers" className="space-y-4">
          {(["direct", "preorder"] as const).map((st) => (
            <Card key={st} className="glass-panel">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  {st === "direct" ? <Truck className="size-4 text-primary" /> : <Package2 className="size-4 text-primary" />}
                  عروض {st === "direct" ? "البيع المباشر" : "الحجز المسبق"}
                </CardTitle>
                <Button size="sm" onClick={() => addOffer(st)}>
                  <Plus className="size-4 ml-1" /> إضافة
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {offers?.filter((o) => o.sale_type === st).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">لا عروض بعد — اضغط إضافة</p>
                )}
                {offers?.filter((o) => o.sale_type === st).map((o) => (
                  <div key={o.id} className="rounded-2xl border p-3 bg-card/50 hover:border-primary/40 transition">
                    <div className="grid sm:grid-cols-[120px,1fr] gap-3">
                      {/* Animated preview */}
                      <div className="rounded-xl overflow-hidden h-24 sm:h-full border border-border/40 relative">
                        {o.image_url ? (
                          <img src={o.image_url} alt={o.title_ar} className="w-full h-full object-cover" />
                        ) : (
                          <WavyColors />
                        )}
                      </div>
                      <div className="space-y-2">
                        <div className="grid sm:grid-cols-2 gap-2">
                          <div>
                            <Label className="text-[11px]">العنوان</Label>
                            <Input defaultValue={o.title_ar}
                              onBlur={(e) => e.target.value !== o.title_ar && updateOffer(o.id!, { title_ar: e.target.value })} />
                          </div>
                          <div>
                            <Label className="text-[11px]">السعر (د.ع)</Label>
                            <Input type="number" defaultValue={o.price_iqd}
                              onBlur={(e) => Number(e.target.value) !== Number(o.price_iqd) && updateOffer(o.id!, { price_iqd: Number(e.target.value) || 0 })} />
                          </div>
                          <div>
                            <Label className="text-[11px]">رابط صورة (اختياري — تترك فارغة لتظهر الموجة)</Label>
                            <Input defaultValue={o.image_url || ""}
                              onBlur={(e) => e.target.value !== (o.image_url || "") && updateOffer(o.id!, { image_url: e.target.value || null })} />
                          </div>
                          <div>
                            <Label className="text-[11px]">ترتيب</Label>
                            <Input type="number" defaultValue={o.display_order}
                              onBlur={(e) => Number(e.target.value) !== o.display_order && updateOffer(o.id!, { display_order: Number(e.target.value) || 0 })} />
                          </div>
                        </div>
                        <div>
                          <Label className="text-[11px]">القسم الفرعي</Label>
                          <Select
                            value={o.category_id || "__all__"}
                            onValueChange={(v) => updateOffer(o.id!, { category_id: v === "__all__" ? null : v })}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__all__">كل الأقسام المفعّلة</SelectItem>
                              {categories?.filter((c: any) => selectedCats.includes(c.id)).map((c: any) => (
                                <SelectItem key={c.id} value={c.id}>{c.name_ar}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-[11px]">الوصف (اختياري)</Label>
                          <Textarea defaultValue={o.description_ar || ""} rows={2}
                            onBlur={(e) => e.target.value !== (o.description_ar || "") && updateOffer(o.id!, { description_ar: e.target.value || null })} />
                        </div>
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <Button variant="outline" size="sm" onClick={() => setProductPickerFor(o)}>
                            <Package2 className="size-3.5 ml-1" />
                            المنتجات المسموحة ({o.allowed_product_ids?.length || 0})
                          </Button>
                          <div className="flex items-center gap-2">
                            <Switch checked={o.enabled} onCheckedChange={(v) => updateOffer(o.id!, { enabled: v })} />
                            <span className="text-xs text-muted-foreground">{o.enabled ? "مفعّل" : "متوقف"}</span>
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteOffer(o.id!)}>
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ORDERS */}
        <TabsContent value="orders" className="space-y-2">
          {orders?.length === 0 && (
            <p className="text-center text-muted-foreground py-8">لا طلبات</p>
          )}
          <div className="grid sm:grid-cols-2 gap-3">
            {orders?.map((o: any) => (
              <Card key={o.id} className="glass-panel">
                <CardContent className="p-4 text-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant={o.order_id ? "default" : "secondary"}>{o.order_id ? "تم الدفع" : "في السلة"}</Badge>
                    <span className="text-[10px] text-muted-foreground">{new Date(o.created_at).toLocaleString("ar-IQ")}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <Info label="المستخدم" value={o.user_id?.slice(0, 8) + "…"} mono />
                    <Info label="النوع" value={o.sale_type === "direct" ? "بيع مباشر" : "حجز مسبق"} />
                    <Info label="القسم" value={o.categories?.name_ar || "—"} />
                    <Info label="المنتج" value={o.products?.name_ar || "—"} />
                    <Info label="اللون" value={o.selected_color || "—"} />
                    <Info label="السعر" value={`${Number(o.price_iqd).toLocaleString()} د.ع`} />
                  </div>
                  {o.order_id && (
                    <Button
                      variant="destructive" size="sm" className="w-full"
                      onClick={async () => {
                        const reason = window.prompt("سبب الحظر:", "عدم استلام طلب فلمنت عشوائي");
                        if (!reason) return;
                        const { error } = await (supabase as any).rpc("ban_user_for_unreceived_random_filament", { p_order_id: o.order_id, p_reason: reason });
                        if (error) toast.error("فشل الحظر");
                        else { toast.success("تم حظر المستخدم"); qc.invalidateQueries({ queryKey: ["admin-rf-bans"] }); }
                      }}
                    >
                      <Ban className="size-3.5 ml-1" /> حظر المستخدم
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* BANS */}
        <TabsContent value="bans" className="space-y-2">
          {bans?.length === 0 && <p className="text-center text-muted-foreground py-8">لا محظورين</p>}
          {bans?.map((b: any) => (
            <Card key={b.user_id} className="glass-panel">
              <CardContent className="p-4 flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <div className="font-mono text-xs truncate">{b.user_id}</div>
                  <div className="text-muted-foreground text-xs truncate">{b.reason}</div>
                </div>
                <Button variant="outline" size="sm" onClick={() => removeBan(b.user_id)}>
                  <Trash2 className="size-3.5 ml-1" /> رفع الحظر
                </Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      <ProductPicker
        offer={productPickerFor}
        onClose={() => setProductPickerFor(null)}
        onSave={async (ids) => {
          if (!productPickerFor?.id) return;
          await updateOffer(productPickerFor.id, { allowed_product_ids: ids });
          toast.success("تم حفظ المنتجات");
          setProductPickerFor(null);
        }}
      />
    </div>
  );
}

function StatChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="rounded-xl border bg-card/60 px-3 py-2">
      <div className="text-[10px] text-muted-foreground flex items-center gap-1">{icon}{label}</div>
      <div className="text-lg font-black">{value}</div>
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={`text-xs font-bold truncate ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}

function ProductPicker({
  offer, onClose, onSave,
}: {
  offer: Offer | null;
  onClose: () => void;
  onSave: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSelected(new Set(offer?.allowed_product_ids || []));
    setSearch("");
  }, [offer]);

  const { data: products } = useQuery({
    queryKey: ["rf-picker-products", offer?.category_id],
    enabled: !!offer,
    queryFn: async () => {
      let q = supabase
        .from("products")
        .select("id, name_ar, image_url, category_id, categories(name_ar)")
        .order("name_ar")
        .limit(500);
      if (offer?.category_id) q = q.eq("category_id", offer.category_id);
      else {
        // restrict to printing materials section via settings
        const { data: s } = await (supabase as any)
          .from("random_filament_settings").select("category_ids").limit(1).maybeSingle();
        const ids: string[] = s?.category_ids || [];
        if (ids.length) q = q.in("category_id", ids);
      }
      const { data } = await q;
      return data || [];
    },
  });

  const filtered = useMemo(
    () => (products || []).filter((p: any) =>
      !search || p.name_ar?.toLowerCase().includes(search.toLowerCase())
    ),
    [products, search]
  );

  const toggle = (id: string) => {
    setSelected((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  return (
    <Dialog open={!!offer} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="!overflow-hidden !max-h-none max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package2 className="size-5 text-primary" />
            المنتجات المسموحة لهذا العرض
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            اترك القائمة فارغة ليشمل العرض كل منتجات القسم. أو اختر منتجات محددة (مثل Esun PLA Plus فقط).
          </p>
        </DialogHeader>

        <div className="relative">
          <Search className="size-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pr-9" placeholder="ابحث باسم المنتج..."
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <ScrollArea className="h-[55vh] -mx-2 px-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {filtered.map((p: any) => {
              const isOn = selected.has(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.id)}
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
                    <div className="text-[10px] text-muted-foreground truncate">
                      {p.categories?.name_ar}
                    </div>
                  </div>
                  {isOn && <Check className="size-4 text-primary shrink-0" />}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="col-span-full text-center text-sm text-muted-foreground py-6">لا منتجات</p>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 flex-row justify-between sm:justify-between">
          <span className="text-xs text-muted-foreground self-center">
            مختار: {selected.size}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>تفريغ</Button>
            <Button size="sm" onClick={() => onSave(Array.from(selected))}>
              <Save className="size-3.5 ml-1" /> حفظ
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
