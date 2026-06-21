import { memo, useState, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, ShoppingCart, Users, Trophy, Gamepad2, MessageCircle, ArrowLeftRight, ArrowUpDown } from 'lucide-react';
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
  const cartContext = useContext(CartContext);
  const itemCount = cartContext?.itemCount ?? 0;
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
        data-app-navbar
        className={cn(
          "z-50 flex items-center gap-1.5 p-2 glass-panel !rounded-full transition-all duration-500",
          positionClasses[dockPosition]
        )}
      >
        {/* Position toggle button */}
        <button
          onClick={cyclePosition}
          title="تغيير موقع الشريط"
          aria-label="تغيير موقع شريط التنقل"
          className="flex items-center justify-center w-8 h-8 rounded-full text-muted-foreground/50 hover:text-muted-foreground hover:bg-[hsl(var(--foreground)/0.06)] transition-all duration-300"
        >
          {isHorizontal ? <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden="true" /> : <ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" />}
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
                "group relative flex items-center justify-center w-11 h-11 rounded-full transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                active
                  ? "bg-primary text-primary-foreground shadow-[0_4px_14px_hsl(var(--primary)/0.45),inset_0_1px_0_hsl(0_0%_100%/0.18)] scale-110"
                  : "text-muted-foreground hover:bg-[hsl(var(--foreground)/0.06)] hover:text-foreground hover:scale-105"
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
              {item.key === 'cart' && itemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center ring-2 ring-background/40">
                  {itemCount > 9 ? '9+' : itemCount}
                </span>
              )}
              {item.key === 'messages' && unreadMsgCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center animate-pulse ring-2 ring-background/40">
                  {unreadMsgCount > 9 ? '9+' : unreadMsgCount}
                </span>
              )}
              <span className={cn(
                "absolute px-2.5 py-1 rounded-lg glass-floating text-foreground text-xs font-medium whitespace-nowrap opacity-0 pointer-events-none scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 z-[60]",
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

  // Mobile: floating oval glass bottom bar
  return (
    <nav
      data-app-navbar
      className="fixed bottom-0 left-0 right-0 z-50 px-3 pointer-events-none"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.5rem)' }}
      aria-label={t('nav_home' as any) as string}
    >
      <div className="glass-panel !rounded-full pointer-events-auto px-2 py-1.5 mx-auto max-w-md">
        <div className="flex items-center justify-around">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            return (
              <button
                key={item.key}
                onClick={() => handleClick(item)}
                aria-label={t(item.labelKey as any) as string}
                aria-current={active ? 'page' : undefined}
                style={{ WebkitTapHighlightColor: 'transparent' }}
                className={cn(
                  "relative flex flex-col items-center min-w-[2.6rem] py-1 select-none outline-none",
                  "transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                  "active:scale-[0.92]",
                  "focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-2xl",
                  active ? "text-primary-foreground" : "text-muted-foreground"
                )}
              >
                {/* Outer ambient glow — only when active */}
                {active && (
                  <span
                    aria-hidden
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-9 rounded-full bg-primary/40 blur-xl opacity-70 animate-pulse pointer-events-none"
                  />
                )}
                <span
                  className={cn(
                    "relative flex items-center justify-center rounded-full",
                    "transition-[width,height,background-color,box-shadow,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                    "group-active:scale-95",
                    active
                      ? [
                          "w-12 h-9 bg-primary text-primary-foreground",
                          // Layered glow: outer drop, primary halo, top inner highlight, bottom inner depth
                          "shadow-[0_6px_18px_-2px_hsl(var(--primary)/0.55),0_2px_6px_hsl(var(--primary)/0.35),inset_0_1px_0_hsl(0_0%_100%/0.25),inset_0_-1px_0_hsl(0_0%_0%/0.15)]",
                        ].join(" ")
                      : "w-9 h-9 hover:bg-[hsl(var(--foreground)/0.06)] active:bg-[hsl(var(--foreground)/0.10)]"
                  )}
                >
                  <Icon
                    className={cn(
                      "transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                      active ? "h-[20px] w-[20px] drop-shadow-[0_1px_2px_hsl(var(--primary)/0.45)]" : "h-[18px] w-[18px]"
                    )}
                    strokeWidth={active ? 2.5 : 1.8}
                  />
                  {item.key === 'cart' && itemCount > 0 && (
                    <span className="absolute -top-0.5 right-0 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center ring-2 ring-background/40">
                      {itemCount > 9 ? '9+' : itemCount}
                    </span>
                  )}
                  {item.key === 'messages' && unreadMsgCount > 0 && (
                    <span className="absolute -top-0.5 right-0 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center ring-2 ring-background/40 animate-pulse">
                      {unreadMsgCount > 9 ? '9+' : unreadMsgCount}
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    "text-[9px] leading-none font-medium mt-0.5 transition-all duration-200",
                    active ? "font-bold text-primary opacity-100" : "opacity-65"
                  )}
                >
                  {t(item.labelKey as any)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
});

AppNavBar.displayName = 'AppNavBar';

export default AppNavBar;
