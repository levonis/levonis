import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Coins, Trophy, CreditCard, Shield, 
  Ticket, Package, Wallet, History,
  Gift, Star, ArrowLeft, Sparkles
} from "lucide-react";

export default function RewardsHub() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Fetch user points
  const { data: userPoints } = useQuery({
    queryKey: ['user-points-balance', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { data, error } = await supabase
        .from('user_points')
        .select('total_points')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data?.total_points || 0;
    },
    enabled: !!user,
    staleTime: 60000,
  });

  // Fetch user tickets
  const { data: userTickets } = useQuery({
    queryKey: ['user-tickets-balance', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { data, error } = await supabase
        .from('user_tickets')
        .select('ticket_count')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data?.ticket_count || 0;
    },
    enabled: !!user,
    staleTime: 60000,
  });

  // Fetch wallet balance
  const { data: wallet } = useQuery({
    queryKey: ['user-wallet-balance', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('user_wallets')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 60000,
  });

  // Fetch loyalty level
  const { data: loyaltyLevel } = useQuery({
    queryKey: ['user-loyalty-level', user?.id, userPoints],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loyalty_levels')
        .select('*')
        .lte('min_points', userPoints || 0)
        .order('min_points', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 60000,
  });

  // Fetch active competitions count
  const { data: activeCompetitions } = useQuery({
    queryKey: ['active-competitions-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('competitions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')
        .neq('is_product_based', true);
      if (error) throw error;
      return count || 0;
    },
    staleTime: 60000,
  });

  // Fetch user's purchased products count
  const { data: purchasedProductsCount } = useQuery({
    queryKey: ['my-purchased-products-count', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count, error } = await supabase
        .from('user_purchased_products')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
    staleTime: 60000,
  });

  // The four main systems
  const mainSystems = [
    {
      id: 'points',
      title: 'النقاط',
      description: 'اكسب واستبدل النقاط',
      icon: Coins,
      color: 'from-amber-500 to-yellow-500',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/30',
      path: '/my-points',
      badge: userPoints ? `${userPoints.toLocaleString()} نقطة` : null,
    },
    {
      id: 'competitions',
      title: 'المسابقات',
      description: 'اشترك واربح جوائز قيمة',
      icon: Trophy,
      color: 'from-purple-500 to-violet-500',
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/30',
      path: '/competitions',
      badge: activeCompetitions ? `${activeCompetitions} مسابقة نشطة` : null,
    },
    {
      id: 'cards',
      title: 'البطاقات',
      description: 'مستويات العضوية والمزايا',
      icon: CreditCard,
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/30',
      path: '/my-points?tab=levels',
      badge: loyaltyLevel?.name_ar || null,
    },
    {
      id: 'insurance',
      title: 'التأمين',
      description: 'حماية طابعاتك ثلاثية الأبعاد',
      icon: Shield,
      color: 'from-green-500 to-emerald-500',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/30',
      path: '/printer-protection',
      badge: null,
    },
  ];

  // Secondary quick actions - left side
  const leftActions = [
    {
      id: 'tickets',
      title: 'تذاكري',
      icon: Ticket,
      path: '/competitions?tab=tickets',
      badge: userTickets ? `${userTickets}` : '0',
    },
    {
      id: 'wallet',
      title: 'المحفظة',
      icon: Wallet,
      path: '/user-info',
      badge: wallet?.balance ? `${wallet.balance.toLocaleString()} د.ع` : null,
    },
  ];

  // Secondary quick actions - right side
  const rightActions = [
    {
      id: 'my-storage',
      title: 'مخزني',
      icon: Package,
      path: '/my-offer-purchases',
      badge: purchasedProductsCount ? `${purchasedProductsCount}` : null,
    },
    {
      id: 'history',
      title: 'السجل',
      icon: History,
      path: '/competitions/history',
      badge: null,
    },
  ];

  // Bottom quick links
  const quickLinks = [
    {
      id: 'product-offers',
      title: 'باقات التذاكر',
      subtitle: 'اشترِ منتجات واحصل على تذاكر',
      icon: Gift,
      path: '/product-offers',
      highlight: true,
    },
    {
      id: 'my-printers',
      title: 'طابعاتي',
      subtitle: 'إدارة اشتراكات الحماية',
      icon: Shield,
      path: '/my-printers',
      highlight: false,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-card/95 backdrop-blur border-b shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-gradient-to-br from-primary to-accent">
                <Sparkles className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-bold">مركز المكافآت</h1>
                <p className="text-xs text-muted-foreground">نقاط • مسابقات • بطاقات • تأمين</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      <main className="flex-1 container mx-auto px-4 py-6">
        {/* User Welcome Banner (if logged in) */}
        {user && loyaltyLevel && (
          <Card className="mb-6 overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className="p-2 rounded-full"
                    style={{ backgroundColor: loyaltyLevel.color + '20' }}
                  >
                    <Star className="h-5 w-5" style={{ color: loyaltyLevel.color }} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">مستواك الحالي</p>
                    <p className="font-bold" style={{ color: loyaltyLevel.color }}>
                      {loyaltyLevel.name_ar}
                    </p>
                  </div>
                </div>
                <div className="text-left">
                  <p className="text-xs text-muted-foreground">رصيد النقاط</p>
                  <p className="font-bold text-lg text-primary">
                    {(userPoints || 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Layout: Side Actions + Center Systems */}
        <div className="flex gap-3 mb-6">
          {/* Left Side Actions */}
          <div className="flex flex-col gap-2 w-16 shrink-0">
            {leftActions.map((action) => (
              <Card 
                key={action.id}
                className="cursor-pointer hover:border-primary/50 transition-all"
                onClick={() => navigate(action.path)}
              >
                <CardContent className="p-2 text-center">
                  <action.icon className="h-5 w-5 mx-auto mb-1 text-primary" />
                  <p className="text-[10px] font-medium leading-tight">{action.title}</p>
                  {action.badge && (
                    <Badge variant="secondary" className="mt-1 text-[9px] px-1 py-0">
                      {action.badge}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Center - Four Main Systems */}
          <div className="flex-1 grid grid-cols-2 gap-3">
            {mainSystems.map((system) => (
              <Card 
                key={system.id}
                className={`cursor-pointer transition-all hover:shadow-lg ${system.borderColor} hover:scale-[1.02]`}
                onClick={() => navigate(system.path)}
              >
                <CardContent className="p-4">
                  <div className={`inline-flex p-3 rounded-xl ${system.bgColor} mb-3`}>
                    <system.icon className={`h-6 w-6 bg-gradient-to-br ${system.color} bg-clip-text text-transparent`} style={{ color: system.color.includes('amber') ? '#f59e0b' : system.color.includes('purple') ? '#8b5cf6' : system.color.includes('blue') ? '#3b82f6' : '#22c55e' }} />
                  </div>
                  <h3 className="font-bold text-base mb-1">{system.title}</h3>
                  <p className="text-xs text-muted-foreground mb-2">{system.description}</p>
                  {system.badge && (
                    <Badge variant="outline" className="text-[10px]">
                      {system.badge}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Right Side Actions */}
          <div className="flex flex-col gap-2 w-16 shrink-0">
            {rightActions.map((action) => (
              <Card 
                key={action.id}
                className="cursor-pointer hover:border-primary/50 transition-all"
                onClick={() => navigate(action.path)}
              >
                <CardContent className="p-2 text-center">
                  <action.icon className="h-5 w-5 mx-auto mb-1 text-primary" />
                  <p className="text-[10px] font-medium leading-tight">{action.title}</p>
                  {action.badge && (
                    <Badge variant="secondary" className="mt-1 text-[9px] px-1 py-0">
                      {action.badge}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Quick Links Section */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground px-1">روابط سريعة</h2>
          <div className="grid grid-cols-2 gap-3">
            {quickLinks.map((link) => (
              <Card 
                key={link.id}
                className={`cursor-pointer transition-all hover:shadow-md ${link.highlight ? 'border-green-500/30 bg-green-500/5' : ''}`}
                onClick={() => navigate(link.path)}
              >
                <CardContent className="p-3 flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${link.highlight ? 'bg-green-500/20' : 'bg-muted'}`}>
                    <link.icon className={`h-4 w-4 ${link.highlight ? 'text-green-600' : 'text-muted-foreground'}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{link.title}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{link.subtitle}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Not logged in prompt */}
        {!user && (
          <Card className="mt-6 border-primary/20 bg-primary/5">
            <CardContent className="p-6 text-center">
              <Sparkles className="h-12 w-12 mx-auto text-primary mb-4" />
              <h3 className="font-bold text-lg mb-2">سجّل دخولك للاستفادة من المكافآت</h3>
              <p className="text-sm text-muted-foreground mb-4">
                اكسب النقاط، شارك في المسابقات، واستمتع بمزايا العضوية
              </p>
              <Button onClick={() => navigate('/auth')} className="gap-2">
                تسجيل الدخول
              </Button>
            </CardContent>
          </Card>
        )}
      </main>

      <Footer />
    </div>
  );
}
