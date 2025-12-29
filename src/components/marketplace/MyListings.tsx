import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Package, Eye, MessageSquare, Edit, Clock, CheckCircle, XCircle, ShoppingBag } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface MyListingsProps {
  children?: React.ReactNode;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
  pending: { label: 'قيد المراجعة', variant: 'secondary', icon: <Clock className="w-3 h-3" /> },
  approved: { label: 'منشور', variant: 'default', icon: <CheckCircle className="w-3 h-3" /> },
  rejected: { label: 'مرفوض', variant: 'destructive', icon: <XCircle className="w-3 h-3" /> },
  sold: { label: 'تم البيع', variant: 'outline', icon: <ShoppingBag className="w-3 h-3" /> },
};

const conditionLabels: Record<string, string> = {
  new: 'جديد',
  like_new: 'شبه جديد',
  good: 'جيد',
  used: 'مستعمل',
  for_parts: 'للقطع',
};

export const MyListings = ({ children }: MyListingsProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const { data: listings, isLoading } = useQuery({
    queryKey: ['my-listings', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('user_listings')
        .select('*, categories(name_ar)')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user && open,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm" className="gap-2">
            <Package className="w-4 h-4" />
            منتجاتي
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-right flex items-center gap-2">
            <Package className="w-5 h-5" />
            منتجاتي المعروضة
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-muted/50 rounded-lg p-4 animate-pulse">
                <div className="h-4 bg-muted rounded w-1/2 mb-2" />
                <div className="h-3 bg-muted rounded w-1/4" />
              </div>
            ))}
          </div>
        ) : listings?.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>لم تقم بإضافة أي منتجات بعد</p>
          </div>
        ) : (
          <div className="space-y-3">
            {listings?.map(listing => {
              const status = statusConfig[listing.status] || statusConfig.pending;
              return (
                <div
                  key={listing.id}
                  className="bg-card border border-border rounded-lg p-4 hover:border-primary/30 transition-colors"
                >
                  <div className="flex gap-4">
                    {/* Image */}
                    <div className="w-20 h-20 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                      {listing.images?.[0] ? (
                        <img
                          src={listing.images[0]}
                          alt={listing.title_ar}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold truncate">{listing.title_ar}</h3>
                        <Badge variant={status.variant} className="flex items-center gap-1 flex-shrink-0">
                          {status.icon}
                          {status.label}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                        <span className="font-bold text-primary">
                          {Number(listing.price).toLocaleString()} {listing.currency}
                        </span>
                        <span>•</span>
                        <span>{conditionLabels[listing.condition]}</span>
                        {listing.categories?.name_ar && (
                          <>
                            <span>•</span>
                            <span>{listing.categories.name_ar}</span>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          {listing.views_count} مشاهدة
                        </span>
                        <span>
                          {format(new Date(listing.created_at), 'dd MMM yyyy', { locale: ar })}
                        </span>
                      </div>

                      {listing.admin_notes && listing.status === 'rejected' && (
                        <p className="text-xs text-destructive mt-2 bg-destructive/10 rounded p-2">
                          سبب الرفض: {listing.admin_notes}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                    <Button variant="ghost" size="sm" className="gap-1 text-xs">
                      <Edit className="w-3 h-3" />
                      تعديل
                    </Button>
                    <Button variant="ghost" size="sm" className="gap-1 text-xs">
                      <MessageSquare className="w-3 h-3" />
                      المحادثات
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MyListings;
