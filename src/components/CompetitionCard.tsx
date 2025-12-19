import { memo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Gift, Ticket, Users, Crown, Calendar, ChevronLeft, ChevronRight, Images, ChevronDown, Loader2 } from "lucide-react";
import CountdownTimer from "@/components/CountdownTimer";
import OptimizedImage from "@/components/OptimizedImage";
import { format, addHours } from "date-fns";
import { ar } from "date-fns/locale";

const formatBaghdadTime = (dateString: string, formatStr: string = 'dd MMM yyyy') => {
  const date = new Date(dateString);
  const baghdadDate = addHours(date, 3);
  return format(baghdadDate, formatStr, { locale: ar });
};

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

interface CompetitionCardProps {
  competition: Competition;
  ticketCount: number;
  myTicketList: { ticket_number: string; is_winner: boolean }[];
  userTicketBalance: number;
  onOpenDetails: (comp: Competition) => void;
  onEnterCompetition: (comp: Competition) => void;
  isEntering: boolean;
  isAuthenticated: boolean;
}

const CompetitionCard = memo(({
  competition: comp,
  ticketCount,
  myTicketList,
  userTicketBalance,
  onOpenDetails,
  onEnterCompetition,
  isEntering,
  isAuthenticated,
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
      
      <CardContent className="p-3 space-y-2">
        <h3 className="font-bold text-sm line-clamp-1">{comp.title_ar}</h3>
        
        {/* Prize Description */}
        <div className="bg-gradient-to-l from-primary/10 to-transparent rounded-md p-2 border-r-2 border-primary/50">
          <div className="flex items-start gap-1.5">
            <Gift className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-primary" />
            <div className="flex-1 min-w-0">
              <span className={`text-xs font-medium text-foreground leading-relaxed ${shouldTruncate && !isDescriptionExpanded ? 'line-clamp-2' : ''}`}>
                {prizeText}
              </span>
              {comp.prize_value && (
                <p className="text-xs font-bold text-primary mt-0.5">
                  {comp.prize_value.toLocaleString()} {comp.currency}
                </p>
              )}
            </div>
          </div>
          {shouldTruncate && (
            <Button 
              variant="link" 
              className="h-auto p-0 text-xs text-primary mt-1"
              onClick={(e) => {
                e.stopPropagation();
                setIsDescriptionExpanded(!isDescriptionExpanded);
              }}
            >
              {isDescriptionExpanded ? 'عرض أقل' : 'المزيد'}
              <ChevronDown className={`h-3 w-3 mr-1 transition-transform ${isDescriptionExpanded ? 'rotate-180' : ''}`} />
            </Button>
          )}
        </div>

        {/* Countdown for timed competitions */}
        {comp.status === 'active' && comp.competition_type === 'timed' && comp.end_date && (
          <div className="text-xs">
            <CountdownTimer endDate={comp.end_date} />
          </div>
        )}
        
        {comp.status === 'active' && comp.end_date && comp.competition_type !== 'timed' && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>ينتهي: {formatBaghdadTime(comp.end_date)}</span>
          </div>
        )}
        
        {/* Participants */}
        <div className="space-y-1">
          {(comp.max_tickets || comp.target_participants) ? (
            <>
              <Progress value={getProgress()} className="h-1.5" />
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
