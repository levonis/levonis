import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Heart, Sparkles, Star, Pencil, Loader2, BadgeCheck, ImagePlus, X, Camera, Flame, TrendingUp, Gift, Truck, Award, Coins, CheckCircle2, User } from "lucide-react";
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
      
      // Fetch profiles for all wish owners
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map((w: any) => w.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, username, avatar_url")
          .in("id", userIds);
        
        const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
        return data.map((w: any) => ({ ...w, profile: profileMap.get(w.user_id) || null }));
      }
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
      // Check for duplicate wish title
      const { data: existing } = await supabase
        .from("wishes")
        .select("id, title")
        .neq("status", "rejected")
        .ilike("title", title.trim());
      
      if (existing && existing.length > 0) {
        throw new Error("DUPLICATE");
      }

      const imgUrl = await uploadImage();
      const { error } = await supabase.from("wishes").insert({
        user_id: user!.id,
        title: title.trim(),
        description: description.trim() || null,
        image_url: imgUrl,
      });
      if (error) {
        if (error.message?.includes("wishes_unique_title_idx")) {
          throw new Error("DUPLICATE");
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-wish"] });
      queryClient.invalidateQueries({ queryKey: ["wishes-approved"] });
      setDialogOpen(false);
      resetForm();
      toast.success("تم إرسال أمنيتك بنجاح! سيتم مراجعتها قريباً ✨");
    },
    onError: (err: any) => {
      if (err.message === "DUPLICATE") {
        toast.error("هذه الأمنية موجودة بالفعل! كل أمنية من نصيب شخص واحد فقط 🎯");
      } else {
        toast.error("حدث خطأ، حاول مرة أخرى");
      }
    },
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
  const isFulfilled = (w: any) => w.status === 'fulfilled' || w.fulfilled_at;

  return (
    <div className="min-h-screen bg-background">
      {/* ═══ HERO SECTION ═══ */}
      <div className="relative pt-20 pb-8 overflow-hidden">
        <div className="absolute top-10 right-10 w-64 h-64 bg-primary/8 rounded-full blur-[100px] animate-pulse-slow" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent/10 rounded-full blur-[80px] animate-pulse-slow" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-32 bg-primary/5 rounded-full blur-[120px]" />

        <div className="container mx-auto px-4 max-w-3xl relative z-10" dir="rtl">
          <div className="absolute top-4 right-8 text-primary/30 animate-bounce" style={{ animationDuration: '3s' }}>✦</div>
          <div className="absolute top-12 left-12 text-accent/20 animate-bounce" style={{ animationDuration: '4s', animationDelay: '1s' }}>✧</div>
          <div className="absolute bottom-4 right-1/3 text-primary/20 animate-bounce" style={{ animationDuration: '3.5s', animationDelay: '0.5s' }}>✦</div>

          <div className="text-center wish-hero-animate">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/20 mb-4 wish-float">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>

            <h1 className="text-4xl md:text-5xl font-black text-gradient-gold mb-3 tracking-tight">
              الأمنيات
            </h1>
            <p className="text-muted-foreground text-sm md:text-base max-w-sm mx-auto leading-relaxed mb-4">
              تمنّى منتجاً ترغب بتوفره وسنعمل على تحقيقه
            </p>

            {/* Rewards info banner */}
            <div className="max-w-md mx-auto mb-4 p-3 rounded-2xl bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/10">
              <p className="text-[11px] font-bold text-primary mb-2">🎉 صاحب الأمنية التي يتم توفيرها سيحصل على:</p>
              <div className="grid grid-cols-2 gap-1.5">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Gift className="w-3 h-3 text-pink-400 shrink-0" />
                  <span>هدية عشوائية مجانية 🎁</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Award className="w-3 h-3 text-yellow-400 shrink-0" />
                  <span>خصم كبير ومميز 💸</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Truck className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span>توصيل مجاني 🚚</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Coins className="w-3 h-3 text-orange-400 shrink-0" />
                  <span>نقاط إضافية ⭐</span>
                </div>
              </div>
            </div>

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
              <div className="absolute -inset-[1px] bg-gradient-to-r from-primary via-accent to-primary bg-[length:300%_100%] rounded-2xl animate-shimmer opacity-60" />
              <div className="relative bg-card rounded-[15px] p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-primary/15 flex items-center justify-center">
                      <Star className="w-3.5 h-3.5 text-primary fill-primary" />
                    </div>
                    <span className="text-xs font-black text-primary">أمنيتك</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={myWish.status} fulfilled={!!myWish.fulfilled_at} />
                    {myWish.status === "pending" && (
                      <button onClick={openEdit} className="w-7 h-7 rounded-lg bg-muted/30 hover:bg-primary/15 flex items-center justify-center text-muted-foreground hover:text-primary transition-all">
                        <Pencil className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

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

                {/* Show rewards if fulfilled */}
                {myWish.fulfilled_at && (
                  <div className="mt-3 p-2.5 rounded-xl bg-gradient-to-r from-emerald-500/10 to-primary/10 border border-emerald-500/20">
                    <p className="text-[11px] font-bold text-emerald-400 mb-1.5 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> تم تحقيق أمنيتك! مكافآتك:
                    </p>
                    <div className="grid grid-cols-2 gap-1">
                      {myWish.reward_gift_description && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Gift className="w-3 h-3 text-pink-400" /> {myWish.reward_gift_description}
                        </span>
                      )}
                      {myWish.reward_discount_percent > 0 && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Award className="w-3 h-3 text-yellow-400" /> خصم {myWish.reward_discount_percent}%
                        </span>
                      )}
                      {myWish.reward_free_shipping && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Truck className="w-3 h-3 text-emerald-400" /> توصيل مجاني
                        </span>
                      )}
                      {myWish.reward_bonus_points > 0 && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Coins className="w-3 h-3 text-orange-400" /> +{myWish.reward_bonus_points} نقطة
                        </span>
                      )}
                    </div>
                  </div>
                )}
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

      <style>{`
        .wish-hero-animate { animation: wishHeroIn 0.7s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .wish-card-animate { animation: wishCardIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; animation-delay: var(--delay, 0s); }
        .wish-float { animation: wishFloat 4s ease-in-out infinite; }
        
        .wish-glass-card {
          transform-style: preserve-3d;
          will-change: transform;
          box-shadow: 
            0 4px 24px -4px rgba(0,0,0,0.12),
            0 8px 48px -8px rgba(0,0,0,0.08);
        }
        .wish-glass-card:hover {
          box-shadow: 
            0 8px 32px -4px rgba(0,0,0,0.18),
            0 16px 64px -8px rgba(0,0,0,0.1);
        }
        .wish-glass-top {
          box-shadow: 
            0 4px 24px -4px hsl(var(--primary) / 0.15),
            0 12px 48px -8px hsl(var(--primary) / 0.08);
        }
        .wish-glass-top:hover {
          box-shadow: 
            0 8px 32px -4px hsl(var(--primary) / 0.2),
            0 20px 64px -8px hsl(var(--primary) / 0.12);
        }

        @keyframes wishHeroIn {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes wishCardIn {
          from { opacity: 0; transform: translateY(16px) rotateX(4deg); }
          to { opacity: 1; transform: translateY(0) rotateX(0deg); }
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
function StatusBadge({ status, fulfilled }: { status: string; fulfilled?: boolean }) {
  if (fulfilled) return (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-gradient-to-r from-emerald-500/15 to-primary/15 text-emerald-400 font-bold border border-emerald-500/20">
      <CheckCircle2 className="w-3 h-3" /> تم تحقيقها 🎉
    </span>
  );
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
  const [pressed, setPressed] = useState(false);
  const isFulfilled = !!wish.fulfilled_at;

  const handleLike = () => {
    if (!canLike) return;
    setAnimateLike(true);
    setTimeout(() => setAnimateLike(false), 400);
    onLike();
  };

  const profile = wish.profile;

  return (
    <div
      className="wish-card-animate"
      style={{
        '--delay': `${0.3 + index * 0.06}s`,
        perspective: '800px',
      } as any}
    >
      <div
        className={`wish-glass-card group relative rounded-2xl overflow-hidden transition-all duration-500 ${
          pressed ? 'scale-[0.97]' : 'hover:scale-[1.02]'
        } ${isTop ? 'wish-glass-top' : ''}`}
        onTouchStart={() => setPressed(true)}
        onTouchEnd={() => setPressed(false)}
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => setPressed(false)}
        onMouseLeave={() => setPressed(false)}
      >
        <div className="absolute inset-0 bg-card/40 backdrop-blur-xl" />
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] to-transparent" />
        {isTop && <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.06] to-transparent" />}
        {isFulfilled && <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.04] to-transparent" />}
        
        <div className={`absolute inset-0 rounded-2xl border transition-colors duration-500 ${
          isFulfilled
            ? 'border-emerald-500/25'
            : isTop
            ? 'border-primary/25 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]'
            : 'border-white/[0.08] group-hover:border-primary/20 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]'
        }`} />

        <div className="relative z-10">
          {/* Image */}
          <div className="relative aspect-[4/3] overflow-hidden m-1.5 rounded-xl">
            {wish.image_url ? (
              <img
                src={wish.image_url}
                alt={wish.title}
                className="w-full h-full object-cover group-hover:scale-[1.06] transition-transform duration-700 ease-out"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/5 to-accent/5 flex items-center justify-center">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 backdrop-blur-sm flex items-center justify-center border border-primary/10">
                  <Sparkles className="w-7 h-7 text-primary/30" />
                </div>
              </div>
            )}

            {/* Top badge */}
            {isFulfilled ? (
              <div className="absolute top-1.5 right-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/90 backdrop-blur-sm text-white text-[9px] font-black flex items-center gap-1 shadow-lg">
                <CheckCircle2 className="w-3 h-3" /> تم التوفير ✨
              </div>
            ) : isTop ? (
              <div className="absolute top-1.5 right-1.5 px-2.5 py-1 rounded-lg bg-primary/90 backdrop-blur-sm text-primary-foreground text-[9px] font-black flex items-center gap-1 shadow-lg shadow-primary/30">
                <Flame className="w-3 h-3" /> الأكثر طلباً
              </div>
            ) : null}

            {/* Like button */}
            <button
              onClick={handleLike}
              disabled={!canLike}
              className={`absolute top-1.5 left-1.5 w-8 h-8 rounded-xl backdrop-blur-xl flex items-center justify-center transition-all duration-300 border ${
                isLiked
                  ? "bg-destructive/70 text-white border-destructive/30 shadow-lg shadow-destructive/25"
                  : "bg-black/20 text-white/80 border-white/10 hover:bg-black/30 hover:border-white/20"
              } ${animateLike ? "wish-heart-pop" : ""}`}
            >
              <Heart className={`w-3.5 h-3.5 transition-all ${isLiked ? "fill-current scale-110" : ""}`} />
            </button>

            {/* Price */}
            {wish.price && (
              <div className="absolute bottom-1.5 right-1.5 px-2.5 py-1 rounded-lg bg-black/40 backdrop-blur-xl border border-white/10">
                <span className="text-[11px] font-black text-white">
                  {Number(wish.price).toLocaleString()} <span className="text-[9px] opacity-70">د.ع</span>
                </span>
              </div>
            )}
          </div>

          {/* Text content */}
          <div className="px-3 pt-1 pb-3">
            <h3 className="font-bold text-[12px] leading-snug line-clamp-2 mb-1.5 text-foreground">{wish.title}</h3>
            
            {/* Owner identity */}
            {profile && (
              <div className="flex items-center gap-1.5 mb-2">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-4 h-4 rounded-full object-cover border border-border/30" />
                ) : (
                  <div className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-2.5 h-2.5 text-primary/50" />
                  </div>
                )}
                <span className="text-[10px] text-muted-foreground font-medium truncate">
                  {profile.full_name || profile.username || 'مستخدم'}
                </span>
              </div>
            )}

            {/* Fulfilled rewards preview */}
            {isFulfilled && (
              <div className="flex flex-wrap gap-1 mb-2">
                <span className="text-[8px] px-1.5 py-0.5 rounded bg-pink-500/10 text-pink-400 font-bold">🎁 هدية</span>
                <span className="text-[8px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 font-bold">💸 خصم</span>
                <span className="text-[8px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold">🚚 مجاني</span>
                <span className="text-[8px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 font-bold">⭐ نقاط</span>
              </div>
            )}
            
            {/* Bottom row */}
            <div className="flex items-center justify-between">
              <button
                onClick={handleLike}
                disabled={!canLike}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all duration-300 ${
                  isLiked
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
                }`}
              >
                <Heart className={`w-3 h-3 ${isLiked ? "fill-current" : ""} ${animateLike ? "wish-heart-pop" : ""}`} />
                <span className="text-[10px] font-bold">{wish.likes_count || 0}</span>
              </button>
              <span className="text-[9px] text-muted-foreground/40 font-medium">
                {new Date(wish.created_at).toLocaleDateString("ar-IQ")}
              </span>
            </div>
          </div>
        </div>

        <div className={`absolute -inset-1 -z-10 rounded-3xl blur-xl transition-opacity duration-500 ${
          isFulfilled
            ? 'bg-emerald-500/10 opacity-100'
            : isTop
            ? 'bg-primary/10 opacity-100'
            : 'bg-foreground/5 opacity-0 group-hover:opacity-100'
        }`} />
      </div>
    </div>
  );
}

