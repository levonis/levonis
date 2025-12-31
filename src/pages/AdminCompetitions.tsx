import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trophy, Users, Ticket, Calendar, Gift, Loader2, Trash2, Play, Crown, Upload, X, Eye, RotateCcw, ImagePlus, Settings, Save, Sparkles, Package } from "lucide-react";
import AdminProductOffersTab from "@/components/AdminProductOffersTab";
import { toast } from "sonner";
import { format, addHours } from "date-fns";
import { ar } from "date-fns/locale";
import AdminLayout, { AdminSection, AdminCard, AdminStatsGrid, AdminStatCard, AdminLoading, AdminEmptyState } from "@/components/admin/AdminLayout";

// Helper function to format date in Baghdad timezone (UTC+3)
const formatBaghdadTime = (dateString: string, formatStr: string = 'dd MMM yyyy - hh:mm a') => {
  const date = new Date(dateString);
  // Baghdad is UTC+3
  const baghdadDate = addHours(date, 3);
  return format(baghdadDate, formatStr, { locale: ar });
};

// Helper function to convert Baghdad local time to UTC for storage
const baghdadToUTC = (localDateString: string): string => {
  if (!localDateString) return '';
  // Input is in Baghdad local time, we need to subtract 3 hours to get UTC
  const localDate = new Date(localDateString);
  const utcDate = addHours(localDate, -3);
  return utcDate.toISOString();
};

// Helper function to convert UTC to Baghdad local time for form display
const utcToBaghdadLocal = (utcDateString: string | null): string => {
  if (!utcDateString) return '';
  const utcDate = new Date(utcDateString);
  const baghdadDate = addHours(utcDate, 3);
  // Format for datetime-local input
  return format(baghdadDate, "yyyy-MM-dd'T'HH:mm");
};
import CelebrationEffect from "@/components/CelebrationEffect";
import CompetitionParticipantsDialog from "@/components/CompetitionParticipantsDialog";
import PrizeProductsSelector from "@/components/PrizeProductsSelector";
import ProductSearchSelect from "@/components/ProductSearchSelect";
import UserTicketsManager from "@/components/UserTicketsManager";
import CompetitionTestDialog from "@/components/CompetitionTestDialog";
import AdminLettersPrizeManager from "@/components/AdminLettersPrizeManager";

type CompetitionType = 'ticket_count' | 'all_tickets_sold' | 'timed' | 'free' | 'instant_winner' | 'everyone_wins' | 'escalating_price' | 'mystery_box' | 'hidden_winner' | 'team_battle' | 'flash_sale' | 'growing_prize' | 'collect_letters';
type CompetitionStatus = 'draft' | 'active' | 'completed' | 'cancelled';

interface PrizeTier {
  id: string;
  name_ar: string;
  probability: number;
  quantity: number;
  remaining: number;
  image_url?: string;
  value?: number;
  is_better_luck?: boolean;
  is_ticket_reward?: boolean;
  tickets_reward?: number;
  product_id?: string;
}

interface PriceTier {
  min_sold: number;
  max_sold: number;
  price: number;
}

interface LetterConfig {
  letter: string;
  probability: number;
}

interface TicketReward {
  id: string;
  name: string;
  tickets: number;
  probability: number;
}

interface PrizeWord {
  word: string;
  prize_name: string;
  prize_value: number;
  stock?: number;
  product_id?: string;
}

interface GrowingPrizeConfig {
  base_prize: number;
  increment_per_interval: number;
  interval_minutes: number;
  decrease_mode?: boolean;
}

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
}

const competitionTypeLabels: Record<CompetitionType, string> = {
  ticket_count: 'عند وصول المشاركين لعدد معين',
  all_tickets_sold: 'عند بيع جميع التذاكر',
  timed: 'مسابقة بوقت محدد',
  free: 'مسابقة مجانية',
  instant_winner: '⚡ فائز فوري',
  everyone_wins: '🎁 الكل رابح',
  escalating_price: '📈 السعر المتصاعد',
  mystery_box: '📦 اختر صندوقك',
  hidden_winner: '🎯 الرابح المخفي',
  team_battle: '⚔️ فريق ضد فريق',
  flash_sale: '🔥 مسابقة سريعة',
  growing_prize: '📊 الجائزة المتحولة',
  collect_letters: '🔤 اجمع أحرف واربح'
};

