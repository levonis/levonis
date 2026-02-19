import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ArrowLeft, Gift, Users, Trophy, CheckCircle, Lock, Calendar, Star, Crown, ChevronLeft } from "lucide-react";
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

export default function MerchantGiveaways() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedGiveaway, setSelectedGiveaway] = useState<Giveaway | null>(null);

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
      toast.success("تم تسجيل مشاركتك بنجاح! 🎉");
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
      {/* Header */}
      <div className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b border-primary/10">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
              <Crown className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground">هدايا التجار</h1>
              <p className="text-[10px] text-muted-foreground">مقدمة من مجتمع ليفو</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <main className="flex-1 px-4 py-4 space-y-5">
        {/* Hero Banner */}
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-bl from-primary/15 via-card to-card border border-primary/15">
          <div className="absolute top-0 left-0 w-32 h-32 bg-primary/5 rounded-full -translate-x-10 -translate-y-10 blur-2xl" />
          <div className="absolute bottom-0 right-0 w-24 h-24 bg-primary/8 rounded-full translate-x-8 translate-y-8 blur-xl" />
          
          <div className="relative px-5 py-6 flex items-center gap-4">
            <div className="flex-1 space-y-2">
              <h2 className="text-base font-bold text-foreground leading-snug">اربح هدية مجانية<br/><span className="text-primary text-sm font-semibold">دعماً لمشروعك</span></h2>
              <p className="text-[11px] text-muted-foreground leading-relaxed max-w-[200px]">
                شارك واحصل على فرصة الفوز بمنتجات مميزة من مجتمع ليفو
              </p>
              {!isVerifiedMerchant && user && (
                <div className="inline-flex items-center gap-1.5 text-[10px] text-primary/80 bg-primary/8 border border-primary/15 rounded-full px-3 py-1">
                  <Lock className="h-2.5 w-2.5" />
                  للتجار الموثقين فقط
                </div>
              )}
              {!user && (
                <Button size="sm" className="h-7 text-[11px] rounded-full px-4 mt-1" onClick={() => navigate("/auth")}>
                  سجّل دخولك
                </Button>
              )}
            </div>
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/25 to-primary/5 border border-primary/20 flex items-center justify-center shrink-0">
              <Gift className="h-7 w-7 text-primary" />
            </div>
          </div>
        </div>

        {/* Compact Stats */}
        <div className="flex items-center gap-2 px-1">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-card/80 border border-border/30 rounded-full px-3 py-1.5">
            <Gift className="h-3 w-3 text-primary" />
            <span className="font-bold text-foreground">{activeGiveaways.length}</span> نشطة
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-card/80 border border-border/30 rounded-full px-3 py-1.5">
            <Users className="h-3 w-3 text-primary" />
            <span className="font-bold text-foreground">{entries?.length || 0}</span> مشاركة
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-card/80 border border-border/30 rounded-full px-3 py-1.5">
            <Trophy className="h-3 w-3 text-primary" />
            <span className="font-bold text-foreground">{completedGiveaways.length}</span> مكتملة
          </div>
        </div>

        {/* Active Giveaways */}
        {activeGiveaways.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-xs font-bold text-foreground flex items-center gap-2 px-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              الهدايا النشطة
            </h3>

            {activeGiveaways.map((g) => (
              <div
                key={g.id}
                className="rounded-xl border border-border/40 bg-card overflow-hidden hover:border-primary/25 transition-all cursor-pointer active:scale-[0.98]"
                onClick={() => setSelectedGiveaway(g)}
              >
                {/* Prize Image */}
                {g.prize_image_url ? (
                  <div className="relative h-36 overflow-hidden">
                    <img src={g.prize_image_url} alt={g.prize_name_ar} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />
                    <div className="absolute bottom-2.5 right-3 left-3 flex items-end justify-between">
                      <div>
                        <h4 className="font-bold text-sm text-foreground drop-shadow-sm">{g.title_ar}</h4>
                        <p className="text-[11px] text-foreground/80 drop-shadow-sm">{g.prize_name_ar}</p>
                      </div>
                      <Badge className="bg-primary/90 text-primary-foreground text-[10px] border-0 shrink-0">نشطة</Badge>
                    </div>
                  </div>
                ) : (
                  <div className="px-3.5 pt-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-sm text-foreground">{g.title_ar}</h4>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{g.prize_name_ar}</p>
                      </div>
                      <Badge className="bg-primary/90 text-primary-foreground text-[10px] border-0 shrink-0">نشطة</Badge>
                    </div>
                  </div>
                )}

                {/* Bottom Bar */}
                <div className="px-3.5 py-2.5 flex items-center justify-between border-t border-border/20">
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {getEntryCount(g.id)} مشارك
                    </span>
                    {g.draw_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(g.draw_date), "d MMM", { locale: ar })}
                      </span>
                    )}
                  </div>

                  {isVerifiedMerchant && !isParticipating(g.id) ? (
                    <Button
                      size="sm"
                      className="h-7 text-[10px] rounded-lg px-3 gap-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        participateMutation.mutate(g.id);
                      }}
                      disabled={participateMutation.isPending}
                    >
                      <Gift className="h-3 w-3" />
                      شارك
                    </Button>
                  ) : isParticipating(g.id) ? (
                    <span className="flex items-center gap-1 text-[10px] text-primary font-medium">
                      <CheckCircle className="h-3 w-3" />
                      مشارك
                    </span>
                  ) : (
                    <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Completed Giveaways */}
        {completedGiveaways.length > 0 && (
          <section className="space-y-2.5">
            <h3 className="text-xs font-bold text-muted-foreground flex items-center gap-2 px-1">
              <span className="w-1.5 h-1.5 rounded-full bg-border" />
              الهدايا السابقة
            </h3>

            {completedGiveaways.map((g) => (
              <div
                key={g.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-card/40 border border-border/20 opacity-50 hover:opacity-70 transition-opacity cursor-pointer"
                onClick={() => setSelectedGiveaway(g)}
              >
                {g.prize_image_url ? (
                  <img src={g.prize_image_url} alt="" className="w-9 h-9 rounded-lg object-cover ring-1 ring-border/30" />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-border/10 flex items-center justify-center">
                    <Gift className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{g.title_ar}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                      <Users className="h-2.5 w-2.5" />{getEntryCount(g.id)}
                    </span>
                    {g.winner_merchant_id && (
                      <span className="text-[10px] text-primary flex items-center gap-0.5 font-medium">
                        <Star className="h-2.5 w-2.5 fill-primary" />
                        {getWinnerName(g.id, g.winner_merchant_id)}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-[9px] text-muted-foreground border border-border/30 rounded px-1.5 py-0.5">منتهية</span>
              </div>
            ))}
          </section>
        )}

        {/* Empty State */}
        {!isLoading && (!giveaways || giveaways.length === 0) && (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-primary/8 border border-primary/15 flex items-center justify-center mx-auto mb-4">
              <Gift className="h-8 w-8 text-primary/40" />
            </div>
            <p className="text-foreground font-bold text-sm">لا توجد هدايا حالياً</p>
            <p className="text-[11px] text-muted-foreground mt-1.5 max-w-[180px] mx-auto">ترقب الهدايا القادمة من مجتمع ليفو</p>
          </div>
        )}
      </main>

      {/* Detail Dialog */}
      <Dialog open={!!selectedGiveaway} onOpenChange={(open) => !open && setSelectedGiveaway(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto p-0 gap-0" dir="rtl">
          {selectedGiveaway && (
            <>
              {/* Image or colored header */}
              {selectedGiveaway.prize_image_url ? (
                <div className="relative h-48 overflow-hidden">
                  <img src={selectedGiveaway.prize_image_url} alt={selectedGiveaway.prize_name_ar} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />
                  <Badge className={`absolute top-3 left-3 text-[10px] border-0 ${
                    selectedGiveaway.status === "active" ? "bg-primary text-primary-foreground" : "bg-card/80 text-muted-foreground backdrop-blur-sm"
                  }`}>
                    {selectedGiveaway.status === "active" ? "نشطة" : "منتهية"}
                  </Badge>
                </div>
              ) : (
                <div className="h-20 bg-gradient-to-bl from-primary/15 to-card relative">
                  <Badge className={`absolute top-3 left-3 text-[10px] border-0 ${
                    selectedGiveaway.status === "active" ? "bg-primary text-primary-foreground" : "bg-card/80 text-muted-foreground"
                  }`}>
                    {selectedGiveaway.status === "active" ? "نشطة" : "منتهية"}
                  </Badge>
                </div>
              )}

              <div className="px-5 pb-5 -mt-2 relative space-y-4">
                {/* Title */}
                <div>
                  <h3 className="text-base font-bold text-foreground">{selectedGiveaway.title_ar}</h3>
                  <p className="text-xs text-primary font-medium mt-0.5">{selectedGiveaway.prize_name_ar}</p>
                  {selectedGiveaway.description_ar && (
                    <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{selectedGiveaway.description_ar}</p>
                  )}
                </div>

                {/* Info Pills */}
                <div className="flex flex-wrap gap-2">
                  <div className="flex items-center gap-1.5 bg-primary/8 border border-primary/10 rounded-lg px-3 py-2">
                    <Users className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-bold text-foreground">{getEntryCount(selectedGiveaway.id)}</span>
                    <span className="text-[10px] text-muted-foreground">مشارك</span>
                  </div>
                  {selectedGiveaway.draw_date && (
                    <div className="flex items-center gap-1.5 bg-primary/8 border border-primary/10 rounded-lg px-3 py-2">
                      <Calendar className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-bold text-foreground">{format(new Date(selectedGiveaway.draw_date), "d MMM", { locale: ar })}</span>
                    </div>
                  )}
                  {selectedGiveaway.prize_value > 0 && (
                    <div className="flex items-center gap-1.5 bg-primary/8 border border-primary/10 rounded-lg px-3 py-2">
                      <Gift className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-bold text-foreground">{selectedGiveaway.prize_value} د.ع</span>
                    </div>
                  )}
                </div>

                {/* Winner Banner */}
                {selectedGiveaway.winner_merchant_id && (
                  <div className="rounded-xl bg-gradient-to-l from-primary/15 to-primary/5 border border-primary/20 p-3.5 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <Trophy className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">🏆 الفائز</p>
                      <p className="text-sm font-bold text-primary">{getWinnerName(selectedGiveaway.id, selectedGiveaway.winner_merchant_id)}</p>
                    </div>
                  </div>
                )}

                {/* Participants List */}
                {getGiveawayEntries(selectedGiveaway.id).length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold text-foreground mb-2">المشاركون</p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {getGiveawayEntries(selectedGiveaway.id).map((entry) => (
                        <div key={entry.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-primary/5 transition-colors">
                          {entry.merchant_store_image ? (
                            <img src={entry.merchant_store_image} alt="" className="w-6 h-6 rounded-full object-cover ring-1 ring-border/30" />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary">
                              {entry.merchant_name.charAt(0)}
                            </div>
                          )}
                          <span className="text-xs flex-1">{entry.merchant_name}</span>
                          {entry.merchant_id === selectedGiveaway.winner_merchant_id && (
                            <Star className="h-3 w-3 text-primary fill-primary" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* CTA */}
                {selectedGiveaway.status === "active" && isVerifiedMerchant && !isParticipating(selectedGiveaway.id) && (
                  <Button
                    className="w-full rounded-xl h-10 gap-2"
                    onClick={() => participateMutation.mutate(selectedGiveaway.id)}
                    disabled={participateMutation.isPending}
                  >
                    <Gift className="h-4 w-4" />
                    شارك الآن
                  </Button>
                )}
                {isParticipating(selectedGiveaway.id) && (
                  <div className="flex items-center justify-center gap-2 text-primary text-sm font-medium py-2.5 bg-primary/5 rounded-xl border border-primary/10">
                    <CheckCircle className="h-4 w-4" />
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
