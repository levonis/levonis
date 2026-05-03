import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Trash2 } from "lucide-react";

export default function AdminRandomFilament() {
  const qc = useQueryClient();
  const [enabled, setEnabled] = useState(false);
  const [directPrice, setDirectPrice] = useState("0");
  const [preorderPrice, setPreorderPrice] = useState("0");
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");

  const { data: settings } = useQuery({
    queryKey: ["admin-rf-settings"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("random_filament_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (!settings) return;
    setEnabled(!!settings.enabled);
    setDirectPrice(String(settings.direct_price_iqd || 0));
    setPreorderPrice(String(settings.pre_order_price_iqd || 0));
    setSelectedCats(settings.category_ids || []);
    setTitle(settings.title_ar || "");
    setDesc(settings.description_ar || "");
  }, [settings]);

  const { data: categories } = useQuery({
    queryKey: ["admin-all-categories"],
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("id, name_ar")
        .order("name_ar");
      return data || [];
    },
  });

  const { data: orders } = useQuery({
    queryKey: ["admin-rf-orders"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("random_filament_orders")
        .select(
          "id, user_id, sale_type, selected_color, price_iqd, revealed_at, created_at, order_id, products(name_ar), categories(name_ar)"
        )
        .order("created_at", { ascending: false })
        .limit(200);
      return data || [];
    },
  });

  const { data: bans } = useQuery({
    queryKey: ["admin-rf-bans"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("random_filament_bans")
        .select("user_id, reason, banned_at")
        .order("banned_at", { ascending: false });
      return data || [];
    },
  });

  const save = async () => {
    if (!settings?.id) return;
    const { error } = await (supabase as any)
      .from("random_filament_settings")
      .update({
        enabled,
        direct_price_iqd: Number(directPrice) || 0,
        pre_order_price_iqd: Number(preorderPrice) || 0,
        category_ids: selectedCats,
        title_ar: title,
        description_ar: desc,
      })
      .eq("id", settings.id);
    if (error) {
      toast.error("فشل الحفظ");
    } else {
      toast.success("تم الحفظ");
      qc.invalidateQueries({ queryKey: ["admin-rf-settings"] });
      qc.invalidateQueries({ queryKey: ["random-filament-settings-public"] });
    }
  };

  const removeBan = async (uid: string) => {
    const { error } = await (supabase as any)
      .from("random_filament_bans")
      .delete()
      .eq("user_id", uid);
    if (error) toast.error("فشل");
    else {
      toast.success("تم رفع الحظر");
      qc.invalidateQueries({ queryKey: ["admin-rf-bans"] });
    }
  };

  const toggleCat = (id: string) => {
    setSelectedCats((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : [...p, id]
    );
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6 max-w-4xl">
      <h1 className="text-2xl font-bold">إدارة الفلمنت العشوائي</h1>

      <Tabs defaultValue="settings">
        <TabsList>
          <TabsTrigger value="settings">الإعدادات</TabsTrigger>
          <TabsTrigger value="orders">الطلبات</TabsTrigger>
          <TabsTrigger value="bans">المحظورون</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>الإعدادات العامة</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>تفعيل القسم</Label>
                <Switch checked={enabled} onCheckedChange={setEnabled} />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>سعر البيع المباشر (د.ع)</Label>
                  <Input
                    type="number"
                    value={directPrice}
                    onChange={(e) => setDirectPrice(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>سعر الحجز المسبق (د.ع)</Label>
                  <Input
                    type="number"
                    value={preorderPrice}
                    onChange={(e) => setPreorderPrice(e.target.value)}
                  />
                </div>
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
                <Label>الفئات المسموح بها</Label>
                <div className="flex flex-wrap gap-2">
                  {categories?.map((c: any) => (
                    <Badge
                      key={c.id}
                      variant={selectedCats.includes(c.id) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleCat(c.id)}
                    >
                      {c.name_ar}
                    </Badge>
                  ))}
                </div>
              </div>
              <Button onClick={save}>حفظ</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders" className="space-y-2">
          {orders?.length === 0 && (
            <p className="text-center text-muted-foreground py-8">لا طلبات</p>
          )}
          {orders?.map((o: any) => (
            <Card key={o.id}>
              <CardContent className="p-4 text-sm grid grid-cols-2 gap-2">
                <div>
                  <span className="text-muted-foreground">المستخدم: </span>
                  <span className="font-mono text-xs">{o.user_id?.slice(0, 8)}…</span>
                </div>
                <div>
                  <span className="text-muted-foreground">النوع: </span>
                  <span className="font-bold">
                    {o.sale_type === "direct" ? "بيع مباشر" : "حجز مسبق"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">القسم: </span>
                  {o.categories?.name_ar}
                </div>
                <div>
                  <span className="text-muted-foreground">المنتج: </span>
                  {o.products?.name_ar}
                </div>
                <div>
                  <span className="text-muted-foreground">اللون: </span>
                  {o.selected_color}
                </div>
                <div>
                  <span className="text-muted-foreground">السعر: </span>
                  {Number(o.price_iqd).toLocaleString()} د.ع
                </div>
                <div>
                  <Badge variant={o.order_id ? "default" : "secondary"}>
                    {o.order_id ? "تم الدفع" : "في السلة"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="bans" className="space-y-2">
          {bans?.length === 0 && (
            <p className="text-center text-muted-foreground py-8">لا محظورين</p>
          )}
          {bans?.map((b: any) => (
            <Card key={b.user_id}>
              <CardContent className="p-4 flex items-center justify-between text-sm">
                <div>
                  <div className="font-mono text-xs">{b.user_id}</div>
                  <div className="text-muted-foreground">{b.reason}</div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeBan(b.user_id)}
                >
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
