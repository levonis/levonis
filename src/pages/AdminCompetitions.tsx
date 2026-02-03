import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trophy, Users, Ticket, Calendar, Eye, Settings } from "lucide-react";
import CompetitionFormDialog from "@/components/CompetitionFormDialog";
import { format, addHours } from "date-fns";
import { ar } from "date-fns/locale";
import AdminLayout, { AdminSection, AdminCard, AdminStatsGrid, AdminStatCard, AdminLoading, AdminEmptyState } from "@/components/admin/AdminLayout";
import CelebrationEffect from "@/components/CelebrationEffect";
import CompetitionParticipantsDialog from "@/components/CompetitionParticipantsDialog";
import UserTicketsManager from "@/components/UserTicketsManager";
import CompetitionTestDialog from "@/components/CompetitionTestDialog";
import AdminLettersPrizeManager from "@/components/AdminLettersPrizeManager";

type CompetitionType = 'ticket_count' | 'all_tickets_sold' | 'timed' | 'free' | 'instant_winner' | 'everyone_wins' | 'escalating_price' | 'mystery_box' | 'hidden_winner' | 'team_battle' | 'flash_sale' | 'growing_prize' | 'collect_letters';
type CompetitionStatus = 'draft' | 'active' | 'completed' | 'cancelled';

interface Competition {
  id: string;
  title: string;
  title_ar: string;
  description: string | null;
  description_ar: string | null;
  image_url: string | null;
  images: string[] | null;
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
  status: CompetitionStatus;
  winner_user_id: string | null;
  currency: string;
  created_at: string;
  required_tickets?: number;
  is_flash?: boolean;
  theme_color?: string;
  legal_disclaimer?: string;
  is_product_based?: boolean;
  product_id?: string | null;
  gift_tickets_per_purchase?: number;
}

const statusLabels: Record<CompetitionStatus, string> = {
  draft: 'مسودة',
  active: 'نشطة',
  completed: 'مكتملة',
  cancelled: 'ملغاة'
};

const statusColors: Record<CompetitionStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  active: 'bg-green-500/10 text-green-600 border-green-500/20',
  completed: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  cancelled: 'bg-red-500/10 text-red-600 border-red-500/20'
};

