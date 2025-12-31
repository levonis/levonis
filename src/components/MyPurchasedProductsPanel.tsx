import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Package, Loader2, Truck, CheckCircle2, Clock, ShoppingBag, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import OptimizedImage from "@/components/OptimizedImage";

interface PurchasedProduct {
  id: string;
  product_name: string;
  product_name_ar: string;
  product_image: string | null;
  product_price: number;
  currency: string;
  source_type: string;
  order_status: string;
  purchased_at: string;
  gift_tickets: number;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  not_ordered: { 
    label: "لم يُطلب", 
    color: "bg-amber-100 text-amber-800 border-amber-200", 
    icon: <Clock className="h-3 w-3" /> 
  },
  pending: { 
    label: "قيد الانتظار", 
    color: "bg-blue-100 text-blue-800 border-blue-200", 
    icon: <Clock className="h-3 w-3" /> 
  },
  shipped: { 
    label: "تم الشحن", 
    color: "bg-purple-100 text-purple-800 border-purple-200", 
    icon: <Truck className="h-3 w-3" /> 
  },
  delivered: { 
    label: "تم التوصيل", 
    color: "bg-green-100 text-green-800 border-green-200", 
    icon: <CheckCircle2 className="h-3 w-3" /> 
  },
};

interface MyPurchasedProductsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MyPurchasedProductsPanel({ isOpen, onClose }: MyPurchasedProductsPanelProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const { data: purchasedProducts, isLoading } = useQuery({
    queryKey: ['my-purchased-products-panel', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('user_purchased_products')
        .select('*')
        .eq('user_id', user.id)
        .order('purchased_at', { ascending: false });
      
      if (error) throw error;
      return data as PurchasedProduct[];
    },
    enabled: !!user && isOpen,
  });

  const requestShipmentMutation = useMutation({
    mutationFn: async (productIds: string[]) => {
      const { data, error } = await supabase.rpc('request_offer_shipment', {
        p_purchase_ids: productIds,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      if (data.success) {
        toast.success('تم طلب الشحن بنجاح!');
        queryClient.invalidateQueries({ queryKey: ['my-purchased-products-panel'] });
        queryClient.invalidateQueries({ queryKey: ['my-purchased-products'] });
        setSelectedProducts([]);
        setShowConfirmDialog(false);
      } else {
        toast.error(data.error || 'حدث خطأ');
      }
    },
    onError: (error) => toast.error('خطأ: ' + error.message),
  });

  const availableForShipment = useMemo(() => {
    return purchasedProducts?.filter(p => p.order_status === 'not_ordered') || [];
  }, [purchasedProducts]);

  const toggleProductSelection = (id: string) => {
    setSelectedProducts(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    const allIds = availableForShipment.map(p => p.id);
    setSelectedProducts(allIds);
  };

  const handleRequestShipment = () => {
    if (selectedProducts.length === 0) {
      toast.error('يرجى اختيار منتج واحد على الأقل');
      return;
    }
    setShowConfirmDialog(true);
  };

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || statusConfig.not_ordered;
    return (
      <Badge variant="outline" className={`gap-1 text-[10px] px-1.5 py-0.5 ${config.color}`}>
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="w-[95vw] max-w-[500px] h-[85vh] max-h-[700px] p-0 flex flex-col" dir="rtl">
          <DialogHeader className="px-4 py-3 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Package className="h-5 w-5 text-primary" />
              مشترياتي
            </DialogTitle>
            <DialogDescription className="text-xs">
              المنتجات التي اشتريتها من العروض
            </DialogDescription>
          </DialogHeader>

          {/* Bulk Actions */}
          {availableForShipment.length > 0 && (
            <div className="px-4 py-2 bg-secondary/30 border-b shrink-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={selectAll}
                    className="text-xs h-7 px-2"
                  >
                    تحديد الكل ({availableForShipment.length})
                  </Button>
                  {selectedProducts.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      محدد: {selectedProducts.length}
                    </span>
                  )}
                </div>
                <Button
                  size="sm"
                  onClick={handleRequestShipment}
                  disabled={selectedProducts.length === 0 || requestShipmentMutation.isPending}
                  className="gap-1 h-7 text-xs"
                >
                  {requestShipmentMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Truck className="h-3 w-3" />
                  )}
                  طلب شحن
                </Button>
              </div>
            </div>
          )}

          {/* Products List */}
          <ScrollArea className="flex-1 px-4 py-2">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : !purchasedProducts || purchasedProducts.length === 0 ? (
              <div className="text-center py-12">
                <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground mb-2">لا توجد مشتريات بعد</p>
                <p className="text-xs text-muted-foreground">
                  اشترِ من العروض للحصول على منتجات وتذاكر هدية!
                </p>
              </div>
            ) : (
              <div className="space-y-2 pb-4">
                {purchasedProducts.map((product) => {
                  const canSelect = product.order_status === 'not_ordered';
                  const isSelected = selectedProducts.includes(product.id);

                  return (
                    <div
                      key={product.id}
                      className={`flex items-center gap-3 p-2 rounded-lg border transition-colors ${
                        canSelect 
                          ? isSelected 
                            ? 'bg-primary/10 border-primary/30' 
                            : 'bg-card hover:bg-secondary/30 border-border'
                          : 'bg-muted/30 border-border/50'
                      }`}
                    >
                      {/* Checkbox */}
                      {canSelect && (
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleProductSelection(product.id)}
                          className="shrink-0"
                        />
                      )}

                      {/* Product Image */}
                      <div className="w-14 h-14 rounded-md overflow-hidden bg-secondary shrink-0">
                        {product.product_image ? (
                          <OptimizedImage
                            src={product.product_image}
                            alt={product.product_name_ar}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="h-6 w-6 text-muted-foreground/50" />
                          </div>
                        )}
                      </div>

                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {product.product_name_ar || product.product_name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(new Date(product.purchased_at), 'dd MMM yyyy', { locale: ar })}
                        </p>
                        <div className="mt-1">
                          {getStatusBadge(product.order_status)}
                        </div>
                      </div>

                      {/* Price */}
                      <div className="text-left shrink-0">
                        <p className="text-sm font-bold text-primary">
                          {product.product_price.toLocaleString()}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {product.currency || 'دينار'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Footer */}
          <div className="px-4 py-3 border-t bg-secondary/20 shrink-0">
            <Button variant="outline" onClick={onClose} className="w-full h-9">
              إغلاق
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Shipment Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد طلب الشحن</AlertDialogTitle>
            <AlertDialogDescription>
              هل تريد طلب شحن {selectedProducts.length} منتج؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogAction
              onClick={() => requestShipmentMutation.mutate(selectedProducts)}
              disabled={requestShipmentMutation.isPending}
            >
              {requestShipmentMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              ) : null}
              تأكيد
            </AlertDialogAction>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
