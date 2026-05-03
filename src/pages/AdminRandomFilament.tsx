import { useEffect, useState } from "react";
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
import { Trash2, Plus, Save } from "lucide-react";

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
};

export default function AdminRandomFilament() {
  const qc = useQueryClient();
  const [enabled, setEnabled] = useState(false);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");

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
      sale_type, title_ar: "عرض جديد", price_iqd: 0, display_order: (offers?.length || 0) + 1,
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

  return (
    <div className="container mx-auto px-4 py-6 space-y-6 max-w-4xl">
      <h1 className="text-2xl font-bold">إدارة الفلمنت العشوائي</h1>

      <Tabs defaultValue="settings">
        <TabsList>
          <TabsTrigger value="settings">الإعدادات</TabsTrigger>
          <TabsTrigger value="offers">العروض</TabsTrigger>
          <TabsTrigger value="orders">الطلبات</TabsTrigger>
          <TabsTrigger value="bans">المحظورون</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>الإعدادات العامة</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>تفعيل القسم</Label>
                <Switch checked={enabled} onCheckedChange={setEnabled} />
              </div>
              <div className="space-y-1">
                <Label>عنوان القسم</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>وصف القسم</Label>
                <Input value={desc} onChange={(e) => setDesc(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>الأقسام الفرعية المسموح بها (من قسم مواد الطباعة)</Label>
                <div className="flex flex-wrap gap-2">
                  {categories?.map((c: any) => (
                    <Badge key={c.id}
                      variant={selectedCats.includes(c.id) ? "default" : "outline"}
                      className="cursor-pointer" onClick={() => toggleCat(c.id)}>
                      {c.name_ar}
                    </Badge>
                  ))}
                </div>
              </div>
              <Button onClick={saveSettings}><Save className="size-4 ml-1" /> حفظ</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="offers" className="space-y-4">
          {(["direct", "preorder"] as const).map((st) => (
            <Card key={st}>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-base">
                  عروض {st === "direct" ? "البيع المباشر" : "الحجز المسبق"}
                </CardTitle>
                <Button size="sm" onClick={() => addOffer(st)}>
                  <Plus className="size-4 ml-1" /> إضافة عرض
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {offers?.filter((o) => o.sale_type === st).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">لا عروض</p>
                )}
                {offers?.filter((o) => o.sale_type === st).map((o) => (
                  <div key={o.id} className="rounded-xl border p-3 space-y-2 bg-muted/30">
                    <div className="grid sm:grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">العنوان</Label>
                        <Input defaultValue={o.title_ar}
                          onBlur={(e) => e.target.value !== o.title_ar && updateOffer(o.id!, { title_ar: e.target.value })} />
                      </div>
                      <div>
                        <Label className="text-xs">السعر (د.ع)</Label>
                        <Input type="number" defaultValue={o.price_iqd}
                          onBlur={(e) => Number(e.target.value) !== Number(o.price_iqd) && updateOffer(o.id!, { price_iqd: Number(e.target.value) || 0 })} />
                      </div>
                      <div>
                        <Label className="text-xs">رابط الصورة (اختياري)</Label>
                        <Input defaultValue={o.image_url || ""}
                          onBlur={(e) => e.target.value !== (o.image_url || "") && updateOffer(o.id!, { image_url: e.target.value || null })} />
                      </div>
                      <div>
                        <Label className="text-xs">ترتيب العرض</Label>
                        <Input type="number" defaultValue={o.display_order}
                          onBlur={(e) => Number(e.target.value) !== o.display_order && updateOffer(o.id!, { display_order: Number(e.target.value) || 0 })} />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">الوصف (اختياري)</Label>
                      <Textarea defaultValue={o.description_ar || ""} rows={2}
                        onBlur={(e) => e.target.value !== (o.description_ar || "") && updateOffer(o.id!, { description_ar: e.target.value || null })} />
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2">
                        <Switch checked={o.enabled} onCheckedChange={(v) => updateOffer(o.id!, { enabled: v })} />
                        <span className="text-xs text-muted-foreground">{o.enabled ? "مفعّل" : "متوقف"}</span>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => deleteOffer(o.id!)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="orders" className="space-y-2">
          {orders?.length === 0 && (
            <p className="text-center text-muted-foreground py-8">لا طلبات</p>
          )}
          {orders?.map((o: any) => (
            <Card key={o.id}>
              <CardContent className="p-4 text-sm grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">المستخدم: </span><span className="font-mono text-xs">{o.user_id?.slice(0, 8)}…</span></div>
                <div><span className="text-muted-foreground">النوع: </span><span className="font-bold">{o.sale_type === "direct" ? "بيع مباشر" : "حجز مسبق"}</span></div>
                <div><span className="text-muted-foreground">القسم: </span>{o.categories?.name_ar}</div>
                <div><span className="text-muted-foreground">المنتج: </span>{o.products?.name_ar}</div>
                <div><span className="text-muted-foreground">اللون: </span>{o.selected_color}</div>
                <div><span className="text-muted-foreground">السعر: </span>{Number(o.price_iqd).toLocaleString()} د.ع</div>
                <div><Badge variant={o.order_id ? "default" : "secondary"}>{o.order_id ? "تم الدفع" : "في السلة"}</Badge></div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="bans" className="space-y-2">
          {bans?.length === 0 && <p className="text-center text-muted-foreground py-8">لا محظورين</p>}
          {bans?.map((b: any) => (
            <Card key={b.user_id}>
              <CardContent className="p-4 flex items-center justify-between text-sm">
                <div>
                  <div className="font-mono text-xs">{b.user_id}</div>
                  <div className="text-muted-foreground">{b.reason}</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => removeBan(b.user_id)}>
                  <Trash2 className="size-4" /> رفع الحظر
                </Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
