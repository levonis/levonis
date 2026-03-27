import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Wrench, Clock, CheckCircle, AlertTriangle, Star } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import EngineerRatingDialog from './EngineerRatingDialog';

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  open: { label: 'مفتوح', color: 'bg-blue-500/20 text-blue-700 border-blue-500/40', icon: <Clock className="w-3 h-3" /> },
  in_progress: { label: 'قيد التنفيذ', color: 'bg-amber-500/20 text-amber-700 border-amber-500/40', icon: <Wrench className="w-3 h-3" /> },
  resolved: { label: 'تم الحل', color: 'bg-green-500/20 text-green-700 border-green-500/40', icon: <CheckCircle className="w-3 h-3" /> },
  closed: { label: 'مغلق', color: 'bg-muted text-muted-foreground', icon: <CheckCircle className="w-3 h-3" /> },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  low: { label: 'منخفضة', color: 'text-muted-foreground' },
  normal: { label: 'عادية', color: 'text-blue-600' },
  high: { label: 'عالية', color: 'text-amber-600' },
  urgent: { label: 'عاجلة', color: 'text-destructive' },
};

export default function MaintenanceTicketsList() {
  const { user } = useAuth();
  const [ratingTicket, setRatingTicket] = useState<any>(null);

  const { data: tickets, isLoading } = useQuery({
    queryKey: ['maintenance-tickets', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('maintenance_tickets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Check which tickets already have ratings
  const { data: existingRatings } = useQuery({
    queryKey: ['engineer-ratings', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('engineer_ratings')
        .select('ticket_id')
        .eq('user_id', user.id);
      if (error) throw error;
      return data?.map(r => r.ticket_id) || [];
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map(i => <Skeleton key={i} className="h-24 w-full" />)}
      </div>
    );
  }

  if (!tickets || tickets.length === 0) {
    return (
      <Card className="text-center py-6 bg-muted/10 border-dashed">
        <CardContent className="p-0">
          <Wrench className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">لا توجد طلبات صيانة</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {tickets.map((ticket: any) => {
          const status = statusConfig[ticket.status] || statusConfig.open;
          const priority = priorityConfig[ticket.priority] || priorityConfig.normal;
          const isResolved = ticket.status === 'resolved' || ticket.status === 'closed';
          const hasRating = existingRatings?.includes(ticket.id);
          const canRate = isResolved && ticket.assigned_engineer_name && !hasRating;

          return (
            <Card key={ticket.id} className="overflow-hidden">
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium line-clamp-1">{ticket.title}</h4>
                    {ticket.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {ticket.description}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className={`text-[10px] shrink-0 gap-1 ${status.color}`}>
                    {status.icon}
                    {status.label}
                  </Badge>
                </div>

                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className={priority.color}>الأولوية: {priority.label}</span>
                  <span>{format(new Date(ticket.created_at), 'dd/MM/yyyy', { locale: ar })}</span>
                  {ticket.assigned_engineer_name && (
                    <span>الفني: {ticket.assigned_engineer_name}</span>
                  )}
                </div>

                {canRate && (
                  <button
                    className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-700 transition-colors"
                    onClick={() => setRatingTicket(ticket)}
                  >
                    <Star className="w-3.5 h-3.5 fill-amber-400" />
                    قيّم الفني
                  </button>
                )}

                {hasRating && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-green-600">
                    <CheckCircle className="w-3 h-3" />
                    تم التقييم
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {ratingTicket && (
        <EngineerRatingDialog
          open={!!ratingTicket}
          onOpenChange={(open) => !open && setRatingTicket(null)}
          ticketId={ratingTicket.id}
          engineerName={ratingTicket.assigned_engineer_name}
          engineerId={ratingTicket.assigned_engineer_id}
        />
      )}
    </>
  );
}
