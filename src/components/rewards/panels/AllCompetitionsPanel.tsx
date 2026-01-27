import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import OptimizedImage from "@/components/OptimizedImage";
import { useState } from "react";
import { 
  X, Ticket, Trophy, Gift, Users, Calendar, 
  Zap, Sparkles, Package, Swords, TrendingUp, Timer, Loader2,
  ChevronDown, ChevronUp, Star, Target, Check, Play, Minus, Plus
} from "lucide-react";
import { toast } from "sonner";
import { format, addHours } from "date-fns";
import { ar } from "date-fns/locale";
import CountdownTimer from "@/components/CountdownTimer";
import BagOpenReveal from "@/components/BagOpenReveal";
import LetterReveal from "@/components/LetterReveal";
import InstantWinReveal from "@/components/InstantWinReveal";
import MysteryBoxReveal from "@/components/MysteryBoxReveal";
import CollectedLettersDisplay from "@/components/CollectedLettersDisplay";

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
  growing_prize: 'جائزة متنامية',
  collect_letters: 'جمع الأحرف'
};

const competitionTypeIcons: Record<CompetitionType, React.ReactNode> = {
  ticket_count: <Target className="h-3 w-3" />,
  all_tickets_sold: <Ticket className="h-3 w-3" />,
  timed: <Timer className="h-3 w-3" />,
  free: <Gift className="h-3 w-3" />,
  instant_winner: <Zap className="h-3 w-3" />,
  everyone_wins: <Star className="h-3 w-3" />,
  escalating_price: <TrendingUp className="h-3 w-3" />,
  mystery_box: <Package className="h-3 w-3" />,
  hidden_winner: <Target className="h-3 w-3" />,
  team_battle: <Swords className="h-3 w-3" />,
  flash_sale: <Zap className="h-3 w-3" />,
  growing_prize: <TrendingUp className="h-3 w-3" />,
  collect_letters: <Sparkles className="h-3 w-3" />
};

const formatBaghdadTime = (dateString: string, formatStr: string = 'dd MMM yyyy') => {
  const date = new Date(dateString);
  const baghdadDate = addHours(date, 3);
  return format(baghdadDate, formatStr, { locale: ar });
};

interface ParticipationResult {
  ticketNumber: string;
  isWinner?: boolean;
  prize?: any;
  letter?: string;
  team?: string;
  competitionType?: CompetitionType;
}

interface RevealState {
  show: boolean;
  type: 'letter' | 'instant' | 'mystery' | 'bag' | null;
  data: any;
}

interface LetterBagParticipation {
  show: boolean;
  competition: any;
  quantity: number;
}

