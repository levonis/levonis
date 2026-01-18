import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import OptimizedImage from "@/components/OptimizedImage";
import { useState } from "react";
import { 
  X, Ticket, Trophy, Gift, Users, Calendar, Crown, 
  Zap, Sparkles, Package, Swords, TrendingUp, Timer, Loader2,
  ChevronDown, ChevronUp
} from "lucide-react";
import { toast } from "sonner";
import { format, addHours } from "date-fns";
import { ar } from "date-fns/locale";
import CountdownTimer from "@/components/CountdownTimer";

type CompetitionType = 'ticket_count' | 'all_tickets_sold' | 'timed' | 'free' | 'instant_winner' | 'everyone_wins' | 'escalating_price' | 'mystery_box' | 'hidden_winner' | 'team_battle' | 'flash_sale' | 'growing_prize' | 'collect_letters';

const competitionTypeLabels: Record<CompetitionType, string> = {
  ticket_count: 'سحب عادي',
  all_tickets_sold: 'حتى نفاذ التذاكر',
  timed: 'محدد بوقت',
  free: 'مجاني',
  instant_winner: 'نتيجة فورية',
  everyone_wins: 'الكل رابح',
  escalating_price: 'سعر متصاعد',
  mystery_box: 'صندوق غامض',
  hidden_winner: 'رابح مخفي',
  team_battle: 'فريق ضد فريق',
  flash_sale: 'عرض سريع',
  growing_prize: 'جائزة متحولة',
  collect_letters: 'جمع الأحرف'
};

const competitionTypeIcons: Record<CompetitionType, string> = {
  ticket_count: '🎯',
  all_tickets_sold: '🎫',
  timed: '⏰',
  free: '🆓',
  instant_winner: '⚡',
  everyone_wins: '🎁',
  escalating_price: '📈',
  mystery_box: '📦',
  hidden_winner: '🎯',
  team_battle: '⚔️',
  flash_sale: '🔥',
  growing_prize: '📊',
  collect_letters: '🔤'
};

const formatBaghdadTime = (dateString: string, formatStr: string = 'dd MMM yyyy') => {
  const date = new Date(dateString);
  const baghdadDate = addHours(date, 3);
  return format(baghdadDate, formatStr, { locale: ar });
};

