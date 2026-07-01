import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Trophy, Gift, Truck, CheckCircle2, Clock, Package, Coins, Ticket, CreditCard, Sparkles, ArrowLeft, MapPin,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useNumberFormat } from "@/lib/i18n/numberFormat";
import SEO from "@/components/SEO";

const PRIZE_ICON: Record<string, any> = {
  points: Coins,
  coupon: Ticket,
  product: Package,
  card: CreditCard,
  tickets: Ticket,
  random_product: Sparkles,
  custom: Gift,
};

const PRIZE_TYPE_LABEL: Record<string, string> = {
  points: 'نقاط',
  coupon: 'كوبون خصم',
  product: 'منتج',
  card: 'بطاقة ولاء',
  tickets: 'تذاكر',
  random_product: 'منتج عشوائي',
  custom: 'جائزة مخصصة',
};

const STATUS_BADGE: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'بانتظارك', color: 'bg-amber-500/15 text-amber-600', icon: Clock },
  requested: { label: 'تم طلب الشحن', color: 'bg-blue-500/15 text-blue-600', icon: Truck },
  granted: { label: 'مُسلَّمة', color: 'bg-green-500/15 text-green-600', icon: CheckCircle2 },
  shipped: { label: 'في الطريق', color: 'bg-blue-500/15 text-blue-600', icon: Truck },
  delivered: { label: 'تم الاستلام', color: 'bg-green-500/15 text-green-600', icon: CheckCircle2 },
  cancelled: { label: 'مُلغاة', color: 'bg-red-500/15 text-red-600', icon: Clock },
};

