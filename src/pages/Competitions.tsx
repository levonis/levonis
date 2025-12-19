import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Trophy, Ticket, Users, Calendar, Gift, Loader2, Clock, Crown, Wallet } from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

type CompetitionType = 'ticket_count' | 'all_tickets_sold' | 'timed' | 'free';

interface Competition {
  id: string;
  title: string;
  title_ar: string;
  description: string | null;
  description_ar: string | null;
  image_url: string | null;
  prize_description: string;
  prize_description_ar: string;
  prize_value: number | null;
  ticket_price: number;
  max_tickets: number | null;
  target_participants: number | null;
  start_date: string;
  end_date: string | null;
  draw_date: string | null;
  competition_type: CompetitionType;
  status: 'active' | 'completed';
  winner_user_id: string | null;
  currency: string;
}

const competitionTypeLabels: Record<CompetitionType, string> = {
  ticket_count: 'السحب عند اكتمال العدد',
  all_tickets_sold: 'السحب عند بيع جميع التذاكر',
  timed: 'مسابقة محددة بوقت',
  free: 'مسابقة مجانية'
};

export default function Competitions() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  const { data: competitions, isLoading } = useQuery({
    queryKey: ['competitions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('competitions')
        .select('*')
        .in('status', ['active', 'completed'])
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Competition[];
    }
  });

  const { data: ticketCounts } = useQuery({
    queryKey: ['competition-ticket-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('competition_tickets')
        .select('competition_id');
      
      if (error) throw error;
      
      const counts: Record<string, number> = {};
      data?.forEach(ticket => {
        counts[ticket.competition_id] = (counts[ticket.competition_id] || 0) + 1;
      });
      return counts;
    }
  });

  const { data: myTickets } = useQuery({
    queryKey: ['my-competition-tickets', user?.id],
    queryFn: async () => {
      if (!user) return {};
      const { data, error } = await supabase
        .from('competition_tickets')
        .select('competition_id, ticket_number, is_winner')
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      const tickets: Record<string, { ticket_number: string; is_winner: boolean }[]> = {};
      data?.forEach(ticket => {
        if (!tickets[ticket.competition_id]) {
          tickets[ticket.competition_id] = [];
        }
        tickets[ticket.competition_id].push({
          ticket_number: ticket.ticket_number,
          is_winner: ticket.is_winner
        });
      });
      return tickets;
    },
    enabled: !!user
  });

  const { data: wallet } = useQuery({
    queryKey: ['user-wallet', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('user_wallets')
        .select('balance')
        .eq('user_id', user.id)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user
  });

  const purchaseMutation = useMutation({
    mutationFn: async (competitionId: string) => {
      const { data, error } = await supabase.rpc('purchase_competition_ticket', {
        comp_id: competitionId
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['my-competition-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['competition-ticket-counts'] });
      queryClient.invalidateQueries({ queryKey: ['user-wallet'] });
      
      if (data.success) {
        toast.success(`🎟️ تم شراء التذكرة! رقم التذكرة: ${data.ticket_number}`);
      } else {
        toast.error(data.error);
      }
      setConfirmDialogOpen(false);
    },
    onError: (error) => {
      toast.error('حدث خطأ: ' + error.message);
    }
  });

  const handlePurchase = (competition: Competition) => {
    if (!user) {
      toast.error('يجب تسجيل الدخول أولاً');
      navigate('/auth');
      return;
    }
    setSelectedCompetition(competition);
    setConfirmDialogOpen(true);
  };

  const getProgress = (comp: Competition) => {
    const count = ticketCounts?.[comp.id] || 0;
    if (comp.max_tickets) {
      return (count / comp.max_tickets) * 100;
    }
    if (comp.target_participants) {
      return (count / comp.target_participants) * 100;
    }
    return 0;
  };

  const getTimeRemaining = (endDate: string) => {
    const end = new Date(endDate);
    if (end < new Date()) {
      return 'انتهى الوقت';
    }
    return formatDistanceToNow(end, { locale: ar, addSuffix: true });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col" dir="rtl">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold flex items-center justify-center gap-3 mb-2">
            <Trophy className="h-8 w-8 text-primary" />
            المسابقات والسحوبات
          </h1>
          <p className="text-muted-foreground">اشترك في المسابقات واربح جوائز قيمة!</p>
          
          {user && wallet && (
            <div className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-primary/10 rounded-full">
              <Wallet className="h-4 w-4 text-primary" />
              <span className="font-medium">رصيد المحفظة: {wallet.balance} دينار عراقي</span>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : competitions?.length === 0 ? (
          <Card className="text-center py-12 max-w-md mx-auto">
            <CardContent>
              <Trophy className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">لا توجد مسابقات نشطة حالياً</p>
              <p className="text-sm text-muted-foreground mt-2">تابعنا لمعرفة المسابقات القادمة!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {competitions?.map((comp) => {
              const ticketCount = ticketCounts?.[comp.id] || 0;
              const myTicketList = myTickets?.[comp.id] || [];
              const hasTicket = myTicketList.length > 0;
              const isWinner = myTicketList.some(t => t.is_winner);
              const isSoldOut = comp.max_tickets ? ticketCount >= comp.max_tickets : false;
              const isEnded = comp.status === 'completed' || (comp.end_date && new Date(comp.end_date) < new Date());

              return (
                <Card key={comp.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  {comp.image_url && (
                    <div className="relative h-48 overflow-hidden">
                      <img 
                        src={comp.image_url} 
                        alt={comp.title_ar}
                        className="w-full h-full object-cover"
                      />
                      {comp.status === 'completed' && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <Badge className="bg-primary text-lg py-2 px-4">
                            <Crown className="h-5 w-5 ml-2" />
                            تم السحب
                          </Badge>
                        </div>
                      )}
                      {isWinner && (
                        <div className="absolute inset-0 bg-primary/80 flex items-center justify-center">
                          <div className="text-center text-white">
                            <Crown className="h-12 w-12 mx-auto mb-2" />
                            <span className="text-xl font-bold">مبروك! لقد فزت! 🎉</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{comp.title_ar}</CardTitle>
                      <Badge variant={comp.ticket_price === 0 ? "secondary" : "default"}>
                        {comp.ticket_price === 0 ? 'مجانية' : `${comp.ticket_price} ${comp.currency}`}
                      </Badge>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    {comp.description_ar && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{comp.description_ar}</p>
                    )}
                    
                    <div className="flex items-center gap-2 text-primary font-medium">
                      <Gift className="h-5 w-5" />
                      <span>{comp.prize_description_ar}</span>
                    </div>

                    {comp.prize_value && (
                      <div className="text-sm text-muted-foreground">
                        قيمة الجائزة: {comp.prize_value.toLocaleString()} {comp.currency}
                      </div>
                    )}

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {ticketCount} مشارك
                        </span>
                        {(comp.max_tickets || comp.target_participants) && (
                          <span className="text-muted-foreground">
                            / {comp.max_tickets || comp.target_participants}
                          </span>
                        )}
                      </div>
                      {(comp.max_tickets || comp.target_participants) && (
                        <Progress value={getProgress(comp)} className="h-2" />
                      )}
                    </div>

                    {comp.end_date && comp.status !== 'completed' && (
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-orange-500" />
                        <span>{getTimeRemaining(comp.end_date)}</span>
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground">
                      {competitionTypeLabels[comp.competition_type]}
                    </p>

                    {hasTicket && (
                      <div className="bg-primary/10 rounded-lg p-3">
                        <p className="text-sm font-medium mb-1">تذاكرك:</p>
                        <div className="flex flex-wrap gap-2">
                          {myTicketList.map((ticket, idx) => (
                            <Badge 
                              key={idx} 
                              variant={ticket.is_winner ? "default" : "outline"}
                              className={ticket.is_winner ? "bg-yellow-500" : ""}
                            >
                              <Ticket className="h-3 w-3 ml-1" />
                              {ticket.ticket_number}
                              {ticket.is_winner && <Crown className="h-3 w-3 mr-1" />}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {comp.status === 'active' && !isEnded && !isSoldOut && (
                      <Button 
                        className="w-full gap-2"
                        onClick={() => handlePurchase(comp)}
                      >
                        <Ticket className="h-4 w-4" />
                        {comp.ticket_price === 0 ? 'اشترك مجاناً' : 'شراء تذكرة'}
                      </Button>
                    )}

                    {isSoldOut && comp.status !== 'completed' && (
                      <Button className="w-full" disabled>
                        نفذت التذاكر
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تأكيد شراء التذكرة</DialogTitle>
            <DialogDescription>
              {selectedCompetition && (
                <div className="space-y-4 mt-4">
                  <div className="bg-muted p-4 rounded-lg space-y-2">
                    <p className="font-medium">{selectedCompetition.title_ar}</p>
                    <p className="text-sm flex items-center gap-2">
                      <Gift className="h-4 w-4" />
                      {selectedCompetition.prize_description_ar}
                    </p>
                    <p className="text-lg font-bold text-primary">
                      {selectedCompetition.ticket_price === 0 
                        ? 'مجانية' 
                        : `${selectedCompetition.ticket_price} ${selectedCompetition.currency}`
                      }
                    </p>
                  </div>

                  {selectedCompetition.ticket_price > 0 && wallet && (
                    <div className="flex items-center justify-between text-sm">
                      <span>رصيد المحفظة:</span>
                      <span className={wallet.balance >= selectedCompetition.ticket_price ? 'text-green-500' : 'text-red-500'}>
                        {wallet.balance} {selectedCompetition.currency}
                      </span>
                    </div>
                  )}

                  {selectedCompetition.ticket_price > 0 && (!wallet || wallet.balance < selectedCompetition.ticket_price) && (
                    <p className="text-red-500 text-sm">
                      رصيد المحفظة غير كافٍ. يرجى شحن المحفظة أولاً.
                    </p>
                  )}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex gap-3 mt-4">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => setConfirmDialogOpen(false)}
            >
              إلغاء
            </Button>
            <Button 
              className="flex-1 gap-2"
              onClick={() => selectedCompetition && purchaseMutation.mutate(selectedCompetition.id)}
              disabled={
                purchaseMutation.isPending || 
                (selectedCompetition?.ticket_price || 0) > 0 && (!wallet || wallet.balance < (selectedCompetition?.ticket_price || 0))
              }
            >
              {purchaseMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              <Ticket className="h-4 w-4" />
              تأكيد
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}