export default function AllCompetitionsPanel() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedCompetition, setSelectedCompetition] = useState<any>(null);
  const [expandedDesc, setExpandedDesc] = useState(false);

  const { data: competitions, isLoading } = useQuery({
    queryKey: ['all-competitions-panel'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('competitions')
        .select('*')
        .eq('status', 'active')
        .neq('is_product_based', true)
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    staleTime: 2 * 60 * 1000,
  });

  const { data: userTickets } = useQuery({
    queryKey: ['user-tickets-balance', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { data, error } = await supabase
        .from('user_tickets')
        .select('ticket_count')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data?.ticket_count || 0;
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  // Get ticket counts per competition
  const { data: ticketCounts } = useQuery({
    queryKey: ['competition-ticket-counts'],
    queryFn: async () => {
      const compIds = competitions?.map(c => c.id) || [];
      if (compIds.length === 0) return {};
      
      const { data, error } = await supabase
        .from('competition_tickets')
        .select('competition_id')
        .in('competition_id', compIds);
      
      if (error) throw error;
      
      const counts: Record<string, number> = {};
      data.forEach(t => {
        counts[t.competition_id] = (counts[t.competition_id] || 0) + 1;
      });
      return counts;
    },
    enabled: !!competitions && competitions.length > 0,
    staleTime: 2 * 60 * 1000,
  });

  const participateMutation = useMutation({
    mutationFn: async (comp: any) => {
      if (!user) throw new Error('يجب تسجيل الدخول');
      
      const requiredTickets = comp.required_tickets || 1;
      const currentBalance = userTickets || 0;
      
      if (comp.competition_type !== 'free' && currentBalance < requiredTickets) {
        throw new Error('رصيد التذاكر غير كافٍ');
      }

      // Deduct tickets (unless free)
      if (comp.competition_type !== 'free') {
        const { error: updateError } = await supabase
          .from('user_tickets')
          .update({ ticket_count: currentBalance - requiredTickets })
          .eq('user_id', user.id);
        if (updateError) throw updateError;
      }

      // Generate ticket number
      const ticketNumber = `T-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      // Insert competition ticket
      const { error: ticketError } = await supabase
        .from('competition_tickets')
        .insert({
          user_id: user.id,
          competition_id: comp.id,
          ticket_number: ticketNumber,
        });
      if (ticketError) throw ticketError;

      return { ticketNumber };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['user-tickets-balance'] });
      queryClient.invalidateQueries({ queryKey: ['competition-ticket-counts'] });
      toast.success(`تم تسجيلك بنجاح! رقم تذكرتك: ${data.ticketNumber}`);
      setSelectedCompetition(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'حدث خطأ');
    },
  });

  const getTypeBadge = (comp: any) => {
    const type = comp.competition_type as CompetitionType;
    const icon = competitionTypeIcons[type] || '🎫';
    const label = competitionTypeLabels[type] || 'مسابقة';
    
    if (comp.is_flash || type === 'flash_sale') {
      return (
        <Badge className="bg-gradient-to-r from-rose-500 to-pink-500 text-white text-[9px] animate-pulse">
          <Zap className="h-2.5 w-2.5 ml-0.5" />
          {comp.flash_badge_text || label}
        </Badge>
      );
    }
    
    return (
      <Badge variant="secondary" className="text-[9px]">
        {icon} {label}
      </Badge>
    );
  };

  const getTypeSpecificInfo = (comp: any) => {
    const type = comp.competition_type as CompetitionType;
    
    switch (type) {
      case 'instant_winner':
        return comp.win_probability ? (
          <div className="flex items-center gap-1 text-[10px] text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded">
            <Zap className="h-2.5 w-2.5" />
            نسبة الفوز: {comp.win_probability}%
          </div>
        ) : null;
      
      case 'collect_letters':
        const words = (comp.letters_config as any)?.prize_words || [];
        const targetWord = words.length > 0 
          ? words.reduce((p: any, c: any) => (c.word?.length || 0) > (p.word?.length || 0) ? c : p, words[0])?.word
          : (comp.letters_config as any)?.target_word || '';
        return targetWord ? (
          <div className="flex items-center gap-1 text-[10px] text-violet-600 bg-violet-500/10 px-2 py-0.5 rounded">
            <Sparkles className="h-2.5 w-2.5" />
            اجمع: {targetWord}
          </div>
        ) : null;
      
      case 'team_battle':
        return (
          <div className="flex items-center gap-1 text-[10px] text-cyan-600 bg-cyan-500/10 px-2 py-0.5 rounded">
            <Swords className="h-2.5 w-2.5" />
            🔵 {comp.team_a_count || 0} - {comp.team_b_count || 0} 🔴
          </div>
        );
      
      case 'mystery_box':
        return (
          <div className="flex items-center gap-1 text-[10px] text-purple-600 bg-purple-500/10 px-2 py-0.5 rounded">
            <Package className="h-2.5 w-2.5" />
            افتح صندوقك!
          </div>
        );
      
      case 'everyone_wins':
        return (
          <div className="flex items-center gap-1 text-[10px] text-green-600 bg-green-500/10 px-2 py-0.5 rounded">
            <Gift className="h-2.5 w-2.5" />
            الكل فائز!
          </div>
        );
      
      case 'escalating_price':
        return (
          <div className="flex items-center gap-1 text-[10px] text-orange-600 bg-orange-500/10 px-2 py-0.5 rounded">
            <TrendingUp className="h-2.5 w-2.5" />
            السعر الحالي: {comp.ticket_price?.toLocaleString()}
          </div>
        );
      
      case 'growing_prize':
        return (
          <div className="flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded">
            <Trophy className="h-2.5 w-2.5" />
            جائزة تنمو!
          </div>
        );
      
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-48 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (!competitions || competitions.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          <Trophy className="h-12 w-12 mx-auto mb-3 opacity-50" />
          لا توجد مسابقات نشطة حالياً
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {competitions.map((comp) => {
          const count = ticketCounts?.[comp.id] || 0;
          const isFree = comp.competition_type === 'free';
          const requiredTickets = comp.required_tickets || 1;
          const progress = comp.max_tickets ? (count / comp.max_tickets) * 100 : 
                          comp.target_participants ? (count / comp.target_participants) * 100 : 0;
          
          return (
            <Card 
              key={comp.id} 
              className={`cursor-pointer hover:shadow-md transition-all overflow-hidden ${
                comp.is_featured ? 'ring-2 ring-primary/50 shadow-lg' : ''
              }`}
              onClick={() => setSelectedCompetition(comp)}
            >
              {/* Featured badge */}
              {comp.is_featured && (
                <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-[9px] font-bold px-2 py-0.5 flex items-center gap-0.5 justify-center">
                  <Sparkles className="h-2.5 w-2.5" />
                  مميزة
                </div>
              )}
              
              <div className="aspect-[4/3] relative">
                <OptimizedImage
                  src={comp.image_url || '/placeholder.svg'}
                  alt={comp.title_ar}
                  className="w-full h-full object-cover"
                />
                
                {/* Required tickets badge */}
                <Badge 
                  className={`absolute top-2 right-2 text-[9px] ${
                    isFree ? 'bg-green-500' : 'bg-primary'
                  }`}
                >
                  {isFree ? (
                    <>
                      <Gift className="h-2.5 w-2.5 ml-0.5" />
                      مجاني
                    </>
                  ) : (
                    <>
                      <Ticket className="h-2.5 w-2.5 ml-0.5" />
                      {requiredTickets} تذكرة
                    </>
                  )}
                </Badge>
                
                {/* Competition type badge */}
                <div className="absolute top-2 left-2">
                  {getTypeBadge(comp)}
                </div>
              </div>
              
              <CardContent className="p-2.5 space-y-1.5">
                <p className="text-xs font-bold line-clamp-1">{comp.title_ar}</p>
                
                {/* Type-specific info */}
                {getTypeSpecificInfo(comp)}
                
                {/* Prize */}
                <div className="flex items-start gap-1">
                  <Gift className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                  <span className="text-[10px] text-muted-foreground line-clamp-1">
                    {comp.prize_description_ar}
                  </span>
                </div>
                
                {/* Progress bar if applicable */}
                {(comp.max_tickets || comp.target_participants) && !comp.hide_participants && (
                  <div className="space-y-0.5">
                    <Progress value={progress} className="h-1" />
                    <div className="flex justify-between text-[9px] text-muted-foreground">
                      <span className="flex items-center gap-0.5">
                        <Users className="h-2.5 w-2.5" />
                        {count}
                      </span>
                      <span>/ {comp.max_tickets || comp.target_participants}</span>
                    </div>
                  </div>
                )}
                
                {/* End date or countdown */}
                {comp.end_date && (
                  <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                    {comp.competition_type === 'timed' || comp.is_flash ? (
                      <div className="w-full">
                        <CountdownTimer endDate={comp.end_date} />
                      </div>
                    ) : (
                      <>
                        <Calendar className="h-2.5 w-2.5" />
                        ينتهي: {formatBaghdadTime(comp.end_date)}
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Competition Detail Sheet */}
      <Sheet open={!!selectedCompetition} onOpenChange={(open) => !open && setSelectedCompetition(null)}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl px-0 pb-0">
          <SheetHeader className="sticky top-0 z-10 bg-background px-4 pb-3 border-b">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-base">تفاصيل المسابقة</SheetTitle>
              <SheetClose asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <X className="h-4 w-4" />
                </Button>
              </SheetClose>
            </div>
          </SheetHeader>
          
          {selectedCompetition && (
            <div className="overflow-y-auto h-full px-4 py-4 pb-32">
              {/* Competition Image */}
              <div className="aspect-video rounded-xl overflow-hidden mb-4 relative">
                <OptimizedImage
                  src={selectedCompetition.image_url || '/placeholder.svg'}
                  alt={selectedCompetition.title_ar}
                  className="w-full h-full object-cover"
                />
                {selectedCompetition.is_featured && (
                  <Badge className="absolute top-2 left-2 bg-gradient-to-r from-primary to-primary/80">
                    <Sparkles className="h-3 w-3 ml-1" />
                    مميزة
                  </Badge>
                )}
              </div>

              {/* Title & Type */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <h2 className="text-lg font-bold flex-1">{selectedCompetition.title_ar}</h2>
                {getTypeBadge(selectedCompetition)}
              </div>
              
              {/* Type-specific info */}
              {getTypeSpecificInfo(selectedCompetition)}

              {/* Prize Card */}
              <Card className="my-4 bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy className="h-5 w-5 text-purple-500" />
                    <span className="font-medium">الجائزة</span>
                  </div>
                  <p className="text-sm">{selectedCompetition.prize_description_ar}</p>
                  {selectedCompetition.prize_value && (
                    <p className="text-xl font-bold text-primary mt-2">
                      {selectedCompetition.prize_value.toLocaleString()} {selectedCompetition.currency}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Description */}
              {selectedCompetition.description_ar && (
                <div className="mb-4">
                  <p className={`text-sm text-muted-foreground ${!expandedDesc ? 'line-clamp-3' : ''}`}>
                    {selectedCompetition.description_ar}
                  </p>
                  {selectedCompetition.description_ar.length > 100 && (
                    <Button 
                      variant="link" 
                      size="sm" 
                      className="p-0 h-auto text-xs"
                      onClick={() => setExpandedDesc(!expandedDesc)}
                    >
                      {expandedDesc ? 'عرض أقل' : 'المزيد'}
                      {expandedDesc ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                    </Button>
                  )}
                </div>
              )}

              {/* Participants count */}
              {!selectedCompetition.hide_participants && (
                <Card className="mb-4">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>المشاركون</span>
                      </div>
                      <span className="font-bold">
                        {ticketCounts?.[selectedCompetition.id] || 0}
                        {(selectedCompetition.max_tickets || selectedCompetition.target_participants) && (
                          <span className="text-muted-foreground font-normal">
                            {' '}/ {selectedCompetition.max_tickets || selectedCompetition.target_participants}
                          </span>
                        )}
                      </span>
                    </div>
                    {(selectedCompetition.max_tickets || selectedCompetition.target_participants) && (
                      <Progress 
                        value={(ticketCounts?.[selectedCompetition.id] || 0) / (selectedCompetition.max_tickets || selectedCompetition.target_participants) * 100} 
                        className="h-1.5 mt-2" 
                      />
                    )}
                  </CardContent>
                </Card>
              )}

              {/* End date / Countdown */}
              {selectedCompetition.end_date && (
                <Card className="mb-4">
                  <CardContent className="p-3">
                    {selectedCompetition.competition_type === 'timed' || selectedCompetition.is_flash ? (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                          <Timer className="h-3 w-3" />
                          الوقت المتبقي
                        </p>
                        <CountdownTimer endDate={selectedCompetition.end_date} />
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>تاريخ الانتهاء</span>
                        </div>
                        <span className="font-medium">
                          {formatBaghdadTime(selectedCompetition.end_date, 'dd MMM yyyy - HH:mm')}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Ticket Info */}
              <Card className="mb-4 border-primary/20 bg-primary/5">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Ticket className="h-5 w-5 text-primary" />
                      <span>رصيدك:</span>
                      <span className="font-bold text-lg">{userTickets || 0} تذكرة</span>
                    </div>
                    <Badge variant="outline" className="text-sm px-3 py-1">
                      المطلوب: {selectedCompetition.competition_type === 'free' ? 'مجاني' : `${selectedCompetition.required_tickets || 1} تذكرة`}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Participate Button */}
              <Button 
                className="w-full"
                size="lg"
                onClick={() => participateMutation.mutate(selectedCompetition)}
                disabled={
                  !user || 
                  participateMutation.isPending ||
                  (selectedCompetition.competition_type !== 'free' && (userTickets || 0) < (selectedCompetition.required_tickets || 1))
                }
              >
                {participateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin ml-2" />
                    جاري التسجيل...
                  </>
                ) : selectedCompetition.competition_type === 'free' ? (
                  'شارك مجاناً'
                ) : (
                  'شارك الآن'
                )}
              </Button>

              {!user && (
                <p className="text-xs text-center text-muted-foreground mt-2">
                  سجّل الدخول للمشاركة في المسابقة
                </p>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
