import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trophy, Ticket, Users, Gift, Loader2, Clock, Crown, Wallet, Plus, Minus, History, ChevronLeft, ChevronRight, Images, ChevronDown, Calendar, ShoppingCart, ArrowRight, Info, Eye } from "lucide-react";
import { toast } from "sonner";
import { format, addHours } from "date-fns";
import { ar } from "date-fns/locale";

// Helper function to format date in Baghdad timezone (UTC+3)
const formatBaghdadTime = (dateString: string, formatStr: string = 'dd MMM yyyy - hh:mm a') => {
  const date = new Date(dateString);
  // Baghdad is UTC+3
  const baghdadDate = addHours(date, 3);
  return format(baghdadDate, formatStr, { locale: ar });
};
import CountdownTimer from "@/components/CountdownTimer";
import CelebrationEffect from "@/components/CelebrationEffect";

type CompetitionType = 'ticket_count' | 'all_tickets_sold' | 'timed' | 'free';

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
  currency: string;
  required_tickets: number;
}

export default function Competitions() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showWinCelebration, setShowWinCelebration] = useState(false);
  const [winningTicket, setWinningTicket] = useState<string | null>(null);
  const [imageIndexes, setImageIndexes] = useState<Record<string, number>>({});
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryCompetition, setGalleryCompetition] = useState<Competition | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Record<string, boolean>>({});
  const [ticketPurchaseQuantity, setTicketPurchaseQuantity] = useState(1);
  const [showPurchaseConfirm, setShowPurchaseConfirm] = useState(false);
  const [showInsufficientBalance, setShowInsufficientBalance] = useState(false);
  const [showEnterConfirm, setShowEnterConfirm] = useState(false);
  const [selectedCompetitionForEntry, setSelectedCompetitionForEntry] = useState<Competition | null>(null);
  const [selectedCompetitionForDetails, setSelectedCompetitionForDetails] = useState<Competition | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [detailsSlideIndex, setDetailsSlideIndex] = useState(0);

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
    enabled: !!user
  });

  const { data: ticketSettings } = useQuery({
    queryKey: ['ticket-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('default_settings')
        .select('setting_value')
        .eq('setting_key', 'ticket_price')
        .single();
      
      if (error && error.code !== 'PGRST116') return { price: 1000 };
      return data?.setting_value as { price: number } || { price: 1000 };
    }
  });

  const purchaseTicketsMutation = useMutation({
    mutationFn: async (quantity: number) => {
      const { data, error } = await supabase.rpc('purchase_tickets', {
        ticket_quantity: quantity,
        price_per_ticket: ticketSettings?.price || 1000
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

  const getAllImages = (comp: Competition): string[] => {
    const images: string[] = [];
    if (comp.images && comp.images.length > 0) {
      images.push(...comp.images);
    } else if (comp.image_url) {
      images.push(comp.image_url);
    }
    return images;
  };

  const getCurrentImageIndex = (compId: string) => {
    return imageIndexes[compId] || 0;
  };

  const navigateImage = (compId: string, images: string[], direction: 'next' | 'prev') => {
    const current = getCurrentImageIndex(compId);
    let newIndex: number;
    if (direction === 'next') {
      newIndex = (current + 1) % images.length;
    } else {
      newIndex = (current - 1 + images.length) % images.length;
    }
    setImageIndexes(prev => ({ ...prev, [compId]: newIndex }));
  };

  // Auto-slide for details dialog images
  useEffect(() => {
    if (!showDetailsDialog || !selectedCompetitionForDetails) return;
    
    const compImages = getAllImages(selectedCompetitionForDetails);
    if (compImages.length <= 1) return;
    
    const interval = setInterval(() => {
      setDetailsSlideIndex(prev => (prev + 1) % compImages.length);
    }, 3000); // Change image every 3 seconds
    
    return () => clearInterval(interval);
  }, [showDetailsDialog, selectedCompetitionForDetails]);

  const openGallery = (comp: Competition, startIndex: number = 0) => {
    setGalleryCompetition(comp);
    setGalleryIndex(startIndex);
    setGalleryOpen(true);
  };

  const toggleDescription = (compId: string) => {
    setExpandedDescriptions(prev => ({ ...prev, [compId]: !prev[compId] }));
  };

  const ticketPrice = ticketSettings?.price || 1000;
  const totalTicketCost = ticketPurchaseQuantity * ticketPrice;
  const canBuyTickets = wallet && wallet.balance >= totalTicketCost;

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
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
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
            {competitions?.map((comp) => {
              const ticketCount = ticketCounts?.[comp.id] || 0;
              const myTicketList = myTickets?.[comp.id] || [];
              const hasTicket = myTicketList.length > 0;
              const isWinner = myTicketList.some(t => t.is_winner);
              const isSoldOut = comp.max_tickets ? ticketCount >= comp.max_tickets : false;
              const isEnded = comp.status === 'completed' || (comp.end_date && new Date(comp.end_date) < new Date());

              const compImages = getAllImages(comp);
              const currentImageIndex = getCurrentImageIndex(comp.id);
              const isDescriptionExpanded = expandedDescriptions[comp.id];
              const prizeText = comp.prize_description_ar;
              const shouldTruncate = prizeText.length > 40;
              const requiredTickets = comp.required_tickets || 1;
              const canEnter = (userTicketBalance || 0) >= requiredTickets;

              return (
                <Card 
                  key={comp.id} 
                  className="overflow-hidden hover:shadow-md transition-all cursor-pointer"
                  onClick={() => {
                    setSelectedCompetitionForDetails(comp);
                    setShowDetailsDialog(true);
                  }}
                >
                  {compImages.length > 0 && (
                    <div className="relative h-36 md:h-40 overflow-hidden group">
                      {/* Image with smooth transition */}
                      <div className="relative w-full h-full">
                        {compImages.map((img, idx) => (
                          <img 
                            key={idx}
                            src={img} 
                            alt={`${comp.title_ar} - ${idx + 1}`}
                            className={`absolute inset-0 w-full h-full object-cover transition-all duration-500 ease-in-out ${
                              idx === currentImageIndex 
                                ? 'opacity-100 scale-100' 
                                : 'opacity-0 scale-105'
                            }`}
                          />
                        ))}
                      </div>
                      
                      {/* Gradient overlay for better text visibility */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
                      
                      {compImages.length > 1 && (
                        <>
                          {/* Navigation buttons with better styling */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 backdrop-blur-sm text-white opacity-0 group-hover:opacity-100 transition-all duration-300 h-8 w-8 rounded-full shadow-lg"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigateImage(comp.id, compImages, 'prev');
                            }}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 backdrop-blur-sm text-white opacity-0 group-hover:opacity-100 transition-all duration-300 h-8 w-8 rounded-full shadow-lg"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigateImage(comp.id, compImages, 'next');
                            }}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                          
                          {/* Improved dots indicator */}
                          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/30 backdrop-blur-sm px-2 py-1 rounded-full">
                            {compImages.map((_, idx) => (
                              <button
                                key={idx}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setImageIndexes(prev => ({ ...prev, [comp.id]: idx }));
                                }}
                                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                                  idx === currentImageIndex 
                                    ? 'bg-white w-4' 
                                    : 'bg-white/50 hover:bg-white/70'
                                }`}
                              />
                            ))}
                          </div>
                          
                          {/* Image counter badge */}
                          <Badge className="absolute top-2 left-2 bg-black/40 backdrop-blur-sm text-white gap-1 text-xs px-2 py-1 border-0">
                            <Images className="h-3 w-3" />
                            {currentImageIndex + 1}/{compImages.length}
                          </Badge>
                        </>
                      )}
                      
                      {/* Required Tickets Badge - improved styling */}
                      <Badge className="absolute top-2 right-2 text-xs px-2 py-1 bg-primary/90 backdrop-blur-sm text-primary-foreground border-0 shadow-md">
                        <Ticket className="h-3 w-3 ml-1" />
                        {requiredTickets} تذكرة
                      </Badge>
                      
                      {/* Completed overlay */}
                      {comp.status === 'completed' && !isWinner && (
                        <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px] flex items-center justify-center">
                          <Badge variant="secondary" className="text-base px-4 py-2 shadow-lg">انتهت</Badge>
                        </div>
                      )}
                      
                      {/* Winner overlay with animation */}
                      {isWinner && (
                        <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/90 to-amber-600/90 flex items-center justify-center">
                          <div className="flex flex-col items-center animate-pulse">
                            <Crown className="h-8 w-8 text-white drop-shadow-lg" />
                            <span className="text-white text-xs font-bold mt-1">فائز!</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <CardContent className="p-3 space-y-2">
                    <h3 className="font-bold text-sm line-clamp-1">{comp.title_ar}</h3>
                    
                    {/* Prize Description */}
                    <div className="text-xs text-muted-foreground">
                      <div className="flex items-start gap-1">
                        <Gift className="h-3 w-3 mt-0.5 flex-shrink-0 text-primary" />
                        <span className={shouldTruncate && !isDescriptionExpanded ? 'line-clamp-1' : ''}>
                          {prizeText}
                        </span>
                      </div>
                      {shouldTruncate && (
                        <Button 
                          variant="link" 
                          className="h-auto p-0 text-xs text-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleDescription(comp.id);
                          }}
                        >
                          {isDescriptionExpanded ? 'عرض أقل' : 'المزيد'}
                          <ChevronDown className={`h-3 w-3 mr-1 transition-transform ${isDescriptionExpanded ? 'rotate-180' : ''}`} />
                        </Button>
                      )}
                    </div>

                    {/* End Date / Countdown */}
                    {comp.status === 'active' && comp.competition_type === 'timed' && comp.end_date && (
                      <div className="text-xs">
                        <CountdownTimer endDate={comp.end_date} />
                      </div>
                    )}
                    
                    {comp.status === 'active' && comp.end_date && comp.competition_type !== 'timed' && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>ينتهي: {formatBaghdadTime(comp.end_date, 'dd MMM yyyy')}</span>
                      </div>
                    )}
                    
                    {/* Participants Count - Always Show */}
                    <div className="space-y-1">
                      {(comp.max_tickets || comp.target_participants) ? (
                        <>
                          <Progress value={getProgress(comp)} className="h-1.5" />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span className="flex items-center gap-0.5">
                              <Users className="h-3 w-3" />
                              {ticketCount} مشترك
                            </span>
                            <span>/ {comp.max_tickets || comp.target_participants}</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Users className="h-3 w-3" />
                          <span>{ticketCount} مشترك</span>
                        </div>
                      )}
                    </div>
                    
                    {/* My Tickets */}
                    {hasTicket && (
                      <div className="text-xs text-primary font-medium">
                        تذاكري: {myTicketList.map(t => t.ticket_number).join(', ')}
                      </div>
                    )}
                    
                    {/* Enter Competition Button */}
                    {comp.status === 'active' && !isSoldOut && !isEnded && (
                      <Button
                        size="sm"
                        className="w-full gap-1 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!user) {
                            toast.error('يجب تسجيل الدخول أولاً');
                            navigate('/auth');
                            return;
                          }
                          setSelectedCompetitionForEntry(comp);
                          setShowEnterConfirm(true);
                        }}
                        disabled={enterCompetitionMutation.isPending || !canEnter}
                      >
                        {enterCompetitionMutation.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Ticket className="h-3 w-3" />
                        )}
                        {canEnter ? `دخول (${requiredTickets} تذكرة)` : `تحتاج ${requiredTickets} تذكرة`}
                      </Button>
                    )}
                    
                    {isSoldOut && comp.status === 'active' && (
                      <Badge variant="secondary" className="w-full justify-center text-xs">نفذت التذاكر</Badge>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <Footer />

      {/* Gallery Dialog */}
      <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          {galleryCompetition && (() => {
            const images = getAllImages(galleryCompetition);
            return (
              <div className="relative">
                <img
                  src={images[galleryIndex]}
                  alt={galleryCompetition.title_ar}
                  className="w-full max-h-[80vh] object-contain"
                />
                {images.length > 1 && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                      onClick={() => setGalleryIndex((galleryIndex - 1 + images.length) % images.length)}
                    >
                      <ChevronLeft className="h-6 w-6" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                      onClick={() => setGalleryIndex((galleryIndex + 1) % images.length)}
                    >
                      <ChevronRight className="h-6 w-6" />
                    </Button>
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                      {images.map((_, idx) => (
                        <button
                          key={idx}
                          className={`w-2.5 h-2.5 rounded-full ${idx === galleryIndex ? 'bg-white' : 'bg-white/50'}`}
                          onClick={() => setGalleryIndex(idx)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Enter Competition Confirmation Dialog */}
      <AlertDialog open={showEnterConfirm} onOpenChange={setShowEnterConfirm}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Ticket className="h-5 w-5 text-primary" />
              تأكيد الدخول في المسابقة
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              {selectedCompetitionForEntry && (
                <>
                  هل تريد الدخول في مسابقة <span className="font-bold text-foreground">{selectedCompetitionForEntry.title_ar}</span>؟
                  <br />
                  <span className="text-muted-foreground text-sm">
                    سيتم خصم <span className="font-bold text-foreground">{selectedCompetitionForEntry.required_tickets || 1} تذكرة</span> من رصيدك.
                  </span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogAction
              onClick={() => {
                if (selectedCompetitionForEntry) {
                  enterCompetitionMutation.mutate(selectedCompetitionForEntry.id);
                }
                setShowEnterConfirm(false);
                setSelectedCompetitionForEntry(null);
              }}
              className="gap-1"
            >
              <Ticket className="h-4 w-4" />
              تأكيد الدخول
            </AlertDialogAction>
            <AlertDialogCancel onClick={() => setSelectedCompetitionForEntry(null)}>إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Competition Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={(open) => {
        setShowDetailsDialog(open);
        if (!open) setDetailsSlideIndex(0);
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] p-0 overflow-hidden" dir="rtl">
          {selectedCompetitionForDetails && (() => {
            const comp = selectedCompetitionForDetails;
            const compImages = getAllImages(comp);
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
                {compImages.length > 0 && (
                  <div className="relative h-48 overflow-hidden">
                    {/* Auto-sliding images */}
                    {compImages.map((img, idx) => (
                      <img 
                        key={idx}
                        src={img} 
                        alt={`${comp.title_ar} - ${idx + 1}`}
                        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
                          idx === (detailsSlideIndex % compImages.length) ? 'opacity-100' : 'opacity-0'
                        }`}
                      />
                    ))}
                    {isWinner && (
                      <div className="absolute inset-0 bg-yellow-500/80 flex items-center justify-center">
                        <div className="text-center text-white">
                          <Crown className="h-12 w-12 mx-auto mb-2" />
                          <p className="font-bold text-lg">مبروك! أنت الفائز!</p>
                        </div>
                      </div>
                    )}
                    {comp.status === 'completed' && !isWinner && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <Badge variant="secondary" className="text-lg px-4 py-2">انتهت المسابقة</Badge>
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white z-10"
                      onClick={() => setShowDetailsDialog(false)}
                    >
                      <ArrowRight className="h-5 w-5" />
                    </Button>
                    
                    {/* Dot Indicators */}
                    {compImages.length > 1 && (
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                        {compImages.map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => setDetailsSlideIndex(idx)}
                            className={`w-2 h-2 rounded-full transition-all ${
                              idx === (detailsSlideIndex % compImages.length) 
                                ? 'bg-white w-4' 
                                : 'bg-white/50 hover:bg-white/70'
                            }`}
                          />
                        ))}
                      </div>
                    )}
                    
                    {/* Gallery Button */}
                    {compImages.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute bottom-2 left-2 bg-black/50 hover:bg-black/70 text-white gap-1 z-10"
                        onClick={() => {
                          setGalleryCompetition(comp);
                          setGalleryIndex(0);
                          setGalleryOpen(true);
                        }}
                      >
                        <Images className="h-4 w-4" />
                        {compImages.length} صور
                      </Button>
                    )}
                  </div>
                )}

                <ScrollArea className="max-h-[calc(90vh-12rem)]">
                  <div className="p-5 space-y-4">
                    {/* Title */}
                    <div>
                      <h2 className="text-xl font-bold">{comp.title_ar}</h2>
                      {comp.title !== comp.title_ar && (
                        <p className="text-sm text-muted-foreground">{comp.title}</p>
                      )}
                    </div>

                    {/* Prize */}
                    <div className="bg-primary/10 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Gift className="h-5 w-5 text-primary" />
                        <span className="font-semibold">الجائزة</span>
                      </div>
                      <p className="text-foreground">{comp.prize_description_ar}</p>
                      {comp.prize_value && (
                        <p className="text-primary font-bold mt-1">
                          القيمة: {comp.prize_value.toLocaleString()} {comp.currency}
                        </p>
                      )}
                    </div>

                    {/* Description */}
                    {comp.description_ar && (
                      <div>
                        <h3 className="font-semibold mb-2 flex items-center gap-2">
                          <Info className="h-4 w-4" />
                          التفاصيل
                        </h3>
                        <p className="text-muted-foreground text-sm">{comp.description_ar}</p>
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

                    {/* Countdown for timed competitions */}
                    {comp.status === 'active' && comp.competition_type === 'timed' && comp.end_date && (
                      <div className="border rounded-lg p-3">
                        <p className="text-sm text-muted-foreground mb-2 text-center">الوقت المتبقي</p>
                        <CountdownTimer endDate={comp.end_date} />
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
    </div>
  );
}
