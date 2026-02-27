import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, MapPin, Edit, Trash2, Check, ArrowRight, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import AddressDialog from '@/components/AddressDialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const AddressSkeleton = () => (
  <div className="space-y-3 px-3 py-3">
    {[1, 2].map(i => (
      <div key={i} className="rounded-2xl border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <div className="flex gap-2 pt-1">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
      </div>
    ))}
  </div>
);

const UserAddresses = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingAddressId, setDeletingAddressId] = useState<string | null>(null);

  const { data: addresses, isLoading } = useQuery({
    queryKey: ['user-addresses', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('user_addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (addressId: string) => {
      const { error } = await supabase.from('user_addresses').update({ is_default: true }).eq('id', addressId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-addresses'] });
      toast({ title: "تم التحديث", description: "تم تعيين العنوان كافتراضي" });
    },
    onError: () => {
      toast({ title: "خطأ", description: "حدث خطأ أثناء تحديث العنوان", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (addressId: string) => {
      const { error } = await supabase.from('user_addresses').delete().eq('id', addressId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-addresses'] });
      toast({ title: "تم الحذف", description: "تم حذف العنوان بنجاح" });
      setDeleteDialogOpen(false);
      setDeletingAddressId(null);
    },
    onError: () => {
      toast({ title: "خطأ", description: "حدث خطأ أثناء حذف العنوان", variant: "destructive" });
    },
  });

  if (!user) { navigate('/auth'); return null; }

  return (
    <div className="min-h-screen flex flex-col bg-background" dir="rtl">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-card border-b shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            <h1 className="text-base font-bold text-foreground">عناويني</h1>
            {addresses && (
              <span className="text-xs text-muted-foreground">({addresses.length})</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => { setEditingAddress(null); setDialogOpen(true); }}>
              <Plus className="h-3.5 w-3.5" />
              إضافة
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => navigate(-1)}>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 px-3 py-3">
        {isLoading ? (
          <AddressSkeleton />
        ) : !addresses || addresses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <MapPin className="h-10 w-10 text-muted-foreground/50" />
            </div>
            <h3 className="font-bold text-foreground mb-1">لا توجد عناوين محفوظة</h3>
            <p className="text-sm text-muted-foreground mb-4">قم بإضافة عنوان توصيل لتسهيل عملية الطلب</p>
            <Button size="sm" onClick={() => { setEditingAddress(null); setDialogOpen(true); }} className="gap-1.5">
              <Plus className="h-4 w-4" />
              إضافة عنوان جديد
            </Button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {addresses.map((address) => (
              <div
                key={address.id}
                className="rounded-2xl border bg-card shadow-sm p-4 relative overflow-hidden"
              >
                {/* Default badge */}
                {address.is_default && (
                  <Badge className="absolute top-3 left-3 bg-primary text-primary-foreground text-[10px] px-2 py-0.5">
                    افتراضي
                  </Badge>
                )}

                <div className="flex gap-3">
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <MapPin className="h-5 w-5 text-primary" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm text-foreground mb-0.5">{address.full_name}</h3>
                    <p className="text-xs text-muted-foreground mb-2">{address.phone_number}</p>

                    <div className="text-xs space-y-0.5 text-foreground/80">
                      <p>{address.governorate} • {address.area}</p>
                      <p className="text-muted-foreground">أقرب نقطة: {address.nearest_landmark}</p>
                      {address.additional_notes && (
                        <p className="text-muted-foreground/70 text-[11px]">📝 {address.additional_notes}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-1.5 mt-3 pt-2.5 border-t border-border/50">
                  {!address.is_default && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDefaultMutation.mutate(address.id)}
                      disabled={setDefaultMutation.isPending}
                      className="flex-1 h-8 text-xs gap-1 text-primary hover:bg-primary/5"
                    >
                      <Check className="h-3.5 w-3.5" />
                      تعيين كافتراضي
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingAddress(address); setDialogOpen(true); }}>
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => { setDeletingAddressId(address.id); setDeleteDialogOpen(true); }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <AddressDialog open={dialogOpen} onOpenChange={setDialogOpen} address={editingAddress} />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
            <AlertDialogDescription>سيتم حذف هذا العنوان نهائياً ولن تتمكن من استرجاعه.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingAddressId && deleteMutation.mutate(deletingAddressId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <><Loader2 className="ml-2 h-4 w-4 animate-spin" />جاري الحذف...</>
              ) : 'حذف'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UserAddresses;
