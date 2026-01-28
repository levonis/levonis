import { memo, useState, useEffect, useCallback } from 'react';
import logoNew from '@/assets/new-logo.png';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from './ui/button';
import { User, LogOut, Settings, ShoppingCart, Package, FileText, Heart, Bell, Coins, Wallet, MessageCircle, MapPin, Trophy, Shield, Users } from 'lucide-react';
import CustomProductRequestDialog from './CustomProductRequestDialog';
import WalletDialog from './WalletDialog';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ADMIN_ROUTES } from '@/config/adminConfig';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

interface TopBarProps {
  announcementHeight?: number;
}

const TopBar = memo(({ announcementHeight = 0 }: TopBarProps) => {
  const { user, isAdmin, signOut } = useAuth();
  const { itemCount } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [walletDialogOpen, setWalletDialogOpen] = useState(false);
  const isHomePage = location.pathname === '/' || location.pathname === '/home';

  // Optimized: Only fetch notifications when user is logged in, with longer stale time
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
    refetchInterval: 120000, // Increased to 2 minutes
    staleTime: 60000, // 1 minute stale time
    gcTime: 300000, // 5 minutes cache
  });

  // Optimized: Cache points settings longer
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
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes cache
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const pointsStatus = pointsSettings?.points_status || 'active';
  const showPointsMenu = pointsStatus === 'active';

  // Optimized: Admin unread messages - fetch from both systems (official + community)
  const { data: adminUnreadMessages } = useQuery({
    queryKey: ['admin-unread-messages', user?.id],
    queryFn: async () => {
      if (!isAdmin) return { total: 0, official: 0, community: 0 };

      // Get official site unread messages
      const { data: conversations } = await supabase
        .from('conversations')
        .select('id')
        .limit(100);

      let officialUnread = 0;
      if (conversations && conversations.length > 0) {
        const conversationIds = conversations.map(c => c.id);
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .in('conversation_id', conversationIds)
          .neq('sender_id', user?.id || '')
          .eq('is_read', false);
        officialUnread = count || 0;
      }

      // Get community unread messages
      const { data: communityConvs } = await supabase
        .from('listing_conversations')
        .select('id')
        .limit(100);

      let communityUnread = 0;
      if (communityConvs && communityConvs.length > 0) {
        const communityConvIds = communityConvs.map(c => c.id);
        const { count } = await supabase
          .from('listing_messages')
          .select('*', { count: 'exact', head: true })
          .in('conversation_id', communityConvIds)
          .neq('sender_id', user?.id || '')
          .eq('is_read', false);
        communityUnread = count || 0;
      }

      return { 
        total: officialUnread + communityUnread, 
        official: officialUnread, 
        community: communityUnread 
      };
    },
    enabled: !!user?.id && isAdmin,
    refetchInterval: 60000, // Check every minute
    staleTime: 30000,
    gcTime: 300000,
  });

  // Optimized: Wallet balance with longer cache
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
    refetchInterval: 120000, // Increased to 2 minutes
    staleTime: 60000, // 1 minute stale
    gcTime: 300000, // 5 min cache
    refetchOnWindowFocus: false,
  });

  // Optimized scroll handler with RAF throttle
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setIsScrolled(window.scrollY > 20);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Calculate top position:
  // On homepage: when scrolling, move from below announcement to top (pushing announcement up)
  // On other pages: always at top (0)
  const topPosition = isHomePage 
    ? (isScrolled ? 0 : announcementHeight)
    : 0;

  return (
    <header 
      className="fixed left-0 right-0 z-50 border-b overflow-hidden transition-all duration-300 bg-background/95 backdrop-blur-xl border-border/40 shadow-md"
      style={{ top: `${topPosition}px` }}
    >
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
            <Link
              to="/community"
              className="text-foreground/80 hover:text-foreground transition-colors font-medium hover-scale"
            >
              المجتمع
            </Link>
          </div>

          {/* Cart and User Actions */}
          <div className="flex items-center gap-3">
            {/* Rewards Hub Button */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate('/rewards')}
              className="rounded-full border-primary/30 hover:border-primary"
              title="مركز المكافآت"
              aria-label="مركز المكافآت"
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

            {/* Admin Chat Button - Links to unified chats */}
            {isAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="relative rounded-full border-primary/30 hover:border-primary"
                    title="محادثات العملاء"
                    aria-label="محادثات العملاء"
                  >
                    <MessageCircle className="h-4 w-4" />
                    {adminUnreadMessages && adminUnreadMessages.total > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold flex items-center justify-center">
                        {adminUnreadMessages.total > 9 ? '9+' : adminUnreadMessages.total}
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-background backdrop-blur-sm border-border z-50">
                  <DropdownMenuLabel>محادثات العملاء</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate(ADMIN_ROUTES.chats)}>
                    <MessageCircle className="ml-2 h-3.5 w-3.5" />
                    <span>محادثات الموقع الرسمي</span>
                    {adminUnreadMessages && adminUnreadMessages.official > 0 && (
                      <span className="mr-auto bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full font-bold">
                        {adminUnreadMessages.official}
                      </span>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/admin/community-messages')}>
                    <Users className="ml-2 h-3.5 w-3.5" />
                    <span>محادثات مجتمع ليفو</span>
                    {adminUnreadMessages && adminUnreadMessages.community > 0 && (
                      <span className="mr-auto bg-purple-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                        {adminUnreadMessages.community}
                      </span>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate(ADMIN_ROUTES.levoCommunity)}>
                    <Shield className="ml-2 h-3.5 w-3.5" />
                    <span>إدارة مجتمع ليفو</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
                    <DropdownMenuItem onClick={() => navigate(ADMIN_ROUTES.dashboard)}>
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
    </header>
  );
});

TopBar.displayName = 'TopBar';

export default TopBar;