export default function AllCompetitionsPanel() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedCompetition, setSelectedCompetition] = useState<any>(null);
  const [expandedDesc, setExpandedDesc] = useState(false);
  const [expandedLetters, setExpandedLetters] = useState<string | null>(null);
  const [revealState, setRevealState] = useState<RevealState>({ show: false, type: null, data: null });
  const [letterBagDialog, setLetterBagDialog] = useState<LetterBagParticipation>({ show: false, competition: null, quantity: 1 });

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

  const { data: userParticipations } = useQuery({
    queryKey: ['user-participations', user?.id],
    queryFn: async () => {
      if (!user) return {};
      const compIds = competitions?.map(c => c.id) || [];
      if (compIds.length === 0) return {};
      
      const { data, error } = await supabase
        .from('competition_tickets')
        .select('competition_id, id, ticket_number, is_winner, letter_awarded, team, prize_won, purchased_at')
        .eq('user_id', user.id)
        .in('competition_id', compIds);
      
      if (error) throw error;
      
      const participations: Record<string, any[]> = {};
      data.forEach(t => {
        if (!participations[t.competition_id]) participations[t.competition_id] = [];
        participations[t.competition_id].push(t);
      });
      return participations;
    },
    enabled: !!user && !!competitions,
    staleTime: 2 * 60 * 1000,
  });

  const { data: userLetters } = useQuery({
    queryKey: ['user-collected-letters', user?.id],
    queryFn: async () => {
      if (!user) return {};
      const letterComps = competitions?.filter(c => c.competition_type === 'collect_letters') || [];
      if (letterComps.length === 0) return {};
      
      const { data, error } = await supabase
        .from('competition_tickets')
        .select('competition_id, letter_awarded')
        .eq('user_id', user.id)
        .in('competition_id', letterComps.map(c => c.id))
        .not('letter_awarded', 'is', null);
      
      if (error) throw error;
      
      const lettersByComp: Record<string, string[]> = {};
      data.forEach(t => {
        if (!lettersByComp[t.competition_id]) lettersByComp[t.competition_id] = [];
        if (t.letter_awarded) lettersByComp[t.competition_id].push(t.letter_awarded);
      });
      return lettersByComp;
    },
    enabled: !!user && !!competitions,
    staleTime: 2 * 60 * 1000,
  });

  const canParticipateFree = (compId: string) => {
    const participations = userParticipations?.[compId] || [];
    return participations.length === 0;
  };

  const simulateResult = (comp: any): ParticipationResult => {
    const type = comp.competition_type as CompetitionType;
    const ticketNumber = `T-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    
    switch (type) {
      case 'instant_winner': {
        const winProbability = comp.win_probability || 10;
        const isWinner = Math.random() * 100 < winProbability;
        let prize = null;
        if (isWinner && comp.prize_tiers) {
          const tiers = comp.prize_tiers as any[];
          prize = tiers[Math.floor(Math.random() * tiers.length)];
        }
        return { ticketNumber, isWinner, prize };
      }
      
      case 'everyone_wins': {
        let prize = null;
        if (comp.prize_tiers) {
          const tiers = (comp.prize_tiers as any[]).filter(t => t.remaining_quantity > 0);
          if (tiers.length > 0) {
            const totalWeight = tiers.reduce((sum, t) => sum + (t.probability || 1), 0);
            let random = Math.random() * totalWeight;
            for (const tier of tiers) {
              random -= (tier.probability || 1);
              if (random <= 0) {
                prize = tier;
                break;
              }
            }
          }
        }
        return { ticketNumber, isWinner: true, prize };
      }
      
      case 'mystery_box': {
        const boxes = comp.mystery_boxes as any[] || [];
        if (boxes.length > 0) {
          const totalWeight = boxes.reduce((sum, b) => sum + (b.probability || 1), 0);
          let random = Math.random() * totalWeight;
          for (const box of boxes) {
            random -= (box.probability || 1);
            if (random <= 0) {
              return { ticketNumber, isWinner: true, prize: box };
            }
          }
        }
        return { ticketNumber, isWinner: false };
      }
      
      case 'collect_letters': {
        const config = comp.letters_config as any;
        const letters = config?.letters || [];
        const prizeWords = config?.prize_words || [];
        
        // Determine letter based on probabilities
        if (letters.length > 0) {
          const totalWeight = letters.reduce((sum: number, l: any) => sum + (l.probability || 1), 0);
          let random = Math.random() * totalWeight;
          for (const letterConfig of letters) {
            random -= (letterConfig.probability || 1);
            if (random <= 0) {
              return { ticketNumber, isWinner: true, letter: letterConfig.letter };
            }
          }
        }
        return { ticketNumber, isWinner: false };
      }
      
      case 'team_battle': {
        const team = Math.random() < 0.5 ? 'A' : 'B';
        return { ticketNumber, isWinner: false, team };
      }
      
      case 'hidden_winner': {
        const currentCount = ticketCounts?.[comp.id] || 0;
        const triggerTicket = comp.hidden_winner_trigger_ticket;
        const isWinner = triggerTicket && currentCount + 1 === triggerTicket;
        return { ticketNumber, isWinner };
      }
      
      default:
        return { ticketNumber, isWinner: false };
    }
  };

  // Multiple bags participation for letter competitions
  const participateMultipleBagsMutation = useMutation({
    mutationFn: async ({ comp, count }: { comp: any; count: number }) => {
      if (!user) throw new Error('يجب تسجيل الدخول');
      
      const requiredTickets = (comp.required_tickets || 1) * count;
      const currentBalance = userTickets || 0;
      
      if (currentBalance < requiredTickets) {
        throw new Error('رصيد التذاكر غير كافٍ');
      }

      const results: { letter: string | null; isNew: boolean; ticketNumber: string }[] = [];
      const existingLetters = [...(userLetters?.[comp.id] || [])];
      
      for (let i = 0; i < count; i++) {
        const result = simulateResult(comp);
        const letter = result.letter || null;
        const isNew = letter ? !existingLetters.includes(letter) : false;
        if (letter) existingLetters.push(letter);
        results.push({ letter, isNew, ticketNumber: result.ticketNumber });
      }

      // Deduct tickets using secure RPC function
      const { error: deductError } = await supabase.rpc('deduct_user_tickets', {
        p_user_id: user.id,
        p_amount: requiredTickets
      });
      if (deductError) throw new Error(deductError.message || 'فشل خصم التذاكر');

      // Insert all tickets
      const ticketRecords = results.map(r => ({
        user_id: user.id,
        competition_id: comp.id,
        ticket_number: r.ticketNumber,
        is_winner: !!r.letter,
        letter_awarded: r.letter,
      }));

      const { error: ticketError } = await supabase
        .from('competition_tickets')
        .insert(ticketRecords);
      if (ticketError) throw ticketError;

      const config = comp.letters_config as any;
      return {
        results,
        competition: comp,
        lettersConfig: {
          target_word: config?.display_word || config?.prize_words?.[0]?.word || '',
          prizes: config?.prize_words || []
        },
        collectedLetters: userLetters?.[comp.id] || []
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['user-tickets-balance'] });
      queryClient.invalidateQueries({ queryKey: ['competition-ticket-counts'] });
      queryClient.invalidateQueries({ queryKey: ['user-collected-letters'] });
      queryClient.invalidateQueries({ queryKey: ['user-participations'] });
      
      // Show bag opening animation
      setRevealState({
        show: true,
        type: 'bag',
        data: {
          results: data.results,
          collectedLetters: data.collectedLetters,
          lettersConfig: data.lettersConfig,
          wonPrize: null
        }
      });
      
      setLetterBagDialog({ show: false, competition: null, quantity: 1 });
      setSelectedCompetition(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'حدث خطأ');
    },
  });

  const participateMutation = useMutation({
    mutationFn: async (comp: any) => {
      if (!user) throw new Error('يجب تسجيل الدخول');
      
      const type = comp.competition_type as CompetitionType;
      const requiredTickets = type === 'free' ? 0 : (comp.required_tickets || 1);
      const currentBalance = userTickets || 0;
      
      if (type === 'free' && !canParticipateFree(comp.id)) {
        throw new Error('لقد شاركت بالفعل في هذه المسابقة المجانية');
      }
      
      if (requiredTickets > 0 && currentBalance < requiredTickets) {
        throw new Error('رصيد التذاكر غير كافٍ');
      }

      const result = simulateResult(comp);

      if (requiredTickets > 0) {
        // Deduct tickets using secure RPC function
        const { error: deductError } = await supabase.rpc('deduct_user_tickets', {
          p_user_id: user.id,
          p_amount: requiredTickets
        });
        if (deductError) throw new Error(deductError.message || 'فشل خصم التذاكر');
      }

      const ticketRecord: any = {
        user_id: user.id,
        competition_id: comp.id,
        ticket_number: result.ticketNumber,
        is_winner: result.isWinner || false,
      };

      if (result.letter) ticketRecord.letter_awarded = result.letter;
      if (result.team) ticketRecord.team = result.team;
      if (result.prize) ticketRecord.prize_won = result.prize;

      const { error: ticketError } = await supabase
        .from('competition_tickets')
        .insert(ticketRecord);
      if (ticketError) throw ticketError;

      if (type === 'team_battle' && result.team) {
        const updateField = result.team === 'A' ? 'team_a_count' : 'team_b_count';
        const currentCount = result.team === 'A' ? (comp.team_a_count || 0) : (comp.team_b_count || 0);
        await supabase
          .from('competitions')
          .update({ [updateField]: currentCount + 1 })
          .eq('id', comp.id);
      }

      return { ...result, competitionType: type, competition: comp, boxes: comp.mystery_boxes || [] };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['user-tickets-balance'] });
      queryClient.invalidateQueries({ queryKey: ['competition-ticket-counts'] });
      queryClient.invalidateQueries({ queryKey: ['user-collected-letters'] });
      queryClient.invalidateQueries({ queryKey: ['user-participations'] });
      queryClient.invalidateQueries({ queryKey: ['all-competitions-panel'] });
      
      const type = data.competitionType;
      
      // Show reveal animations based on type
      if (type === 'collect_letters') {
        const collected = userLetters?.[data.competition.id] || [];
        const config = data.competition.letters_config as any;
        // For single participation, show bag animation
        setRevealState({
          show: true,
          type: 'bag',
          data: {
            results: [{ letter: data.letter || null, isNew: data.letter ? !collected.includes(data.letter) : false }],
            collectedLetters: collected,
            lettersConfig: {
              target_word: config?.display_word || config?.prize_words?.[0]?.word || '',
              prizes: config?.prize_words || []
            },
            wonPrize: null
          }
        });
      } else if (type === 'instant_winner') {
        setRevealState({
          show: true,
          type: 'instant',
          data: {
            isWinner: data.isWinner,
            prize: data.prize ? { name_ar: data.prize.name_ar || data.prize.prize_name_ar } : null,
            competitionType: type
          }
        });
      } else if (type === 'mystery_box') {
        setRevealState({
          show: true,
          type: 'mystery',
          data: {
            prize: data.prize,
            competitionType: type
          }
        });
      } else if (type === 'everyone_wins' && data.prize) {
        toast.success(`🎁 مبروك! ربحت: ${data.prize.name_ar || 'جائزة'}`);
      } else if (type === 'team_battle' && data.team) {
        toast.success(`⚔️ انضممت للفريق ${data.team === 'A' ? 'الأزرق 🔵' : 'الأحمر 🔴'}!`);
      } else {
        toast.success(`✅ تم تسجيلك بنجاح!`);
      }
      
      setSelectedCompetition(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'حدث خطأ');
    },
  });

  const quickParticipateMutation = useMutation({
    mutationFn: async (comp: any) => {
      return participateMutation.mutateAsync(comp);
    },
  });

  const getTypeBadge = (comp: any) => {
    const type = comp.competition_type as CompetitionType;
    const icon = competitionTypeIcons[type] || <Ticket className="h-3 w-3" />;
    const label = competitionTypeLabels[type] || 'مسابقة';
    
    if (comp.is_flash || type === 'flash_sale') {
      return (
        <Badge className="bg-gradient-to-r from-rose-500 to-pink-500 text-white text-[9px] animate-pulse gap-0.5">
          <Zap className="h-2.5 w-2.5" />
          {comp.flash_badge_text || label}
        </Badge>
      );
    }
    
    return (
      <Badge variant="secondary" className="text-[9px] gap-0.5 bg-black/60 text-white backdrop-blur-sm">
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
      
      case 'collect_letters': {
        const config = comp.letters_config as any;
        const prizeWords = config?.prize_words || [];
        const displayWord = config?.display_word || prizeWords[0]?.word || '';
        const collected = userLetters?.[comp.id] || [];
        
        // Count letters
        const letterCounts: Record<string, number> = {};
        collected.forEach((l: string) => {
          letterCounts[l] = (letterCounts[l] || 0) + 1;
        });
        
        return (
          <div className="p-2.5 rounded-lg bg-gradient-to-br from-violet-500/10 to-purple-500/10 border border-violet-500/20 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-[10px] text-violet-600 font-medium">
                <Sparkles className="h-3 w-3" />
                اجمع الأحرف واربح!
              </div>
              {collected.length > 0 && (
                <Badge variant="secondary" className="text-[9px] bg-violet-500/20 text-violet-700">
                  {collected.length} حرف
                </Badge>
              )}
            </div>
            
            {/* Display target word with collected progress */}
            <div className="flex items-center gap-1 justify-center flex-wrap">
              {displayWord.split('').map((letter: string, idx: number) => {
                const hasLetter = (letterCounts[letter] || 0) > 0;
                return (
                  <span 
                    key={idx} 
                    className={`w-7 h-7 flex items-center justify-center rounded-md text-xs font-bold transition-all ${
                      hasLetter 
                        ? 'bg-gradient-to-br from-green-400 to-emerald-500 text-white shadow-sm' 
                        : 'bg-violet-100 text-violet-400 border border-violet-200'
                    }`}
                  >
                    {hasLetter ? letter : '?'}
                  </span>
                );
              })}
            </div>
            
            {/* Show prize info */}
            {prizeWords.length > 0 && (
              <div className="text-[10px] text-center text-muted-foreground">
                <Gift className="h-3 w-3 inline-block ml-1" />
                {prizeWords[0]?.prize_name_ar || prizeWords[0]?.prize_name || 'جائزة'}
                {prizeWords[0]?.stock !== undefined && (
                  <span className="text-violet-600"> (متبقي: {prizeWords[0].stock})</span>
                )}
              </div>
            )}
          </div>
        );
      }
      
      case 'team_battle': {
        const userTeam = userParticipations?.[comp.id]?.[0]?.team;
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-[10px] text-cyan-600 bg-cyan-500/10 px-2 py-0.5 rounded">
              <Swords className="h-2.5 w-2.5" />
              🔵 {comp.team_a_count || 0} - {comp.team_b_count || 0} 🔴
            </div>
            {userTeam && (
              <div className="flex items-center gap-1 text-[10px] text-green-600 bg-green-500/10 px-2 py-0.5 rounded">
                <Check className="h-2.5 w-2.5" />
                أنت في الفريق {userTeam === 'A' ? 'الأزرق 🔵' : 'الأحمر 🔴'}
              </div>
            )}
          </div>
        );
      }
      
      case 'mystery_box': {
        const boxes = comp.mystery_boxes as any[] || [];
        return (
          <div className="flex items-center gap-1 text-[10px] text-purple-600 bg-purple-500/10 px-2 py-0.5 rounded">
            <Package className="h-2.5 w-2.5" />
            {boxes.length} صناديق مختلفة
          </div>
        );
      }
      
      case 'everyone_wins': {
        const tiers = comp.prize_tiers as any[] || [];
        const available = tiers.filter(t => t.remaining_quantity > 0).length;
        return (
          <div className="flex items-center gap-1 text-[10px] text-green-600 bg-green-500/10 px-2 py-0.5 rounded">
            <Gift className="h-2.5 w-2.5" />
            {available} جوائز متاحة - الكل رابح!
          </div>
        );
      }
      
      case 'escalating_price': {
        const tiers = comp.price_tiers as any[] || [];
        const currentTier = tiers.find(t => {
          const count = ticketCounts?.[comp.id] || 0;
          return count >= (t.from_ticket || 0) && count < (t.to_ticket || Infinity);
        });
        return currentTier ? (
          <div className="flex items-center gap-1 text-[10px] text-orange-600 bg-orange-500/10 px-2 py-0.5 rounded">
            <TrendingUp className="h-2.5 w-2.5" />
            السعر الحالي: {currentTier.price?.toLocaleString()} تذكرة
          </div>
        ) : null;
      }
      
      case 'growing_prize': {
        const config = comp.growing_prize_config as any;
        const count = ticketCounts?.[comp.id] || 0;
        const currentPrize = (config?.base_prize || 0) + (count * (config?.increment_per_ticket || 0));
        return (
          <div className="flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded">
            <Trophy className="h-2.5 w-2.5" />
            الجائزة الحالية: {currentPrize.toLocaleString()}
          </div>
        );
      }
      
      case 'hidden_winner':
        return (
          <div className="flex items-center gap-1 text-[10px] text-slate-600 bg-slate-500/10 px-2 py-0.5 rounded">
            <Target className="h-2.5 w-2.5" />
            الفائز مخفي حتى الإعلان
          </div>
        );
      
      case 'free': {
        const participated = !canParticipateFree(comp.id);
        return participated ? (
          <div className="flex items-center gap-1 text-[10px] text-green-600 bg-green-500/10 px-2 py-0.5 rounded">
            <Check className="h-2.5 w-2.5" />
            شاركت بالفعل
          </div>
        ) : (
          <div className="flex items-center gap-1 text-[10px] text-blue-600 bg-blue-500/10 px-2 py-0.5 rounded">
            <Gift className="h-2.5 w-2.5" />
            مشاركة واحدة مجانية
          </div>
        );
      }
      
      default:
        return null;
    }
  };

  const getQuickActionButton = (comp: any) => {
    const type = comp.competition_type as CompetitionType;
    const isFree = type === 'free';
    const requiredTickets = comp.required_tickets || 1;
    const participated = isFree && !canParticipateFree(comp.id);
    const hasEnoughTickets = isFree || (userTickets || 0) >= requiredTickets;
    
    if (!user) return null;
    if (participated) return null;
    if (!hasEnoughTickets) return null;
    
    return (
      <Button
        size="sm"
        className="h-7 text-[10px] shadow-lg"
        onClick={(e) => {
          e.stopPropagation();
          quickParticipateMutation.mutate(comp);
        }}
        disabled={quickParticipateMutation.isPending}
      >
        {quickParticipateMutation.isPending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <>
            <Play className="h-3 w-3 ml-1" />
            شارك
          </>
        )}
      </Button>
    );
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
          const type = comp.competition_type as CompetitionType;
          const isFree = type === 'free';
          const requiredTickets = comp.required_tickets || 1;
          const progress = comp.max_tickets ? (count / comp.max_tickets) * 100 : 
                          comp.target_participants ? (count / comp.target_participants) * 100 : 0;
          const userParticipation = userParticipations?.[comp.id];
          
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
                
                {/* Competition type badge - TOP LEFT */}
                <div className="absolute top-2 left-2">
                  {getTypeBadge(comp)}
                </div>
                
                {/* Required tickets badge - TOP RIGHT */}
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
                
                {/* User participated indicator - BOTTOM RIGHT */}
                {userParticipation && userParticipation.length > 0 && (
                  <div className="absolute bottom-2 right-2">
                    <Badge className="bg-green-500/90 text-[9px]">
                      <Check className="h-2 w-2 ml-0.5" />
                      {userParticipation.length} مشاركة
                    </Badge>
                  </div>
                )}
              </div>
              
              <CardContent className="p-2.5 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold line-clamp-1 flex-1">{comp.title_ar}</p>
                  {/* Quick action button moved here */}
                  {getQuickActionButton(comp)}
                </div>
                
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
                    {type === 'timed' || comp.is_flash ? (
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
              </div>

              {/* Title & Type Badge */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <h2 className="text-lg font-bold">{selectedCompetition.title_ar}</h2>
                {getTypeBadge(selectedCompetition)}
              </div>
              
              {selectedCompetition.is_featured && (
                <Badge className="mb-3 bg-gradient-to-r from-primary to-primary/80">
                  <Sparkles className="h-3 w-3 ml-1" />
                  مميزة
                </Badge>
              )}
              
              {/* Type-specific info */}
              <div className="mb-4">
                {getTypeSpecificInfo(selectedCompetition)}
              </div>

              {/* User's Previous Participations - hide for letter competitions */}
              {selectedCompetition.competition_type !== 'collect_letters' && 
               userParticipations?.[selectedCompetition.id] && 
               userParticipations[selectedCompetition.id].length > 0 && (
                <Card className="mb-4 border-green-200 bg-green-500/5">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <span className="font-medium text-green-700">مشاركاتك ({userParticipations[selectedCompetition.id].length})</span>
                    </div>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {userParticipations[selectedCompetition.id].map((p: any) => (
                        <div key={p.id} className="flex items-center justify-between text-xs p-1.5 bg-background rounded">
                          <span className="text-muted-foreground">
                            {formatBaghdadTime(p.purchased_at, 'dd/MM HH:mm')}
                          </span>
                          <div className="flex items-center gap-1">
                            {p.team && (
                              <Badge variant="outline" className="text-[9px]">
                                فريق {p.team === 'A' ? '🔵' : '🔴'}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Letters Collection Display for letter competitions */}
              {selectedCompetition.competition_type === 'collect_letters' && (
                <div className="mb-4">
                  <CollectedLettersDisplay
                    collectedLetters={userLetters?.[selectedCompetition.id] || []}
                    lettersConfig={{
                      target_word: (selectedCompetition.letters_config as any)?.display_word || 
                                   (selectedCompetition.letters_config as any)?.prize_words?.[0]?.word || '',
                      display_word: (selectedCompetition.letters_config as any)?.display_word,
                      prize_words: (selectedCompetition.letters_config as any)?.prize_words || []
                    }}
                    competitionId={selectedCompetition.id}
                    onRedeemSuccess={() => {
                      queryClient.invalidateQueries({ queryKey: ['user-collected-letters'] });
                      queryClient.invalidateQueries({ queryKey: ['user-participations'] });
                    }}
                  />
                </div>
              )}

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
              {(() => {
                const type = selectedCompetition.competition_type as CompetitionType;
                const isFree = type === 'free';
                const isLetterComp = type === 'collect_letters';
                const participated = isFree && !canParticipateFree(selectedCompetition.id);
                const requiredPerBag = selectedCompetition.required_tickets || 1;
                const hasEnoughTickets = isFree || (userTickets || 0) >= requiredPerBag;
                const maxBags = Math.floor((userTickets || 0) / requiredPerBag);
                
                if (participated) {
                  return (
                    <Button className="w-full" size="lg" disabled>
                      <Check className="h-4 w-4 ml-2" />
                      شاركت بالفعل
                    </Button>
                  );
                }
                
                // For letter competitions, show bag quantity selection
                if (isLetterComp && hasEnoughTickets) {
                  return (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-violet-500/10 border border-violet-500/20 rounded-lg">
                        <span className="text-sm font-medium">عدد الأكياس:</span>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setLetterBagDialog(prev => ({ ...prev, quantity: Math.max(1, prev.quantity - 1) }))}
                            disabled={letterBagDialog.quantity <= 1}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <Input
                            type="number"
                            min="1"
                            max={maxBags}
                            value={letterBagDialog.quantity}
                            onChange={(e) => setLetterBagDialog(prev => ({ 
                              ...prev, 
                              quantity: Math.min(maxBags, Math.max(1, parseInt(e.target.value) || 1))
                            }))}
                            className="w-16 text-center h-8"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setLetterBagDialog(prev => ({ ...prev, quantity: Math.min(maxBags, prev.quantity + 1) }))}
                            disabled={letterBagDialog.quantity >= maxBags}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-center text-muted-foreground">
                        التكلفة: {(letterBagDialog.quantity * requiredPerBag).toLocaleString()} تذكرة
                      </p>
                      <Button 
                        className="w-full bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600"
                        size="lg"
                        onClick={() => participateMultipleBagsMutation.mutate({ 
                          comp: selectedCompetition, 
                          count: letterBagDialog.quantity 
                        })}
                        disabled={!user || participateMultipleBagsMutation.isPending}
                      >
                        {participateMultipleBagsMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin ml-2" />
                            جاري فتح الأكياس...
                          </>
                        ) : (
                          <>
                            <Package className="h-4 w-4 ml-2" />
                            افتح {letterBagDialog.quantity} كيس
                          </>
                        )}
                      </Button>
                    </div>
                  );
                }
                
                return (
                  <Button 
                    className="w-full"
                    size="lg"
                    onClick={() => participateMutation.mutate(selectedCompetition)}
                    disabled={!user || participateMutation.isPending || !hasEnoughTickets}
                  >
                    {participateMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin ml-2" />
                        جاري التسجيل...
                      </>
                    ) : isFree ? (
                      'شارك مجاناً'
                    ) : (
                      'شارك الآن'
                    )}
                  </Button>
                );
              })()}

              {!user && (
                <p className="text-xs text-center text-muted-foreground mt-2">
                  سجّل الدخول للمشاركة في المسابقة
                </p>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Bag Open Reveal Animation for Letters */}
      {revealState.type === 'bag' && (
        <BagOpenReveal
          isOpen={revealState.show}
          onClose={() => setRevealState({ show: false, type: null, data: null })}
          results={revealState.data.results}
          collectedLetters={revealState.data.collectedLetters}
          lettersConfig={revealState.data.lettersConfig}
          wonPrize={revealState.data.wonPrize}
        />
      )}

      {/* Letter Reveal Animation */}
      {revealState.type === 'letter' && (
        <LetterReveal
          isOpen={revealState.show}
          onClose={() => setRevealState({ show: false, type: null, data: null })}
          awardedLetter={revealState.data.awardedLetter}
          collectedLetters={revealState.data.collectedLetters}
          lettersConfig={revealState.data.lettersConfig}
          wonPrize={revealState.data.wonPrize}
        />
      )}

      {/* Instant Win Reveal Animation */}
      {revealState.type === 'instant' && (
        <InstantWinReveal
          isOpen={revealState.show}
          onClose={() => setRevealState({ show: false, type: null, data: null })}
          isWinner={revealState.data.isWinner}
          prize={revealState.data.prize}
          competitionType={revealState.data.competitionType}
        />
      )}

      {/* Mystery Box Reveal Animation */}
      {revealState.type === 'mystery' && (
        <MysteryBoxReveal
          isOpen={revealState.show}
          onClose={() => setRevealState({ show: false, type: null, data: null })}
          boxes={revealState.data.boxes || []}
          wonPrize={revealState.data.prize}
        />
      )}
    </>
  );
}
