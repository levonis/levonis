import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, MapPin, Edit, Trash2, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import AddressDialog from '@/components/AddressDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
      const { error } = await supabase
        .from('user_addresses')
        .update({ is_default: true })
        .eq('id', addressId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-addresses'] });
      toast({
        title: "تم التحديث",
        description: "تم تعيين العنوان كافتراضي",
      });
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء تحديث العنوان",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (addressId: string) => {
      const { error } = await supabase
        .from('user_addresses')
        .delete()
        .eq('id', addressId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-addresses'] });
      toast({
        title: "تم الحذف",
        description: "تم حذف العنوان بنجاح",
      });
      setDeleteDialogOpen(false);
      setDeletingAddressId(null);
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء حذف العنوان",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (address: any) => {
    setEditingAddress(address);
    setDialogOpen(true);
  };

  const handleDelete = (addressId: string) => {
    setDeletingAddressId(addressId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (deletingAddressId) {
      deleteMutation.mutate(deletingAddressId);
    }
  };

  const handleAddNew = () => {
    setEditingAddress(null);
    setDialogOpen(true);
  };

  if (!user) {
    navigate('/auth');
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background/95 backdrop-blur-sm pt-24">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background/95 backdrop-blur-sm">
      <main className="container mx-auto px-4 py-8 pt-24">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-black text-primary mb-2">عناويني</h1>
            <p className="text-muted-foreground">
              إدارة عناوين التوصيل الخاصة بك
            </p>
          </div>
          <Button
            onClick={handleAddNew}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            إضافة عنوان جديد
          </Button>
        </div>

        {!addresses || addresses.length === 0 ? (
          <Card className="p-8 text-center">
            <div className="w-24 h-24 mx-auto mb-6 opacity-20">
              <MapPin className="w-full h-full text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">لا توجد عناوين محفوظة</h2>
            <p className="text-muted-foreground mb-6">
              قم بإضافة عنوان توصيل لتسهيل عملية الطلب
            </p>
            <Button onClick={handleAddNew} className="gap-2">
              <Plus className="h-4 w-4" />
              إضافة عنوان جديد
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {addresses.map((address) => (
              <Card key={address.id} className="p-6 relative">
                {address.is_default && (
                  <Badge className="absolute top-4 left-4 bg-primary">
                    افتراضي
                  </Badge>
                )}
                
                <div className="space-y-3">
                  <div>
                    <h3 className="font-bold text-lg text-foreground mb-1">
                      {address.full_name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {address.phone_number}
                    </p>
                  </div>

                  <div className="text-sm space-y-1">
                    <p className="text-foreground">
                      <span className="font-semibold">المحافظة:</span> {address.governorate}
                    </p>
                    <p className="text-foreground">
                      <span className="font-semibold">المنطقة:</span> {address.area}
                    </p>
                    <p className="text-foreground">
                      <span className="font-semibold">أقرب نقطة دالة:</span> {address.nearest_landmark}
                    </p>
                    {address.additional_notes && (
                      <p className="text-muted-foreground text-xs pt-2">
                        <span className="font-semibold">ملاحظات:</span> {address.additional_notes}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2">
                    {!address.is_default && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDefaultMutation.mutate(address.id)}
                        disabled={setDefaultMutation.isPending}
                        className="flex-1"
                      >
                        <Check className="h-4 w-4 ml-1" />
                        تعيين كافتراضي
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(address)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(address.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        <AddressDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          address={editingAddress}
        />

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
              <AlertDialogDescription>
                سيتم حذف هذا العنوان نهائياً ولن تتمكن من استرجاعه.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    جاري الحذف...
                  </>
                ) : (
                  'حذف'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
};

export default UserAddresses;
