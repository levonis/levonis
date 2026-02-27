import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Heart, Sparkles, Star, Pencil, Loader2, BadgeCheck, ImagePlus, X, Camera, Flame, TrendingUp } from "lucide-react";
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

  const totalWishes = wishes?.length || 0;

  return (
    <div className="min-h-screen bg-background">
      {/* ═══ HERO SECTION ═══ */}
      <div className="relative pt-20 pb-8 overflow-hidden">
        {/* Animated background orbs */}
        <div className="absolute top-10 right-10 w-64 h-64 bg-primary/8 rounded-full blur-[100px] animate-pulse-slow" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent/10 rounded-full blur-[80px] animate-pulse-slow" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-32 bg-primary/5 rounded-full blur-[120px]" />

        <div className="container mx-auto px-4 max-w-3xl relative z-10" dir="rtl">
          {/* Sparkle particles */}
          <div className="absolute top-4 right-8 text-primary/30 animate-bounce" style={{ animationDuration: '3s' }}>✦</div>
          <div className="absolute top-12 left-12 text-accent/20 animate-bounce" style={{ animationDuration: '4s', animationDelay: '1s' }}>✧</div>
          <div className="absolute bottom-4 right-1/3 text-primary/20 animate-bounce" style={{ animationDuration: '3.5s', animationDelay: '0.5s' }}>✦</div>

          <div className="text-center wish-hero-animate">
            {/* Icon badge */}
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/20 mb-4 wish-float">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>

            <h1 className="text-4xl md:text-5xl font-black text-gradient-gold mb-3 tracking-tight">
              الأمنيات
            </h1>
            <p className="text-muted-foreground text-sm md:text-base max-w-sm mx-auto leading-relaxed mb-4">
              تمنّى منتجاً ترغب بتوفره وسنعمل على تحقيقه
            </p>

            {/* Stats pills */}
            <div className="flex items-center justify-center gap-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card/60 border border-border/40 text-xs">
                <Flame className="w-3.5 h-3.5 text-primary" />
                <span className="text-muted-foreground"><strong className="text-foreground">{totalWishes}</strong> أمنية</span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card/60 border border-border/40 text-xs">
                <TrendingUp className="w-3.5 h-3.5 text-primary" />
                <span className="text-muted-foreground">الأكثر شعبية</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 pb-6 max-w-3xl" dir="rtl">
        {/* ═══ MY WISH - PREMIUM CARD ═══ */}
        {user && myWish && (
          <div className="mb-6 wish-card-animate" style={{ '--delay': '0.15s' } as any}>
            <div className="relative rounded-2xl overflow-hidden">
              {/* Animated border glow */}
              <div className="absolute -inset-[1px] bg-gradient-to-r from-primary via-accent to-primary bg-[length:300%_100%] rounded-2xl animate-shimmer opacity-60" />
              <div className="relative bg-card rounded-[15px] p-4">
                {/* Top row: label + status */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-primary/15 flex items-center justify-center">
                      <Star className="w-3.5 h-3.5 text-primary fill-primary" />
                    </div>
                    <span className="text-xs font-black text-primary">أمنيتك</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={myWish.status} />
                    {myWish.status === "pending" && (
                      <button onClick={openEdit} className="w-7 h-7 rounded-lg bg-muted/30 hover:bg-primary/15 flex items-center justify-center text-muted-foreground hover:text-primary transition-all">
                        <Pencil className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="flex gap-3">
                  {myWish.image_url && (
                    <div className="shrink-0 w-[72px] h-[72px] rounded-xl overflow-hidden border border-border/40">
                      <img src={myWish.image_url} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm mb-0.5 line-clamp-1">{myWish.title}</h3>
                    {myWish.description && <p className="text-[11px] text-muted-foreground line-clamp-2 mb-2">{myWish.description}</p>}
                    {myWish.price && (
                      <span className="inline-flex items-center gap-1 text-xs font-black text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/15">
                        {Number(myWish.price).toLocaleString()} د.ع
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ ADD WISH CTA ═══ */}
        {user && !myWish && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <button onClick={openNew} className="w-full mb-6 group wish-card-animate" style={{ '--delay': '0.2s' } as any}>
                <div className="relative rounded-2xl overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_100%] animate-shimmer" />
                  <div className="relative flex items-center justify-center gap-3 py-4 px-6 m-[1px] rounded-[15px] bg-card/80 group-hover:bg-card/60 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Star className="w-5 h-5 text-primary" />
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-black text-foreground block">تمنّى أمنية جديدة</span>
                      <span className="text-[10px] text-muted-foreground">سنعمل على توفيرها لك</span>
                    </div>
                    <Sparkles className="w-5 h-5 text-primary/50 mr-auto animate-pulse" />
                  </div>
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
          <div className="mb-6 text-center p-6 rounded-2xl border border-border/40 bg-card/40 wish-card-animate" style={{ '--delay': '0.2s' } as any}>
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Heart className="w-6 h-6 text-primary/50" />
            </div>
            <p className="text-sm font-bold text-foreground mb-1">سجل دخولك</p>
            <p className="text-xs text-muted-foreground">لتتمنى أمنية وتصوّت على أمنيات الآخرين ❤️</p>
          </div>
        )}

        {/* ═══ SECTION TITLE ═══ */}
        {!isLoading && wishes && wishes.length > 0 && (
          <div className="flex items-center gap-2 mb-4 wish-card-animate" style={{ '--delay': '0.25s' } as any}>
            <div className="w-1 h-5 rounded-full bg-gradient-to-b from-primary to-accent" />
            <h2 className="text-sm font-black">أمنيات المجتمع</h2>
            <div className="flex-1 h-px bg-border/30" />
          </div>
        )}

        {/* ═══ WISHES GRID ═══ */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-2.5">
            {[...Array(6)].map((_, i) => (
              <WishSkeleton key={i} index={i} />
            ))}
          </div>
        ) : wishes && wishes.length > 0 ? (
          <div className="grid grid-cols-2 gap-2.5">
            {wishes.map((wish: any, i: number) => (
              <WishCard
                key={wish.id}
                wish={wish}
                isLiked={myLikes?.has(wish.id) || false}
                onLike={() => user && likeMutation.mutate(wish.id)}
                canLike={!!user && !likeMutation.isPending}
                index={i}
                isTop={i === 0}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 wish-card-animate" style={{ '--delay': '0.3s' } as any}>
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/10 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-9 h-9 text-primary/30" />
            </div>
            <p className="font-bold text-sm mb-1">لا توجد أمنيات بعد</p>
            <p className="text-xs text-muted-foreground">كن أول من يتمنّى! ✨</p>
          </div>
        )}

        <div className="mt-10">
          <Footer />
        </div>
      </main>

      {/* Scoped styles */}
      <style>{`
        .wish-hero-animate { animation: wishHeroIn 0.7s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .wish-card-animate { animation: wishCardIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; animation-delay: var(--delay, 0s); }
        .wish-float { animation: wishFloat 4s ease-in-out infinite; }
        
        @keyframes wishHeroIn {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes wishCardIn {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes wishFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes wishHeartPop {
          0% { transform: scale(1); }
          30% { transform: scale(1.4); }
          60% { transform: scale(0.9); }
          100% { transform: scale(1); }
        }
        .wish-heart-pop { animation: wishHeartPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }
      `}</style>
    </div>
  );
}

/* ═══════════════ Status Badge ═══════════════ */
function StatusBadge({ status }: { status: string }) {
  if (status === "approved") return (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/20">
      <BadgeCheck className="w-3 h-3" /> معتمدة
    </span>
  );
  if (status === "rejected") return (
    <span className="text-[10px] px-2 py-0.5 rounded-md bg-destructive/15 text-destructive font-bold border border-destructive/20">مرفوضة</span>
  );
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-md bg-primary/10 text-primary font-bold border border-primary/15 animate-pulse">
      ⏳ قيد المراجعة
    </span>
  );
}

/* ═══════════════ Wish Card ═══════════════ */
function WishCard({ wish, isLiked, onLike, canLike, index, isTop }: {
  wish: any; isLiked: boolean; onLike: () => void; canLike: boolean; index: number; isTop: boolean;
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
      className={`rounded-2xl border bg-card/70 overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 group wish-card-animate ${
        isTop ? "border-primary/30 ring-1 ring-primary/10" : "border-border/30 hover:border-primary/20"
      }`}
      style={{ '--delay': `${0.3 + index * 0.06}s` } as any}
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-card to-background">
        {wish.image_url ? (
          <img
            src={wish.image_url}
            alt={wish.title}
            className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-700 ease-out"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-12 h-12 rounded-2xl bg-primary/8 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-primary/25" />
            </div>
          </div>
        )}

        {/* Top badge for #1 */}
        {isTop && (
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-primary/90 text-primary-foreground text-[9px] font-black flex items-center gap-1">
            <Flame className="w-3 h-3" /> الأكثر طلباً
          </div>
        )}

        {/* Price overlay */}
        {wish.price && (
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent pt-6 pb-2 px-2.5">
            <span className="text-[11px] font-black text-white drop-shadow-sm">
              {Number(wish.price).toLocaleString()} <span className="text-[9px] font-bold opacity-80">د.ع</span>
            </span>
          </div>
        )}

        {/* Like button overlay */}
        <button
          onClick={handleLike}
          disabled={!canLike}
          className={`absolute top-2 left-2 w-8 h-8 rounded-full backdrop-blur-md flex items-center justify-center transition-all ${
            isLiked
              ? "bg-destructive/80 text-destructive-foreground shadow-lg shadow-destructive/20"
              : "bg-card/60 text-foreground/70 hover:bg-card/90"
          } ${animateLike ? "wish-heart-pop" : ""}`}
        >
          <Heart className={`w-3.5 h-3.5 ${isLiked ? "fill-current" : ""}`} />
        </button>
      </div>

      {/* Content */}
      <div className="p-2.5">
        <h3 className="font-bold text-[11px] leading-snug line-clamp-2 mb-1.5">{wish.title}</h3>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Heart className={`w-3 h-3 ${isLiked ? "fill-destructive text-destructive" : ""}`} />
            <span className="text-[10px] font-bold">{wish.likes_count || 0}</span>
          </div>
          <span className="text-[9px] text-muted-foreground/50">
            {new Date(wish.created_at).toLocaleDateString("ar-IQ")}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════ Skeleton ═══════════════ */
function WishSkeleton({ index }: { index: number }) {
  return (
    <div
      className="rounded-2xl border border-border/20 bg-card/30 overflow-hidden wish-card-animate"
      style={{ '--delay': `${0.1 + index * 0.06}s` } as any}
    >
      <div className="aspect-square bg-muted/10 animate-pulse" />
      <div className="p-2.5 space-y-1.5">
        <div className="h-3 w-4/5 bg-muted/10 rounded animate-pulse" />
        <div className="flex justify-between">
          <div className="h-3 w-8 bg-muted/10 rounded animate-pulse" />
          <div className="h-2.5 w-10 bg-muted/8 rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════ Form Dialog ═══════════════ */
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
          <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
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
            <div className="relative rounded-xl overflow-hidden border border-border/40 group">
              <img src={imagePreview} alt="" className="w-full aspect-[16/10] object-cover" />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                <button onClick={() => fileRef.current?.click()} className="w-10 h-10 rounded-xl bg-card/90 text-foreground hover:bg-card flex items-center justify-center transition-colors">
                  <Camera className="w-5 h-5" />
                </button>
                <button onClick={onClearImage} className="w-10 h-10 rounded-xl bg-destructive/90 text-destructive-foreground hover:bg-destructive flex items-center justify-center transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="w-full aspect-[16/10] rounded-xl border-2 border-dashed border-border/40 hover:border-primary/40 bg-card/20 hover:bg-primary/5 transition-all flex flex-col items-center justify-center gap-2 group"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 group-hover:bg-primary/15 flex items-center justify-center transition-colors group-hover:scale-105">
                <ImagePlus className="w-6 h-6 text-primary/50 group-hover:text-primary transition-colors" />
              </div>
              <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors font-bold">اضغط أو اسحب صورة هنا</span>
              <span className="text-[10px] text-muted-foreground/40">PNG, JPG حتى 5MB</span>
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
