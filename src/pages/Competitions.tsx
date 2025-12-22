import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trophy, Ticket, Users, Gift, Loader2, Clock, Crown, Wallet, Plus, Minus, History, ChevronLeft, ChevronRight, Images, Calendar, ShoppingCart, ArrowRight, Info, Eye, Sparkles, Zap, Package, Swords } from "lucide-react";
import { toast } from "sonner";
import { format, addHours } from "date-fns";
import { ar } from "date-fns/locale";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import CountdownTimer from "@/components/CountdownTimer";
import CelebrationEffect from "@/components/CelebrationEffect";
import CompetitionCard from "@/components/CompetitionCard";
import OptimizedImage from "@/components/OptimizedImage";
import InstantWinReveal from "@/components/InstantWinReveal";
import LetterReveal from "@/components/LetterReveal";
import ScratchCardReveal from "@/components/ScratchCardReveal";
import BagOpenReveal from "@/components/BagOpenReveal";
import TicketBundleOffer from "@/components/TicketBundleOffer";
import TeamBattleDisplay from "@/components/TeamBattleDisplay";
import CollectedLettersDisplay from "@/components/CollectedLettersDisplay";

const formatBaghdadTime = (dateString: string, formatStr: string = 'dd MMM yyyy - hh:mm a') => {
  const date = new Date(dateString);
  const baghdadDate = addHours(date, 3);
  return format(baghdadDate, formatStr, { locale: ar });
};

type CompetitionType = 'ticket_count' | 'all_tickets_sold' | 'timed' | 'free' | 'instant_winner' | 'everyone_wins' | 'escalating_price' | 'mystery_box' | 'hidden_winner' | 'team_battle' | 'flash_sale' | 'growing_prize' | 'collect_letters';

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
  status: 'active' | 'completed';
  winner_user_id: string | null;
  winner_user_ids: string[] | null;
  winner_ticket_ids: string[] | null;
  winners_count: number;
  currency: string;
  required_tickets: number;
  // New fields
  is_flash?: boolean;
  flash_badge_text?: string;
  theme_color?: string;
  remaining_prizes?: number;
  instant_reveal?: boolean;
  win_probability?: number;
  letters_config?: any;
  prize_tiers?: any;
  mystery_boxes?: any;
  hidden_winner_trigger_ticket?: number;
  team_config?: any;
  team_a_count?: number;
  team_b_count?: number;
  price_tiers?: any;
  growing_prize_config?: any;
  hide_participants?: boolean;
  is_featured?: boolean;
  prize_products?: any;
}

// Ticket bundle offers configuration
// Default bundles fallback
const defaultBundles = [
  { quantity: 10, bonusTickets: 0, price: 2500, label: 'عادي' },
  { quantity: 20, bonusTickets: 2, price: 5000, label: 'مميز' },
  { quantity: 36, bonusTickets: 4, price: 9000, label: 'العرض الذهبي', highlight: true },
  { quantity: 50, bonusTickets: 10, price: 12500, label: 'باقة VIP' },
];