export default function AdminCompetitions() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCompetition, setEditingCompetition] = useState<Competition | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [winnerInfo, setWinnerInfo] = useState<{ name: string; ticket: string } | null>(null);
  const [participantsDialogOpen, setParticipantsDialogOpen] = useState(false);
  const [selectedCompetitionForParticipants, setSelectedCompetitionForParticipants] = useState<Competition | null>(null);
  const [ticketsManagerOpen, setTicketsManagerOpen] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [selectedCompetitionForTest, setSelectedCompetitionForTest] = useState<Competition | null>(null);
  const [lettersPrizeManagerOpen, setLettersPrizeManagerOpen] = useState(false);
  const [selectedCompetitionForLetters, setSelectedCompetitionForLetters] = useState<Competition | null>(null);

  const handleOpenCreateDialog = () => {
    setEditingCompetition(null);
    setIsDialogOpen(true);
  };

  const handleOpenEditDialog = (competition: Competition) => {
    setEditingCompetition(competition);
    setIsDialogOpen(true);
  };

  const { data: competitions, isLoading } = useQuery({
    queryKey: ['admin-competitions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('competitions')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Competition[];
    },
    staleTime: 0
  });

  const { data: ticketCounts } = useQuery({
    queryKey: ['competition-ticket-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('competition_tickets')
        .select('competition_id, user_id');
      if (error) throw error;
      
      const tickets: Record<string, number> = {};
      const participants: Record<string, Set<string>> = {};
      
      data?.forEach(ticket => {
        tickets[ticket.competition_id] = (tickets[ticket.competition_id] || 0) + 1;
        if (!participants[ticket.competition_id]) {
          participants[ticket.competition_id] = new Set();
        }
        participants[ticket.competition_id].add(ticket.user_id);
      });
      
      const uniqueParticipants: Record<string, number> = {};
      Object.keys(participants).forEach(compId => {
        uniqueParticipants[compId] = participants[compId].size;
      });
      
      return { tickets, participants: uniqueParticipants };
    }
  });

  const activeCompetitions = competitions?.filter(c => c.status === 'active').length || 0;
  const totalTicketsSold = ticketCounts?.tickets ? Object.values(ticketCounts.tickets).reduce((a, b) => a + b, 0) : 0;
  const totalParticipants = ticketCounts?.participants ? Object.values(ticketCounts.participants).reduce((a, b) => a + b, 0) : 0;

  if (isLoading) {
    return (
      <AdminLayout title="إدارة المسابقات" icon={<Trophy className="h-5 w-5" />} description="إنشاء وإدارة جميع أنواع المسابقات">
        <AdminLoading />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="إدارة المسابقات" icon={<Trophy className="h-5 w-5" />} description="إنشاء وإدارة جميع أنواع المسابقات">
      {showCelebration && winnerInfo && (
        <CelebrationEffect winnerName={winnerInfo.name} ticketNumber={winnerInfo.ticket} isActive={showCelebration} onComplete={() => setShowCelebration(false)} />
      )}

      <div className="space-y-6">
        <div className="flex justify-end mb-4 gap-2">
          <Button variant="outline" onClick={() => setTicketsManagerOpen(true)} className="gap-2">
            <Ticket className="h-4 w-4" />
            <span className="hidden sm:inline">إدارة التذاكر</span>
          </Button>
          <Button onClick={handleOpenCreateDialog} className="admin-btn-primary gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">مسابقة جديدة</span>
          </Button>
        </div>

          <AdminStatsGrid>
            <AdminStatCard icon={<Trophy className="h-5 w-5" />} value={activeCompetitions} label="مسابقات نشطة" colorClass="text-green-600" bgClass="bg-green-500/10" />
            <AdminStatCard icon={<Ticket className="h-5 w-5" />} value={totalTicketsSold} label="التذاكر المباعة" colorClass="text-primary" bgClass="bg-primary/10" />
            <AdminStatCard icon={<Users className="h-5 w-5" />} value={totalParticipants} label="إجمالي المشاركين" colorClass="text-blue-600" bgClass="bg-blue-500/10" />
            <AdminStatCard icon={<Calendar className="h-5 w-5" />} value={competitions?.length || 0} label="إجمالي المسابقات" colorClass="text-purple-600" bgClass="bg-purple-500/10" />
          </AdminStatsGrid>

          <AdminSection title="المسابقات">
            {!competitions || competitions.length === 0 ? (
              <AdminEmptyState icon={<Trophy className="h-12 w-12" />} title="لا توجد مسابقات بعد" description="ابدأ بإنشاء مسابقة جديدة"
                action={<Button onClick={handleOpenCreateDialog} className="admin-btn-primary gap-2"><Plus className="h-4 w-4" />إنشاء مسابقة</Button>}
              />
            ) : (
              <div className="admin-grid-3">
                {competitions.map((competition) => (
                  <AdminCard key={competition.id} className="overflow-hidden">
                    {competition.image_url && (
                      <div className="aspect-video w-full overflow-hidden">
                        <img src={competition.image_url} alt={competition.title_ar} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <h3 className="font-bold text-foreground line-clamp-1">{competition.title_ar}</h3>
                        <Badge className={statusColors[competition.status]}>{statusLabels[competition.status]}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{competition.prize_description_ar}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                        <div className="flex items-center gap-1"><Ticket className="h-3.5 w-3.5" /><span>{ticketCounts?.tickets?.[competition.id] || 0}</span></div>
                        <div className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /><span>{ticketCounts?.participants?.[competition.id] || 0}</span></div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => { setSelectedCompetitionForParticipants(competition); setParticipantsDialogOpen(true); }}>
                          <Eye className="h-3 w-3 ml-1" />المشاركين
                        </Button>
                        <Button size="sm" className="flex-1 text-xs admin-btn-primary" onClick={() => handleOpenEditDialog(competition)}>
                          <Settings className="h-3 w-3 ml-1" />تعديل
                        </Button>
                      </div>
                    </div>
                  </AdminCard>
                ))}
              </div>
            )}
          </AdminSection>
        </div>
      {/* Competition Form Dialog */}
      <CompetitionFormDialog
        open={isDialogOpen}
        onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setEditingCompetition(null); }}
        editingCompetition={editingCompetition}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['admin-competitions'] })}
      />

      {participantsDialogOpen && selectedCompetitionForParticipants && (
        <CompetitionParticipantsDialog open={participantsDialogOpen} onOpenChange={setParticipantsDialogOpen} competitionId={selectedCompetitionForParticipants.id} competitionTitle={selectedCompetitionForParticipants.title_ar} />
      )}
      {ticketsManagerOpen && <UserTicketsManager open={ticketsManagerOpen} onOpenChange={setTicketsManagerOpen} />}
      {testDialogOpen && selectedCompetitionForTest && <CompetitionTestDialog open={testDialogOpen} onOpenChange={setTestDialogOpen} competition={selectedCompetitionForTest} />}
      {lettersPrizeManagerOpen && selectedCompetitionForLetters && <AdminLettersPrizeManager open={lettersPrizeManagerOpen} onOpenChange={setLettersPrizeManagerOpen} competitionId={selectedCompetitionForLetters.id} competitionTitle={selectedCompetitionForLetters.title_ar} />}
    </AdminLayout>
  );
}
