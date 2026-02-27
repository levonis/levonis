import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Heart, Sparkles, Star, Pencil, Loader2, BadgeCheck, ImagePlus, X, Camera } from "lucide-react";
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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [existingImageUrl, setExistingImageUrl] = useState("");

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

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile || !user) return existingImageUrl || null;
    const ext = imageFile.name.split(".").pop();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("wish-images").upload(path, imageFile, { upsert: true });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from("wish-images").getPublicUrl(path);
    return urlData.publicUrl;
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const imgUrl = await uploadImage();
      const { error } = await supabase.from("wishes").insert({
        user_id: user!.id,
        title: title.trim(),
        description: description.trim() || null,
        image_url: imgUrl,
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

  const updateMutation = useMutation({
    mutationFn: async () => {
      const imgUrl = await uploadImage();
      const { error } = await supabase
        .from("wishes")
        .update({
          title: title.trim(),
          description: description.trim() || null,
          image_url: imgUrl,
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

  const likeMutation = useMutation({
    mutationFn: async (wishId: string) => {
      const isLiked = myLikes?.has(wishId);
      if (isLiked) {
        const { error } = await supabase.from("wish_likes").delete().eq("wish_id", wishId).eq("user_id", user!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("wish_likes").insert({ wish_id: wishId, user_id: user!.id });
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
    setImageFile(null);
    setImagePreview("");
    setExistingImageUrl("");
  };

  const openEdit = () => {
    if (myWish) {
      setTitle(myWish.title);
      setDescription(myWish.description || "");
      setExistingImageUrl(myWish.image_url || "");
      setImagePreview(myWish.image_url || "");
      setImageFile(null);
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

  const handleImageSelect = (file: File) => {
    if (file.size > 5 * 1024 * 1024) return toast.error("حجم الصورة يجب ألا يتجاوز 5 ميجابايت");
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setExistingImageUrl("");
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview("");
    setExistingImageUrl("");
  };

  const statusBadge = (status: string) => {
    if (status === "approved") return <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-bold"><BadgeCheck className="w-3 h-3" /> معتمدة</span>;
    if (status === "rejected") return <span className="text-[10px] px-2.5 py-1 rounded-full bg-destructive/20 text-destructive font-bold">مرفوضة</span>;
    return <span className="text-[10px] px-2.5 py-1 rounded-full bg-yellow-500/20 text-yellow-400 font-bold animate-pulse">⏳ قيد المراجعة</span>;
  };

  return (
    <div className="min-h-screen bg-background/95">
      <main className="container mx-auto px-4 py-6 pt-20 max-w-3xl" dir="rtl">
        {/* ✨ Animated Header */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="relative inline-block mb-4">
            <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 via-accent/30 to-primary/20 rounded-full blur-2xl animate-pulse-slow" />
            <div className="relative flex items-center gap-3">
              <Sparkles className="w-7 h-7 text-primary animate-pulse" />
              <h1 className="text-3xl md:text-4xl font-black text-gradient-gold">الأمنيات</h1>
              <Sparkles className="w-7 h-7 text-primary animate-pulse" style={{ animationDelay: '0.5s' }} />
            </div>
          </div>
          <p className="text-muted-foreground text-sm max-w-md mx-auto leading-relaxed">
            تمنّى منتجاً ترغب بتوفره وسنعمل على تحقيقه! 🌟
          </p>
        </div>

        {/* 🌟 My Wish - Glassmorphism Pinned Card */}
        {user && myWish && (
          <div className="mb-6 relative group animate-scale-in" style={{ animationDelay: '0.1s' }}>
            <div className="absolute -inset-[1px] bg-gradient-to-r from-primary/50 via-accent/50 to-primary/50 rounded-2xl blur-sm group-hover:blur-md transition-all duration-500" />
            <div className="relative p-5 rounded-2xl bg-card/90 backdrop-blur-sm border border-primary/20">
              <div className="absolute top-3 left-3 flex items-center gap-2">
                {statusBadge(myWish.status)}
                {myWish.status === "pending" && (
                  <button onClick={openEdit} className="p-1.5 rounded-full bg-card/80 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="flex gap-4">
                {myWish.image_url && (
                  <div className="relative shrink-0">
                    <div className="absolute -inset-1 bg-gradient-to-br from-primary/30 to-accent/30 rounded-xl blur-sm" />
                    <img src={myWish.image_url} alt="" className="relative w-20 h-20 rounded-xl object-cover border border-primary/20" />
                  </div>
                )}
                <div className="flex-1 min-w-0 pt-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Star className="w-4 h-4 text-primary fill-primary" />
                    <span className="text-xs text-primary font-black">أمنيتك</span>
                  </div>
                  <h3 className="font-bold text-sm mb-1">{myWish.title}</h3>
                  {myWish.description && <p className="text-xs text-muted-foreground line-clamp-2">{myWish.description}</p>}
                  {myWish.price && (
                    <div className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/15 border border-primary/20">
                      <span className="text-xs font-black text-primary">{Number(myWish.price).toLocaleString()} د.ع</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ✨ Add Wish Button */}
        {user && !myWish && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <button
                onClick={openNew}
                className="w-full mb-6 relative group overflow-hidden rounded-2xl"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_100%] animate-shimmer" />
                <div className="relative flex items-center justify-center gap-3 py-4 px-6">
                  <Star className="w-5 h-5 text-primary-foreground animate-pulse" />
                  <span className="text-base font-black text-primary-foreground">تمنّى أمنية جديدة</span>
                  <Sparkles className="w-5 h-5 text-primary-foreground" />
                </div>
              </button>
            </DialogTrigger>
            <WishFormDialog
              title={title} setTitle={setTitle}
              description={description} setDescription={setDescription}
              imagePreview={imagePreview}
              onImageSelect={handleImageSelect}
              onClearImage={clearImage}
              onSubmit={handleSubmit}
              loading={createMutation.isPending}
              editMode={false}
            />
          </Dialog>
        )}

        {user && myWish && (
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditMode(false); }}>
            <WishFormDialog
              title={title} setTitle={setTitle}
              description={description} setDescription={setDescription}
              imagePreview={imagePreview}
              onImageSelect={handleImageSelect}
              onClearImage={clearImage}
              onSubmit={handleSubmit}
              loading={updateMutation.isPending}
              editMode={true}
            />
          </Dialog>
        )}

        {!user && (
          <div className="text-center mb-6 p-5 rounded-2xl border border-border/50 bg-card/50 animate-fade-in">
            <Heart className="w-8 h-8 text-primary/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground font-bold">سجل دخولك لتتمنى أمنية ❤️</p>
          </div>
        )}

        {/* 🎯 Wishes Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <WishSkeleton key={i} delay={i * 0.1} />
            ))}
          </div>
        ) : wishes && wishes.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {wishes.map((wish: any, i: number) => (
              <WishCard
                key={wish.id}
                wish={wish}
                isLiked={myLikes?.has(wish.id) || false}
                onLike={() => user && likeMutation.mutate(wish.id)}
                canLike={!!user && !likeMutation.isPending}
                index={i}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 animate-fade-in">
            <div className="relative inline-block mb-4">
              <div className="absolute inset-0 bg-primary/10 rounded-full blur-xl" />
              <Sparkles className="relative w-14 h-14 text-muted-foreground/30" />
            </div>
            <p className="text-sm text-muted-foreground font-bold">لا توجد أمنيات معتمدة بعد</p>
            <p className="text-xs text-muted-foreground/60 mt-1">كن أول من يتمنّى!</p>
          </div>
        )}

        <div className="mt-10">
          <Footer />
        </div>
      </main>
    </div>
  );
}

/* ═══════════════ Wish Card ═══════════════ */
function WishCard({ wish, isLiked, onLike, canLike, index }: {
  wish: any; isLiked: boolean; onLike: () => void; canLike: boolean; index: number;
}) {
  const [animateLike, setAnimateLike] = useState(false);

  const handleLike = () => {
    if (!canLike) return;
    setAnimateLike(true);
    setTimeout(() => setAnimateLike(false), 400);
    onLike();
  };

  return (
    <div
      className="rounded-2xl border border-border/40 bg-card/60 overflow-hidden hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 group animate-fade-in"
      style={{ animationDelay: `${index * 0.08}s`, animationFillMode: 'backwards' }}
    >
      {/* Image */}
      {wish.image_url ? (
        <div className="relative aspect-[4/3] overflow-hidden">
          <img
            src={wish.image_url}
            alt={wish.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
          {wish.price && (
            <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full bg-card/90 backdrop-blur-sm border border-primary/30">
              <span className="text-[10px] font-black text-primary">{Number(wish.price).toLocaleString()} د.ع</span>
            </div>
          )}
        </div>
      ) : (
        <div className="aspect-[4/3] bg-gradient-to-br from-primary/5 to-accent/5 flex items-center justify-center">
          <Sparkles className="w-8 h-8 text-primary/20" />
        </div>
      )}

      {/* Content */}
      <div className="p-3">
        <h3 className="font-bold text-xs leading-snug line-clamp-2 mb-1">{wish.title}</h3>
        {wish.description && (
          <p className="text-[10px] text-muted-foreground line-clamp-2 mb-2">{wish.description}</p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-border/30">
          <button
            onClick={handleLike}
            disabled={!canLike}
            className={`flex items-center gap-1 transition-all duration-200 ${
              isLiked ? "text-red-500" : "text-muted-foreground hover:text-red-500"
            }`}
          >
            <Heart className={`w-4 h-4 transition-transform duration-300 ${
              isLiked ? "fill-current" : ""
            } ${animateLike ? "scale-150" : "scale-100"}`} />
            <span className="text-[11px] font-bold">{wish.likes_count || 0}</span>
          </button>
          <span className="text-[9px] text-muted-foreground/60">
            {new Date(wish.created_at).toLocaleDateString("ar-IQ")}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════ Skeleton ═══════════════ */
function WishSkeleton({ delay }: { delay: number }) {
  return (
    <div className="rounded-2xl border border-border/30 bg-card/40 overflow-hidden animate-pulse" style={{ animationDelay: `${delay}s` }}>
      <div className="aspect-[4/3] bg-muted/20" />
      <div className="p-3 space-y-2">
        <div className="h-3 w-3/4 bg-muted/20 rounded" />
        <div className="h-2 w-1/2 bg-muted/15 rounded" />
        <div className="flex justify-between pt-2 border-t border-border/20">
          <div className="h-4 w-10 bg-muted/15 rounded" />
          <div className="h-3 w-12 bg-muted/10 rounded" />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════ Form Dialog with Image Upload ═══════════════ */
function WishFormDialog({ title, setTitle, description, setDescription, imagePreview, onImageSelect, onClearImage, onSubmit, loading, editMode }: {
  title: string; setTitle: (v: string) => void;
  description: string; setDescription: (v: string) => void;
  imagePreview: string;
  onImageSelect: (f: File) => void;
  onClearImage: () => void;
  onSubmit: () => void; loading: boolean; editMode: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("image/")) onImageSelect(file);
  }, [onImageSelect]);

  return (
    <DialogContent className="max-w-md" dir="rtl">
      <DialogHeader>
        <DialogTitle className="text-right flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          {editMode ? "تعديل أمنيتك" : "تمنّى أمنية جديدة"}
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-4 mt-2">
        {/* Image Upload */}
        <div>
          <Label className="text-xs mb-1.5 block">صورة المنتج (اختياري)</Label>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onImageSelect(e.target.files[0])}
          />
          {imagePreview ? (
            <div className="relative rounded-xl overflow-hidden border border-border/50 group">
              <img src={imagePreview} alt="" className="w-full aspect-video object-cover" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                <button onClick={() => fileRef.current?.click()} className="p-2 rounded-full bg-card/80 text-foreground hover:bg-card transition-colors">
                  <Camera className="w-5 h-5" />
                </button>
                <button onClick={onClearImage} className="p-2 rounded-full bg-destructive/80 text-destructive-foreground hover:bg-destructive transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="w-full aspect-video rounded-xl border-2 border-dashed border-border/50 hover:border-primary/50 bg-card/30 hover:bg-primary/5 transition-all flex flex-col items-center justify-center gap-2 group"
            >
              <div className="p-3 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <ImagePlus className="w-6 h-6 text-primary/60 group-hover:text-primary transition-colors" />
              </div>
              <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">اضغط أو اسحب صورة هنا</span>
              <span className="text-[10px] text-muted-foreground/50">PNG, JPG حتى 5MB</span>
            </button>
          )}
        </div>

        <div>
          <Label>عنوان الأمنية *</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: سماعة ايربودز برو" maxLength={100} className="mt-1" />
        </div>
        <div>
          <Label>الوصف (اختياري)</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="وصف إضافي عن المنتج الذي تريده..." maxLength={500} className="mt-1" rows={3} />
        </div>
        <Button onClick={onSubmit} disabled={loading} className="w-full h-11 text-sm font-black gap-2 rounded-xl">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
            <>
              <Sparkles className="w-4 h-4" />
              {editMode ? "حفظ التعديلات" : "إرسال الأمنية"}
            </>
          )}
        </Button>
      </div>
    </DialogContent>
  );
}