export default function MyLevelPrizes() {
  const { user } = useAuth();
  const { fmt } = useNumberFormat();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [shipDialog, setShipDialog] = useState<{ open: boolean; claim: any | null }>({ open: false, claim: null });
  const [addressId, setAddressId] = useState<string>("");

  const { data: claims, isLoading } = useQuery({
    queryKey: ['my-level-prize-claims', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('user_level_prize_claims')
        .select(`
          *,
          level_prizes:prize_id (
            id, title_ar, description_ar, prize_type, prize_value, image_url,
            tickets_count, coupon_code, product_id, is_random_product, auto_grant
          )
        `)
        .eq('user_id', user.id)
        .order('level_number', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 60 * 1000,
  });

  const { data: addresses } = useQuery({
    queryKey: ['user-addresses-prizes', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('user_addresses')
        .select('id, governorate, area, district, full_name, phone, is_default')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const requestShipping = useMutation({
    mutationFn: async ({ claimId, addrId }: { claimId: string; addrId?: string }) => {
      const { data, error } = await supabase.rpc('request_level_prize_shipping', {
        p_claim_id: claimId,
        p_address_id: addrId || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (res: any) => {
      if (res?.success) {
        toast.success('تم إرسال طلب الشحن — ستتواصل الإدارة معك قريباً');
        setShipDialog({ open: false, claim: null });
        setAddressId("");
        queryClient.invalidateQueries({ queryKey: ['my-level-prize-claims'] });
      } else {
        toast.error(res?.error || 'تعذّر إرسال الطلب');
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!user) {
    return (
      <div className="container mx-auto p-4 text-center">
        <p>يجب تسجيل الدخول لعرض جوائزك</p>
        <Link to="/auth"><Button className="mt-3">تسجيل الدخول</Button></Link>
      </div>
    );
  }

  const list = claims || [];
  const pending = list.filter((c: any) => c.status === 'pending');
  const inProgress = list.filter((c: any) => ['requested', 'shipped'].includes(c.status));
  const done = list.filter((c: any) => ['granted', 'delivered'].includes(c.status));

  const renderCard = (claim: any) => {
    const prize = claim.level_prizes;
    if (!prize) return null;
    const Icon = PRIZE_ICON[prize.prize_type] || Gift;
    const status = STATUS_BADGE[claim.status] || STATUS_BADGE.pending;
    const StatusIcon = status.icon;
    const needsShipping = claim.status === 'pending' && !prize.auto_grant && ['product', 'random_product', 'card'].includes(prize.prize_type);

    return (
      <Card key={claim.id} className="overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {prize.image_url ? (
              <img src={prize.image_url} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" loading="lazy" decoding="async" />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
                <Icon className="h-7 w-7 text-amber-600" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <Badge variant="outline" className="text-[10px] px-1.5">المستوى {claim.level_number}</Badge>
                <Badge className={`text-[10px] px-1.5 border-0 ${status.color}`}>
                  <StatusIcon className="h-3 w-3 ml-0.5" />
                  {status.label}
                </Badge>
              </div>
              <p className="font-bold text-sm">{prize.title_ar}</p>
              {prize.description_ar && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{prize.description_ar}</p>
              )}
              <p className="text-[10px] text-muted-foreground mt-1">
                {PRIZE_TYPE_LABEL[prize.prize_type] || prize.prize_type}
                {prize.prize_value > 0 && ` • قيمة ${fmt(prize.prize_value)}`}
                {prize.tickets_count > 0 && ` • ${prize.tickets_count} تذكرة`}
                {prize.coupon_code && ` • كود: ${prize.coupon_code}`}
              </p>

              {/* Auto-granted summary */}
              {claim.status === 'granted' && claim.granted_at && (
                <p className="text-[10px] text-green-600 mt-1">
                  تم إضافتها لحسابك في {new Date(claim.granted_at).toLocaleDateString('ar')}
                </p>
              )}

              {/* Coupon reveal */}
              {claim.status === 'granted' && prize.coupon_code && (
                <div className="mt-2 p-2 rounded-lg bg-amber-500/10 flex items-center justify-between">
                  <code className="text-xs font-bold text-amber-700 dark:text-amber-400">{prize.coupon_code}</code>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-[10px]"
                    onClick={() => {
                      navigator.clipboard.writeText(prize.coupon_code);
                      toast.success('تم النسخ');
                    }}
                  >
                    نسخ
                  </Button>
                </div>
              )}

              {needsShipping && (
                <Button
                  size="sm"
                  className="mt-2 h-8 text-xs gap-1"
                  onClick={() => setShipDialog({ open: true, claim })}
                >
                  <Truck className="h-3.5 w-3.5" />
                  طلب الشحن
                </Button>
              )}

              {claim.notes && (
                <p className="text-[10px] text-muted-foreground mt-1 italic">ملاحظة الإدارة: {claim.notes}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <SEO title="جوائزي" description="جوائز المستويات الخاصة بك" />
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b">
        <div className="container mx-auto p-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              جوائز مستوياتي
            </h1>
            <p className="text-[11px] text-muted-foreground">جوائز كل 5 مستويات تظهر هنا</p>
          </div>
        </div>
      </div>

      <div className="container mx-auto p-4 space-y-4">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        ) : list.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center">
              <Trophy className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="font-semibold mb-1">لا توجد جوائز بعد</p>
              <p className="text-xs text-muted-foreground mb-4">
                اربح جوائز عند الوصول إلى كل 5 مستويات (5، 10، 15...). تابع التسوق لكسب XP!
              </p>
              <Link to="/rewards">
                <Button variant="outline" size="sm">عرض المستويات</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="pending" className="w-full">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="pending">بانتظارك ({pending.length})</TabsTrigger>
              <TabsTrigger value="progress">قيد المعالجة ({inProgress.length})</TabsTrigger>
              <TabsTrigger value="done">مُكتملة ({done.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="pending" className="space-y-3 mt-3">
              {pending.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-6">لا توجد جوائز بانتظارك</p>
              ) : pending.map(renderCard)}
            </TabsContent>
            <TabsContent value="progress" className="space-y-3 mt-3">
              {inProgress.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-6">لا شيء قيد المعالجة</p>
              ) : inProgress.map(renderCard)}
            </TabsContent>
            <TabsContent value="done" className="space-y-3 mt-3">
              {done.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-6">لا توجد جوائز مُكتملة</p>
              ) : done.map(renderCard)}
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Shipping request dialog */}
      <Dialog open={shipDialog.open} onOpenChange={(o) => !o && setShipDialog({ open: false, claim: null })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>طلب شحن جائزة</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              اختر عنوان الشحن لهذه الجائزة. ستتواصل الإدارة معك لتنسيق التسليم.
            </p>
            {(addresses?.length || 0) === 0 ? (
              <Card>
                <CardContent className="p-4 text-center text-sm">
                  <MapPin className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                  لا يوجد عنوان مسجل
                  <Link to="/addresses">
                    <Button size="sm" className="mt-2">إضافة عنوان</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div>
                <label className="text-xs font-semibold mb-1 block">عنوان الشحن</label>
                <Select value={addressId} onValueChange={setAddressId}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر عنوان" />
                  </SelectTrigger>
                  <SelectContent>
                    {addresses?.map((a: any) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.governorate} - {a.area} {a.district ? `(${a.district})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShipDialog({ open: false, claim: null })}>
              إلغاء
            </Button>
            <Button
              onClick={() => requestShipping.mutate({ claimId: shipDialog.claim.id, addrId: addressId })}
              disabled={requestShipping.isPending || !addressId}
            >
              {requestShipping.isPending ? 'جاري الإرسال...' : 'تأكيد طلب الشحن'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
