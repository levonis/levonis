import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Trophy, Ticket, Users, Gift, Loader2, Clock, Crown, Wallet, Plus, Minus, History, ChevronLeft, ChevronRight, Images, ChevronDown, ShoppingCart, Calendar } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
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
  const [cardQuantities, setCardQuantities] = useState<Record<string, number>>({});
  const [expandedDescriptions, setExpandedDescriptions] = useState<Record<string, boolean>>({});
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string | null>(null);

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
    mutationFn: async ({ competitionId, quantity }: { competitionId: string; quantity: number }) => {
      const { data, error } = await supabase.rpc('purchase_competition_ticket', {
        comp_id: competitionId,
        quantity: quantity
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['my-competition-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['competition-ticket-counts'] });
      queryClient.invalidateQueries({ queryKey: ['user-wallet'] });
      
      if (data.success) {
        toast.success(`🎟️ تم شراء ${data.quantity} تذكرة بنجاح!`);
      } else {
        toast.error(data.error);
      }
    },
    onError: (error) => {
      toast.error('حدث خطأ: ' + error.message);
    }
  });

  const handleDirectPurchase = (competition: Competition) => {
    if (!user) {
      toast.error('يجب تسجيل الدخول أولاً');
      navigate('/auth');
      return;
    }
    const quantity = cardQuantities[competition.id] || 1;
    purchaseMutation.mutate({ competitionId: competition.id, quantity });
  };

  const getCardQuantity = (compId: string) => cardQuantities[compId] || 1;

  const setCardQuantity = (compId: string, quantity: number, max: number) => {
    setCardQuantities(prev => ({
      ...prev,
      [compId]: Math.max(1, Math.min(quantity, max))
    }));
  };

  const getMaxAvailableTickets = (comp: Competition) => {
    if (!comp.max_tickets) return 100;
    const currentCount = ticketCounts?.[comp.id] || 0;
    return Math.min(100, comp.max_tickets - currentCount);
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

  const openGallery = (comp: Competition, startIndex: number = 0) => {
    setGalleryCompetition(comp);
    setGalleryIndex(startIndex);
    setGalleryOpen(true);
  };

  const toggleDescription = (compId: string) => {
    setExpandedDescriptions(prev => ({ ...prev, [compId]: !prev[compId] }));
  };

  const activeCompetitions = competitions?.filter(c => c.status === 'active') || [];

  return (
    <div className="min-h-screen bg-background flex flex-col" dir="rtl">
      {/* Fixed Ticket Purchase Bar */}
      {selectedCompetitionId && (() => {
        const comp = competitions?.find(c => c.id === selectedCompetitionId);
        if (!comp || comp.status !== 'active') return null;
        const isSoldOut = comp.max_tickets ? (ticketCounts?.[comp.id] || 0) >= comp.max_tickets : false;
        if (isSoldOut) return null;

        return (
          <div className="sticky top-0 z-50 bg-card/95 backdrop-blur border-b shadow-sm">
            <div className="container mx-auto px-4 py-3">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <Ticket className="h-5 w-5 text-primary" />
                  <span className="font-medium text-sm truncate max-w-[200px]">{comp.title_ar}</span>
                  <Badge variant="secondary" className="text-xs">
                    {comp.ticket_price === 0 ? 'مجانية' : `${comp.ticket_price} ${comp.currency}/تذكرة`}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setCardQuantity(comp.id, getCardQuantity(comp.id) - 1, getMaxAvailableTickets(comp))}
                      disabled={getCardQuantity(comp.id) <= 1}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <Input
                      type="number"
                      min={1}
                      max={getMaxAvailableTickets(comp)}
                      value={getCardQuantity(comp.id)}
                      onChange={(e) => setCardQuantity(comp.id, parseInt(e.target.value) || 1, getMaxAvailableTickets(comp))}
                      className="w-12 h-7 text-center text-sm px-1"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setCardQuantity(comp.id, getCardQuantity(comp.id) + 1, getMaxAvailableTickets(comp))}
                      disabled={getCardQuantity(comp.id) >= getMaxAvailableTickets(comp)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  
                  {comp.ticket_price > 0 && (
                    <span className="text-sm font-bold text-primary min-w-[80px] text-center">
                      {(comp.ticket_price * getCardQuantity(comp.id)).toLocaleString()} {comp.currency}
                    </span>
                  )}
                  
                  <Button 
                    size="sm"
                    className="gap-1"
                    onClick={() => handleDirectPurchase(comp)}
                    disabled={purchaseMutation.isPending || (comp.ticket_price > 0 && (!wallet || wallet.balance < comp.ticket_price * getCardQuantity(comp.id)))}
                  >
                    {purchaseMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ShoppingCart className="h-4 w-4" />
                    )}
                    شراء
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      <main className="flex-1 container mx-auto px-4 py-6">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold flex items-center justify-center gap-2 mb-1">
            <Trophy className="h-6 w-6 text-primary" />
            المسابقات والسحوبات
          </h1>
          <p className="text-sm text-muted-foreground">اشترك في المسابقات واربح جوائز قيمة!</p>
          
          <div className="flex items-center justify-center gap-3 mt-3 flex-wrap">
            {user && wallet && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full text-sm">
                <Wallet className="h-4 w-4 text-primary" />
                <span className="font-medium">{wallet.balance.toLocaleString()} دينار</span>
              </div>
            )}
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
              const isSelected = selectedCompetitionId === comp.id;

              const compImages = getAllImages(comp);
              const currentImageIndex = getCurrentImageIndex(comp.id);
              const isDescriptionExpanded = expandedDescriptions[comp.id];
              const prizeText = comp.prize_description_ar;
              const shouldTruncate = prizeText.length > 40;

              return (
                <Card 
                  key={comp.id} 
                  className={`overflow-hidden hover:shadow-md transition-all cursor-pointer ${isSelected ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => {
                    if (comp.status === 'active' && !isSoldOut && !isEnded) {
                      setSelectedCompetitionId(isSelected ? null : comp.id);
                    }
                  }}
                >
                  {compImages.length > 0 && (
                    <div className="relative h-28 overflow-hidden group">
                      <img 
                        src={compImages[currentImageIndex]} 
                        alt={comp.title_ar}
                        className="w-full h-full object-cover"
                        onClick={(e) => {
                          e.stopPropagation();
                          openGallery(comp, currentImageIndex);
                        }}
                      />
                      
                      {compImages.length > 1 && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute left-1 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigateImage(comp.id, compImages, 'prev');
                            }}
                          >
                            <ChevronLeft className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigateImage(comp.id, compImages, 'next');
                            }}
                          >
                            <ChevronRight className="h-3 w-3" />
                          </Button>
                          
                          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                            {compImages.map((_, idx) => (
                              <span
                                key={idx}
                                className={`w-1.5 h-1.5 rounded-full ${idx === currentImageIndex ? 'bg-white' : 'bg-white/50'}`}
                              />
                            ))}
                          </div>
                          
                          <Badge className="absolute top-1 left-1 bg-black/50 text-white gap-0.5 text-xs px-1.5 py-0.5">
                            <Images className="h-2.5 w-2.5" />
                            {compImages.length}
                          </Badge>
                        </>
                      )}
                      
                      {/* Price Badge */}
                      <Badge className="absolute top-1 right-1 text-xs px-1.5 py-0.5" variant={comp.ticket_price === 0 ? "secondary" : "default"}>
                        {comp.ticket_price === 0 ? 'مجانية' : `${comp.ticket_price}`}
                      </Badge>
                      
                      {comp.status === 'completed' && !isWinner && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <Badge className="bg-primary text-xs py-1 px-2">
                            <Crown className="h-3 w-3 ml-1" />
                            تم السحب
                          </Badge>
                        </div>
                      )}
                      {isWinner && (
                        <div 
                          className="absolute inset-0 bg-primary/80 flex items-center justify-center"
                          onClick={(e) => {
                            e.stopPropagation();
                            const winTicket = myTicketList.find(t => t.is_winner);
                            if (winTicket) {
                              setWinningTicket(winTicket.ticket_number);
                              setShowWinCelebration(true);
                            }
                          }}
                        >
                          <div className="text-center text-white">
                            <Crown className="h-8 w-8 mx-auto mb-1 animate-bounce" />
                            <span className="text-sm font-bold">مبروك! 🎉</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <CardContent className="p-2 space-y-1.5">
                    <h3 className="font-semibold text-sm line-clamp-1">{comp.title_ar}</h3>
                    
                    {/* Prize Description with Show More */}
                    <div className="text-xs">
                      <div className="flex items-start gap-1 text-primary">
                        <Gift className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <span className={!isDescriptionExpanded && shouldTruncate ? 'line-clamp-1' : ''}>
                          {prizeText}
                        </span>
                      </div>
                      {shouldTruncate && (
                        <button
                          className="text-muted-foreground hover:text-primary text-[10px] flex items-center gap-0.5 mt-0.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleDescription(comp.id);
                          }}
                        >
                          {isDescriptionExpanded ? 'أقل' : 'المزيد'}
                          <ChevronDown className={`h-2.5 w-2.5 transition-transform ${isDescriptionExpanded ? 'rotate-180' : ''}`} />
                        </button>
                      )}
                    </div>

                    {comp.prize_value && (
                      <p className="text-[10px] text-muted-foreground">
                        القيمة: {comp.prize_value.toLocaleString()} {comp.currency}
                      </p>
                    )}

                    {/* Countdown or End Date */}
                    {comp.end_date && comp.status !== 'completed' && (
                      <div className="bg-orange-500/10 rounded p-1.5 border border-orange-500/20">
                        {comp.competition_type === 'timed' ? (
                          <div className="scale-75 origin-right">
                            <CountdownTimer endDate={comp.end_date} />
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-[10px] text-orange-600">
                            <Calendar className="h-3 w-3" />
                            <span>ينتهي: {format(new Date(comp.end_date), 'dd MMM yyyy', { locale: ar })}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Progress */}
                    <div className="space-y-0.5">
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-0.5">
                          <Users className="h-3 w-3" />
                          {ticketCount}
                        </span>
                        {(comp.max_tickets || comp.target_participants) && (
                          <span>/ {comp.max_tickets || comp.target_participants}</span>
                        )}
                      </div>
                      {(comp.max_tickets || comp.target_participants) && (
                        <Progress value={getProgress(comp)} className="h-1" />
                      )}
                    </div>

                    {/* My Tickets */}
                    {hasTicket && (
                      <div className="bg-primary/10 rounded p-1.5">
                        <div className="flex flex-wrap gap-1">
                          {myTicketList.slice(0, 2).map((ticket, idx) => (
                            <Badge 
                              key={idx} 
                              variant={ticket.is_winner ? "default" : "outline"}
                              className={`text-[9px] px-1 py-0 ${ticket.is_winner ? "bg-yellow-500" : ""}`}
                            >
                              <Ticket className="h-2 w-2 ml-0.5" />
                              {ticket.ticket_number.slice(-4)}
                            </Badge>
                          ))}
                          {myTicketList.length > 2 && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0">
                              +{myTicketList.length - 2}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Quick Purchase Button */}
                    {comp.status === 'active' && !isEnded && !isSoldOut && (
                      <Button 
                        size="sm"
                        variant={isSelected ? "default" : "outline"}
                        className="w-full h-7 text-xs gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isSelected) {
                            handleDirectPurchase(comp);
                          } else {
                            setSelectedCompetitionId(comp.id);
                          }
                        }}
                        disabled={purchaseMutation.isPending}
                      >
                        {purchaseMutation.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : isSelected ? (
                          <>
                            <ShoppingCart className="h-3 w-3" />
                            شراء {getCardQuantity(comp.id)} تذكرة
                          </>
                        ) : (
                          <>
                            <Ticket className="h-3 w-3" />
                            اختيار
                          </>
                        )}
                      </Button>
                    )}

                    {isSoldOut && comp.status !== 'completed' && (
                      <Badge variant="secondary" className="w-full justify-center text-[10px]">
                        نفذت التذاكر
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* Gallery Dialog */}
      <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
        <DialogContent className="max-w-4xl p-0 bg-black/95">
          <DialogHeader className="sr-only">
            <DialogTitle>معرض الصور</DialogTitle>
          </DialogHeader>
          {galleryCompetition && (() => {
            const galleryImages = getAllImages(galleryCompetition);
            return (
              <div className="relative">
                <div className="aspect-video flex items-center justify-center">
                  <img
                    src={galleryImages[galleryIndex]}
                    alt={`${galleryCompetition.title_ar} - صورة ${galleryIndex + 1}`}
                    className="max-h-[70vh] max-w-full object-contain"
                  />
                </div>
                
                {galleryImages.length > 1 && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 text-white h-12 w-12"
                      onClick={() => setGalleryIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length)}
                    >
                      <ChevronLeft className="h-6 w-6" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 text-white h-12 w-12"
                      onClick={() => setGalleryIndex((prev) => (prev + 1) % galleryImages.length)}
                    >
                      <ChevronRight className="h-6 w-6" />
                    </Button>
                  </>
                )}
                
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4">
                  <span className="text-white bg-black/50 px-3 py-1 rounded-full text-sm">
                    {galleryIndex + 1} / {galleryImages.length}
                  </span>
                </div>
                
                {galleryImages.length > 1 && (
                  <div className="flex gap-2 justify-center p-4 bg-black/80 overflow-x-auto">
                    {galleryImages.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setGalleryIndex(idx)}
                        className={`flex-shrink-0 w-16 h-16 rounded overflow-hidden border-2 transition-colors ${
                          idx === galleryIndex ? 'border-primary' : 'border-transparent'
                        }`}
                      >
                        <img src={img} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <CelebrationEffect
        isActive={showWinCelebration}
        ticketNumber={winningTicket || undefined}
        onComplete={() => {
          setShowWinCelebration(false);
          setWinningTicket(null);
        }}
      />

      <Footer />
    </div>
  );
}
