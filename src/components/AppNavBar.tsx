import { memo, useState, lazy, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, ShoppingCart, Users, MessageCircle, Gamepad2, Trophy, User } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

const ListingConversations = lazy(() =>
  import('@/components/marketplace/ListingConversations').then(m => ({ default: m.ListingConversations }))
);

interface NavItem {
  key: string;
  labelKey: string;
  icon: typeof Home;
  path: string;
  action?: 'chat';
}

const NAV_ITEMS: NavItem[] = [
  { key: 'home', labelKey: 'nav_home', icon: Home, path: '/' },
  { key: 'cart', labelKey: 'menu_cart', icon: ShoppingCart, path: '/cart' },
  { key: 'community', labelKey: 'nav_community', icon: Users, path: '/community' },
  { key: 'chat', labelKey: 'menu_messages', icon: MessageCircle, path: '', action: 'chat' },
  { key: 'games', labelKey: 'nav_games', icon: Gamepad2, path: '/games' },
  { key: 'rewards', labelKey: 'menu_rewards', icon: Trophy, path: '/rewards' },
  { key: 'account', labelKey: 'menu_account_info', icon: User, path: '/profile' },
];

const AppNavBar = memo(() => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const { itemCount } = useCart();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [chatOpen, setChatOpen] = useState(false);

  const isActive = (item: NavItem) => {
    if (item.action) return false;
    if (item.path === '/') return location.pathname === '/' || location.pathname === '/home';
    return location.pathname.startsWith(item.path);
  };

  const handleClick = (item: NavItem) => {
    if (item.action === 'chat') {
      if (!user) {
        navigate('/auth');
        return;
      }
      setChatOpen(true);
      return;
    }
    navigate(item.path);
  };

  const renderNavItem = (item: NavItem, vertical = false) => {
    const Icon = item.icon;
    const active = isActive(item);

    if (vertical) {
      return (
        <button
          key={item.key}
          onClick={() => handleClick(item)}
          title={t(item.labelKey as any)}
          className={cn(
            "group relative flex items-center justify-center w-11 h-11 rounded-xl transition-all duration-200",
            active
              ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
          {item.key === 'cart' && itemCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
              {itemCount > 9 ? '9+' : itemCount}
            </span>
          )}
          {/* Tooltip */}
          <span className="absolute right-full mr-2 px-2.5 py-1 rounded-lg bg-foreground text-background text-xs font-medium whitespace-nowrap opacity-0 pointer-events-none scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150">
            {t(item.labelKey as any)}
          </span>
          {active && (
            <span className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-4 rounded-full bg-primary-foreground/60" />
          )}
        </button>
      );
    }

    // Mobile horizontal
    return (
      <button
        key={item.key}
        onClick={() => handleClick(item)}
        className={cn(
          "relative flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl min-w-[2.8rem] transition-all duration-200",
          active
            ? "text-primary"
            : "text-muted-foreground active:text-foreground"
        )}
      >
        {active && (
          <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-5 h-1 rounded-full bg-primary" />
        )}
        <span className={cn(
          "relative flex items-center justify-center w-7 h-7 rounded-xl transition-all duration-200",
          active && "bg-primary/10 scale-110"
        )}>
          <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.5 : 2} />
          {item.key === 'cart' && itemCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
              {itemCount > 9 ? '9+' : itemCount}
            </span>
          )}
        </span>
        <span className={cn(
          "text-[9px] leading-none font-medium transition-all duration-200",
          active && "font-bold text-primary"
        )}>
          {t(item.labelKey as any)}
        </span>
      </button>
    );
  };

  return (
    <>
      {/* Mobile: bottom bar */}
      {isMobile ? (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-t border-border/50 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <div className="flex items-center justify-around px-1 py-1">
            {NAV_ITEMS.map((item) => renderNavItem(item, false))}
          </div>
        </nav>
      ) : (
        /* Desktop/Tablet: right vertical bar */
        <nav className="fixed top-1/2 -translate-y-1/2 right-0 z-50 flex flex-col items-center gap-1 p-2 m-3 rounded-2xl bg-background/90 backdrop-blur-xl border border-border/50 shadow-xl">
          {NAV_ITEMS.map((item) => renderNavItem(item, true))}
        </nav>
      )}

      {/* Chat overlay using ListingConversations */}
      {chatOpen && (
        <Suspense fallback={null}>
          <ListingConversations
            externalOpen={chatOpen}
            onExternalOpenChange={setChatOpen}
            onClose={() => setChatOpen(false)}
          >
            <span className="sr-only">{t('menu_messages')}</span>
          </ListingConversations>
        </Suspense>
      )}
    </>
  );
});

AppNavBar.displayName = 'AppNavBar';

export default AppNavBar;
