import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, Truck } from "lucide-react";
import OptimizedImage from "@/components/OptimizedImage";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { toast } from "sonner";

export default function AllStoragePanel() {
  const { user } = useAuth();

  const { data: purchases, isLoading } = useQuery({
    queryKey: ['all-storage-panel', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('product_offer_purchases')
        .select('*, product_offers(title_ar, image_url, description_ar)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  if (!user) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">سجّل الدخول لعرض مخزنك</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (!purchases || purchases.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <p className="font-medium text-lg">مخزنك فارغ</p>
          <p className="text-sm text-muted-foreground mt-2">
            اشترِ باقات التذاكر وستظهر هنا في انتظار طلب الشحن
          </p>
        </CardContent>
      </Card>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline">في المخزن</Badge>;
      case 'shipping_requested':
        return <Badge className="bg-blue-500">طلب الشحن</Badge>;
      case 'shipped':
        return <Badge className="bg-orange-500">تم الشحن</Badge>;
      case 'delivered':
        return <Badge className="bg-green-500">تم التسليم</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-3">
      {purchases.map((purchase: any) => (
        <Card key={purchase.id}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-muted">
                <OptimizedImage
                  src={purchase.product_offers?.image_url || '/placeholder.svg'}
                  alt={purchase.product_offers?.title_ar || ''}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium line-clamp-1">
                    {purchase.product_offers?.title_ar}
                  </p>
                  {getStatusBadge(purchase.purchase_status)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  الكمية: {purchase.quantity} • 
                  {format(new Date(purchase.created_at), ' dd MMM yyyy', { locale: ar })}
                </p>
                
                {purchase.purchase_status === 'pending' && (
                  <Button 
                    size="sm" 
                    className="mt-2"
                    onClick={() => toast.success('سيتم معالجة طلب الشحن قريباً')}
                  >
                    <Truck className="h-3.5 w-3.5 ml-1" />
                    طلب الشحن
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
