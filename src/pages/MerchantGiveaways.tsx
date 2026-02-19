import { useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ArrowLeft, Gift, Users, Trophy, CheckCircle, Lock, Calendar, Star, Crown, ChevronLeft, Sparkles, PartyPopper } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import Footer from "@/components/Footer";

interface Giveaway {
  id: string;
  title_ar: string;
  description_ar: string | null;
  prize_name_ar: string;
  prize_image_url: string | null;
  prize_value: number;
  status: string;
  winner_merchant_id: string | null;
  max_participants: number | null;
  start_date: string;
  end_date: string | null;
  draw_date: string | null;
  created_at: string;
}

interface GiveawayEntry {
  id: string;
  giveaway_id: string;
  merchant_id: string;
  merchant_name: string;
  merchant_store_image: string | null;
  user_id: string;
  created_at: string;
}

// Confetti burst component
function ConfettiBurst({ active }: { active: boolean }) {
  if (!active) return null;
  const particles = Array.from({ length: 24 }, (_, i) => i);
  const colors = ["hsl(var(--primary))", "hsl(45 100% 60%)", "hsl(280 80% 65%)", "hsl(150 70% 50%)", "hsl(0 80% 60%)"];
  
  return (
    <div className="fixed inset-0 z-[100] pointer-events-none overflow-hidden">
      {particles.map((i) => {
        const angle = (i / particles.length) * 360;
        const distance = 80 + Math.random() * 200;
        const size = 4 + Math.random() * 8;
        const delay = Math.random() * 0.3;
        const color = colors[i % colors.length];
        const isCircle = Math.random() > 0.5;
        
        return (
          <div
            key={i}
            className="absolute left-1/2 top-1/2"
            style={{
              width: size,
              height: isCircle ? size : size * 2,
              backgroundColor: color,
              borderRadius: isCircle ? "50%" : "2px",
              animation: `confetti-burst 1s ease-out ${delay}s forwards`,
              transform: `translate(-50%, -50%)`,
              opacity: 0,
              ["--angle" as any]: `${angle}deg`,
              ["--distance" as any]: `${distance}px`,
            }}
          />
        );
      })}
      <style>{`
        @keyframes confetti-burst {
          0% { opacity: 1; transform: translate(-50%, -50%) rotate(0deg) translateY(0); }
          100% { opacity: 0; transform: translate(-50%, -50%) rotate(var(--angle)) translateY(calc(-1 * var(--distance))); }
        }
      `}</style>
    </div>
  );
}

// Success animation overlay
function ParticipationSuccess({ show, onDone }: { show: boolean; onDone: () => void }) {
  if (!show) return null;
  
  return (
    <div 
      className="fixed inset-0 z-[99] flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in"
      onClick={onDone}
    >
      <div className="text-center space-y-4 animate-scale-in">
        <div className="relative mx-auto w-24 h-24">
          <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" style={{ animationDuration: "1.5s" }} />
          <div className="relative h-24 w-24 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-2xl shadow-primary/40">
            <PartyPopper className="h-10 w-10 text-primary-foreground animate-bounce" />
          </div>
        </div>
        <div>
          <h3 className="text-xl font-black text-foreground">تم تسجيل مشاركتك! 🎉</h3>
          <p className="text-sm text-muted-foreground mt-1">بالتوفيق في السحب</p>
        </div>
        <Button variant="outline" size="sm" onClick={onDone} className="mt-2">
          حسناً
        </Button>
      </div>
    </div>
  );
}

