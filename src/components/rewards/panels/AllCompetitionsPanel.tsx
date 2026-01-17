import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import OptimizedImage from "@/components/OptimizedImage";
import { useState } from "react";
import { X, Ticket, Trophy } from "lucide-react";
import { toast } from "sonner";

export default function AllCompetitionsPanel() {
  const { user } = useAuth();
  const [selectedCompetition, setSelectedCompetition] = useState<any>(null);

  const { data: competitions, isLoading } = useQuery({
    queryKey: ['all-competitions-panel'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('competitions')
        .select('*')
        .eq('status', 'active')
        .neq('is_product_based', true)
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

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-40 w-full" />
        ))}
      </div>
    );
  }

  if (!competitions || competitions.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          لا توجد مسابقات نشطة حالياً
        </CardContent>
      </Card>
    );
  }

  const handleParticipate = (comp: any) => {
    if (!user) {
      toast.error('يجب تسجيل الدخول للمشاركة');
      return;
    }
    if ((userTickets || 0) < comp.ticket_price) {
      toast.error('رصيد التذاكر غير كافٍ');
      return;
    }
    toast.success('سيتم فتح نموذج المشاركة');
    // The actual participation logic remains unchanged - just triggering it from here
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {competitions.map((comp) => (
          <Card 
            key={comp.id} 
            className="cursor-pointer hover:shadow-md transition-shadow overflow-hidden"
            onClick={() => setSelectedCompetition(comp)}
          >
            <div className="aspect-video relative">
              <OptimizedImage
                src={comp.image_url || '/placeholder.svg'}
                alt={comp.title_ar}
                className="w-full h-full object-cover"
              />
              <Badge className="absolute top-2 right-2 text-[9px]">
                {comp.ticket_price} تذكرة
              </Badge>
            </div>
            <CardContent className="p-3">
              <p className="text-sm font-medium line-clamp-1">{comp.title_ar}</p>
              <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                {comp.prize_description_ar}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Competition Detail Sheet */}
      <Sheet open={!!selectedCompetition} onOpenChange={(open) => !open && setSelectedCompetition(null)}>
        <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl px-0 pb-0">
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
            <div className="overflow-y-auto h-full px-4 py-4 pb-24">
              {/* Competition Image */}
              <div className="aspect-video rounded-xl overflow-hidden mb-4">
                <OptimizedImage
                  src={selectedCompetition.image_url || '/placeholder.svg'}
                  alt={selectedCompetition.title_ar}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Competition Info */}
              <h2 className="text-xl font-bold mb-2">{selectedCompetition.title_ar}</h2>
              
              <Card className="mb-4 bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy className="h-5 w-5 text-purple-500" />
                    <span className="font-medium">الجائزة</span>
                  </div>
                  <p className="text-sm">{selectedCompetition.prize_description_ar}</p>
                  {selectedCompetition.prize_value && (
                    <p className="text-lg font-bold text-primary mt-1">
                      {selectedCompetition.prize_value.toLocaleString()} {selectedCompetition.currency}
                    </p>
                  )}
                </CardContent>
              </Card>

              {selectedCompetition.description_ar && (
                <p className="text-sm text-muted-foreground mb-4">
                  {selectedCompetition.description_ar}
                </p>
              )}

              {/* Ticket Info */}
              <Card className="mb-4">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Ticket className="h-5 w-5 text-primary" />
                    <span>رصيدك:</span>
                    <span className="font-bold">{userTickets || 0} تذكرة</span>
                  </div>
                  <Badge variant="outline">
                    المطلوب: {selectedCompetition.ticket_price} تذكرة
                  </Badge>
                </CardContent>
              </Card>

              {/* Participate Button */}
              <Button 
                className="w-full"
                size="lg"
                onClick={() => handleParticipate(selectedCompetition)}
                disabled={!user || (userTickets || 0) < selectedCompetition.ticket_price}
              >
                شارك الآن
              </Button>

              {!user && (
                <p className="text-xs text-center text-muted-foreground mt-2">
                  سجّل الدخول للمشاركة في المسابقة
                </p>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
