import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Coins, ShoppingCart, Loader2, Gift, Package, Ticket } from "lucide-react";
import { toast } from "sonner";
import OptimizedImage from "@/components/OptimizedImage";
import { useLanguage } from "@/lib/i18n";

interface RedeemableProduct {
  id: string;
  title_ar: string;
  description_ar: string;
  product_type: string;
  value_amount: number;
  points_cost: number;
  stock_quantity: number;
  max_per_user: number;
  image_url: string | null;
  is_active: boolean;
  valid_days: number;
}

export default function PointsStorePanel() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [selectedProduct, setSelectedProduct] = useState<RedeemableProduct | null>(null);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);

  // Fetch user points
  const { data: userPoints } = useQuery({
    queryKey: ['user-points-store', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('user_points')
        .select('available_points')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  // Fetch redeemable products
  const { data: products, isLoading } = useQuery({
    queryKey: ['points-redeemable-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('points_redeemable_products')
        .select('*')
        .eq('is_active', true)
        .gt('stock_quantity', 0)
        .order('points_cost', { ascending: true });
      if (error) throw error;
      return data as RedeemableProduct[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch user's redemption history
  const { data: userRedemptions } = useQuery({
    queryKey: ['user-product-redemptions', user?.id],
    queryFn: async () => {
      if (!user) return [] as { product_id: string }[];
      const { data, error } = await supabase
        .from('points_product_redemptions' as any)
        .select('product_id')
        .eq('user_id', user.id);
      if (error && error.code !== 'PGRST116') throw error;
      return (data || []) as unknown as { product_id: string }[];
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  // Purchase mutation
  const purchaseMutation = useMutation({
    mutationFn: async (product: RedeemableProduct) => {
      if (!user) throw new Error(t('points_login_required'));

      const availablePoints = userPoints?.available_points || 0;
      if (availablePoints < product.points_cost) {
        throw new Error(t('comp_insufficient_balance'));
      }

      // Check if user already hit the limit
      const userPurchaseCount = userRedemptions?.filter(r => r.product_id === product.id).length || 0;
      if (userPurchaseCount >= product.max_per_user) {
        throw new Error(t('points_reached_limit'));
      }

      // Deduct points
      const { error: pointsError } = await supabase
        .from('user_points')
        .update({
          available_points: availablePoints - product.points_cost,
        })
        .eq('user_id', user.id);
      if (pointsError) throw pointsError;

      // Record transaction
      const { error: transError } = await supabase
        .from('points_transactions')
        .insert({
          user_id: user.id,
          points: product.points_cost,
          type: 'spent',
          source: 'product_redemption',
          description: `${t('points_redeem_action')}: ${product.title_ar}`,
          related_id: product.id,
        });
      if (transError) throw transError;

      // Record redemption
      const { error: redeemError } = await supabase
        .from('points_product_redemptions' as any)
        .insert({
          user_id: user.id,
          product_id: product.id,
          points_spent: product.points_cost,
        });
      if (redeemError) throw redeemError;

      // Decrease stock
      const { error: stockError } = await supabase
        .from('points_redeemable_products')
        .update({ stock_quantity: product.stock_quantity - 1 })
        .eq('id', product.id);
      if (stockError) throw stockError;

      // Handle based on product type
      if (product.product_type === 'coupon' || product.product_type === 'free_shipping') {
        // Create a coupon for the user
        const couponCode = `RED${Date.now().toString(36).toUpperCase()}`;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + (product.valid_days || 30));
        
        await supabase.from('user_coupons').insert({
          user_id: user.id,
          coupon_code: couponCode,
          discount_type: product.product_type === 'free_shipping' ? 'free_shipping' : 'fixed',
          discount_value: product.value_amount || 0,
          expires_at: expiresAt.toISOString(),
          source: 'points_store',
        });
      } else if (product.product_type === 'physical') {
        // Add to user storage for shipping
        await supabase.from('product_offer_purchases').insert({
          user_id: user.id,
          offer_id: product.id, // Using product id as offer reference
          quantity: 1,
          unit_price: 0,
          total_price: 0,
          gift_tickets_awarded: 0,
          purchase_status: 'pending',
        });
      }

      return product;
    },
    onSuccess: (product) => {
      queryClient.invalidateQueries({ queryKey: ['user-points'] });
      queryClient.invalidateQueries({ queryKey: ['user-points-store'] });
      queryClient.invalidateQueries({ queryKey: ['points-redeemable-products'] });
      queryClient.invalidateQueries({ queryKey: ['user-product-redemptions'] });
      queryClient.invalidateQueries({ queryKey: ['user-coupons'] });
      
      if (product.product_type === 'physical') {
        toast.success(t('points_product_added_storage'));
      } else {
        toast.success(t('points_coupon_redeemed'));
      }
      setPurchaseDialogOpen(false);
      setSelectedProduct(null);
    },
    onError: (error: any) => {
      toast.error(error.message || t('common_error'));
    },
  });

  const getProductIcon = (type: string) => {
    switch (type) {
      case 'free_shipping': return Ticket;
      case 'physical': return Package;
      default: return Gift;
    }
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Coins className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">{t('points_login_required')}</p>
        </CardContent>
      </Card>
    );
  }

  const availablePoints = userPoints?.available_points || 0;

  return (
    <div className="space-y-4">
      {/* Points Balance */}
      <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center">
            <Coins className="h-6 w-6 text-amber-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('points_available_for_redeem')}</p>
            <p className="text-2xl font-bold">{availablePoints.toLocaleString()} {t('points_unit')}</p>
          </div>
        </CardContent>
      </Card>

      {/* Products Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : !products || products.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Gift className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <p className="font-medium">{t('points_no_products')}</p>
            <p className="text-sm text-muted-foreground mt-2">{t('points_no_products_desc')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {products.map((product) => {
            const Icon = getProductIcon(product.product_type);
            const canAfford = availablePoints >= product.points_cost;
            const userPurchaseCount = userRedemptions?.filter(r => r.product_id === product.id).length || 0;
            const reachedLimit = userPurchaseCount >= product.max_per_user;
            
            return (
              <Card 
                key={product.id} 
                className={`overflow-hidden transition-all hover:shadow-md ${!canAfford || reachedLimit ? 'opacity-60' : ''}`}
              >
                {product.image_url ? (
                  <div className="aspect-square bg-muted">
                    <OptimizedImage
                      src={product.image_url}
                      alt={product.title_ar}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="aspect-square bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                    <Icon className="h-12 w-12 text-primary/40" />
                  </div>
                )}
                <CardContent className="p-3 space-y-2">
                  <div>
                    <p className="font-medium text-sm line-clamp-1">{product.title_ar}</p>
                    {product.description_ar && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {product.description_ar}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="secondary" className="text-xs gap-1">
                      <Coins className="h-3 w-3" />
                      {product.points_cost.toLocaleString()}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {t('points_remaining_stock')} {product.stock_quantity}
                    </span>
                  </div>
                  
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={!canAfford || reachedLimit}
                    onClick={() => {
                      setSelectedProduct(product);
                      setPurchaseDialogOpen(true);
                    }}
                  >
                    {reachedLimit ? (
                      t('points_reached_limit')
                    ) : canAfford ? (
                      <>
                        <ShoppingCart className="h-3.5 w-3.5 ml-1" />
                        {t('points_redeem_action')}
                      </>
                    ) : (
                      t('points_need_more', { count: (product.points_cost - availablePoints).toLocaleString() })
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Purchase Dialog */}
      <AlertDialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('points_confirm_redeem')}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              {selectedProduct && (
                <>
                  <p>
                    {t('points_confirm_redeem_desc', { 
                      points: selectedProduct.points_cost.toLocaleString(), 
                      product: selectedProduct.title_ar 
                    })}
                  </p>
                  {selectedProduct.product_type === 'physical' && (
                    <p className="text-sm text-primary">{t('points_physical_note')}</p>
                  )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common_cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedProduct && purchaseMutation.mutate(selectedProduct)}
              disabled={purchaseMutation.isPending}
            >
              {purchaseMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              ) : null}
              {t('points_confirm_action')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
