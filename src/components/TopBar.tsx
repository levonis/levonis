import { memo, useState, useEffect, useCallback } from 'react';
import logoNew from '@/assets/logo-new.webp';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from './ui/button';
import { User, LogOut, Settings, ShoppingCart, Package, FileText, Heart, Bell, Coins, Wallet, MessageCircle, MapPin, Trophy } from 'lucide-react';
import CustomProductRequestDialog from './CustomProductRequestDialog';
import WalletDialog from './WalletDialog';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

const TopBar = memo(() => {
  const { user, isAdmin, signOut } = useAuth();
  const { itemCount } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [walletDialogOpen, setWalletDialogOpen] = useState(false);
  const isHomePage = location.pathname === '/' || location.pathname === '/home';

  const { data: unreadNotifications } = useQuery({
    queryKey: ['unread-notifications', user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.id)
        .eq('read', false);
      
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user?.id,
    refetchInterval: 60000, // Increased to 60 seconds
    staleTime: 30000,
  });

  const { data: pointsSettings } = useQuery({
    queryKey: ['points-settings-status'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('default_settings')
        .select('setting_value')
        .eq('setting_key', 'points_settings')
        .maybeSingle();
      
      if (error) throw error;
      return data?.setting_value as any;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  const pointsStatus = pointsSettings?.points_status || 'active';
  const showPointsMenu = pointsStatus === 'active';

  // جلب عدد الرسائل غير المقروءة للأدمن
  const { data: adminUnreadMessages } = useQuery({
    queryKey: ['admin-unread-messages', user?.id],
    queryFn: async () => {
      if (!isAdmin) return 0;

      const { data: conversations } = await supabase
        .from('conversations')
        .select('id');

      if (!conversations || conversations.length === 0) return 0;

      const conversationIds = conversations.map(c => c.id);

      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .in('conversation_id', conversationIds)
        .neq('sender_id', user?.id || '')
        .eq('is_read', false);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!user?.id && isAdmin,
    refetchInterval: 60000, // Increased to 60 seconds
    staleTime: 30000,
  });

  // جلب رصيد المحفظة
  const { data: wallet } = useQuery({
    queryKey: ['wallet-balance', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('user_wallets')
        .select('balance, currency')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user?.id,
    refetchInterval: 60000, // Increased to 60 seconds
    staleTime: 30000,
  });

  const handleScroll = useCallback(() => {
    setIsScrolled(window.scrollY > 20);
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  return (
    <div className={`sticky top-0 z-50 border-b overflow-hidden transition-all duration-500 ${
      isScrolled 
        ? 'bg-background/30 backdrop-blur-2xl border-border/20 shadow-2xl' 
        : 'bg-background/95 backdrop-blur-3xl border-border/40 shadow-lg'
    }`}>
      {/* Animated decorative line */}
      <div className="absolute top-0 left-0 w-full h-px overflow-hidden">
        <div className="h-full w-full bg-gradient-to-r from-transparent via-ring to-transparent animate-shimmer" 
             style={{ 
               backgroundSize: '200% 100%',
               animation: 'shimmer 3s linear infinite'
             }} 
        />
      </div>
      
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <img 
              src={logoNew} 
              alt="LEVONIS Logo" 
              className="h-10 w-auto object-contain bg-transparent"
              loading="eager"
              fetchPriority="high"
              width="50"
              height="40"
              style={{ mixBlendMode: 'normal' }}
            />
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-6">
            <Link 
              to="/" 
              className="text-foreground/80 hover:text-foreground transition-colors font-medium hover-scale"
            >
              الرئيسية
            </Link>
            <Link 
              to="/categories" 
              className="text-foreground/80 hover:text-foreground transition-colors font-medium hover-scale"
            >
              الأقسام
            </Link>
            <Link 
              to="/products" 
              className="text-foreground/80 hover:text-foreground transition-colors font-medium hover-scale"
            >
              المنتجات
            </Link>
          </div>

          {/* Cart and User Actions */}
          <div className="flex items-center gap-3">
            {/* Competitions Button */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate('/competitions')}
              className="rounded-full border-primary/30 hover:border-primary"
              title="المسابقات"
              aria-label="المسابقات"
            >
              <Trophy className="h-4 w-4" />
            </Button>

            {/* Custom Product Request Button */}
            <CustomProductRequestDialog>
              <Button
                variant="outline"
                size="icon"
                className="rounded-full border-primary/30 hover:border-primary"
                title="طلب منتج مخصص"
                aria-label="طلب منتج مخصص"
              >
                <Package className="h-4 w-4" />
              </Button>
            </CustomProductRequestDialog>

            {/* Cart Button */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate('/cart')}
              className="relative rounded-full border-primary/30 hover:border-primary"
              aria-label="سلة التسوق"
            >
              <ShoppingCart className="h-4 w-4" />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                  {itemCount > 9 ? '9+' : itemCount}
                </span>
              )}
            </Button>

            {/* Admin Chat Button */}
            {isAdmin && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigate('/admin/chats')}
                className="relative rounded-full border-primary/30 hover:border-primary"
                title="محادثات العملاء"
                aria-label="محادثات العملاء"
              >
                <MessageCircle className="h-4 w-4" />
                {adminUnreadMessages && adminUnreadMessages > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold flex items-center justify-center">
                    {adminUnreadMessages > 9 ? '9+' : adminUnreadMessages}
                  </span>
                )}
              </Button>
            )}

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon"
                    className="relative rounded-full border-primary/30 hover:border-primary"
                    aria-label="قائمة المستخدم"
                  >
                    <User className="h-4 w-4" />
                    {unreadNotifications && unreadNotifications > 0 && (
                      <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow-lg">
                        {unreadNotifications > 9 ? '9+' : unreadNotifications}
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-background backdrop-blur-sm border-border z-50">
                  <DropdownMenuLabel>حسابي</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/user-info')}>
                    <User className="ml-2 h-3.5 w-3.5" />
                    <span>معلومات الحساب</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/my-requests')}>
                    <FileText className="ml-2 h-3.5 w-3.5" />
                    <span>طلباتي المخصصة</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/addresses')}>
                    <MapPin className="ml-2 h-3.5 w-3.5" />
                    <span>العناوين</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/my-orders')}>
                    <Package className="ml-2 h-3.5 w-3.5" />
                    <span>طلباتي</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/favorites')}>
                    <Heart className="ml-2 h-3.5 w-3.5" />
                    <span>المفضلة</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setWalletDialogOpen(true)} className="relative">
                    <Wallet className="ml-2 h-3.5 w-3.5" />
                    <span>المحفظة</span>
                    {wallet && wallet.balance > 0 && (
                      <span className="mr-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                        {wallet.balance.toFixed(0)} د.ع
                      </span>
                    )}
                  </DropdownMenuItem>
                  {showPointsMenu && (
                    <DropdownMenuItem onClick={() => navigate('/my-points')}>
                      <Coins className="ml-2 h-3.5 w-3.5" />
                      <span>النقاط</span>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => navigate('/notifications')}>
                    <Bell className="ml-2 h-3.5 w-3.5" />
                    <span>الإشعارات</span>
                    {unreadNotifications && unreadNotifications > 0 && (
                      <span className="mr-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold min-w-[20px] text-center">
                        {unreadNotifications > 9 ? '9+' : unreadNotifications}
                      </span>
                    )}
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem onClick={() => navigate('/admin')}>
                      <Settings className="ml-2 h-3.5 w-3.5" />
                      <span>لوحة التحكم</span>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut} className="text-destructive">
                    <LogOut className="ml-2 h-3.5 w-3.5" />
                    <span>تسجيل الخروج</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button 
                onClick={() => navigate('/auth')}
                className="bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90"
              >
                تسجيل الدخول
              </Button>
            )}
          </div>
        </div>
      </div>

      <WalletDialog open={walletDialogOpen} onOpenChange={setWalletDialogOpen} />
    </div>
  );
});

TopBar.displayName = 'TopBar';

export default TopBar;