export default function Competitions() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showWinCelebration, setShowWinCelebration] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryCompetition, setGalleryCompetition] = useState<Competition | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [ticketPurchaseQuantity, setTicketPurchaseQuantity] = useState(1);
  const [showPurchaseConfirm, setShowPurchaseConfirm] = useState(false);
  const [showInsufficientBalance, setShowInsufficientBalance] = useState(false);
  const [showEnterConfirm, setShowEnterConfirm] = useState(false);
  const [selectedCompetitionForEntry, setSelectedCompetitionForEntry] = useState<Competition | null>(null);
  const [selectedCompetitionForDetails, setSelectedCompetitionForDetails] = useState<Competition | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [detailsSlideIndex, setDetailsSlideIndex] = useState(0);
  
  // New states for instant reveal and bundles
  const [showInstantReveal, setShowInstantReveal] = useState(false);
  const [instantRevealResult, setInstantRevealResult] = useState<{ isWinner: boolean; prize: any } | null>(null);
  const [showLetterReveal, setShowLetterReveal] = useState(false);
  const [showScratchReveal, setShowScratchReveal] = useState(false);
  const [showBagReveal, setShowBagReveal] = useState(false);
  const [letterRevealData, setLetterRevealData] = useState<{ letter: string; collected: string[]; config: any; prize: any } | null>(null);
  const [bagRevealResults, setBagRevealResults] = useState<{ letter: string | null; isNew: boolean }[]>([]);
  const [showBundleOffers, setShowBundleOffers] = useState(false);
  
  // State for multiple bag purchase
  const [showBagPurchaseDialog, setShowBagPurchaseDialog] = useState(false);
  const [bagPurchaseQuantity, setBagPurchaseQuantity] = useState(1);

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
    },
    staleTime: 30000, // Cache for 30 seconds
  });

  // Fetch ticket counts - available for all users (no auth required)
  const { data: ticketCounts } = useQuery({
    queryKey: ['competition-ticket-counts'],
    queryFn: async () => {
      // Use count aggregation for better performance and RLS compatibility
      const competitionIds = competitions?.map(c => c.id) || [];
      if (competitionIds.length === 0) return {};
      
      const counts: Record<string, number> = {};
      
      // Fetch count for each competition
      await Promise.all(
        competitionIds.map(async (compId) => {
          const { count, error } = await supabase
            .from('competition_tickets')
            .select('*', { count: 'exact', head: true })
            .eq('competition_id', compId);
          
          if (!error && count !== null) {
            counts[compId] = count;
          }
        })
      );
      
      return counts;
    },
    enabled: !!competitions && competitions.length > 0,
    staleTime: 30000,
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
    enabled: !!user,
    staleTime: 30000,
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
    enabled: !!user,
    staleTime: 30000,
  });

  const { data: userTicketBalance } = useQuery({
    queryKey: ['user-ticket-balance', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { data, error } = await supabase
        .from('user_tickets')
        .select('ticket_count')
        .eq('user_id', user.id)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data?.ticket_count || 0;
    },
    enabled: !!user,
    staleTime: 30000,
  });

  const { data: ticketSettings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['ticket-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('default_settings')
        .select('setting_value')
        .eq('setting_key', 'ticket_price')
        .single();
      
      if (error && error.code !== 'PGRST116') return { price: 250 };
      return data?.setting_value as { price: number } || { price: 250 };
    },
    staleTime: 60000,
  });

  // Fetch ticket bundles from database
  const { data: ticketBundles } = useQuery({
    queryKey: ['ticket-bundles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('default_settings')
        .select('setting_value')
        .eq('setting_key', 'ticket_bundles')
        .single();
      
      if (error && error.code !== 'PGRST116') return defaultBundles;
      
      const savedBundles = data?.setting_value as any[];
      if (!savedBundles || savedBundles.length === 0) return defaultBundles;
      
      // Transform from DB format to component format
      return savedBundles
        .filter(b => b.active !== false)
        .map(b => ({
          quantity: b.quantity,
          bonusTickets: b.bonus_tickets || 0,
          price: b.price,
          label: b.label,
          highlight: b.highlight || false,
        }));
    },
    staleTime: 60000,
  });

  // Fetch winners info for completed competitions
  const { data: winnersInfo } = useQuery({
    queryKey: ['competition-winners'],
    queryFn: async () => {
      // Get all winning tickets with user profiles
      const { data, error } = await supabase
        .from('competition_tickets')
        .select(`
          id,
          competition_id,
          ticket_number,
          user_id
        `)
        .eq('is_winner', true);
      
      if (error) throw error;
      
      // Get unique user IDs
      const userIds = [...new Set(data?.map(t => t.user_id) || [])];
      
      // Fetch profiles for those users
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, full_name')
        .in('id', userIds);
      
      if (profilesError) throw profilesError;
      
      // Create lookup map
      const profilesMap: Record<string, { username: string; full_name: string | null }> = {};
      profiles?.forEach(p => {
        profilesMap[p.id] = { username: p.username, full_name: p.full_name };
      });
      
      // Group by competition
      const winnersMap: Record<string, { user_id: string; ticket_number: string; username: string; full_name: string | null }[]> = {};
      data?.forEach(ticket => {
        if (!winnersMap[ticket.competition_id]) {
          winnersMap[ticket.competition_id] = [];
        }
        winnersMap[ticket.competition_id].push({
          user_id: ticket.user_id,
          ticket_number: ticket.ticket_number,
          username: profilesMap[ticket.user_id]?.username || 'مستخدم',
          full_name: profilesMap[ticket.user_id]?.full_name || null
        });
      });
      
      return winnersMap;
    },
    staleTime: 30000,
  });

  // Fetch user's collected letters for collect_letters competitions
  const { data: collectedLettersData, refetch: refetchCollectedLetters } = useQuery({
    queryKey: ['my-collected-letters', user?.id],
    queryFn: async () => {
      if (!user) return {};
      const { data, error } = await supabase
        .from('user_collected_letters')
        .select('competition_id, letter')
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      const letters: Record<string, string[]> = {};
      data?.forEach(item => {
        if (!letters[item.competition_id]) {
          letters[item.competition_id] = [];
        }
        letters[item.competition_id].push(item.letter);
      });
      return letters;
    },
    enabled: !!user,
    staleTime: 30000,
  });

  const purchaseTicketsMutation = useMutation({
    mutationFn: async (quantity: number) => {
      const priceToUse = ticketSettings?.price ?? 250;
      const { data, error } = await supabase.rpc('purchase_tickets', {
        ticket_quantity: quantity,
        price_per_ticket: priceToUse
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['user-ticket-balance'] });
        queryClient.invalidateQueries({ queryKey: ['user-wallet'] });
        toast.success(`تم شراء ${ticketPurchaseQuantity} تذكرة بنجاح!`);
        setTicketPurchaseQuantity(1);
      } else {
        toast.error(data.error);
      }
    },
    onError: (error) => {
      toast.error('حدث خطأ: ' + error.message);
    }
  });

  // Bundle purchase mutation
  const purchaseBundleMutation = useMutation({
    mutationFn: async (bundle: { quantity: number; bonusTickets: number; price: number }) => {
      const pricePerTicket = bundle.price / bundle.quantity;
      const { data, error } = await supabase.rpc('purchase_tickets_with_bonus', {
        ticket_quantity: bundle.quantity,
        bonus_tickets: bundle.bonusTickets,
        price_per_ticket: pricePerTicket
      });
      if (error) throw error;
      return { ...(data as Record<string, any>), bundle };
    },
    onSuccess: (data: any) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['user-ticket-balance'] });
        queryClient.invalidateQueries({ queryKey: ['user-wallet'] });
        toast.success(`🎉 تم شراء ${data.purchased} تذكرة + ${data.bonus} هدية!`);
        setShowBundleOffers(false);
      } else {
        toast.error(data.error);
      }
    },
    onError: (error) => {
      toast.error('حدث خطأ: ' + error.message);
    }
  });

  // Instant win competition mutation
  const enterInstantWinMutation = useMutation({
    mutationFn: async (competitionId: string) => {
      const { data, error } = await supabase.rpc('enter_instant_win_competition', {
        comp_id: competitionId
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['user-ticket-balance'] });
        queryClient.invalidateQueries({ queryKey: ['my-competition-tickets'] });
        queryClient.invalidateQueries({ queryKey: ['competition-ticket-counts'] });
        setInstantRevealResult({ isWinner: data.is_winner, prize: data.prize });
        setShowInstantReveal(true);
        if (data.is_winner) {
          setShowWinCelebration(true);
        }
      } else {
        toast.error(data.error);
      }
    },
    onError: (error) => {
      toast.error('حدث خطأ: ' + error.message);
    }
  });

  // Collect letters competition mutation
  const enterCollectLettersMutation = useMutation({
    mutationFn: async ({ competitionId, quantity }: { competitionId: string; quantity: number }) => {
      // Enter multiple times
      const results = [];
      for (let i = 0; i < quantity; i++) {
        const { data, error } = await supabase.rpc('enter_collect_letters_competition', {
          comp_id: competitionId
        });
        if (error) throw error;
        results.push(data);
      }
      return results;
    },
    onSuccess: (dataArray: any[]) => {
      const lastData = dataArray[dataArray.length - 1];
      if (lastData.success) {
        queryClient.invalidateQueries({ queryKey: ['user-ticket-balance'] });
        queryClient.invalidateQueries({ queryKey: ['my-competition-tickets'] });
        queryClient.invalidateQueries({ queryKey: ['competition-ticket-counts'] });
        queryClient.invalidateQueries({ queryKey: ['my-collected-letters'] });
        
        // Get animation type from competition config
        const animationType = selectedCompetitionForEntry?.letters_config?.animation_type || 'bags';
        const allowSkip = selectedCompetitionForEntry?.letters_config?.allow_skip_animation !== false;
        
        // Check if any prize was won
        const wonPrize = dataArray.find(d => d.won_prizes && d.won_prizes.length > 0)?.won_prizes?.[0] || null;
        
        if (dataArray.length === 1) {
          // Single entry - use single reveal animation
          const data = dataArray[0];
          setLetterRevealData({
            letter: data.is_better_luck ? null : data.letter_awarded,
            collected: data.collected_letters || [],
            config: selectedCompetitionForEntry?.letters_config || {},
            prize: wonPrize
          });
          
          if (animationType === 'scratch') {
            setShowScratchReveal(true);
          } else {
            setShowLetterReveal(true);
          }
        } else {
          // Multiple entries - use bag reveal animation
          const bagResults = dataArray.map(data => ({
            letter: data.is_better_luck ? null : data.letter_awarded,
            isNew: !data.collected_letters?.includes(data.letter_awarded)
          }));
          
          setBagRevealResults(bagResults);
          setLetterRevealData({
            letter: null,
            collected: lastData.collected_letters || [],
            config: selectedCompetitionForEntry?.letters_config || {},
            prize: wonPrize
          });
          setShowBagReveal(true);
        }
        
        if (wonPrize) {
          setShowWinCelebration(true);
        }
      } else {
        toast.error(lastData.error);
      }
      setShowBagPurchaseDialog(false);
      setBagPurchaseQuantity(1);
    },
    onError: (error) => {
      toast.error('حدث خطأ: ' + error.message);
    }
  });

  // Mystery box mutation
  const enterMysteryBoxMutation = useMutation({
    mutationFn: async (competitionId: string) => {
      const { data, error } = await supabase.rpc('enter_mystery_box_competition', {
        comp_id: competitionId
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['user-ticket-balance'] });
        queryClient.invalidateQueries({ queryKey: ['my-competition-tickets'] });
        queryClient.invalidateQueries({ queryKey: ['competition-ticket-counts'] });
        setInstantRevealResult({ isWinner: true, prize: data.prize });
        setShowInstantReveal(true);
        setShowWinCelebration(true);
      } else {
        toast.error(data.error);
      }
    },
    onError: (error) => {
      toast.error('حدث خطأ: ' + error.message);
    }
  });

  // Everyone wins mutation
  const enterEveryoneWinsMutation = useMutation({
    mutationFn: async (competitionId: string) => {
      const { data, error } = await supabase.rpc('enter_everyone_wins_competition', {
        comp_id: competitionId
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['user-ticket-balance'] });
        queryClient.invalidateQueries({ queryKey: ['my-competition-tickets'] });
        queryClient.invalidateQueries({ queryKey: ['competition-ticket-counts'] });
        setInstantRevealResult({ isWinner: true, prize: data.prize });
        setShowInstantReveal(true);
        setShowWinCelebration(true);
      } else {
        toast.error(data.error);
      }
    },
    onError: (error) => {
      toast.error('حدث خطأ: ' + error.message);
    }
  });

  const enterCompetitionMutation = useMutation({
    mutationFn: async (competitionId: string) => {
      const { data, error } = await supabase.rpc('enter_competition_with_tickets', {
        comp_id: competitionId
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['user-ticket-balance'] });
        queryClient.invalidateQueries({ queryKey: ['my-competition-tickets'] });
        queryClient.invalidateQueries({ queryKey: ['competition-ticket-counts'] });
        toast.success(`🎟️ تم الدخول بنجاح! رقم تذكرتك: ${data.ticket_number}`);
      } else {
        toast.error(data.error);
      }
    },
    onError: (error) => {
      toast.error('حدث خطأ: ' + error.message);
    }
  });

  // Handle competition entry based on type
  const handleCompetitionEntry = useCallback((comp: Competition, quantity: number = 1) => {
    if (!comp) return;
    
    switch (comp.competition_type) {
      case 'instant_winner':
        enterInstantWinMutation.mutate(comp.id);
        break;
      case 'collect_letters':
        enterCollectLettersMutation.mutate({ competitionId: comp.id, quantity });
        break;
      case 'mystery_box':
        enterMysteryBoxMutation.mutate(comp.id);
        break;
      case 'everyone_wins':
        enterEveryoneWinsMutation.mutate(comp.id);
        break;
      default:
        enterCompetitionMutation.mutate(comp.id);
    }
  }, [enterInstantWinMutation, enterCollectLettersMutation, enterMysteryBoxMutation, enterEveryoneWinsMutation, enterCompetitionMutation]);

  const getAllImages = useCallback((comp: Competition): string[] => {
    if (comp.images?.length) return comp.images;
    if (comp.image_url) return [comp.image_url];
    return [];
  }, []);

  const getProgress = useCallback((comp: Competition) => {
    const count = ticketCounts?.[comp.id] || 0;
    if (comp.max_tickets) return (count / comp.max_tickets) * 100;
    if (comp.target_participants) return (count / comp.target_participants) * 100;
    return 0;
  }, [ticketCounts]);

  // Auto-slide for details dialog - only when dialog is open
  useEffect(() => {
    if (!showDetailsDialog || !selectedCompetitionForDetails) return;
    
    const compImages = getAllImages(selectedCompetitionForDetails);
    if (compImages.length <= 1) return;
    
    const interval = setInterval(() => {
      setDetailsSlideIndex(prev => (prev + 1) % compImages.length);
    }, 4000);
    
    return () => clearInterval(interval);
  }, [showDetailsDialog, selectedCompetitionForDetails, getAllImages]);

  const handleOpenDetails = useCallback((comp: Competition) => {
    setSelectedCompetitionForDetails(comp);
    setDetailsSlideIndex(0);
    setShowDetailsDialog(true);
  }, []);

  const handleEnterCompetition = useCallback((comp: Competition) => {
    setSelectedCompetitionForEntry(comp);
    setShowEnterConfirm(true);
  }, []);

  const ticketPrice = ticketSettings?.price ?? 250;
  const totalTicketCost = ticketPurchaseQuantity * ticketPrice;
  const canBuyTickets = wallet && wallet.balance >= totalTicketCost;

  // Memoize gallery images
  const galleryImages = useMemo(() => {
    if (!galleryCompetition) return [];
    return getAllImages(galleryCompetition);
  }, [galleryCompetition, getAllImages]);

  // Memoize details images
  const detailsImages = useMemo(() => {
    if (!selectedCompetitionForDetails) return [];
    return getAllImages(selectedCompetitionForDetails);
  }, [selectedCompetitionForDetails, getAllImages]);

  return (
    <div className="min-h-screen bg-background flex flex-col" dir="rtl">
      {/* Insufficient Balance Dialog */}
      <AlertDialog open={showInsufficientBalance} onOpenChange={setShowInsufficientBalance}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Wallet className="h-5 w-5" />
              رصيد غير كافٍ
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              رصيد المحفظة غير كافٍ لشراء {ticketPurchaseQuantity} تذكرة.
              <br />
              المطلوب: <span className="font-bold text-foreground">{totalTicketCost.toLocaleString()} دينار</span>
              <br />
              رصيدك الحالي: <span className="font-bold text-foreground">{(wallet?.balance || 0).toLocaleString()} دينار</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>إغلاق</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Purchase Confirmation Dialog */}
      <AlertDialog open={showPurchaseConfirm} onOpenChange={setShowPurchaseConfirm}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Ticket className="h-5 w-5 text-primary" />
              تأكيد شراء التذاكر
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              هل تريد شراء <span className="font-bold text-foreground">{ticketPurchaseQuantity} تذكرة</span> بمبلغ <span className="font-bold text-foreground">{totalTicketCost.toLocaleString()} دينار</span>؟
              <br />
              <span className="text-muted-foreground text-sm">سيتم خصم المبلغ من رصيد المحفظة.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogAction
              onClick={() => {
                purchaseTicketsMutation.mutate(ticketPurchaseQuantity);
                setShowPurchaseConfirm(false);
              }}
              className="gap-1"
            >
              <ShoppingCart className="h-4 w-4" />
              تأكيد الشراء
            </AlertDialogAction>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Fixed Ticket Purchase Bar */}
      <div className="sticky top-0 z-50 bg-card/95 backdrop-blur border-b shadow-sm">
        <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-3">
          {/* Mobile Layout */}
          <div className="flex flex-col gap-2 sm:hidden">
            {/* Row 1: Balance info */}
            <div className="flex items-center justify-center gap-2">
              {user && (
                <div className="inline-flex items-center gap-1 px-2 py-1 bg-secondary/50 rounded-full text-xs">
                  <Ticket className="h-3 w-3 text-primary" />
                  <span className="font-medium">{userTicketBalance || 0}</span>
                </div>
              )}
              {user && wallet && (
                <div className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 rounded-full text-xs">
                  <Wallet className="h-3 w-3 text-primary" />
                  <span className="font-medium">{wallet.balance.toLocaleString()}</span>
                </div>
              )}
            </div>
            
            {/* Row 2: Purchase controls */}
            <div className="flex items-center justify-center gap-1.5">
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setTicketPurchaseQuantity(q => Math.max(1, q - 1))}
                  disabled={ticketPurchaseQuantity <= 1}
                >
                  <Minus className="h-2.5 w-2.5" />
                </Button>
                <Input
                  type="number"
                  min={1}
                  value={ticketPurchaseQuantity}
                  onChange={(e) => setTicketPurchaseQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-10 h-6 text-center text-xs px-0.5"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setTicketPurchaseQuantity(q => q + 1)}
                >
                  <Plus className="h-2.5 w-2.5" />
                </Button>
              </div>
              
              <span className="text-xs font-bold text-primary whitespace-nowrap">
                {totalTicketCost.toLocaleString()}
              </span>
              
              <Button 
                size="sm"
                className="gap-0.5 h-6 px-2 text-xs"
                onClick={() => {
                  if (!user) {
                    toast.error('يجب تسجيل الدخول أولاً');
                    navigate('/auth');
                    return;
                  }
                  if (!canBuyTickets) {
                    setShowInsufficientBalance(true);
                    return;
                  }
                  setShowPurchaseConfirm(true);
                }}
                disabled={purchaseTicketsMutation.isPending}
              >
                {purchaseTicketsMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <ShoppingCart className="h-3 w-3" />
                )}
                شراء
              </Button>
              
              <Button 
                variant="outline"
                size="sm"
                className="gap-0.5 h-6 px-2 text-xs"
                onClick={() => {
                  if (!user) {
                    toast.error('يجب تسجيل الدخول أولاً');
                    navigate('/auth');
                    return;
                  }
                  setShowBundleOffers(true);
                }}
              >
                <Sparkles className="h-3 w-3" />
                عروض
              </Button>
            </div>
          </div>

          {/* Desktop Layout */}
          <div className="hidden sm:flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Ticket className="h-5 w-5 text-primary" />
                <span className="font-medium text-sm">شراء تذاكر</span>
              </div>
              
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setTicketPurchaseQuantity(q => Math.max(1, q - 1))}
                  disabled={ticketPurchaseQuantity <= 1}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <Input
                  type="number"
                  min={1}
                  value={ticketPurchaseQuantity}
                  onChange={(e) => setTicketPurchaseQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-14 h-7 text-center text-sm px-1"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setTicketPurchaseQuantity(q => q + 1)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              
              <span className="text-sm font-bold text-primary">
                {totalTicketCost.toLocaleString()} دينار
              </span>
              
              <Button 
                size="sm"
                className="gap-1"
                onClick={() => {
                  if (!user) {
                    toast.error('يجب تسجيل الدخول أولاً');
                    navigate('/auth');
                    return;
                  }
                  if (!canBuyTickets) {
                    setShowInsufficientBalance(true);
                    return;
                  }
                  setShowPurchaseConfirm(true);
                }}
                disabled={purchaseTicketsMutation.isPending}
              >
                {purchaseTicketsMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShoppingCart className="h-4 w-4" />
                )}
                شراء
              </Button>
              
              {/* Bundle Offers Button */}
              <Button 
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => {
                  if (!user) {
                    toast.error('يجب تسجيل الدخول أولاً');
                    navigate('/auth');
                    return;
                  }
                  setShowBundleOffers(true);
                }}
              >
                <Sparkles className="h-4 w-4" />
                عروض
              </Button>
            </div>

            <div className="flex items-center gap-3">
              {user && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-secondary/50 rounded-full text-sm">
                  <Ticket className="h-4 w-4 text-primary" />
                  <span className="font-medium">{userTicketBalance || 0} تذكرة</span>
                </div>
              )}
              {user && wallet && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full text-sm">
                  <Wallet className="h-4 w-4 text-primary" />
                  <span className="font-medium">{wallet.balance.toLocaleString()} دينار</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <main className="flex-1 container mx-auto px-4 py-6">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold flex items-center justify-center gap-2 mb-1">
            <Trophy className="h-6 w-6 text-primary" />
            المسابقات والسحوبات
          </h1>
          <p className="text-sm text-muted-foreground">اشترك في المسابقات واربح جوائز قيمة!</p>
          
          <div className="flex items-center justify-center gap-3 mt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/competitions/history')}
              className="gap-1"
            >
              <History className="h-4 w-4" />
              السجل
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : competitions?.length === 0 ? (
          <Card className="text-center py-8 max-w-sm mx-auto">
            <CardContent className="pt-6">
              <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">لا توجد مسابقات نشطة حالياً</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {competitions?.map((comp) => (
              <CompetitionCard
                key={comp.id}
                competition={comp}
                ticketCount={ticketCounts?.[comp.id] || 0}
                myTicketList={myTickets?.[comp.id] || []}
                userTicketBalance={userTicketBalance || 0}
                onOpenDetails={handleOpenDetails}
                onEnterCompetition={handleEnterCompetition}
                isEntering={enterCompetitionMutation.isPending}
                isAuthenticated={!!user}
                winners={winnersInfo?.[comp.id] || []}
              />
            ))}
          </div>
        )}
      </main>

      <Footer />

      {/* Gallery Dialog */}
      <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden" aria-describedby={undefined}>
          <VisuallyHidden>
            <DialogTitle>معرض الصور</DialogTitle>
          </VisuallyHidden>
          {galleryCompetition && (
            <div className="relative">
              <img
                src={galleryImages[galleryIndex]}
                alt={galleryCompetition.title_ar}
                className="w-full max-h-[80vh] object-contain"
                loading="lazy"
              />
              {galleryImages.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                    onClick={() => setGalleryIndex((galleryIndex - 1 + galleryImages.length) % galleryImages.length)}
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                    onClick={() => setGalleryIndex((galleryIndex + 1) % galleryImages.length)}
                  >
                    <ChevronRight className="h-6 w-6" />
                  </Button>
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                    {galleryImages.map((_, idx) => (
                      <button
                        key={idx}
                        className={`w-2.5 h-2.5 rounded-full transition-colors ${idx === galleryIndex ? 'bg-white' : 'bg-white/50'}`}
                        onClick={() => setGalleryIndex(idx)}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Enter Competition Confirmation Dialog */}
      <AlertDialog open={showEnterConfirm} onOpenChange={(open) => {
        setShowEnterConfirm(open);
        if (!open) {
          setBagPurchaseQuantity(1);
        }
      }}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Ticket className="h-5 w-5 text-primary" />
              {selectedCompetitionForEntry?.competition_type === 'collect_letters' ? 'اجمع أحرف واربح!' : 'تأكيد الدخول في المسابقة'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right" asChild>
              <div>
                {selectedCompetitionForEntry && (
                  <>
                    <p className="mb-3">
                      هل تريد الدخول في مسابقة <span className="font-bold text-foreground">{selectedCompetitionForEntry.title_ar}</span>؟
                    </p>
                    
                    {/* Bag quantity selector for collect_letters with bags animation */}
                    {selectedCompetitionForEntry.competition_type === 'collect_letters' && 
                     selectedCompetitionForEntry.letters_config?.animation_type !== 'scratch' && (
                      <div className="mt-4 p-4 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-red-500/10 rounded-xl border border-amber-500/20">
                        <p className="font-semibold mb-3 flex items-center gap-2">
                          <Package className="h-5 w-5 text-amber-600" />
                          كم كيس تريد فتحه؟
                        </p>
                        <div className="flex items-center justify-center gap-3">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setBagPurchaseQuantity(q => Math.max(1, q - 1))}
                            disabled={bagPurchaseQuantity <= 1}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <Input
                            type="number"
                            min={1}
                            max={selectedCompetitionForEntry.letters_config?.max_bags_per_purchase || 10}
                            value={bagPurchaseQuantity}
                            onChange={(e) => setBagPurchaseQuantity(Math.max(1, Math.min(
                              selectedCompetitionForEntry.letters_config?.max_bags_per_purchase || 10,
                              parseInt(e.target.value) || 1
                            )))}
                            className="w-20 h-10 text-center text-lg font-bold"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setBagPurchaseQuantity(q => Math.min(
                              selectedCompetitionForEntry.letters_config?.max_bags_per_purchase || 10,
                              q + 1
                            ))}
                            disabled={bagPurchaseQuantity >= (selectedCompetitionForEntry.letters_config?.max_bags_per_purchase || 10)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        <p className="text-center mt-3 text-sm text-muted-foreground">
                          سيتم خصم <span className="font-bold text-foreground">{bagPurchaseQuantity * (selectedCompetitionForEntry.required_tickets || 1)} تذكرة</span>
                        </p>
                        <p className="text-center text-xs text-muted-foreground mt-1">
                          الحد الأقصى: {selectedCompetitionForEntry.letters_config?.max_bags_per_purchase || 10} أكياس
                        </p>
                      </div>
                    )}
                    
                    {/* Standard message for other types or scratch animation */}
                    {(selectedCompetitionForEntry.competition_type !== 'collect_letters' || 
                      selectedCompetitionForEntry.letters_config?.animation_type === 'scratch') && (
                      <p className="text-muted-foreground text-sm">
                        سيتم خصم <span className="font-bold text-foreground">{selectedCompetitionForEntry.required_tickets || 1} تذكرة</span> من رصيدك.
                      </p>
                    )}
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogAction
              onClick={() => {
                if (selectedCompetitionForEntry) {
                  const quantity = selectedCompetitionForEntry.competition_type === 'collect_letters' && 
                    selectedCompetitionForEntry.letters_config?.animation_type !== 'scratch' 
                    ? bagPurchaseQuantity : 1;
                  handleCompetitionEntry(selectedCompetitionForEntry, quantity);
                }
                setShowEnterConfirm(false);
                setSelectedCompetitionForEntry(null);
              }}
              className="gap-1"
              disabled={enterCompetitionMutation.isPending || enterInstantWinMutation.isPending || enterCollectLettersMutation.isPending || enterMysteryBoxMutation.isPending || enterEveryoneWinsMutation.isPending}
            >
              {(enterCompetitionMutation.isPending || enterInstantWinMutation.isPending || enterCollectLettersMutation.isPending || enterMysteryBoxMutation.isPending || enterEveryoneWinsMutation.isPending) ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                selectedCompetitionForEntry?.competition_type === 'collect_letters' && 
                selectedCompetitionForEntry?.letters_config?.animation_type !== 'scratch' ? (
                  <Package className="h-4 w-4" />
                ) : (
                  <Ticket className="h-4 w-4" />
                )
              )}
              {selectedCompetitionForEntry?.competition_type === 'collect_letters' && 
               selectedCompetitionForEntry?.letters_config?.animation_type !== 'scratch' 
                ? `افتح ${bagPurchaseQuantity} كيس` 
                : 'تأكيد الدخول'}
            </AlertDialogAction>
            <AlertDialogCancel onClick={() => {
              setSelectedCompetitionForEntry(null);
              setBagPurchaseQuantity(1);
            }}>إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Competition Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={(open) => {
        setShowDetailsDialog(open);
        if (!open) {
          setDetailsSlideIndex(0);
          setSelectedCompetitionForDetails(null);
        }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] p-0 overflow-hidden" dir="rtl" aria-describedby={undefined}>
          <VisuallyHidden>
            <DialogTitle>{selectedCompetitionForDetails?.title_ar || 'تفاصيل المسابقة'}</DialogTitle>
          </VisuallyHidden>
          {selectedCompetitionForDetails && (() => {
            const comp = selectedCompetitionForDetails;
            const ticketCount = ticketCounts?.[comp.id] || 0;
            const myTicketList = myTickets?.[comp.id] || [];
            const hasTicket = myTicketList.length > 0;
            const isWinner = myTicketList.some(t => t.is_winner);
            const isSoldOut = comp.max_tickets ? ticketCount >= comp.max_tickets : false;
            const isEnded = comp.status === 'completed' || (comp.end_date && new Date(comp.end_date) < new Date());
            const requiredTickets = comp.required_tickets || 1;
            const canEnter = (userTicketBalance || 0) >= requiredTickets;

            return (
              <>
                {/* Header Image Slideshow */}
                {detailsImages.length > 0 && (
                  <div className="relative h-56 md:h-64 overflow-hidden bg-gradient-to-b from-background/5 to-background">
                    {/* Background blur */}
                    <div className="absolute inset-0 overflow-hidden">
                      <img 
                        src={detailsImages[detailsSlideIndex % detailsImages.length]} 
                        alt=""
                        className="w-full h-full object-cover blur-2xl scale-110 opacity-40"
                        loading="lazy"
                      />
                    </div>
                    
                    {/* Main image */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <img 
                        src={detailsImages[detailsSlideIndex % detailsImages.length]} 
                        alt={comp.title_ar}
                        className="max-w-[90%] max-h-[90%] object-contain rounded-lg shadow-2xl"
                        loading="lazy"
                      />
                    </div>
                    
                    {/* Overlays */}
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent pointer-events-none" />
                    <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-background/80 to-transparent pointer-events-none" />
                    
                    {isWinner && (
                      <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/90 to-amber-600/90 flex items-center justify-center">
                        <div className="text-center text-white">
                          <Crown className="h-16 w-16 mx-auto mb-3" />
                          <p className="font-bold text-xl">مبروك! أنت الفائز!</p>
                        </div>
                      </div>
                    )}
                    
                    {comp.status === 'completed' && !isWinner && (
                      <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                        <Badge variant="secondary" className="text-lg px-6 py-3">انتهت المسابقة</Badge>
                      </div>
                    )}
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-3 right-3 bg-black/40 hover:bg-black/60 text-white z-10 rounded-full h-10 w-10"
                      onClick={() => setShowDetailsDialog(false)}
                    >
                      <ArrowRight className="h-5 w-5" />
                    </Button>
                    
                    {detailsImages.length > 1 && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white z-10 rounded-full h-10 w-10"
                          onClick={() => setDetailsSlideIndex(prev => (prev - 1 + detailsImages.length) % detailsImages.length)}
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white z-10 rounded-full h-10 w-10"
                          onClick={() => setDetailsSlideIndex(prev => (prev + 1) % detailsImages.length)}
                        >
                          <ChevronRight className="h-5 w-5" />
                        </Button>
                        
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10 bg-black/30 backdrop-blur-md px-3 py-2 rounded-full">
                          {detailsImages.map((_, idx) => (
                            <button
                              key={idx}
                              onClick={() => setDetailsSlideIndex(idx)}
                              className={`rounded-full transition-all ${
                                idx === (detailsSlideIndex % detailsImages.length) 
                                  ? 'bg-white w-6 h-2' 
                                  : 'bg-white/40 w-2 h-2'
                              }`}
                            />
                          ))}
                        </div>
                        
                        <Badge className="absolute top-3 left-3 bg-black/40 text-white gap-1 text-xs px-2.5 py-1 border-0">
                          <Images className="h-3.5 w-3.5" />
                          {(detailsSlideIndex % detailsImages.length) + 1}/{detailsImages.length}
                        </Badge>
                      </>
                    )}
                    
                    {detailsImages.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute bottom-4 left-3 bg-black/40 hover:bg-black/60 text-white gap-1.5 z-10 rounded-full"
                        onClick={() => {
                          setGalleryCompetition(comp);
                          setGalleryIndex(detailsSlideIndex % detailsImages.length);
                          setGalleryOpen(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                        {detailsImages.length > 1 ? `عرض ${detailsImages.length} صور` : 'تكبير'}
                      </Button>
                    )}
                  </div>
                )}

                <ScrollArea className="max-h-[calc(90vh-16rem)]">
                  <div className="p-5 space-y-4">
                    {/* Title */}
                    <div>
                      <h2 className="text-xl font-bold">{comp.title_ar}</h2>
                      {comp.title !== comp.title_ar && (
                        <p className="text-sm text-muted-foreground">{comp.title}</p>
                      )}
                    </div>

                    {/* Prize - Enhanced Display */}
                    <div className="relative overflow-hidden rounded-xl border border-primary/20">
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent" />
                      <div className="absolute top-0 right-0 w-20 h-20 bg-primary/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                      
                      <div className="relative p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-full bg-primary/20">
                            <Gift className="h-5 w-5 text-primary" />
                          </div>
                          <span className="font-bold text-lg">الجائزة</span>
                          {comp.prize_value && (
                            <Badge variant="secondary" className="mr-auto bg-primary/20 text-primary border-0">
                              {comp.prize_value.toLocaleString()} {comp.currency}
                            </Badge>
                          )}
                        </div>
                        
                        <div className="pr-2 border-r-2 border-primary/40">
                          <p className="text-foreground leading-relaxed">{comp.prize_description_ar}</p>
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    {comp.description_ar && comp.description_ar !== comp.prize_description_ar && (
                      <div className="bg-secondary/30 rounded-lg p-4">
                        <h3 className="font-semibold mb-2 flex items-center gap-2 text-sm">
                          <Info className="h-4 w-4 text-muted-foreground" />
                          تفاصيل المسابقة
                        </h3>
                        <p className="text-muted-foreground text-sm leading-relaxed">{comp.description_ar}</p>
                      </div>
                    )}

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-secondary/50 rounded-lg p-3 text-center">
                        <Users className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                        <p className="text-lg font-bold">{ticketCount}</p>
                        <p className="text-xs text-muted-foreground">مشترك</p>
                      </div>
                      <div className="bg-secondary/50 rounded-lg p-3 text-center">
                        <Ticket className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                        <p className="text-lg font-bold">{requiredTickets}</p>
                        <p className="text-xs text-muted-foreground">تذاكر للدخول</p>
                      </div>
                    </div>

                    {/* Progress */}
                    {(comp.max_tickets || comp.target_participants) && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>التقدم</span>
                          <span className="text-muted-foreground">
                            {ticketCount} / {comp.max_tickets || comp.target_participants}
                          </span>
                        </div>
                        <Progress value={getProgress(comp)} className="h-2" />
                      </div>
                    )}

                    {/* Collected Letters Display for collect_letters competitions */}
                    {comp.competition_type === 'collect_letters' && user && collectedLettersData?.[comp.id] && (
                      <CollectedLettersDisplay
                        collectedLetters={collectedLettersData[comp.id] || []}
                        lettersConfig={comp.letters_config || { target_word: '', prize_words: [] }}
                        competitionId={comp.id}
                        onRedeemSuccess={() => refetchCollectedLetters()}
                      />
                    )}

                    {/* Dates */}
                    <div className="space-y-2 text-sm">
                      {comp.start_date && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <span>بداية: {formatBaghdadTime(comp.start_date)}</span>
                        </div>
                      )}
                      {comp.end_date && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span>نهاية: {formatBaghdadTime(comp.end_date)}</span>
                        </div>
                      )}
                      {comp.draw_date && (
                        <div className="flex items-center gap-2 text-primary">
                          <Trophy className="h-4 w-4" />
                          <span>موعد السحب: {formatBaghdadTime(comp.draw_date)}</span>
                        </div>
                      )}
                    </div>

                    {/* Countdown */}
                    {comp.status === 'active' && comp.competition_type === 'timed' && comp.end_date && (
                      <div className="border rounded-lg p-3">
                        <p className="text-sm text-muted-foreground mb-2 text-center">الوقت المتبقي</p>
                        <CountdownTimer endDate={comp.end_date} />
                      </div>
                    )}

                    {/* Winners List for completed competitions */}
                    {comp.status === 'completed' && winnersInfo?.[comp.id] && winnersInfo[comp.id].length > 0 && (
                      <div className="bg-gradient-to-br from-yellow-500/10 via-amber-500/10 to-orange-500/10 border border-yellow-500/30 rounded-xl p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-full bg-yellow-500/20">
                            <Crown className="h-5 w-5 text-yellow-600" />
                          </div>
                          <span className="font-bold text-lg">
                            {winnersInfo[comp.id].length > 1 ? 'الفائزون' : 'الفائز'}
                          </span>
                          <Badge variant="secondary" className="mr-auto bg-yellow-500/20 text-yellow-700 border-0">
                            {winnersInfo[comp.id].length} {winnersInfo[comp.id].length > 1 ? 'فائزين' : 'فائز'}
                          </Badge>
                        </div>
                        
                        <div className="space-y-2">
                          {winnersInfo[comp.id].map((winner, idx) => (
                            <div 
                              key={idx}
                              className={`flex items-center gap-3 p-3 rounded-lg ${
                                winner.user_id === user?.id 
                                  ? 'bg-yellow-500/30 border border-yellow-500/50 shadow-lg' 
                                  : 'bg-background/50'
                              }`}
                            >
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                                winner.user_id === user?.id 
                                  ? 'bg-yellow-500 text-white' 
                                  : 'bg-muted text-muted-foreground'
                              }`}>
                                {idx + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold truncate flex items-center gap-1">
                                  {winner.full_name || winner.username}
                                  {winner.user_id === user?.id && (
                                    <Badge className="bg-yellow-500 text-white text-xs">أنت!</Badge>
                                  )}
                                </p>
                                <p className="text-xs text-muted-foreground">@{winner.username}</p>
                              </div>
                              <Badge variant="outline" className="text-xs font-mono">
                                #{winner.ticket_number}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* My Tickets */}
                    {hasTicket && (
                      <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
                        <p className="font-semibold mb-2 flex items-center gap-2">
                          <Ticket className="h-4 w-4" />
                          تذاكري ({myTicketList.length})
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {myTicketList.map((t, idx) => (
                            <Badge 
                              key={idx} 
                              variant={t.is_winner ? "default" : "secondary"}
                              className={t.is_winner ? "bg-yellow-500 text-white" : ""}
                            >
                              {t.ticket_number}
                              {t.is_winner && <Crown className="h-3 w-3 mr-1" />}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Enter Button */}
                    {comp.status === 'active' && !isSoldOut && !isEnded && (
                      <Button
                        className="w-full gap-2"
                        size="lg"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!user) {
                            toast.error('يجب تسجيل الدخول أولاً');
                            navigate('/auth');
                            return;
                          }
                          setSelectedCompetitionForEntry(comp);
                          setShowEnterConfirm(true);
                          setShowDetailsDialog(false);
                        }}
                        disabled={enterCompetitionMutation.isPending || !canEnter}
                      >
                        {enterCompetitionMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Ticket className="h-4 w-4" />
                        )}
                        {canEnter ? `دخول المسابقة (${requiredTickets} تذكرة)` : `تحتاج ${requiredTickets} تذكرة للدخول`}
                      </Button>
                    )}

                    {isSoldOut && comp.status === 'active' && (
                      <Badge variant="secondary" className="w-full justify-center py-3 text-base">نفذت التذاكر</Badge>
                    )}
                  </div>
                </ScrollArea>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      <CelebrationEffect 
        isActive={showWinCelebration} 
        onComplete={() => setShowWinCelebration(false)}
      />

      {/* Instant Win Reveal Dialog */}
      <InstantWinReveal
        isOpen={showInstantReveal}
        onClose={() => {
          setShowInstantReveal(false);
          setInstantRevealResult(null);
        }}
        prize={instantRevealResult?.prize}
        competitionType={selectedCompetitionForEntry?.competition_type as 'instant_winner' | 'everyone_wins' | 'mystery_box' || 'instant_winner'}
        isWinner={instantRevealResult?.isWinner || false}
      />

      {/* Letter Reveal Dialog (Single - for scratch animation) */}
      {letterRevealData && (
        <ScratchCardReveal
          isOpen={showScratchReveal}
          onClose={() => {
            setShowScratchReveal(false);
            setLetterRevealData(null);
          }}
          awardedLetter={letterRevealData.letter}
          collectedLetters={letterRevealData.collected}
          lettersConfig={letterRevealData.config}
          wonPrize={letterRevealData.prize}
          allowSkip={letterRevealData.config?.allow_skip_animation !== false}
        />
      )}

      {/* Letter Reveal Dialog (Single - for bags animation) */}
      {letterRevealData && (
        <LetterReveal
          isOpen={showLetterReveal}
          onClose={() => {
            setShowLetterReveal(false);
            setLetterRevealData(null);
          }}
          awardedLetter={letterRevealData.letter}
          collectedLetters={letterRevealData.collected}
          lettersConfig={letterRevealData.config}
          wonPrize={letterRevealData.prize}
        />
      )}

      {/* Bag Open Reveal Dialog (Multiple bags) */}
      {letterRevealData && (
        <BagOpenReveal
          isOpen={showBagReveal}
          onClose={() => {
            setShowBagReveal(false);
            setLetterRevealData(null);
            setBagRevealResults([]);
          }}
          results={bagRevealResults}
          collectedLetters={letterRevealData.collected}
          lettersConfig={letterRevealData.config}
          wonPrize={letterRevealData.prize}
          allowSkip={letterRevealData.config?.allow_skip_animation !== false}
        />
      )}

      {/* Bundle Offers Dialog */}
      <Dialog open={showBundleOffers} onOpenChange={setShowBundleOffers}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            عروض التذاكر الخاصة
          </DialogTitle>
          <DialogDescription>
            اشترِ المزيد واحصل على تذاكر هدية!
          </DialogDescription>

          <ScrollArea className="max-h-[70vh]">
            <div className="pb-4">
              <TicketBundleOffer
                bundles={ticketBundles || defaultBundles}
                onSelectBundle={(bundle) => {
                  if (wallet && wallet.balance >= bundle.price) {
                    purchaseBundleMutation.mutate(bundle);
                  } else {
                    toast.error('رصيد المحفظة غير كافٍ');
                  }
                }}
                walletBalance={wallet?.balance || 0}
                isLoading={purchaseBundleMutation.isPending}
              />
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
