import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Heart, Sparkles, Star, Pencil, Loader2, BadgeCheck } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import Footer from "@/components/Footer";

export default function Wishes() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  // Fetch approved wishes
  const { data: wishes, isLoading } = useQuery({
    queryKey: ["wishes-approved"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wishes")
        .select("*")
        .eq("status", "approved")
        .order("likes_count", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch current user's wish
  const { data: myWish } = useQuery({
    queryKey: ["my-wish", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wishes")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch user's likes
  const { data: myLikes } = useQuery({
    queryKey: ["my-wish-likes", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wish_likes")
        .select("wish_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      return new Set(data.map((l: any) => l.wish_id));
    },
  });

  // Create wish
  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("wishes").insert({
        user_id: user!.id,
        title: title.trim(),
        description: description.trim() || null,
        image_url: imageUrl.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-wish"] });
      queryClient.invalidateQueries({ queryKey: ["wishes-approved"] });
      setDialogOpen(false);
      resetForm();
      toast.success("تم إرسال أمنيتك بنجاح! سيتم مراجعتها قريباً ✨");
    },
    onError: () => toast.error("حدث خطأ، حاول مرة أخرى"),
  });

  // Update wish
  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("wishes")
        .update({
          title: title.trim(),
          description: description.trim() || null,
          image_url: imageUrl.trim() || null,
        })
        .eq("id", myWish!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-wish"] });
      setDialogOpen(false);
      setEditMode(false);
      resetForm();
      toast.success("تم تحديث أمنيتك ✨");
    },
    onError: () => toast.error("حدث خطأ، حاول مرة أخرى"),
  });

  // Toggle like
  const likeMutation = useMutation({
    mutationFn: async (wishId: string) => {
      const isLiked = myLikes?.has(wishId);
      if (isLiked) {
        const { error } = await supabase
          .from("wish_likes")
          .delete()
          .eq("wish_id", wishId)
          .eq("user_id", user!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("wish_likes")
          .insert({ wish_id: wishId, user_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-wish-likes"] });
      queryClient.invalidateQueries({ queryKey: ["wishes-approved"] });
    },
  });

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setImageUrl("");
  };

  const openEdit = () => {
    if (myWish) {
      setTitle(myWish.title);
      setDescription(myWish.description || "");
      setImageUrl(myWish.image_url || "");
      setEditMode(true);
      setDialogOpen(true);
    }
  };

  const openNew = () => {
    resetForm();
    setEditMode(false);
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!title.trim()) return toast.error("يرجى كتابة عنوان الأمنية");
    if (editMode) updateMutation.mutate();
    else createMutation.mutate();
  };

  const statusBadge = (status: string) => {
    if (status === "approved") return <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400"><BadgeCheck className="w-3 h-3" /> معتمدة</span>;
    if (status === "rejected") return <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/20 text-destructive">مرفوضة</span>;
    return <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">قيد المراجعة</span>;
  };

  return (
    <div className="min-h-screen bg-background/95 backdrop-blur-sm">
      <main className="container mx-auto px-4 py-6 pt-20 max-w-3xl" dir="rtl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <Sparkles className="w-6 h-6 text-primary" />
            <h1 className="text-2xl md:text-3xl font-black text-gradient-gold">الأمنيات</h1>
            <Sparkles className="w-6 h-6 text-primary" />
          </div>
          <p className="text-muted-foreground text-sm">تمنّى منتجاً ترغب بتوفره وسنعمل على تحقيقه! 🌟</p>
        </div>

        {/* My Wish - Pinned */}
        {user && myWish && (
          <div className="mb-6 p-4 rounded-2xl border-2 border-primary/30 bg-primary/5 relative">
            <div className="absolute top-2 left-2 flex items-center gap-1.5">
              {statusBadge(myWish.status)}
              {myWish.status === "pending" && (
                <button onClick={openEdit} className="text-muted-foreground hover:text-primary transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex gap-3">
              {myWish.image_url && (
                <img src={myWish.image_url} alt="" className="w-16 h-16 rounded-xl object-cover border border-border/50" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-primary font-bold mb-1">⭐ أمنيتك</p>
                <h3 className="font-bold text-sm">{myWish.title}</h3>
                {myWish.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{myWish.description}</p>}
                {myWish.price && (
                  <p className="text-xs font-bold text-primary mt-1">{Number(myWish.price).toLocaleString()} د.ع</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Add Wish Button */}
        {user && !myWish && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew} className="w-full mb-6 rounded-xl h-12 text-base font-bold gap-2">
                <Star className="w-5 h-5" /> تمنّى أمنية جديدة
              </Button>
            </DialogTrigger>
            <WishDialog
              title={title}
              setTitle={setTitle}
              description={description}
              setDescription={setDescription}
              imageUrl={imageUrl}
              setImageUrl={setImageUrl}
              onSubmit={handleSubmit}
              loading={createMutation.isPending || updateMutation.isPending}
              editMode={editMode}
            />
          </Dialog>
        )}

        {/* Edit dialog when myWish exists */}
        {user && myWish && (
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditMode(false); }}>
            <WishDialog
              title={title}
              setTitle={setTitle}
              description={description}
              setDescription={setDescription}
              imageUrl={imageUrl}
              setImageUrl={setImageUrl}
              onSubmit={handleSubmit}
              loading={createMutation.isPending || updateMutation.isPending}
              editMode={editMode}
            />
          </Dialog>
        )}

        {!user && (
          <div className="text-center mb-6 p-4 rounded-xl border border-border/50 bg-card/50">
            <p className="text-sm text-muted-foreground">سجل دخولك لتتمنى أمنية ❤️</p>
          </div>
        )}

        {/* Approved Wishes List */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : wishes && wishes.length > 0 ? (
          <div className="space-y-3">
            {wishes.map((wish: any) => (
              <div key={wish.id} className="p-4 rounded-xl border border-border/50 bg-card/50 hover:border-primary/30 transition-colors">
                <div className="flex gap-3">
                  {wish.image_url && (
                    <img src={wish.image_url} alt="" className="w-14 h-14 rounded-lg object-cover border border-border/30" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-sm">{wish.title}</h3>
                      {wish.price && (
                        <span className="text-xs font-bold text-primary whitespace-nowrap">{Number(wish.price).toLocaleString()} د.ع</span>
                      )}
                    </div>
                    {wish.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{wish.description}</p>}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/30">
                  <button
                    onClick={() => user && likeMutation.mutate(wish.id)}
                    disabled={!user || likeMutation.isPending}
                    className={`flex items-center gap-1.5 text-xs transition-colors ${
                      myLikes?.has(wish.id) ? "text-red-500" : "text-muted-foreground hover:text-red-500"
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${myLikes?.has(wish.id) ? "fill-current" : ""}`} />
                    <span>{wish.likes_count || 0}</span>
                  </button>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(wish.created_at).toLocaleDateString("ar-IQ")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Sparkles className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">لا توجد أمنيات معتمدة بعد</p>
          </div>
        )}

        <div className="mt-10">
          <Footer />
        </div>
      </main>
    </div>
  );
}

function WishDialog({
  title, setTitle, description, setDescription, imageUrl, setImageUrl, onSubmit, loading, editMode,
}: {
  title: string; setTitle: (v: string) => void;
  description: string; setDescription: (v: string) => void;
  imageUrl: string; setImageUrl: (v: string) => void;
  onSubmit: () => void; loading: boolean; editMode: boolean;
}) {
  return (
    <DialogContent className="max-w-md" dir="rtl">
      <DialogHeader>
        <DialogTitle className="text-right">{editMode ? "تعديل أمنيتك" : "تمنّى أمنية جديدة ✨"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 mt-2">
        <div>
          <Label>عنوان الأمنية *</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: سماعة ايربودز برو" maxLength={100} className="mt-1" />
        </div>
        <div>
          <Label>الوصف (اختياري)</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="وصف إضافي عن المنتج الذي تريده..." maxLength={500} className="mt-1" rows={3} />
        </div>
        <div>
          <Label>رابط صورة (اختياري)</Label>
          <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." type="url" className="mt-1" dir="ltr" />
        </div>
        <Button onClick={onSubmit} disabled={loading} className="w-full">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : editMode ? "حفظ التعديلات" : "إرسال الأمنية ✨"}
        </Button>
      </div>
    </DialogContent>
  );
}
