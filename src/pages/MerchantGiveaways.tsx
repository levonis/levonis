import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Gift, Users, Trophy, Clock, CheckCircle, Lock, Crown, Calendar, Sparkles } from "lucide-react";
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

  // Check if user is a verified merchant
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

  // Fetch all giveaways
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

  // Fetch entries
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

  // Participate mutation
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
      <div className="sticky top-0 z-50 bg-card border-b shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg">
              <Gift className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground">هدايا التجار</h1>
              <p className="text-xs text-muted-foreground">اربح هدية مجانية من مجتمع ليفو</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <main className="flex-1 px-4 py-4 space-y-6">
        {/* Hero Banner */}
        <Card className="overflow-hidden border-0 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-primary/10">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg">
                <Crown className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-foreground mb-1">اربح هدية مجانية! 🎁</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  مقدمة من مجتمع ليفو دعماً لمشروعك. شارك الآن واحصل على فرصة الفوز بمنتجات مميزة.
                </p>
                {!isVerifiedMerchant && user && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-amber-600 bg-amber-500/10 rounded-lg p-2">
                    <Lock className="h-3.5 w-3.5" />
                    <span>المشاركة متاحة للتجار الموثقين فقط</span>
                  </div>
                )}
                {!user && (
                  <Button size="sm" className="mt-3" onClick={() => navigate("/auth")}>
                    سجّل دخولك للمشاركة
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Giveaways */}
        {activeGiveaways.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <h3 className="font-bold text-foreground">المسابقات النشطة</h3>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x">
              {activeGiveaways.map((g) => (
                <Card
                  key={g.id}
                  className="min-w-[280px] max-w-[320px] snap-start overflow-hidden border-primary/20 hover:border-primary/40 transition-all cursor-pointer"
                  onClick={() => setSelectedGiveaway(g)}
                >
                  {g.prize_image_url && (
                    <div className="aspect-[16/9] overflow-hidden">
                      <img src={g.prize_image_url} alt={g.prize_name_ar} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <CardContent className="p-4 space-y-3">
                    <div>
                      <h4 className="font-bold text-sm text-foreground line-clamp-1">{g.title_ar}</h4>
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{g.prize_name_ar}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Users className="h-3.5 w-3.5" />
                        <span>{getEntryCount(g.id)} مشارك</span>
                      </div>
                      <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-[10px]">
                        نشطة
                      </Badge>
                    </div>
                    {isVerifiedMerchant && !isParticipating(g.id) ? (
                      <Button
                        size="sm"
                        className="w-full text-xs bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          participateMutation.mutate(g.id);
                        }}
                        disabled={participateMutation.isPending}
                      >
                        <Gift className="h-3.5 w-3.5 ml-1" />
                        شارك الآن
                      </Button>
                    ) : isParticipating(g.id) ? (
                      <div className="flex items-center gap-1.5 text-xs text-green-600 justify-center py-1.5">
                        <CheckCircle className="h-3.5 w-3.5" />
                        <span>أنت مشارك</span>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Completed Giveaways */}
        {completedGiveaways.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-bold text-muted-foreground">المسابقات السابقة</h3>
            </div>
            <div className="space-y-2">
              {completedGiveaways.map((g) => (
                <Card
                  key={g.id}
                  className="opacity-70 hover:opacity-90 transition-opacity cursor-pointer border-border/50"
                  onClick={() => setSelectedGiveaway(g)}
                >
                  <CardContent className="p-3 flex items-center gap-3">
                    {g.prize_image_url ? (
                      <img src={g.prize_image_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                        <Gift className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm text-foreground line-clamp-1">{g.title_ar}</h4>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {getEntryCount(g.id)} مشارك
                        </span>
                        {g.winner_merchant_id && (
                          <span className="flex items-center gap-1 text-amber-600 font-medium">
                            <Trophy className="h-3 w-3" />
                            {getWinnerName(g.id, g.winner_merchant_id)}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[10px] shrink-0">منتهية</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Empty State */}
        {!isLoading && (!giveaways || giveaways.length === 0) && (
          <div className="text-center py-16">
            <Gift className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground font-medium">لا توجد هدايا حالياً</p>
            <p className="text-xs text-muted-foreground/70 mt-1">ترقب الهدايا القادمة من مجتمع ليفو</p>
          </div>
        )}
      </main>

      {/* Giveaway Details Dialog */}
      <Dialog open={!!selectedGiveaway} onOpenChange={(open) => !open && setSelectedGiveaway(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto" dir="rtl">
          {selectedGiveaway && (
            <>
              <DialogHeader>
                <DialogTitle className="text-right flex items-center gap-2">
                  <Gift className="h-5 w-5 text-amber-500" />
                  {selectedGiveaway.title_ar}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {selectedGiveaway.prize_image_url && (
                  <div className="rounded-xl overflow-hidden aspect-video">
                    <img
                      src={selectedGiveaway.prize_image_url}
                      alt={selectedGiveaway.prize_name_ar}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge className={selectedGiveaway.status === "active"
                      ? "bg-green-500/10 text-green-600 border-green-500/20"
                      : "bg-muted text-muted-foreground"
                    }>
                      {selectedGiveaway.status === "active" ? "نشطة" : "منتهية"}
                    </Badge>
                    {selectedGiveaway.prize_value > 0 && (
                      <Badge variant="outline" className="text-amber-600 border-amber-500/30">
                        قيمة الجائزة: {selectedGiveaway.prize_value} د.ع
                      </Badge>
                    )}
                  </div>

                  <h3 className="font-bold">{selectedGiveaway.prize_name_ar}</h3>
                  {selectedGiveaway.description_ar && (
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {selectedGiveaway.description_ar}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1.5 p-2 rounded-lg bg-muted/50">
                    <Users className="h-3.5 w-3.5 text-primary" />
                    <span>{getEntryCount(selectedGiveaway.id)} مشارك</span>
                  </div>
                  {selectedGiveaway.draw_date && (
                    <div className="flex items-center gap-1.5 p-2 rounded-lg bg-muted/50">
                      <Calendar className="h-3.5 w-3.5 text-primary" />
                      <span>{format(new Date(selectedGiveaway.draw_date), "d MMM yyyy", { locale: ar })}</span>
                    </div>
                  )}
                </div>

                {/* Winner announcement */}
                {selectedGiveaway.winner_merchant_id && (
                  <Card className="border-amber-500/30 bg-amber-500/5">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="p-2 rounded-full bg-amber-500/20">
                        <Trophy className="h-5 w-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">الفائز</p>
                        <p className="font-bold text-amber-600">
                          {getWinnerName(selectedGiveaway.id, selectedGiveaway.winner_merchant_id)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Participants list */}
                {getGiveawayEntries(selectedGiveaway.id).length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">المشاركون</h4>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {getGiveawayEntries(selectedGiveaway.id).map((entry) => (
                        <div key={entry.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                          {entry.merchant_store_image ? (
                            <img src={entry.merchant_store_image} alt="" className="w-7 h-7 rounded-full object-cover" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                              <Users className="h-3.5 w-3.5 text-primary" />
                            </div>
                          )}
                          <span className="text-sm font-medium">{entry.merchant_name}</span>
                          {entry.merchant_id === selectedGiveaway.winner_merchant_id && (
                            <Trophy className="h-3.5 w-3.5 text-amber-500 mr-auto" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action button */}
                {selectedGiveaway.status === "active" && isVerifiedMerchant && !isParticipating(selectedGiveaway.id) && (
                  <Button
                    className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white"
                    onClick={() => participateMutation.mutate(selectedGiveaway.id)}
                    disabled={participateMutation.isPending}
                  >
                    <Gift className="h-4 w-4 ml-2" />
                    شارك الآن
                  </Button>
                )}
                {isParticipating(selectedGiveaway.id) && (
                  <div className="flex items-center justify-center gap-2 text-green-600 py-2">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">أنت مشارك في هذه الهدية</span>
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
