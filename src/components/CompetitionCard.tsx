import { memo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Gift, Ticket, Users, Crown, Calendar, ChevronLeft, ChevronRight, Images, ChevronDown, Loader2, Zap, Sparkles, Package, Target, Swords, TrendingUp, Timer } from "lucide-react";
import CountdownTimer from "@/components/CountdownTimer";
import OptimizedImage from "@/components/OptimizedImage";
import { format, addHours } from "date-fns";
import { ar } from "date-fns/locale";

const formatBaghdadTime = (dateString: string, formatStr: string = 'dd MMM yyyy') => {
  const date = new Date(dateString);
  const baghdadDate = addHours(date, 3);
  return format(baghdadDate, formatStr, { locale: ar });
};

type CompetitionType = 'ticket_count' | 'all_tickets_sold' | 'timed' | 'free' | 'instant_winner' | 'everyone_wins' | 'escalating_price' | 'mystery_box' | 'hidden_winner' | 'team_battle' | 'flash_sale' | 'growing_prize' | 'collect_letters';

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

const competitionTypeColors: Record<CompetitionType, string> = {
  ticket_count: 'bg-blue-500',
  all_tickets_sold: 'bg-green-500',
  timed: 'bg-purple-500',
  free: 'bg-gray-500',
  instant_winner: 'from-yellow-500 to-amber-500',
  everyone_wins: 'from-pink-500 to-rose-500',
  escalating_price: 'from-orange-500 to-red-500',
  mystery_box: 'from-indigo-500 to-purple-500',
  hidden_winner: 'from-red-500 to-rose-600',
  team_battle: 'from-cyan-500 to-blue-500',
  flash_sale: 'from-rose-500 to-pink-500',
  growing_prize: 'from-emerald-500 to-green-500',
  collect_letters: 'from-violet-500 to-purple-500'
};

interface Winner {
  user_id: string;
  ticket_number: string;
  username: string;
  full_name: string | null;
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
  status: 'active' | 'completed';
  winner_user_id: string | null;
  winner_user_ids: string[] | null;
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
  team_config?: any;
  team_a_count?: number;
  team_b_count?: number;
  price_tiers?: any;
  growing_prize_config?: any;
}

interface CompetitionCardProps {
  competition: Competition;
  ticketCount: number;
  myTicketList: { ticket_number: string; is_winner: boolean }[];
  userTicketBalance: number;
  onOpenDetails: (comp: Competition) => void;
  onEnterCompetition: (comp: Competition) => void;
  isEntering: boolean;
  isAuthenticated: boolean;
  winners?: Winner[];
}

const isInstantType = (type: CompetitionType) => {
  return ['instant_winner', 'everyone_wins', 'mystery_box', 'hidden_winner', 'collect_letters'].includes(type);
};

const getCompetitionTypeBadge = (comp: Competition) => {
  const type = comp.competition_type;
  const icon = competitionTypeIcons[type] || '🎫';
  const label = competitionTypeLabels[type] || 'مسابقة';
  const colorClass = competitionTypeColors[type] || 'bg-primary';
  
  // Special styling for flash sales
  if (type === 'flash_sale' || comp.is_flash) {
    return (
      <Badge className={`bg-gradient-to-r ${colorClass} text-white border-0 text-xs px-2 py-0.5 gap-1 animate-pulse`}>
        <Zap className="h-3 w-3" />
        {comp.flash_badge_text || label}
      </Badge>
    );
  }
  
  // Gradient types
  if (colorClass.includes('from-')) {
    return (
      <Badge className={`bg-gradient-to-r ${colorClass} text-white border-0 text-xs px-2 py-0.5`}>
        {icon} {label}
      </Badge>
    );
  }
  
  return (
    <Badge className={`${colorClass} text-white border-0 text-xs px-2 py-0.5`}>
      {icon} {label}
    </Badge>
  );
};

