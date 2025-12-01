import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Package, ShoppingCart } from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import { toast } from 'sonner';
import { formatDate, formatPrice } from '@/lib/utils';

const MyCustomRequests = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { addCustomRequestToCart } = useCart();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }
  }, [user, authLoading, navigate]);

  const { data: customRequests, isLoading: requestsLoading } = useQuery({
    queryKey: ['my-custom-requests', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('custom_product_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });

  const handleAddToCart = async (request: any) => {
    if (!request.suggested_price) {
      toast.error('لم يتم تحديد سعر لهذا الطلب بعد');
      return;
    }
    
    try {
      await addCustomRequestToCart(request.id);
    } catch (error) {
      console.error('Error adding to cart:', error);
    }
  };

  if (authLoading) {
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
      <main className="container mx-auto px-4 py-8 pt-24 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-4xl font-black text-primary mb-2">طلباتي المخصصة</h1>
          <p className="text-muted-foreground">جميع طلبات المنتجات المخصصة التي قمت بها</p>
        </div>

        <Card className="glass-effect border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              طلباتي المخصصة
            </CardTitle>
            <CardDescription>
              جميع طلبات المنتجات المخصصة التي قمت بها
            </CardDescription>
          </CardHeader>
          <CardContent>
            {requestsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : customRequests && customRequests.length > 0 ? (
              <div className="space-y-4">
                {customRequests.map((request) => (
                  <div 
                    key={request.id}
                    className="p-4 rounded-lg border border-border/50 bg-card/50 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-bold text-foreground mb-1">
                          {request.product_name}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-2">
                          الكمية: {request.quantity}
                        </p>
                        <a 
                          href={request.product_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline block truncate"
                        >
                          رابط المنتج
                        </a>
                      </div>
                      <Badge 
                        variant={
                          request.status === 'approved' ? 'default' :
                          request.status === 'rejected' ? 'destructive' :
                          'secondary'
                        }
                      >
                        {request.status === 'pending' && 'قيد الانتظار'}
                        {request.status === 'reviewed' && 'تمت المراجعة'}
                        {request.status === 'approved' && 'موافق عليه'}
                        {request.status === 'rejected' && 'مرفوض'}
                      </Badge>
                    </div>

                    {request.image_url && (
                      <img 
                        src={request.image_url}
                        alt={request.product_name}
                        className="w-full h-40 object-cover rounded-lg"
                      />
                    )}

                    {request.description && (
                      <p className="text-sm text-muted-foreground">
                        {request.description}
                      </p>
                    )}

                    {request.suggested_price && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
                          <span className="text-sm font-medium">السعر المقترح:</span>
                          <span className="text-lg font-black text-primary">
                            {formatPrice(Number(request.suggested_price))} دينار عراقي
                          </span>
                        </div>
                        
                        {request.status === 'approved' && (
                          <Button
                            onClick={() => handleAddToCart(request)}
                            className="w-full bg-gradient-to-b from-primary to-accent"
                          >
                            <ShoppingCart className="ml-2 h-4 w-4" />
                            إضافة للسلة
                          </Button>
                        )}
                      </div>
                    )}

                    {request.admin_notes && (
                      <div className="p-3 rounded-lg bg-muted/50 border border-border/30">
                        <p className="text-sm font-medium mb-1">ملاحظات الإدارة:</p>
                        <p className="text-sm text-muted-foreground">
                          {request.admin_notes}
                        </p>
                      </div>
                    )}

                    <div className="text-xs text-muted-foreground pt-2 border-t border-border/30">
                      تاريخ الطلب: {formatDate(request.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Package className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground">لم تقم بأي طلبات مخصصة بعد</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default MyCustomRequests;
