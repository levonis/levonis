import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Trophy, Crown, Calendar, Gift, Users, Ticket, ChevronDown } from "lucide-react";
import { format, addHours } from "date-fns";
import { ar } from "date-fns/locale";
import { useState } from "react";
import OptimizedImage from "@/components/OptimizedImage";

const formatBaghdadTime = (dateString: string) => {
  const date = new Date(dateString);
  const baghdadDate = addHours(date, 3);
  return format(baghdadDate, 'dd MMM yyyy - hh:mm a', { locale: ar });
};

interface Winner {
  user_id: string;
  ticket_number: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface CompletedCompetition {
  id: string;
  title_ar: string;
  description_ar: string | null;
  image_url: string | null;
  images: string[] | null;
  prize_description_ar: string;
  prize_value: number | null;
  ticket_price: number;
  draw_date: string | null;
  end_date: string | null;
  winner_user_ids: string[] | null;
  winners_count: number;
  currency: string;
  winners: Winner[];
  tickets_count: number;
}

export default function CompetitionHistory() {
  const navigate = useNavigate();
  const [expandedWinners, setExpandedWinners] = useState<Record<string, boolean>>({});

  const { data: competitions, isLoading } = useQuery({
    queryKey: ['completed-competitions-full'],
    queryFn: async () => {
      // Get completed competitions
      const { data: comps, error } = await supabase
        .from('competitions')
        .select('*')
        .eq('status', 'completed')
        .order('draw_date', { ascending: false });
      
      if (error) throw error;
      
      // For each competition, get winners and ticket count
      const enrichedComps = await Promise.all(
        (comps || []).map(async (comp) => {
          // Get all winning tickets with user info
          const { data: winningTickets } = await supabase
            .from('competition_tickets')
            .select('user_id, ticket_number')
            .eq('competition_id', comp.id)
            .eq('is_winner', true);
          
          // Get profiles for winners
          const winnerUserIds = winningTickets?.map(t => t.user_id) || [];
          let winners: Winner[] = [];
          
          if (winnerUserIds.length > 0) {
            const { data: profiles } = await supabase
              .from('profiles')
              .select('id, username, full_name, avatar_url')
              .in('id', winnerUserIds);
            
            const profilesMap: Record<string, any> = {};
            profiles?.forEach(p => {
              profilesMap[p.id] = p;
            });
            
            winners = winningTickets?.map(ticket => ({
              user_id: ticket.user_id,
              ticket_number: ticket.ticket_number,
              username: profilesMap[ticket.user_id]?.username || 'مستخدم',
              full_name: profilesMap[ticket.user_id]?.full_name || null,
              avatar_url: profilesMap[ticket.user_id]?.avatar_url || null
            })) || [];
          }
          
          // Get total tickets count
          const { count } = await supabase
            .from('competition_tickets')
            .select('*', { count: 'exact', head: true })
            .eq('competition_id', comp.id);
          
          return {
            ...comp,
            winners,
            tickets_count: count || 0
          } as CompletedCompetition;
        })
      );
      
      return enrichedComps;
    }
  });

  const toggleWinners = (compId: string) => {
    setExpandedWinners(prev => ({ ...prev, [compId]: !prev[compId] }));
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate('/competitions')}>
            <ArrowRight className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Trophy className="h-6 w-6 text-primary" />
              سجل المسابقات السابقة
            </h1>
            <p className="text-muted-foreground">جميع المسابقات المكتملة والفائزين</p>
          </div>
        </div>

        {/* Statistics Summary */}
        {competitions && competitions.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
              <CardContent className="p-4 text-center">
                <Trophy className="h-8 w-8 mx-auto mb-2 text-primary" />
                <p className="text-2xl font-bold">{competitions.length}</p>
                <p className="text-sm text-muted-foreground">مسابقة مكتملة</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-500/5">
              <CardContent className="p-4 text-center">
                <Crown className="h-8 w-8 mx-auto mb-2 text-yellow-600" />
                <p className="text-2xl font-bold">
                  {competitions.reduce((sum, c) => sum + c.winners.length, 0)}
                </p>
                <p className="text-sm text-muted-foreground">فائز</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5">
              <CardContent className="p-4 text-center">
                <Users className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                <p className="text-2xl font-bold">
                  {competitions.reduce((sum, c) => sum + c.tickets_count, 0)}
                </p>
                <p className="text-sm text-muted-foreground">مشاركة</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5">
              <CardContent className="p-4 text-center">
                <Gift className="h-8 w-8 mx-auto mb-2 text-green-600" />
                <p className="text-2xl font-bold">
                  {competitions.reduce((sum, c) => sum + (c.prize_value || 0), 0).toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">قيمة الجوائز</p>
              </CardContent>
            </Card>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : !competitions?.length ? (
          <Card className="text-center py-16">
            <CardContent>
              <Trophy className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">لا توجد مسابقات مكتملة</h3>
              <p className="text-muted-foreground">لم يتم إكمال أي مسابقات حتى الآن</p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => navigate('/competitions')}
              >
                تصفح المسابقات النشطة
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {competitions.map((comp) => (
              <Card key={comp.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                {(comp.image_url || comp.images?.[0]) && (
                  <div className="relative h-48 overflow-hidden">
                    <OptimizedImage 
                      src={comp.images?.[0] || comp.image_url || ''} 
                      alt={comp.title_ar}
                      className="w-full h-full"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <Badge className="absolute top-3 right-3 bg-blue-500 border-0">
                      مكتملة
                    </Badge>
                    {comp.winners.length > 1 && (
                      <Badge className="absolute top-3 left-3 bg-yellow-500 border-0">
                        {comp.winners.length} فائزين
                      </Badge>
                    )}
                  </div>
                )}
                
                <CardContent className="p-4 space-y-4">
                  <div>
                    <h3 className="text-lg font-bold">{comp.title_ar}</h3>
                    {comp.description_ar && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {comp.description_ar}
                      </p>
                    )}
                  </div>

                  {/* Prize */}
                  <div className="bg-gradient-to-l from-primary/10 to-transparent rounded-md p-2 border-r-2 border-primary/50">
                    <div className="flex items-center gap-2 text-primary">
                      <Gift className="h-4 w-4 flex-shrink-0" />
                      <span className="font-medium text-sm">{comp.prize_description_ar}</span>
                    </div>
                    {comp.prize_value && (
                      <p className="text-sm font-bold text-primary mr-6 mt-1">
                        {comp.prize_value.toLocaleString()} {comp.currency}
                      </p>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span>{comp.tickets_count} مشارك</span>
                    </div>
                    {comp.draw_date && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>{formatBaghdadTime(comp.draw_date)}</span>
                      </div>
                    )}
                  </div>

                  {/* Winners Section */}
                  {comp.winners.length > 0 && (
                    <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-yellow-700 flex items-center gap-1">
                          <Crown className="h-4 w-4" />
                          {comp.winners.length > 1 ? `الفائزون (${comp.winners.length})` : 'الفائز'}
                        </p>
                        {comp.winners.length > 2 && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 px-2 text-xs"
                            onClick={() => toggleWinners(comp.id)}
                          >
                            {expandedWinners[comp.id] ? 'عرض أقل' : 'عرض الكل'}
                            <ChevronDown className={`h-3 w-3 mr-1 transition-transform ${expandedWinners[comp.id] ? 'rotate-180' : ''}`} />
                          </Button>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        {(expandedWinners[comp.id] ? comp.winners : comp.winners.slice(0, 2)).map((winner, idx) => (
                          <div key={idx} className="flex items-center gap-3 bg-white/50 rounded-lg p-2">
                            <div className="relative">
                              {idx === 0 && (
                                <Crown className="absolute -top-1.5 -right-1 h-3 w-3 text-yellow-500 transform rotate-12" />
                              )}
                              <img 
                                src={winner.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${winner.username}`}
                                alt="الفائز"
                                className="h-10 w-10 rounded-full border-2 border-yellow-500"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-sm truncate">
                                {winner.full_name || winner.username}
                              </p>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Ticket className="h-3 w-3" />
                                <span>{winner.ticket_number}</span>
                              </div>
                            </div>
                            <Badge variant="secondary" className="text-xs bg-yellow-500/20 text-yellow-700 border-0">
                              #{idx + 1}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}