const CompetitionCard = memo(({
  competition: comp,
  ticketCount,
  myTicketList,
  userTicketBalance,
  onOpenDetails,
  onEnterCompetition,
  isEntering,
  isAuthenticated,
  winners = [],
}: CompetitionCardProps) => {
  const navigate = useNavigate();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  const hasTicket = myTicketList.length > 0;
  const isWinner = myTicketList.some(t => t.is_winner);
  const isSoldOut = comp.max_tickets ? ticketCount >= comp.max_tickets : false;
  const isEnded = comp.status === 'completed' || (comp.end_date && new Date(comp.end_date) < new Date());
  const requiredTickets = comp.required_tickets || 1;
  const canEnter = userTicketBalance >= requiredTickets;

  const compImages = comp.images?.length ? comp.images : (comp.image_url ? [comp.image_url] : []);
  const prizeText = comp.prize_description_ar;
  const shouldTruncate = prizeText.length > 40;

  const getProgress = () => {
    if (comp.max_tickets) return (ticketCount / comp.max_tickets) * 100;
    if (comp.target_participants) return (ticketCount / comp.target_participants) * 100;
    return 0;
  };

  const navigateImage = useCallback((direction: 'next' | 'prev') => {
    if (direction === 'next') {
      setCurrentImageIndex(prev => (prev + 1) % compImages.length);
    } else {
      setCurrentImageIndex(prev => (prev - 1 + compImages.length) % compImages.length);
    }
  }, [compImages.length]);

  const handleEnterClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      navigate('/auth');
      return;
    }
    onEnterCompetition(comp);
  }, [isAuthenticated, navigate, onEnterCompetition, comp]);

  return (
    <Card 
      className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onOpenDetails(comp)}
    >
      {compImages.length > 0 && (
        <div className="relative h-36 md:h-40 overflow-hidden group">
          {/* Only render current image for performance */}
          <OptimizedImage
            src={compImages[currentImageIndex]}
            alt={comp.title_ar}
            className="absolute inset-0 w-full h-full"
          />
          
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
          
          {compImages.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 backdrop-blur-sm text-white opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 rounded-full"
                onClick={(e) => {
                  e.stopPropagation();
                  navigateImage('prev');
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 backdrop-blur-sm text-white opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 rounded-full"
                onClick={(e) => {
                  e.stopPropagation();
                  navigateImage('next');
                }}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/30 backdrop-blur-sm px-2 py-1 rounded-full">
                {compImages.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentImageIndex(idx);
                    }}
                    className={`w-2 h-2 rounded-full transition-all ${
                      idx === currentImageIndex ? 'bg-white w-4' : 'bg-white/50'
                    }`}
                  />
                ))}
              </div>
              
              <Badge className="absolute top-2 left-2 bg-black/40 backdrop-blur-sm text-white gap-1 text-xs px-2 py-1 border-0">
                <Images className="h-3 w-3" />
                {currentImageIndex + 1}/{compImages.length}
              </Badge>
            </>
          )}
          
          <Badge className="absolute top-2 right-2 text-xs px-2 py-1 bg-primary/90 backdrop-blur-sm text-primary-foreground border-0">
            <Ticket className="h-3 w-3 ml-1" />
            {requiredTickets} تذكرة
          </Badge>
          
          {comp.status === 'completed' && !isWinner && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
              <Badge variant="secondary" className="text-base px-4 py-2">انتهت</Badge>
            </div>
          )}
          
          {isWinner && (
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/90 to-amber-600/90 flex items-center justify-center">
              <div className="flex flex-col items-center">
                <Crown className="h-8 w-8 text-white" />
                <span className="text-white text-xs font-bold mt-1">فائز!</span>
              </div>
            </div>
          )}
        </div>
      )}
      
      <CardContent className="p-2 sm:p-3 space-y-1.5 sm:space-y-2">
        {/* Competition Type Badge */}
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-bold text-xs sm:text-sm line-clamp-1 flex-1">{comp.title_ar}</h3>
          {getCompetitionTypeBadge(comp)}
        </div>
        
        {/* Special indicators for new types */}
        {comp.competition_type === 'instant_winner' && comp.win_probability && (
          <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-500/10 px-2 py-1 rounded-md">
            <Zap className="h-3 w-3" />
            <span>نسبة الفوز: {comp.win_probability}%</span>
          </div>
        )}
        
        {comp.competition_type === 'collect_letters' && comp.letters_config && (
          <div className="flex items-center gap-1 text-xs text-violet-600 bg-violet-500/10 px-2 py-1 rounded-md">
            <Sparkles className="h-3 w-3" />
            <span>أجمع الأحرف: {(comp.letters_config as any).target_word}</span>
          </div>
        )}
        
        {comp.competition_type === 'team_battle' && (
          <div className="flex items-center gap-1 text-xs text-cyan-600 bg-cyan-500/10 px-2 py-1 rounded-md">
            <Swords className="h-3 w-3" />
            <span>🔵 {comp.team_a_count || 0} - {comp.team_b_count || 0} 🔴</span>
          </div>
        )}
        
        {comp.competition_type === 'escalating_price' && comp.price_tiers && (
          <div className="flex items-center gap-1 text-xs text-orange-600 bg-orange-500/10 px-2 py-1 rounded-md">
            <TrendingUp className="h-3 w-3" />
            <span>السعر الحالي: {comp.ticket_price.toLocaleString()} دينار</span>
          </div>
        )}
        
        {comp.competition_type === 'mystery_box' && (
          <div className="flex items-center gap-1 text-xs text-purple-600 bg-purple-500/10 px-2 py-1 rounded-md">
            <Package className="h-3 w-3" />
            <span>افتح صندوقك واكتشف جائزتك!</span>
          </div>
        )}
        
        {(comp.competition_type === 'flash_sale' || comp.is_flash) && comp.end_date && (
          <div className="flex items-center gap-1 text-xs text-rose-600 bg-rose-500/10 px-2 py-1 rounded-md animate-pulse">
            <Timer className="h-3 w-3" />
            <span>عرض محدود!</span>
          </div>
        )}
        
        {/* Prize Description */}
        <div className="bg-gradient-to-l from-primary/10 to-transparent rounded-md p-1.5 sm:p-2 border-r-2 border-primary/50">
          <div className="flex items-start gap-1 sm:gap-1.5">
            <Gift className="h-3 w-3 sm:h-3.5 sm:w-3.5 mt-0.5 flex-shrink-0 text-primary" />
            <div className="flex-1 min-w-0">
              <span className={`text-[10px] sm:text-xs font-medium text-foreground leading-relaxed ${shouldTruncate && !isDescriptionExpanded ? 'line-clamp-2' : ''}`}>
                {prizeText}
              </span>
              {comp.prize_value && (
                <p className="text-[10px] sm:text-xs font-bold text-primary mt-0.5">
                  {comp.prize_value.toLocaleString()} {comp.currency}
                </p>
              )}
            </div>
          </div>
          {shouldTruncate && (
            <Button 
              variant="link" 
              className="h-auto p-0 text-[10px] sm:text-xs text-primary mt-0.5 sm:mt-1"
              onClick={(e) => {
                e.stopPropagation();
                setIsDescriptionExpanded(!isDescriptionExpanded);
              }}
            >
              {isDescriptionExpanded ? 'عرض أقل' : 'المزيد'}
              <ChevronDown className={`h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1 transition-transform ${isDescriptionExpanded ? 'rotate-180' : ''}`} />
            </Button>
          )}
        </div>

        {/* Countdown for timed competitions */}
        {comp.status === 'active' && comp.competition_type === 'timed' && comp.end_date && (
          <div className="text-[10px] sm:text-xs overflow-x-auto">
            <CountdownTimer endDate={comp.end_date} />
          </div>
        )}
        
        {comp.status === 'active' && comp.end_date && comp.competition_type !== 'timed' && (
          <div className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground">
            <Calendar className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
            <span>ينتهي: {formatBaghdadTime(comp.end_date)}</span>
          </div>
        )}
        
        {/* Participants */}
        <div className="space-y-0.5 sm:space-y-1">
          {(comp.max_tickets || comp.target_participants) ? (
            <>
              <Progress value={getProgress()} className="h-1 sm:h-1.5" />
              <div className="flex justify-between text-[10px] sm:text-xs text-muted-foreground">
                <span className="flex items-center gap-0.5">
                  <Users className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  {ticketCount} مشترك
                </span>
                <span>/ {comp.max_tickets || comp.target_participants}</span>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground">
              <Users className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
              <span>{ticketCount} مشترك</span>
            </div>
          )}
        </div>
        
        {/* Winners Display for completed competitions */}
        {comp.status === 'completed' && winners.length > 0 && (
          <div className="bg-gradient-to-l from-yellow-500/10 to-transparent rounded-md p-2 border-r-2 border-yellow-500/50">
            <div className="flex items-start gap-1.5">
              <Crown className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-yellow-600" />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-medium text-muted-foreground">
                  {winners.length > 1 ? 'الفائزون:' : 'الفائز:'}
                </span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {winners.slice(0, 3).map((winner, idx) => (
                    <Badge 
                      key={idx} 
                      variant="secondary" 
                      className="text-xs bg-yellow-500/20 text-yellow-700 border-0"
                    >
                      {winner.full_name || winner.username}
                    </Badge>
                  ))}
                  {winners.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{winners.length - 3}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {hasTicket && (
          <div className="text-xs text-primary font-medium">
            تذاكري: {myTicketList.map(t => t.ticket_number).join(', ')}
          </div>
        )}
        
        {comp.status === 'active' && !isSoldOut && !isEnded && (
          <Button
            size="sm"
            className="w-full gap-1 text-xs"
            onClick={handleEnterClick}
            disabled={isEntering || !canEnter}
          >
            {isEntering ? (
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
});

CompetitionCard.displayName = "CompetitionCard";

export default CompetitionCard;