export default function MerchantGiveaways() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedGiveaway, setSelectedGiveaway] = useState<Giveaway | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const { data: merchantApp } = useQuery({
    queryKey: ["my-merchant-app", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("merchant_applications")
        .select("id, display_name, store_image_url, is_verified, status")
        .eq("user_id", user.id)
        .eq("status", "approved")
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const isVerifiedMerchant = merchantApp?.is_verified === true;

  const { data: giveaways, isLoading } = useQuery({
    queryKey: ["merchant-giveaways"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_giveaways")
        .select("*")
        .in("status", ["active", "completed"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Giveaway[];
    },
  });

  const { data: entries } = useQuery({
    queryKey: ["giveaway-entries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_giveaway_entries")
        .select("*");
      if (error) throw error;
      return data as GiveawayEntry[];
    },
  });

  const triggerSuccess = useCallback(() => {
    setShowConfetti(true);
    setShowSuccess(true);
    setTimeout(() => setShowConfetti(false), 1500);
  }, []);

  const participateMutation = useMutation({
    mutationFn: async (giveawayId: string) => {
      if (!user || !merchantApp) throw new Error("يجب تسجيل الدخول كتاجر موثق");
      const { error } = await supabase.from("merchant_giveaway_entries").insert({
        giveaway_id: giveawayId,
        merchant_id: merchantApp.id,
        merchant_name: merchantApp.display_name || "تاجر",
        merchant_store_image: merchantApp.store_image_url,
        user_id: user.id,
      });
      if (error) {
        if (error.code === "23505") throw new Error("أنت مشارك بالفعل");
        throw error;
      }
    },
    onSuccess: () => {
      triggerSuccess();
      queryClient.invalidateQueries({ queryKey: ["giveaway-entries"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const activeGiveaways = giveaways?.filter((g) => g.status === "active") || [];
  const completedGiveaways = giveaways?.filter((g) => g.status === "completed") || [];

  const getEntryCount = (giveawayId: string) =>
    entries?.filter((e) => e.giveaway_id === giveawayId).length || 0;

  const isParticipating = (giveawayId: string) =>
    entries?.some((e) => e.giveaway_id === giveawayId && e.user_id === user?.id) || false;

  const getWinnerName = (giveawayId: string, winnerId: string | null) => {
    if (!winnerId) return null;
    const entry = entries?.find((e) => e.giveaway_id === giveawayId && e.merchant_id === winnerId);
    return entry?.merchant_name || "تاجر";
  };

  const getGiveawayEntries = (giveawayId: string) =>
    entries?.filter((e) => e.giveaway_id === giveawayId) || [];

  return (
    <div className="min-h-screen flex flex-col bg-background" dir="rtl">
      <ConfettiBurst active={showConfetti} />
      <ParticipationSuccess show={showSuccess} onDone={() => setShowSuccess(false)} />

      {/* Header */}
      <div className="sticky top-0 z-50 bg-card/95 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent p-[2px] shadow-lg shadow-primary/20">
              <div className="w-full h-full rounded-[10px] bg-card flex items-center justify-center">
                <Crown className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div>
              <h1 className="text-sm font-black text-foreground tracking-tight">هدايا التجار</h1>
              <p className="text-[10px] text-muted-foreground">مقدمة من مجتمع ليفو</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-xl hover:bg-accent" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <main className="flex-1 px-4 py-5 space-y-6">
        {/* Hero Banner */}
        <div className="relative rounded-2xl overflow-hidden border border-primary/20 bg-card">
          <div className="absolute inset-0 bg-gradient-to-bl from-primary/10 via-transparent to-accent/5" />
          <div className="absolute top-0 right-0 w-40 h-40 bg-primary/8 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
          
          <div className="relative px-5 py-7 flex items-center gap-4">
            <div className="flex-1 space-y-3">
              <div className="inline-flex items-center gap-1.5 text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 rounded-full px-3 py-1">
                <Sparkles className="h-3 w-3" />
                حصرياً للتجار الموثقين
              </div>
              <h2 className="text-lg font-black text-foreground leading-tight">
                اربح هدايا مجانية
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-[220px]">
                شارك واحصل على فرصة الفوز بمنتجات مميزة من مجتمع ليفو
              </p>
              {!user && (
                <Button size="sm" className="h-8 text-xs rounded-full px-5 gap-1.5" onClick={() => navigate("/auth")}>
                  سجّل دخولك
                </Button>
              )}
            </div>
            <div className="relative w-20 h-20 shrink-0">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/30 to-accent/20 blur-xl" />
              <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-xl">
                <Gift className="h-9 w-9 text-primary-foreground" />
              </div>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
          {[
            { icon: Gift, value: activeGiveaways.length, label: "نشطة", accent: true },
            { icon: Users, value: entries?.length || 0, label: "مشاركة" },
            { icon: Trophy, value: completedGiveaways.length, label: "مكتملة" },
          ].map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div
                key={i}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 border shrink-0 ${
                  stat.accent
                    ? "bg-primary/10 border-primary/20"
                    : "bg-card border-border/40"
                }`}
              >
                <Icon className={`h-4 w-4 ${stat.accent ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-sm font-black text-foreground">{stat.value}</span>
                <span className="text-[10px] text-muted-foreground">{stat.label}</span>
              </div>
            );
          })}
        </div>

        {/* Active Giveaways */}
        {activeGiveaways.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <h3 className="text-sm font-black text-foreground">الهدايا النشطة</h3>
            </div>

            <div className="space-y-4">
              {activeGiveaways.map((g) => {
                const participating = isParticipating(g.id);
                const entryCount = getEntryCount(g.id);
                
                return (
                  <div
                    key={g.id}
                    className="group rounded-2xl border border-border/40 bg-card overflow-hidden hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 cursor-pointer"
                    onClick={() => setSelectedGiveaway(g)}
                  >
                    {/* Prize Image */}
                    {g.prize_image_url ? (
                      <div className="relative h-44 overflow-hidden">
                        <img
                          src={g.prize_image_url}
                          alt={g.prize_name_ar}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />
                        <div className="absolute top-3 left-3">
                          <Badge className="bg-primary text-primary-foreground text-[10px] border-0 shadow-lg gap-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground animate-pulse" />
                            نشطة
                          </Badge>
                        </div>
                        <div className="absolute bottom-3 right-4 left-4">
                          <h4 className="font-black text-base text-foreground drop-shadow-sm">{g.title_ar}</h4>
                          <p className="text-xs text-foreground/80 mt-0.5 drop-shadow-sm">{g.prize_name_ar}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="relative px-4 pt-4 pb-3 bg-gradient-to-bl from-primary/8 to-transparent">
                        <Badge className="bg-primary text-primary-foreground text-[10px] border-0 shadow-lg gap-1 absolute top-3 left-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground animate-pulse" />
                          نشطة
                        </Badge>
                        <div className="pt-6">
                          <h4 className="font-black text-base text-foreground">{g.title_ar}</h4>
                          <p className="text-xs text-muted-foreground mt-0.5">{g.prize_name_ar}</p>
                        </div>
                      </div>
                    )}

                    {/* Bottom Action Bar */}
                    <div className="px-4 py-3 flex items-center justify-between border-t border-border/20">
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5" />
                          <span className="font-bold text-foreground">{entryCount}</span> مشارك
                        </span>
                        {g.draw_date && (
                          <span className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5" />
                            {format(new Date(g.draw_date), "d MMM", { locale: ar })}
                          </span>
                        )}
                      </div>

                      {isVerifiedMerchant && !participating ? (
                        <Button
                          size="sm"
                          className="h-9 text-xs rounded-xl px-5 gap-1.5 bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-md hover:shadow-lg transition-all active:scale-95"
                          onClick={(e) => {
                            e.stopPropagation();
                            participateMutation.mutate(g.id);
                          }}
                          disabled={participateMutation.isPending}
                        >
                          {participateMutation.isPending ? (
                            <div className="h-4 w-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                          ) : (
                            <>
                              <Gift className="h-3.5 w-3.5" />
                              شارك الآن
                            </>
                          )}
                        </Button>
                      ) : participating ? (
                        <div className="flex items-center gap-1.5 text-xs text-primary font-bold bg-primary/10 rounded-xl px-3 py-1.5">
                          <CheckCircle className="h-3.5 w-3.5" />
                          مشارك ✓
                        </div>
                      ) : !isVerifiedMerchant && user ? (
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Lock className="h-3 w-3" />
                          للموثقين
                        </div>
                      ) : (
                        <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Completed Giveaways */}
        {completedGiveaways.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-xs font-bold text-muted-foreground flex items-center gap-2 px-1">
              <div className="w-1.5 h-1.5 rounded-full bg-border" />
              الهدايا السابقة
            </h3>

            <div className="space-y-2">
              {completedGiveaways.map((g) => (
                <div
                  key={g.id}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card/60 border border-border/30 hover:bg-card transition-colors cursor-pointer"
                  onClick={() => setSelectedGiveaway(g)}
                >
                  {g.prize_image_url ? (
                    <img src={g.prize_image_url} alt="" className="w-10 h-10 rounded-xl object-cover ring-1 ring-border/30" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center">
                      <Gift className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">{g.title_ar}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <Users className="h-2.5 w-2.5" />{getEntryCount(g.id)}
                      </span>
                      {g.winner_merchant_id && (
                        <span className="text-[10px] text-primary flex items-center gap-0.5 font-bold">
                          <Star className="h-2.5 w-2.5 fill-primary" />
                          {getWinnerName(g.id, g.winner_merchant_id)}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[9px] border-border/40 text-muted-foreground">منتهية</Badge>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Empty State */}
        {!isLoading && (!giveaways || giveaways.length === 0) && (
          <div className="text-center py-20">
            <div className="relative w-20 h-20 mx-auto mb-5">
              <div className="absolute inset-0 rounded-2xl bg-primary/10 blur-xl" />
              <div className="relative w-20 h-20 rounded-2xl bg-card border border-primary/20 flex items-center justify-center">
                <Gift className="h-9 w-9 text-primary/40" />
              </div>
            </div>
            <p className="text-foreground font-black text-base">لا توجد هدايا حالياً</p>
            <p className="text-xs text-muted-foreground mt-2 max-w-[200px] mx-auto leading-relaxed">
              ترقب الهدايا القادمة من مجتمع ليفو
            </p>
          </div>
        )}
      </main>

      {/* Detail Dialog */}
      <Dialog open={!!selectedGiveaway} onOpenChange={(open) => !open && setSelectedGiveaway(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto p-0 gap-0" dir="rtl">
          {selectedGiveaway && (
            <>
              {selectedGiveaway.prize_image_url ? (
                <div className="relative h-52 overflow-hidden">
                  <img src={selectedGiveaway.prize_image_url} alt={selectedGiveaway.prize_name_ar} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
                  <Badge className={`absolute top-4 left-4 text-[10px] border-0 shadow-lg ${
                    selectedGiveaway.status === "active" ? "bg-primary text-primary-foreground" : "bg-card/90 text-muted-foreground backdrop-blur-sm"
                  }`}>
                    {selectedGiveaway.status === "active" ? "نشطة" : "منتهية"}
                  </Badge>
                </div>
              ) : (
                <div className="h-24 bg-gradient-to-bl from-primary/15 to-card relative">
                  <Badge className={`absolute top-4 left-4 text-[10px] border-0 ${
                    selectedGiveaway.status === "active" ? "bg-primary text-primary-foreground" : "bg-card/90 text-muted-foreground"
                  }`}>
                    {selectedGiveaway.status === "active" ? "نشطة" : "منتهية"}
                  </Badge>
                </div>
              )}

              <div className="px-5 pb-6 -mt-2 relative space-y-5">
                <div>
                  <h3 className="text-lg font-black text-foreground">{selectedGiveaway.title_ar}</h3>
                  <p className="text-sm text-primary font-bold mt-1">{selectedGiveaway.prize_name_ar}</p>
                  {selectedGiveaway.description_ar && (
                    <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{selectedGiveaway.description_ar}</p>
                  )}
                </div>

                {/* Info Pills */}
                <div className="flex flex-wrap gap-2">
                  <div className="flex items-center gap-2 bg-primary/8 border border-primary/15 rounded-xl px-4 py-2.5">
                    <Users className="h-4 w-4 text-primary" />
                    <span className="text-sm font-black text-foreground">{getEntryCount(selectedGiveaway.id)}</span>
                    <span className="text-[10px] text-muted-foreground">مشارك</span>
                  </div>
                  {selectedGiveaway.draw_date && (
                    <div className="flex items-center gap-2 bg-primary/8 border border-primary/15 rounded-xl px-4 py-2.5">
                      <Calendar className="h-4 w-4 text-primary" />
                      <span className="text-sm font-black text-foreground">{format(new Date(selectedGiveaway.draw_date), "d MMM", { locale: ar })}</span>
                    </div>
                  )}
                  {selectedGiveaway.prize_value > 0 && (
                    <div className="flex items-center gap-2 bg-primary/8 border border-primary/15 rounded-xl px-4 py-2.5">
                      <Gift className="h-4 w-4 text-primary" />
                      <span className="text-sm font-black text-foreground">{selectedGiveaway.prize_value.toLocaleString()} د.ع</span>
                    </div>
                  )}
                </div>

                {/* Winner Banner */}
                {selectedGiveaway.winner_merchant_id && (
                  <div className="rounded-xl bg-gradient-to-l from-primary/15 to-primary/5 border border-primary/25 p-4 flex items-center gap-4">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0 shadow-lg shadow-primary/30">
                      <Trophy className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground font-medium">🏆 الفائز</p>
                      <p className="text-base font-black text-primary">{getWinnerName(selectedGiveaway.id, selectedGiveaway.winner_merchant_id)}</p>
                    </div>
                  </div>
                )}

                {/* Participants */}
                {getGiveawayEntries(selectedGiveaway.id).length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-foreground mb-3">المشاركون</p>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {getGiveawayEntries(selectedGiveaway.id).map((entry) => (
                        <div key={entry.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-accent/50 transition-colors">
                          {entry.merchant_store_image ? (
                            <img src={entry.merchant_store_image} alt="" className="w-7 h-7 rounded-full object-cover ring-1 ring-border/30" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary">
                              {entry.merchant_name.charAt(0)}
                            </div>
                          )}
                          <span className="text-xs font-medium flex-1">{entry.merchant_name}</span>
                          {entry.merchant_id === selectedGiveaway.winner_merchant_id && (
                            <Star className="h-3.5 w-3.5 text-primary fill-primary" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* CTA */}
                {selectedGiveaway.status === "active" && isVerifiedMerchant && !isParticipating(selectedGiveaway.id) && (
                  <Button
                    className="w-full rounded-xl h-12 gap-2.5 text-sm font-black bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-xl shadow-primary/25 hover:shadow-2xl transition-all active:scale-[0.98]"
                    onClick={() => participateMutation.mutate(selectedGiveaway.id)}
                    disabled={participateMutation.isPending}
                  >
                    {participateMutation.isPending ? (
                      <div className="h-5 w-5 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                    ) : (
                      <>
                        <Gift className="h-5 w-5" />
                        شارك الآن
                      </>
                    )}
                  </Button>
                )}
                {isParticipating(selectedGiveaway.id) && (
                  <div className="flex items-center justify-center gap-2.5 text-primary text-sm font-black py-3 bg-primary/8 rounded-xl border border-primary/15">
                    <CheckCircle className="h-5 w-5" />
                    أنت مشارك في هذه الهدية
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}
