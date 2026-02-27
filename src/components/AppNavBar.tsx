import { memo, useState, lazy, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, ShoppingCart, Users, Trophy, User } from 'lucide-react';
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
}

const NAV_ITEMS: NavItem[] = [
  { key: 'home', labelKey: 'nav_home', icon: Home, path: '/' },
  { key: 'cart', labelKey: 'menu_cart', icon: ShoppingCart, path: '/cart' },
  { key: 'community', labelKey: 'nav_community', icon: Users, path: '/community' },
  { key: 'rewards', labelKey: 'menu_rewards', icon: Trophy, path: '/rewards' },
  { key: 'account', labelKey: 'menu_account_info', icon: User, path: '/profile' },
];

const AppNavBar = memo(() => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const { itemCount } = useCart();
  const isMobile = useIsMobile();

  const isActive = (item: NavItem) => {
    if (item.path === '/') return location.pathname === '/' || location.pathname === '/home';
    return location.pathname.startsWith(item.path);
  };

  const handleClick = (item: NavItem) => {
    navigate(item.path);
  };

  if (!isMobile) {
    // Desktop: compact right sidebar
    return (
      <nav className="fixed top-1/2 -translate-y-1/2 right-0 z-50 flex flex-col items-center gap-1.5 p-2 m-3 rounded-2xl bg-card/90 border border-border/50 shadow-xl">
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
              <span className="absolute right-full mr-2 px-2.5 py-1 rounded-lg bg-foreground text-background text-xs font-medium whitespace-nowrap opacity-0 pointer-events-none scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150">
                {t(item.labelKey as any)}
              </span>
            </button>
          );
        })}
      </nav>
    );
  }

  // Mobile: redesigned bottom bar with pill active indicator
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
              {/* Pill floating indicator */}
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
              </span>
              <span
                className={cn(
                  "text-[10px] leading-none font-medium transition-all duration-200",
                  active ? "font-bold text-primary opacity-100" : "opacity-70"
                )}
              >
                {t(item.labelKey as any)}
              </span>
              {/* Active dot */}
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
