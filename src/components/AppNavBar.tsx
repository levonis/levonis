import { memo, useState, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, ShoppingCart, Users, Trophy, User, Gamepad2, MessageCircle, ArrowLeftRight, ArrowUpDown } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { CartContext } from '@/hooks/useCart';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface NavItem {
  key: string;
  labelKey: string;
  icon: typeof Home;
  path: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'home', labelKey: 'nav_home', icon: Home, path: '/' },
  { key: 'cart', labelKey: 'menu_cart', icon: ShoppingCart, path: '/cart' },
  { key: 'community', labelKey: 'nav_community', icon: Users, path: '/community' },
  { key: 'rewards', labelKey: 'menu_rewards', icon: Trophy, path: '/rewards' },
  { key: 'games', labelKey: 'nav_games', icon: Gamepad2, path: '/games' },
  { key: 'messages', labelKey: 'menu_messages', icon: MessageCircle, path: '/chats' },
  { key: 'account', labelKey: 'menu_account_info', icon: User, path: '/profile' },
];

type DockPosition = 'right' | 'left' | 'top' | 'bottom';
const POSITIONS: DockPosition[] = ['right', 'bottom', 'left', 'top'];
const STORAGE_KEY = 'nav-dock-position';

const getStoredPosition = (): DockPosition => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && POSITIONS.includes(stored as DockPosition)) return stored as DockPosition;
  } catch {}
  return 'right';
};

const AppNavBar = memo(() => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const { itemCount } = useCart();
  const isMobile = useIsMobile();
  const { user } = useAuth();

  const { data: unreadMsgCount = 0 } = useQuery({
    queryKey: ["nav-unread-messages", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { data: convs } = await supabase
        .from("listing_conversations")
        .select("id")
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`);
      if (!convs?.length) return 0;
      const { count } = await supabase
        .from("listing_messages")
        .select("id", { count: "exact", head: true })
        .in("conversation_id", convs.map(c => c.id))
        .neq("sender_id", user.id)
        .eq("is_read", false);
      return count || 0;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });
  const [dockPosition, setDockPosition] = useState<DockPosition>(getStoredPosition);

  const isActive = (item: NavItem) => {
    if (item.path === '/') return location.pathname === '/' || location.pathname === '/home';
    return location.pathname.startsWith(item.path);
  };

  const handleClick = (item: NavItem) => {
    navigate(item.path);
  };

  const cyclePosition = () => {
    const idx = POSITIONS.indexOf(dockPosition);
    const next = POSITIONS[(idx + 1) % POSITIONS.length];
    setDockPosition(next);
    localStorage.setItem(STORAGE_KEY, next);
  };

  const isHorizontal = dockPosition === 'top' || dockPosition === 'bottom';

  if (!isMobile) {
    const positionClasses: Record<DockPosition, string> = {
      right: 'fixed top-1/2 -translate-y-1/2 right-3 flex-col',
      left: 'fixed top-1/2 -translate-y-1/2 left-3 flex-col',
      top: 'fixed top-3 left-1/2 -translate-x-1/2 flex-row',
      bottom: 'fixed bottom-3 left-1/2 -translate-x-1/2 flex-row',
    };

    const tooltipClasses: Record<DockPosition, string> = {
      right: 'right-full mr-2',
      left: 'left-full ml-2',
      top: 'top-full mt-2',
      bottom: 'bottom-full mb-2',
    };

    return (
      <nav
        className={cn(
          "z-50 flex items-center gap-1.5 p-2 rounded-2xl bg-card/90 border border-border/50 shadow-xl transition-all duration-500",
          positionClasses[dockPosition]
        )}
      >
        {/* Position toggle button */}
        <button
          onClick={cyclePosition}
          title="تغيير موقع الشريط"
          className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/50 transition-colors"
        >
          {isHorizontal ? <ArrowLeftRight className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5" />}
        </button>

        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);
          return (
            <button
              key={item.key}
              onClick={() => handleClick(item)}
              title={t(item.labelKey as any)}
              className={cn(
                "group relative flex items-center justify-center w-11 h-11 rounded-xl transition-all duration-200",
                active
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
              {item.key === 'cart' && itemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                  {itemCount > 9 ? '9+' : itemCount}
                </span>
              )}
              {item.key === 'messages' && unreadMsgCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center animate-pulse">
                  {unreadMsgCount > 9 ? '9+' : unreadMsgCount}
                </span>
              )}
              <span className={cn(
                "absolute px-2.5 py-1 rounded-lg bg-foreground text-background text-xs font-medium whitespace-nowrap opacity-0 pointer-events-none scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 z-[60]",
                tooltipClasses[dockPosition]
              )}>
                {t(item.labelKey as any)}
              </span>
            </button>
          );
        })}
      </nav>
    );
  }

  // Mobile: bottom bar (unchanged)
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border/40"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-end justify-around px-2 pt-1 pb-1.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);
          return (
            <button
              key={item.key}
              onClick={() => handleClick(item)}
              className={cn(
                "relative flex flex-col items-center gap-0.5 min-w-[3.2rem] py-1 transition-all duration-300",
                active ? "text-primary" : "text-muted-foreground active:scale-90"
              )}
            >
              <span
                className={cn(
                  "flex items-center justify-center rounded-2xl transition-all duration-300",
                  active
                    ? "w-12 h-8 bg-primary/15 -translate-y-1 shadow-sm"
                    : "w-8 h-8"
                )}
              >
                <Icon
                  className={cn(
                    "transition-all duration-300",
                    active ? "h-[22px] w-[22px]" : "h-[18px] w-[18px]"
                  )}
                  strokeWidth={active ? 2.5 : 1.8}
                />
                {item.key === 'cart' && itemCount > 0 && (
                  <span className="absolute top-0 right-1/2 translate-x-4 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center shadow-sm">
                    {itemCount > 9 ? '9+' : itemCount}
                  </span>
                )}
                {item.key === 'messages' && unreadMsgCount > 0 && (
                  <span className="absolute top-0 right-1/2 translate-x-4 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center shadow-sm animate-pulse">
                    {unreadMsgCount > 9 ? '9+' : unreadMsgCount}
                  </span>
                )}
              </span>
              <span
                className={cn(
                  "text-[10px] leading-none font-medium transition-all duration-200",
                  active ? "font-bold text-primary opacity-100" : "opacity-70"
                )}
              >
                {t(item.labelKey as any)}
              </span>
              {active && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
});

AppNavBar.displayName = 'AppNavBar';

export default AppNavBar;
