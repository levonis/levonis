import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Package, Eye, MessageSquare, Edit, Clock, CheckCircle, XCircle, ShoppingBag, Trash2, Loader2, X } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { ListingConversations } from './ListingConversations';

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
};

const conditionOptions = [
  { value: 'new', label: 'جديد' },
  { value: 'like_new', label: 'شبه جديد' },
  { value: 'good', label: 'جيد' },
  { value: 'used', label: 'مستعمل' },
];

export const MyListings = ({ children }: MyListingsProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingListing, setEditingListing] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    title_ar: '',
    description_ar: '',
    price: '',
    condition: 'used',
    location: '',
  });
  const [conversationsListingId, setConversationsListingId] = useState<string | null>(null);

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

  // Fetch conversations count for each listing
  const { data: conversationCounts } = useQuery({
    queryKey: ['listing-conversation-counts', user?.id],
    queryFn: async () => {
      if (!user || !listings?.length) return {};
      
      const { data, error } = await supabase
        .from('listing_conversations')
        .select('listing_id')
        .in('listing_id', listings.map(l => l.id));
      
      if (error) throw error;
      
      return data?.reduce((acc, conv) => {
        acc[conv.listing_id] = (acc[conv.listing_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};
    },
    enabled: !!user && !!listings?.length,
  });

  const updateListingMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: any }) => {
      const { error } = await supabase
        .from('user_listings')
        .update(values)
        .eq('id', id)
        .eq('seller_id', user?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم تحديث المنتج');
      queryClient.invalidateQueries({ queryKey: ['my-listings'] });
      queryClient.invalidateQueries({ queryKey: ['approved-listings'] });
      setEditingListing(null);
    },
    onError: () => {
      toast.error('فشل تحديث المنتج');
    },
  });

  const deleteListingMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('user_listings')
        .delete()
        .eq('id', id)
        .eq('seller_id', user?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم حذف المنتج');
      queryClient.invalidateQueries({ queryKey: ['my-listings'] });
      queryClient.invalidateQueries({ queryKey: ['approved-listings'] });
    },
    onError: () => {
      toast.error('فشل حذف المنتج');
    },
  });

  const handleEdit = (listing: any) => {
    setEditForm({
      title_ar: listing.title_ar,
      description_ar: listing.description_ar || '',
      price: String(listing.price),
      condition: listing.condition,
      location: listing.location || '',
    });
    setEditingListing(listing);
  };

  const handleSaveEdit = () => {
    if (!editingListing) return;
    updateListingMutation.mutate({
      id: editingListing.id,
      values: {
        title_ar: editForm.title_ar,
        description_ar: editForm.description_ar,
        price: parseFloat(editForm.price),
        condition: editForm.condition,
        location: editForm.location,
        status: 'pending', // Re-submit for review
      },
    });
  };

  const handleDelete = (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا المنتج؟')) {
      deleteListingMutation.mutate(id);
    }
  };

  return (
    <>
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
            <DialogDescription>إدارة منتجاتك في سوق المستعمل</DialogDescription>
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
                const convCount = conversationCounts?.[listing.id] || 0;
                
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
                        </div>

                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Eye className="w-3 h-3" />
                            {listing.views_count || 0} مشاهدة
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
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="gap-1 text-xs"
                        onClick={() => handleEdit(listing)}
                      >
                        <Edit className="w-3 h-3" />
                        تعديل
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="gap-1 text-xs"
                        onClick={() => setConversationsListingId(listing.id)}
                      >
                        <MessageSquare className="w-3 h-3" />
                        المحادثات
                        {convCount > 0 && (
                          <Badge variant="secondary" className="h-5 px-1.5 mr-1">{convCount}</Badge>
                        )}
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="gap-1 text-xs text-destructive hover:text-destructive"
                        onClick={() => handleDelete(listing.id)}
                        disabled={deleteListingMutation.isPending}
                      >
                        {deleteListingMutation.isPending ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Trash2 className="w-3 h-3" />
                        )}
                        حذف
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingListing} onOpenChange={() => setEditingListing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>تعديل المنتج</DialogTitle>
            <DialogDescription>سيتم إعادة المنتج للمراجعة بعد التعديل</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>العنوان</Label>
              <Input
                value={editForm.title_ar}
                onChange={(e) => setEditForm(prev => ({ ...prev, title_ar: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label>الوصف</Label>
              <Textarea
                value={editForm.description_ar}
                onChange={(e) => setEditForm(prev => ({ ...prev, description_ar: e.target.value }))}
                rows={3}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>السعر</Label>
                <Input
                  type="number"
                  value={editForm.price}
                  onChange={(e) => setEditForm(prev => ({ ...prev, price: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>الحالة</Label>
                <select
                  className="w-full p-2 border rounded-md bg-background"
                  value={editForm.condition}
                  onChange={(e) => setEditForm(prev => ({ ...prev, condition: e.target.value }))}
                >
                  {conditionOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>الموقع</Label>
              <Input
                value={editForm.location}
                onChange={(e) => setEditForm(prev => ({ ...prev, location: e.target.value }))}
              />
            </div>
            
            <div className="flex gap-3">
              <Button 
                onClick={handleSaveEdit} 
                disabled={updateListingMutation.isPending}
                className="flex-1"
              >
                {updateListingMutation.isPending && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                حفظ التعديلات
              </Button>
              <Button variant="outline" onClick={() => setEditingListing(null)}>
                إلغاء
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Conversations for specific listing */}
      {conversationsListingId && (
        <ListingConversations 
          listingId={conversationsListingId}
          onClose={() => setConversationsListingId(null)}
        />
      )}
    </>
  );
};

export default MyListings;
