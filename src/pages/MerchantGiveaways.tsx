import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Gift, Users, Trophy, CheckCircle, Lock, Calendar, Sparkles, Star, Award } from "lucide-react";
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
      <div className="sticky top-0 z-50 bg-card/95 backdrop-blur-lg border-b border-border/40">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
              <Gift className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground">هدايا التجار</h1>
              <p className="text-[11px] text-muted-foreground">مقدمة من مجتمع ليفو</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-xl hover:bg-card" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <main className="flex-1 px-4 py-5 space-y-6">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-card">
          {/* Decorative pattern */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute top-4 right-4 w-32 h-32 rounded-full border-2 border-primary" />
            <div className="absolute bottom-4 left-4 w-24 h-24 rounded-full border border-primary" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full border border-primary/50" />
          </div>
          
          <div className="relative p-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center mx-auto">
              <Award className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">اربح هدية مجانية</h2>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-xs mx-auto">
                مقدمة من مجتمع ليفو دعماً لمشروعك. شارك واحصل على فرصة الفوز بمنتجات مميزة
              </p>
            </div>
            
            {!isVerifiedMerchant && user && (
              <div className="inline-flex items-center gap-2 text-xs text-primary bg-primary/10 border border-primary/20 rounded-full px-4 py-2">
                <Lock className="h-3 w-3" />
                <span>للتجار الموثقين فقط</span>
              </div>
            )}
            {!user && (
              <Button size="sm" className="rounded-full px-6" onClick={() => navigate("/auth")}>
                سجّل دخولك للمشاركة
              </Button>
            )}
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-card rounded-xl border border-border/50 p-3 text-center">
            <Sparkles className="h-4 w-4 text-primary mx-auto mb-1" />
            <p className="text-lg font-bold text-foreground">{activeGiveaways.length}</p>
            <p className="text-[10px] text-muted-foreground">نشطة</p>
          </div>
          <div className="bg-card rounded-xl border border-border/50 p-3 text-center">
            <Users className="h-4 w-4 text-primary mx-auto mb-1" />
            <p className="text-lg font-bold text-foreground">{entries?.length || 0}</p>
            <p className="text-[10px] text-muted-foreground">مشاركة</p>
          </div>
          <div className="bg-card rounded-xl border border-border/50 p-3 text-center">
            <Trophy className="h-4 w-4 text-primary mx-auto mb-1" />
            <p className="text-lg font-bold text-foreground">{completedGiveaways.length}</p>
            <p className="text-[10px] text-muted-foreground">مكتملة</p>
          </div>
        </div>

        {/* Active Giveaways */}
        {activeGiveaways.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 rounded-full bg-primary" />
              <h3 className="font-bold text-foreground text-sm">الهدايا النشطة</h3>
            </div>
            <div className="space-y-3">
              {activeGiveaways.map((g) => (
                <Card
                  key={g.id}
                  className="overflow-hidden border-border/50 hover:border-primary/30 transition-all cursor-pointer group"
                  onClick={() => setSelectedGiveaway(g)}
                >
                  <div className="flex">
                    {/* Image */}
                    <div className="w-28 shrink-0 bg-card">
                      {g.prize_image_url ? (
                        <img src={g.prize_image_url} alt={g.prize_name_ar} className="w-full h-full object-cover min-h-[110px]" />
                      ) : (
                        <div className="w-full h-full min-h-[110px] flex items-center justify-center bg-primary/5">
                          <Gift className="h-8 w-8 text-primary/40" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <CardContent className="flex-1 p-3.5 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <h4 className="font-bold text-sm text-foreground line-clamp-1 group-hover:text-primary transition-colors">{g.title_ar}</h4>
                          <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] shrink-0">نشطة</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1">{g.prize_name_ar}</p>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3 text-primary/70" />
                            {getEntryCount(g.id)}
                          </span>
                          {g.draw_date && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-primary/70" />
                              {format(new Date(g.draw_date), "d MMM", { locale: ar })}
                            </span>
                          )}
                        </div>

                        {isVerifiedMerchant && !isParticipating(g.id) ? (
                          <Button
                            size="sm"
                            className="h-7 text-[11px] rounded-lg px-3"
                            onClick={(e) => {
                              e.stopPropagation();
                              participateMutation.mutate(g.id);
                            }}
                            disabled={participateMutation.isPending}
                          >
                            شارك الآن
                          </Button>
                        ) : isParticipating(g.id) ? (
                          <span className="flex items-center gap-1 text-[11px] text-primary">
                            <CheckCircle className="h-3.5 w-3.5" />
                            مشارك
                          </span>
                        ) : null}
                      </div>
                    </CardContent>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Completed Giveaways */}
        {completedGiveaways.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 rounded-full bg-border" />
              <h3 className="font-bold text-muted-foreground text-sm">الهدايا السابقة</h3>
            </div>
            <div className="space-y-2">
              {completedGiveaways.map((g) => (
                <div
                  key={g.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-card/50 border border-border/30 opacity-60 hover:opacity-80 transition-all cursor-pointer"
                  onClick={() => setSelectedGiveaway(g)}
                >
                  {g.prize_image_url ? (
                    <img src={g.prize_image_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-primary/5 flex items-center justify-center">
                      <Gift className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-foreground line-clamp-1">{g.title_ar}</h4>
                    <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{getEntryCount(g.id)}</span>
                      {g.winner_merchant_id && (
                        <span className="flex items-center gap-1 text-primary font-medium">
                          <Star className="h-3 w-3" />
                          {getWinnerName(g.id, g.winner_merchant_id)}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] border-border/50 text-muted-foreground shrink-0">منتهية</Badge>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Empty State */}
        {!isLoading && (!giveaways || giveaways.length === 0) && (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-5">
              <Gift className="h-10 w-10 text-primary/50" />
            </div>
            <p className="text-foreground font-bold text-base">لا توجد هدايا حالياً</p>
            <p className="text-xs text-muted-foreground mt-2 max-w-[200px] mx-auto">ترقب الهدايا القادمة من مجتمع ليفو لدعم مشروعك</p>
          </div>
        )}
      </main>

      {/* Giveaway Details Dialog */}
      <Dialog open={!!selectedGiveaway} onOpenChange={(open) => !open && setSelectedGiveaway(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto p-0" dir="rtl">
          {selectedGiveaway && (
            <div>
              {/* Dialog Image Header */}
              {selectedGiveaway.prize_image_url ? (
                <div className="relative aspect-[16/10] overflow-hidden">
                  <img
                    src={selectedGiveaway.prize_image_url}
                    alt={selectedGiveaway.prize_name_ar}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
                  <div className="absolute bottom-3 right-4 left-4">
                    <Badge className={selectedGiveaway.status === "active"
                      ? "bg-primary/20 text-primary border-primary/30 backdrop-blur-sm"
                      : "bg-card/60 text-muted-foreground backdrop-blur-sm"
                    }>
                      {selectedGiveaway.status === "active" ? "نشطة" : "منتهية"}
                    </Badge>
                  </div>
                </div>
              ) : (
                <div className="h-6" />
              )}

              {/* Dialog Content */}
              <div className="p-5 space-y-5">
                {!selectedGiveaway.prize_image_url && (
                  <DialogHeader>
                    <DialogTitle className="text-right">{selectedGiveaway.title_ar}</DialogTitle>
                  </DialogHeader>
                )}

                <div>
                  {selectedGiveaway.prize_image_url && (
                    <h3 className="text-lg font-bold text-foreground mb-1">{selectedGiveaway.title_ar}</h3>
                  )}
                  <p className="text-sm text-primary font-medium">{selectedGiveaway.prize_name_ar}</p>
                  {selectedGiveaway.description_ar && (
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{selectedGiveaway.description_ar}</p>
                  )}
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/5 border border-primary/10">
                    <Users className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-sm font-bold text-foreground">{getEntryCount(selectedGiveaway.id)}</p>
                      <p className="text-[10px] text-muted-foreground">مشارك</p>
                    </div>
                  </div>
                  {selectedGiveaway.draw_date && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/5 border border-primary/10">
                      <Calendar className="h-4 w-4 text-primary" />
                      <div>
                        <p className="text-sm font-bold text-foreground">
                          {format(new Date(selectedGiveaway.draw_date), "d MMM", { locale: ar })}
                        </p>
                        <p className="text-[10px] text-muted-foreground">تاريخ السحب</p>
                      </div>
                    </div>
                  )}
                  {selectedGiveaway.prize_value > 0 && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/5 border border-primary/10 col-span-2">
                      <Gift className="h-4 w-4 text-primary" />
                      <div>
                        <p className="text-sm font-bold text-foreground">{selectedGiveaway.prize_value} د.ع</p>
                        <p className="text-[10px] text-muted-foreground">قيمة الجائزة</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Winner */}
                {selectedGiveaway.winner_merchant_id && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
                      <Trophy className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground">الفائز</p>
                      <p className="font-bold text-primary">
                        {getWinnerName(selectedGiveaway.id, selectedGiveaway.winner_merchant_id)}
                      </p>
                    </div>
                  </div>
                )}

                {/* Participants */}
                {getGiveawayEntries(selectedGiveaway.id).length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-primary" />
                      المشاركون ({getGiveawayEntries(selectedGiveaway.id).length})
                    </h4>
                    <div className="space-y-1 max-h-36 overflow-y-auto rounded-xl border border-border/30 p-2">
                      {getGiveawayEntries(selectedGiveaway.id).map((entry) => (
                        <div key={entry.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-card/50 transition-colors">
                          {entry.merchant_store_image ? (
                            <img src={entry.merchant_store_image} alt="" className="w-7 h-7 rounded-full object-cover ring-1 ring-border" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                              <Users className="h-3 w-3 text-primary" />
                            </div>
                          )}
                          <span className="text-sm font-medium flex-1">{entry.merchant_name}</span>
                          {entry.merchant_id === selectedGiveaway.winner_merchant_id && (
                            <Star className="h-3.5 w-3.5 text-primary" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action */}
                {selectedGiveaway.status === "active" && isVerifiedMerchant && !isParticipating(selectedGiveaway.id) && (
                  <Button
                    className="w-full rounded-xl h-11"
                    onClick={() => participateMutation.mutate(selectedGiveaway.id)}
                    disabled={participateMutation.isPending}
                  >
                    <Gift className="h-4 w-4 ml-2" />
                    شارك الآن
                  </Button>
                )}
                {isParticipating(selectedGiveaway.id) && (
                  <div className="flex items-center justify-center gap-2 text-primary py-2 bg-primary/5 rounded-xl border border-primary/10">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">أنت مشارك في هذه الهدية</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}
