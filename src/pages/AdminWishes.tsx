import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Check, X, Loader2, Pencil, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
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

  const { data: wishes, isLoading } = useQuery({
    queryKey: ["admin-wishes", filter],
    queryFn: async () => {
      let q = supabase.from("wishes").select("*").order("created_at", { ascending: false });
      if (filter !== "all") q = q.eq("status", filter);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

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
  };

  const saveEdit = () => {
    if (!editWish) return;
    updateMutation.mutate({
      id: editWish.id,
      updates: {
        title: editTitle.trim(),
        description: editDesc.trim() || null,
        image_url: editImage.trim() || null,
        price: editPrice ? Number(editPrice) : null,
      },
    });
    setEditWish(null);
  };

  const filters: { label: string; value: WishStatus | "all" }[] = [
    { label: "معلقة", value: "pending" },
    { label: "معتمدة", value: "approved" },
    { label: "مرفوضة", value: "rejected" },
    { label: "الكل", value: "all" },
  ];

  return (
    <div className="min-h-screen bg-background/95 pt-20">
      <main className="container mx-auto px-4 py-6 max-w-4xl" dir="rtl">
        <div className="flex items-center gap-3 mb-6">
          <Link to={ADMIN_BASE_PATH} className="text-muted-foreground hover:text-primary">
            <ArrowRight className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-black">إدارة الأمنيات</h1>
        </div>

        {/* Filters */}
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
                <Label>العنوان</Label>
                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>الوصف</Label>
                <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="mt-1" rows={3} />
              </div>
              <div>
                <Label>رابط الصورة</Label>
                <Input value={editImage} onChange={(e) => setEditImage(e.target.value)} className="mt-1" dir="ltr" />
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
      </main>
    </div>
  );
}

function WishAdminCard({
  wish, onApprove, onReject, onEdit, isPending,
}: {
  wish: any; onApprove: (id: string, price: string) => void;
  onReject: (id: string) => void; onEdit: (w: any) => void; isPending: boolean;
}) {
  const [price, setPrice] = useState(wish.price?.toString() || "");

  return (
    <div className="p-4 rounded-xl border border-border/50 bg-card/50">
      <div className="flex gap-3">
        {wish.image_url && (
          <img src={wish.image_url} alt="" className="w-14 h-14 rounded-lg object-cover border border-border/30" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-sm">{wish.title}</h3>
            <span className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap ${
              wish.status === "approved" ? "bg-emerald-500/20 text-emerald-400" :
              wish.status === "rejected" ? "bg-destructive/20 text-destructive" :
              "bg-yellow-500/20 text-yellow-400"
            }`}>
              {wish.status === "approved" ? "معتمدة" : wish.status === "rejected" ? "مرفوضة" : "معلقة"}
            </span>
          </div>
          {wish.description && <p className="text-xs text-muted-foreground mt-1">{wish.description}</p>}
          <p className="text-[10px] text-muted-foreground mt-1">
            ❤️ {wish.likes_count || 0} إعجاب · {new Date(wish.created_at).toLocaleDateString("ar-IQ")}
          </p>
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

      <div className="mt-2 flex justify-end">
        <button onClick={() => onEdit(wish)} className="text-muted-foreground hover:text-primary transition-colors">
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