/* ═══════════════ Skeleton ═══════════════ */
function WishSkeleton({ index }: { index: number }) {
  return (
    <div
      className="wish-card-animate"
      style={{ '--delay': `${0.1 + index * 0.06}s`, perspective: '800px' } as any}
    >
      <div className="relative rounded-2xl overflow-hidden">
        <div className="absolute inset-0 bg-card/40 backdrop-blur-xl" />
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.06] to-transparent" />
        <div className="absolute inset-0 rounded-2xl border border-white/[0.06]" />
        <div className="relative z-10">
          <div className="aspect-[4/3] m-1.5 rounded-xl bg-muted/10 animate-pulse" />
          <div className="px-3 pt-1 pb-3 space-y-2">
            <div className="h-3.5 w-4/5 bg-muted/10 rounded-lg animate-pulse" />
            <div className="flex justify-between items-center">
              <div className="h-6 w-14 bg-muted/8 rounded-lg animate-pulse" />
              <div className="h-2.5 w-10 bg-muted/6 rounded animate-pulse" />
            </div>
          </div>
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
        {/* Unique wish notice */}
        {!editMode && (
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 font-medium flex items-start gap-2">
            <Star className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
            <span>كل أمنية فريدة! إذا كان شخص آخر قد تمنّى نفس المنتج فلن تتمكن من إضافته. الأمنية من نصيب أول شخص فقط 🎯</span>
          </div>
        )}

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