const competitionTypeDescriptions: Record<CompetitionType, string> = {
  ticket_count: 'يتم السحب عند وصول عدد معين من المشاركين',
  all_tickets_sold: 'يتم السحب عند بيع جميع التذاكر المتاحة',
  timed: 'يتم السحب تلقائياً عند انتهاء الوقت',
  free: 'مسابقة مجانية بدون تذاكر',
  instant_winner: 'يعرف المشترك نتيجته فوراً عند الشراء مع نسبة احتمال محددة',
  everyone_wins: 'كل مشارك يفوز بجائزة حسب مستويات الجوائز والاحتمالات',
  escalating_price: 'السعر يرتفع تلقائياً كلما قل عدد التذاكر المتبقية',
  mystery_box: 'صناديق غامضة بجوائز مختلفة مع نسب احتمالات',
  hidden_winner: 'تذكرة واحدة رابحة مخفية تظهر عند رقم معين',
  team_battle: 'المستخدمون يُقسمون عشوائياً لفريقين ويتنافسون',
  flash_sale: 'مسابقة سريعة بتصميم مميز وعروض محدودة',
  growing_prize: 'الجائزة تكبر أو تقل مع مرور الوقت',
  collect_letters: 'اجمع أحرف معينة لتفوز بجوائز'
};

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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCompetition, setEditingCompetition] = useState<Competition | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [winnerInfo, setWinnerInfo] = useState<{ name: string; ticket: string } | null>(null);
  const [participantsDialogOpen, setParticipantsDialogOpen] = useState(false);
  const [selectedCompetitionForParticipants, setSelectedCompetitionForParticipants] = useState<Competition | null>(null);
  const [ticketsManagerOpen, setTicketsManagerOpen] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [selectedCompetitionForTest, setSelectedCompetitionForTest] = useState<Competition | null>(null);
  const [lettersPrizeManagerOpen, setLettersPrizeManagerOpen] = useState(false);
  const [selectedCompetitionForLetters, setSelectedCompetitionForLetters] = useState<Competition | null>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    title_ar: '',
    description: '',
    description_ar: '',
    image_url: '',
    images: [] as string[],
    prize_description: '',
    prize_description_ar: '',
    prize_value: '',
    ticket_price: '0',
    max_tickets: '',
    target_participants: '',
    start_date: '',
    end_date: '',
    draw_date: '',
    max_tickets_per_user: '',
    terms_conditions: '',
    required_tickets: '1',
    winners_count: '1',
    competition_type: 'ticket_count' as CompetitionType,
    status: 'draft' as CompetitionStatus,
    prize_tiers: [] as PrizeTier[],
    price_tiers: [] as PriceTier[],
    is_flash: false,
    flash_badge_text: '',
    theme_color: '#d4af37',
    remaining_prizes: '',
    instant_reveal: false,
    win_probability: '',
    hidden_winner_trigger_ticket: '',
    letters_config: [] as LetterConfig[],
    better_luck_probability: '0',
    prize_words: [] as PrizeWord[],
    display_word: '',
    growing_prize_config: {
      base_prize: 0,
      increment_per_interval: 0,
      interval_minutes: 60,
      decrease_mode: false
    } as GrowingPrizeConfig,
    hide_participants: false,
    unlimited_winners: false,
    is_featured: false,
    prize_product_id: '' as string,
    prize_products: [] as { product_id: string; quantity: number }[],
    animation_type: 'bags' as 'bags' | 'scratch',
    max_bags_per_purchase: 10 as number,
    allow_skip_animation: true as boolean,
    ticket_rewards: [] as TicketReward[],
    is_product_based: false,
    product_id: '' as string,
    gift_tickets_per_purchase: '1',
    legal_disclaimer: 'الشراء يتم على منتجات حقيقية، والتذاكر هدية مجانية مرفقة.'
  });

  const { data: products } = useQuery({
    queryKey: ['products-for-prizes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name_ar, image_url, price')
        .order('name_ar');
      if (error) throw error;
      return data;
    }
  });

  const { data: competitions, isLoading, refetch: refetchCompetitions } = useQuery({
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
      
      const ticketCounts: Record<string, number> = {};
      const participantCounts: Record<string, Set<string>> = {};
      
      data?.forEach(ticket => {
        ticketCounts[ticket.competition_id] = (ticketCounts[ticket.competition_id] || 0) + 1;
        if (!participantCounts[ticket.competition_id]) {
          participantCounts[ticket.competition_id] = new Set();
        }
        participantCounts[ticket.competition_id].add(ticket.user_id);
      });
      
      const uniqueParticipants: Record<string, number> = {};
      Object.keys(participantCounts).forEach(compId => {
        uniqueParticipants[compId] = participantCounts[compId].size;
      });
      
      return { tickets: ticketCounts, participants: uniqueParticipants };
    }
  });

  const activeCompetitions = competitions?.filter(c => c.status === 'active').length || 0;
  const totalTicketsSold = ticketCounts?.tickets ? Object.values(ticketCounts.tickets).reduce((a, b) => a + b, 0) : 0;
  const totalParticipants = ticketCounts?.participants ? Object.values(ticketCounts.participants).reduce((a, b) => a + b, 0) : 0;

  if (isLoading) {
    return (
      <AdminLayout 
        title="إدارة المسابقات" 
        icon={<Trophy className="h-5 w-5" />}
        description="إنشاء وإدارة جميع أنواع المسابقات"
      >
        <AdminLoading />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="إدارة المسابقات"
      icon={<Trophy className="h-5 w-5" />}
      description="إنشاء وإدارة جميع أنواع المسابقات"
      actions={
        <Button onClick={() => setIsDialogOpen(true)} className="admin-btn-primary gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">مسابقة جديدة</span>
        </Button>
      }
    >
      {showCelebration && winnerInfo && (
        <CelebrationEffect 
          winnerName={winnerInfo.name} 
          ticketNumber={winnerInfo.ticket}
          isActive={showCelebration}
          onComplete={() => setShowCelebration(false)}
        />
      )}

      {/* Stats */}
      <AdminStatsGrid>
        <AdminStatCard 
          icon={<Trophy className="h-5 w-5" />}
          value={activeCompetitions}
          label="مسابقات نشطة"
          colorClass="text-green-600"
          bgClass="bg-green-500/10"
        />
        <AdminStatCard 
          icon={<Ticket className="h-5 w-5" />}
          value={totalTicketsSold}
          label="التذاكر المباعة"
          colorClass="text-primary"
          bgClass="bg-primary/10"
        />
        <AdminStatCard 
          icon={<Users className="h-5 w-5" />}
          value={totalParticipants}
          label="إجمالي المشاركين"
          colorClass="text-blue-600"
          bgClass="bg-blue-500/10"
        />
        <AdminStatCard 
          icon={<Calendar className="h-5 w-5" />}
          value={competitions?.length || 0}
          label="إجمالي المسابقات"
          colorClass="text-purple-600"
          bgClass="bg-purple-500/10"
        />
      </AdminStatsGrid>

      {/* Competitions List */}
      <AdminSection title="المسابقات" className="mt-6">
        {!competitions || competitions.length === 0 ? (
          <AdminEmptyState 
            icon={<Trophy className="h-12 w-12" />}
            title="لا توجد مسابقات بعد"
            description="ابدأ بإنشاء مسابقة جديدة"
            action={
              <Button onClick={() => setIsDialogOpen(true)} className="admin-btn-primary gap-2">
                <Plus className="h-4 w-4" />
                إنشاء مسابقة
              </Button>
            }
          />
        ) : (
          <div className="admin-grid-3">
            {competitions.map((competition) => (
              <AdminCard key={competition.id} className="overflow-hidden">
                {competition.image_url && (
                  <div className="aspect-video w-full overflow-hidden">
                    <img 
                      src={competition.image_url} 
                      alt={competition.title_ar}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 className="font-bold text-foreground line-clamp-1">{competition.title_ar}</h3>
                    <Badge className={statusColors[competition.status]}>
                      {statusLabels[competition.status]}
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {competition.prize_description_ar}
                  </p>
                  
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                    <div className="flex items-center gap-1">
                      <Ticket className="h-3.5 w-3.5" />
                      <span>{ticketCounts?.tickets?.[competition.id] || 0}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      <span>{ticketCounts?.participants?.[competition.id] || 0}</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="flex-1 text-xs"
                      onClick={() => {
                        setSelectedCompetitionForParticipants(competition);
                        setParticipantsDialogOpen(true);
                      }}
                    >
                      <Eye className="h-3 w-3 ml-1" />
                      المشاركين
                    </Button>
                    <Button 
                      size="sm"
                      className="flex-1 text-xs admin-btn-primary"
                      onClick={() => {
                        setEditingCompetition(competition);
                        setIsDialogOpen(true);
                      }}
                    >
                      <Settings className="h-3 w-3 ml-1" />
                      تعديل
                    </Button>
                  </div>
                </div>
              </AdminCard>
            ))}
          </div>
        )}
      </AdminSection>

      {/* Dialogs remain the same */}
      {participantsDialogOpen && selectedCompetitionForParticipants && (
        <CompetitionParticipantsDialog
          open={participantsDialogOpen}
          onOpenChange={setParticipantsDialogOpen}
          competitionId={selectedCompetitionForParticipants.id}
        />
      )}

      {ticketsManagerOpen && (
        <UserTicketsManager 
          open={ticketsManagerOpen} 
          onOpenChange={setTicketsManagerOpen} 
        />
      )}

      {testDialogOpen && selectedCompetitionForTest && (
        <CompetitionTestDialog
          open={testDialogOpen}
          onOpenChange={setTestDialogOpen}
          competition={selectedCompetitionForTest}
        />
      )}

      {lettersPrizeManagerOpen && selectedCompetitionForLetters && (
        <AdminLettersPrizeManager
          open={lettersPrizeManagerOpen}
          onOpenChange={setLettersPrizeManagerOpen}
          competitionId={selectedCompetitionForLetters.id}
          competitionTitle={selectedCompetitionForLetters.title_ar}
        />
      )}
    </AdminLayout>
  );
}
