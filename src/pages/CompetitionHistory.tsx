import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Trophy, Crown, Calendar, Gift, Users } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface CompletedCompetition {
  id: string;
  title_ar: string;
  description_ar: string | null;
  image_url: string | null;
  prize_description_ar: string;
  prize_value: number | null;
  ticket_price: number;
  draw_date: string | null;
  winner_user_id: string | null;
  currency: string;
  winner_profile?: {
    full_name: string | null;
    username: string;
    avatar_url: string | null;
  };
  winner_ticket?: {
    ticket_number: string;
  };
  tickets_count: number;
}

export default function CompetitionHistory() {
  const navigate = useNavigate();

  const { data: competitions, isLoading } = useQuery({
    queryKey: ['completed-competitions'],
    queryFn: async () => {
      // Get completed competitions
      const { data: comps, error } = await supabase
        .from('competitions')
        .select('*')
        .eq('status', 'completed')
        .order('draw_date', { ascending: false });
      
      if (error) throw error;
      
      // For each competition, get winner profile and ticket count
      const enrichedComps = await Promise.all(
        (comps || []).map(async (comp) => {
          let winner_profile = null;
          let winner_ticket = null;
          
          // Get winner profile if exists
          if (comp.winner_user_id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name, username, avatar_url')
              .eq('id', comp.winner_user_id)
              .single();
            winner_profile = profile;
          }
          
          // Get winner ticket
          if (comp.winner_ticket_id) {
            const { data: ticket } = await supabase
              .from('competition_tickets')
              .select('ticket_number')
              .eq('id', comp.winner_ticket_id)
              .single();
            winner_ticket = ticket;
          }
          
          // Get total tickets count
          const { count } = await supabase
            .from('competition_tickets')
            .select('*', { count: 'exact', head: true })
            .eq('competition_id', comp.id);
          
          return {
            ...comp,
            winner_profile,
            winner_ticket,
            tickets_count: count || 0
          } as CompletedCompetition;
        })
      );
      
      return enrichedComps;
    }
  });

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
                {comp.image_url && (
                  <div className="relative h-48 overflow-hidden">
                    <img 
                      src={comp.image_url} 
                      alt={comp.title_ar}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <Badge className="absolute top-3 right-3 bg-blue-500">
                      مكتملة
                    </Badge>
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
                  <div className="flex items-center gap-2 text-primary">
                    <Gift className="h-4 w-4" />
                    <span className="font-medium">{comp.prize_description_ar}</span>
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
                        <span>{format(new Date(comp.draw_date), 'dd MMM yyyy', { locale: ar })}</span>
                      </div>
                    )}
                  </div>

                  {/* Winner Section */}
                  {comp.winner_profile && (
                    <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Crown className="absolute -top-2 -right-1 h-4 w-4 text-yellow-500 transform rotate-12" />
                          <img 
                            src={comp.winner_profile.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=winner'}
                            alt="الفائز"
                            className="h-12 w-12 rounded-full border-2 border-yellow-500"
                          />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-yellow-600 font-medium">🎉 الفائز</p>
                          <p className="font-bold">
                            {comp.winner_profile.full_name || comp.winner_profile.username}
                          </p>
                          {comp.winner_ticket && (
                            <p className="text-xs text-muted-foreground">
                              تذكرة: {comp.winner_ticket.ticket_number}
                            </p>
                          )}
                        </div>
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
