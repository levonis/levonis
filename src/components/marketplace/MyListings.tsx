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
import { Package, Eye, Edit, Clock, CheckCircle, XCircle, ShoppingBag, Trash2, Loader2, Tag, X } from 'lucide-react';

// Format relative time in Arabic (Baghdad timezone UTC+3)
const formatRelativeTime = (dateString: string): string => {
  // Get Baghdad time
  const baghdadOffset = 3 * 60 * 60 * 1000; // UTC+3
  const now = new Date();
  const nowBaghdad = new Date(now.getTime() + baghdadOffset + now.getTimezoneOffset() * 60 * 1000);
  const date = new Date(dateString);
  const dateBaghdad = new Date(date.getTime() + baghdadOffset + date.getTimezoneOffset() * 60 * 1000);
  
  const diffMs = nowBaghdad.getTime() - dateBaghdad.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);

  if (diffSeconds < 60) {
    return `قبل ${diffSeconds} ثانية`;
  } else if (diffMinutes < 60) {
    return `قبل ${diffMinutes} دقيقة`;
  } else if (diffHours < 24) {
    return `قبل ${diffHours} ساعة`;
  } else if (diffDays < 7) {
    return `قبل ${diffDays} يوم`;
  } else {
    return `قبل ${diffWeeks} أسبوع`;
  }
};

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

  const handleMarkAsSold = (id: string) => {
    if (confirm('هل تريد تحديد هذا المنتج كـ "تم البيع"؟')) {
      updateListingMutation.mutate({
        id,
        values: { status: 'sold' },
      });
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
        <DialogContent hideClose className="max-w-2xl max-h-[85vh] overflow-y-auto p-0">
          {/* Close Button */}
          <button
            onClick={() => setOpen(false)}
            className="absolute left-3 top-3 z-50 bg-background/90 backdrop-blur-sm rounded-full p-2 hover:bg-muted shadow-lg border border-border transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <DialogHeader className="p-4 pb-2 sticky top-0 bg-background z-10 border-b">
            <DialogTitle className="text-right flex items-center gap-2">
              <Package className="w-5 h-5" />
              منتجاتي المعروضة
            </DialogTitle>
            <DialogDescription>إدارة منتجاتك في سوق المستعمل</DialogDescription>
          </DialogHeader>

          <div className="p-4">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : listings?.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>لم تقم بإضافة أي منتجات بعد</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {listings?.map(listing => {
                  const status = statusConfig[listing.status] || statusConfig.pending;
                  
                  return (
                    <div
                      key={listing.id}
                      className="bg-card border border-border rounded-lg overflow-hidden hover:shadow-md transition-all"
                    >
                      {/* Compact Image */}
                      <div className="relative aspect-square bg-muted">
                        {listing.images?.[0] ? (
                          <img
                            src={listing.images[0]}
                            alt={listing.title_ar}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-6 h-6 text-muted-foreground" />
                          </div>
                        )}
                        
                        {/* Status Badge */}
                        <Badge 
                          variant={status.variant} 
                          className="absolute top-1.5 right-1.5 flex items-center gap-0.5 text-[9px] px-1 py-0.5"
                        >
                          {status.icon}
                          {status.label}
                        </Badge>
                      </div>

                      {/* Compact Details */}
                      <div className="p-2">
                        <h3 className="font-medium text-xs truncate mb-1">{listing.title_ar}</h3>
                        
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold text-primary text-sm">
                            {Number(listing.price).toLocaleString()}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {conditionLabels[listing.condition]}
                          </span>
                        </div>

                        {/* Relative Time - Icon only for views */}
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-2">
                          <Clock className="w-3 h-3" />
                          <span>{formatRelativeTime(listing.created_at)}</span>
                          <span>•</span>
                          <span title="المشاهدات">
                            <Eye className="w-3 h-3 inline" />
                          </span>
                          <span>{listing.views_count || 0}</span>
                        </div>

                        {listing.admin_notes && listing.status === 'rejected' && (
                          <p className="text-[10px] text-destructive bg-destructive/10 rounded p-1.5 mb-2 line-clamp-2">
                            {listing.admin_notes}
                          </p>
                        )}

                        {/* Compact Actions */}
                        <div className="flex gap-1.5">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1 text-[10px] h-7 px-2"
                            onClick={() => handleEdit(listing)}
                          >
                            <Edit className="w-3 h-3 ml-0.5" />
                            تعديل
                          </Button>
                          {listing.status === 'approved' && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="text-green-600 hover:text-green-600 h-7 px-2"
                              onClick={() => handleMarkAsSold(listing.id)}
                              disabled={updateListingMutation.isPending}
                              title="تم البيع"
                            >
                              <Tag className="w-3 h-3" />
                            </Button>
                          )}
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-destructive hover:text-destructive h-7 px-2"
                            onClick={() => handleDelete(listing.id)}
                            disabled={deleteListingMutation.isPending}
                          >
                            {deleteListingMutation.isPending ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Trash2 className="w-3 h-3" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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
    </>
  );
};

export default MyListings;
