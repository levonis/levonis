import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Check, X, Loader2, Pencil, ArrowRight, ImagePlus, Camera, Gift, Truck, Award, Coins, CheckCircle2, User } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ADMIN_BASE_PATH } from "@/config/adminConfig";

type WishStatus = "pending" | "approved" | "rejected";

export default function AdminWishes() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<WishStatus | "all">("pending");
  const [editWish, setEditWish] = useState<any>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editImage, setEditImage] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState("");
  const editFileRef = useRef<HTMLInputElement>(null);

  // Fulfill dialog state
  const [fulfillWish, setFulfillWish] = useState<any>(null);
  const [rewardGift, setRewardGift] = useState("");
  const [rewardDiscount, setRewardDiscount] = useState("");
  const [rewardFreeShipping, setRewardFreeShipping] = useState(true);
  const [rewardPoints, setRewardPoints] = useState("500");

  const { data: wishes, isLoading } = useQuery({
    queryKey: ["admin-wishes", filter],
    queryFn: async () => {
      let q = supabase.from("wishes").select("*").order("created_at", { ascending: false });
      if (filter !== "all") q = q.eq("status", filter);
      const { data, error } = await q;
      if (error) throw error;

      // Fetch profiles
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map((w: any) => w.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, username, phone_number")
          .in("id", userIds);
        const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
        return data.map((w: any) => ({ ...w, profile: profileMap.get(w.user_id) || null }));
      }
      return data;
    },
  });

  const uploadEditImage = async (): Promise<string | null> => {
    if (!editImageFile) return editImage.trim() || null;
    const ext = editImageFile.name.split(".").pop();
    const path = `admin/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("wish-images").upload(path, editImageFile, { upsert: true });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from("wish-images").getPublicUrl(path);
    return urlData.publicUrl;
  };

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const { error } = await supabase.from("wishes").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-wishes"] });
      toast.success("تم التحديث بنجاح");
    },
    onError: () => toast.error("حدث خطأ"),
  });

  const approve = (id: string, price: string) => {
    if (!price || isNaN(Number(price))) return toast.error("يرجى تحديد سعر صحيح");
    updateMutation.mutate({ id, updates: { status: "approved", price: Number(price) } });
  };

  const reject = (id: string) => {
    updateMutation.mutate({ id, updates: { status: "rejected" } });
  };

  const openEdit = (wish: any) => {
    setEditWish(wish);
    setEditTitle(wish.title);
    setEditDesc(wish.description || "");
    setEditImage(wish.image_url || "");
    setEditPrice(wish.price?.toString() || "");
    setEditImageFile(null);
    setEditImagePreview(wish.image_url || "");
  };

  const saveEdit = async () => {
    if (!editWish) return;
    const imgUrl = await uploadEditImage();
    updateMutation.mutate({
      id: editWish.id,
      updates: {
        title: editTitle.trim(),
        description: editDesc.trim() || null,
        image_url: imgUrl,
        price: editPrice ? Number(editPrice) : null,
      },
    });
    setEditWish(null);
  };

  const openFulfill = (wish: any) => {
    setFulfillWish(wish);
    setRewardGift("هدية عشوائية مجانية");
    setRewardDiscount("15");
    setRewardFreeShipping(true);
    setRewardPoints("500");
  };

  const saveFulfill = () => {
    if (!fulfillWish) return;
    updateMutation.mutate({
      id: fulfillWish.id,
      updates: {
        fulfilled_at: new Date().toISOString(),
        reward_gift_description: rewardGift.trim() || null,
        reward_discount_percent: rewardDiscount ? Number(rewardDiscount) : 0,
        reward_free_shipping: rewardFreeShipping,
        reward_bonus_points: rewardPoints ? Number(rewardPoints) : 0,
      },
    });
    setFulfillWish(null);
  };

  const handleEditImageSelect = (file: File) => {
    if (file.size > 5 * 1024 * 1024) return toast.error("حجم الصورة يجب ألا يتجاوز 5 ميجابايت");
    setEditImageFile(file);
    setEditImagePreview(URL.createObjectURL(file));
    setEditImage("");
  };

  const filters: { label: string; value: WishStatus | "all" }[] = [
    { label: "معلقة", value: "pending" },
    { label: "معتمدة", value: "approved" },
    { label: "مرفوضة", value: "rejected" },
    { label: "الكل", value: "all" },
  ];

  return (
    <div className="min-h-screen bg-background/95">
      <main className="container mx-auto px-4 py-6 max-w-4xl" dir="rtl">
        <div className="flex items-center gap-3 mb-6">
          <Link to={ADMIN_BASE_PATH} className="text-muted-foreground hover:text-primary">
            <ArrowRight className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-black">إدارة الأمنيات</h1>
        </div>

        <div className="flex gap-2 mb-6 flex-wrap">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${
                filter === f.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border/50 text-muted-foreground hover:border-primary/50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : wishes && wishes.length > 0 ? (
          <div className="space-y-3">
            {wishes.map((wish: any) => (
              <WishAdminCard
                key={wish.id}
                wish={wish}
                onApprove={approve}
                onReject={reject}
                onEdit={openEdit}
                onFulfill={openFulfill}
                isPending={updateMutation.isPending}
              />
            ))}
          </div>
        ) : (
          <p className="text-center py-12 text-sm text-muted-foreground">لا توجد أمنيات</p>
        )}

        {/* Edit Dialog */}
        <Dialog open={!!editWish} onOpenChange={(o) => !o && setEditWish(null)}>
          <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-right">تعديل الأمنية</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label className="text-xs mb-1.5 block">الصورة</Label>
                <input ref={editFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleEditImageSelect(e.target.files[0])} />
                {editImagePreview ? (
                  <div className="relative rounded-xl overflow-hidden border border-border/50 group">
                    <img src={editImagePreview} alt="" className="w-full aspect-video object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <button onClick={() => editFileRef.current?.click()} className="p-2 rounded-full bg-card/80 text-foreground hover:bg-card transition-colors">
                        <Camera className="w-5 h-5" />
                      </button>
                      <button onClick={() => { setEditImageFile(null); setEditImagePreview(""); setEditImage(""); }} className="p-2 rounded-full bg-destructive/80 text-destructive-foreground hover:bg-destructive transition-colors">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => editFileRef.current?.click()} className="w-full aspect-video rounded-xl border-2 border-dashed border-border/50 hover:border-primary/50 bg-card/30 hover:bg-primary/5 transition-all flex flex-col items-center justify-center gap-2 group">
                    <ImagePlus className="w-6 h-6 text-primary/60 group-hover:text-primary transition-colors" />
                    <span className="text-xs text-muted-foreground">اضغط لرفع صورة</span>
                  </button>
                )}
              </div>

              <div>
                <Label>العنوان</Label>
                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>الوصف</Label>
                <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="mt-1" rows={3} />
              </div>
              <div>
                <Label>السعر (د.ع)</Label>
                <Input value={editPrice} onChange={(e) => setEditPrice(e.target.value)} type="number" className="mt-1" dir="ltr" />
              </div>
              <Button onClick={saveEdit} disabled={updateMutation.isPending} className="w-full">
                {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "حفظ"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Fulfill Dialog */}
        <Dialog open={!!fulfillWish} onOpenChange={(o) => !o && setFulfillWish(null)}>
          <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-right flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                تحقيق الأمنية وتحديد المكافآت
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              {fulfillWish && (
                <div className="p-3 rounded-xl bg-card/50 border border-border/30">
                  <p className="text-sm font-bold">{fulfillWish.title}</p>
                  {fulfillWish.profile && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {fulfillWish.profile.full_name || fulfillWish.profile.username}
                    </p>
                  )}
                </div>
              )}

              <div>
                <Label className="flex items-center gap-1.5 text-xs">
                  <Gift className="w-3.5 h-3.5 text-pink-400" /> وصف الهدية المجانية
                </Label>
                <Input value={rewardGift} onChange={(e) => setRewardGift(e.target.value)} placeholder="هدية عشوائية مجانية" className="mt-1" />
              </div>

              <div>
                <Label className="flex items-center gap-1.5 text-xs">
                  <Award className="w-3.5 h-3.5 text-yellow-400" /> نسبة الخصم %
                </Label>
                <Input value={rewardDiscount} onChange={(e) => setRewardDiscount(e.target.value)} type="number" placeholder="15" className="mt-1" dir="ltr" />
              </div>

              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5 text-xs">
                  <Truck className="w-3.5 h-3.5 text-emerald-400" /> توصيل مجاني
                </Label>
                <Switch checked={rewardFreeShipping} onCheckedChange={setRewardFreeShipping} />
              </div>

              <div>
                <Label className="flex items-center gap-1.5 text-xs">
                  <Coins className="w-3.5 h-3.5 text-orange-400" /> نقاط إضافية
                </Label>
                <Input value={rewardPoints} onChange={(e) => setRewardPoints(e.target.value)} type="number" placeholder="500" className="mt-1" dir="ltr" />
              </div>

              <Button onClick={saveFulfill} disabled={updateMutation.isPending} className="w-full h-11 gap-2 bg-emerald-600 hover:bg-emerald-700">
                {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    تحقيق الأمنية وإرسال المكافآت
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

function WishAdminCard({ wish, onApprove, onReject, onEdit, onFulfill, isPending }: {
  wish: any; onApprove: (id: string, price: string) => void;
  onReject: (id: string) => void; onEdit: (w: any) => void; onFulfill: (w: any) => void; isPending: boolean;
}) {
  const [price, setPrice] = useState(wish.price?.toString() || "");
  const isFulfilled = !!wish.fulfilled_at;

  return (
    <div className={`p-4 rounded-xl border bg-card/50 ${isFulfilled ? 'border-emerald-500/30' : 'border-border/50'}`}>
      <div className="flex gap-3">
        {wish.image_url && (
          <img src={wish.image_url} alt="" className="w-14 h-14 rounded-lg object-cover border border-border/30" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-sm">{wish.title}</h3>
            <div className="flex items-center gap-1.5">
              {isFulfilled && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 whitespace-nowrap flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> محققة
                </span>
              )}
              <span className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap ${
                wish.status === "approved" ? "bg-emerald-500/20 text-emerald-400" :
                wish.status === "rejected" ? "bg-destructive/20 text-destructive" :
                "bg-yellow-500/20 text-yellow-400"
              }`}>
                {wish.status === "approved" ? "معتمدة" : wish.status === "rejected" ? "مرفوضة" : "معلقة"}
              </span>
            </div>
          </div>
          {wish.description && <p className="text-xs text-muted-foreground mt-1">{wish.description}</p>}
          
          {/* Owner info */}
          {wish.profile && (
            <p className="text-[10px] text-primary/70 mt-1 flex items-center gap-1">
              <User className="w-3 h-3" />
              {wish.profile.full_name || wish.profile.username}
              {wish.profile.phone_number && <span className="text-muted-foreground mr-1">({wish.profile.phone_number})</span>}
            </p>
          )}
          
          <p className="text-[10px] text-muted-foreground mt-1">
            ❤️ {wish.likes_count || 0} إعجاب · {new Date(wish.created_at).toLocaleDateString("ar-IQ")}
          </p>

          {/* Show rewards if fulfilled */}
          {isFulfilled && (
            <div className="mt-2 flex flex-wrap gap-1">
              {wish.reward_gift_description && <span className="text-[9px] px-1.5 py-0.5 rounded bg-pink-500/10 text-pink-400">🎁 {wish.reward_gift_description}</span>}
              {wish.reward_discount_percent > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400">💸 {wish.reward_discount_percent}%</span>}
              {wish.reward_free_shipping && <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">🚚 مجاني</span>}
              {wish.reward_bonus_points > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400">⭐ +{wish.reward_bonus_points}</span>}
            </div>
          )}
        </div>
      </div>

      {wish.status === "pending" && (
        <div className="mt-3 pt-3 border-t border-border/30 flex items-end gap-2">
          <div className="flex-1">
            <Label className="text-[10px]">السعر (د.ع)</Label>
            <Input value={price} onChange={(e) => setPrice(e.target.value)} type="number" placeholder="0" className="h-8 text-xs mt-0.5" dir="ltr" />
          </div>
          <Button size="sm" onClick={() => onApprove(wish.id, price)} disabled={isPending} className="h-8 gap-1">
            <Check className="w-3.5 h-3.5" /> موافقة
          </Button>
          <Button size="sm" variant="destructive" onClick={() => onReject(wish.id)} disabled={isPending} className="h-8 gap-1">
            <X className="w-3.5 h-3.5" /> رفض
          </Button>
        </div>
      )}

      <div className="mt-2 flex justify-end gap-2">
        {wish.status === "approved" && !isFulfilled && (
          <Button size="sm" variant="outline" onClick={() => onFulfill(wish)} className="h-7 text-[10px] gap-1 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10">
            <CheckCircle2 className="w-3 h-3" /> تحقيق الأمنية
          </Button>
        )}
        <button onClick={() => onEdit(wish)} className="text-muted-foreground hover:text-primary transition-colors">
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
