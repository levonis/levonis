import { memo, useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, ShoppingCart, Users, Trophy, User, Gamepad2, MessageCircle, GripVertical } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { useCart } from '@/hooks/useCart';
import { useIsMobile } from '@/hooks/use-mobile';
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
  { key: 'messages', labelKey: 'menu_messages', icon: MessageCircle, path: '/community/messages' },
  { key: 'account', labelKey: 'menu_account_info', icon: User, path: '/profile' },
];

type DockPosition = 'right' | 'left' | 'top' | 'bottom';

const STORAGE_KEY = 'nav-dock-position';

const getStoredPosition = (): DockPosition => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && ['right', 'left', 'top', 'bottom'].includes(stored)) return stored as DockPosition;
  } catch {}
  return 'right';
};

const AppNavBar = memo(() => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const { itemCount } = useCart();
  const isMobile = useIsMobile();
  const [dockPosition, setDockPosition] = useState<DockPosition>(getStoredPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const dragStartRef = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  const hasDraggedRef = useRef(false);

  const isActive = (item: NavItem) => {
    if (item.path === '/') return location.pathname === '/' || location.pathname === '/home';
    return location.pathname.startsWith(item.path);
  };

  const handleClick = (item: NavItem) => {
    if (hasDraggedRef.current) return;
    navigate(item.path);
  };

  const snapToEdge = useCallback((x: number, y: number) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cx = x;
    const cy = y;

    // Distances to each edge
    const distRight = vw - cx;
    const distLeft = cx;
    const distTop = cy;
    const distBottom = vh - cy;

    const min = Math.min(distRight, distLeft, distTop, distBottom);

    let newPos: DockPosition = 'right';
    if (min === distLeft) newPos = 'left';
    else if (min === distTop) newPos = 'top';
    else if (min === distBottom) newPos = 'bottom';
    else newPos = 'right';

    setDockPosition(newPos);
    localStorage.setItem(STORAGE_KEY, newPos);
    setDragPos(null);
    setIsDragging(false);
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (isMobile) return;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const rect = navRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragStartRef.current = { x: e.clientX, y: e.clientY, startX: rect.left + rect.width / 2, startY: rect.top + rect.height / 2 };
    hasDraggedRef.current = false;
  }, [isMobile]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    if (!isDragging && Math.abs(dx) + Math.abs(dy) < 8) return;
    hasDraggedRef.current = true;
    setIsDragging(true);
    setDragPos({
      x: dragStartRef.current.startX + dx,
      y: dragStartRef.current.startY + dy,
    });
  }, [isDragging]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragStartRef.current) return;
    if (isDragging && dragPos) {
      snapToEdge(dragPos.x, dragPos.y);
    }
    dragStartRef.current = null;
    setTimeout(() => { hasDraggedRef.current = false; }, 50);
  }, [isDragging, dragPos, snapToEdge]);

  const isHorizontal = dockPosition === 'top' || dockPosition === 'bottom';

  if (!isMobile) {
    const dockStyles: React.CSSProperties = isDragging && dragPos
      ? {
          position: 'fixed',
          left: dragPos.x,
          top: dragPos.y,
          transform: 'translate(-50%, -50%)',
          zIndex: 9999,
          opacity: 0.85,
          transition: 'none',
        }
      : dockPosition === 'right'
        ? { position: 'fixed', top: '50%', right: 12, transform: 'translateY(-50%)' }
        : dockPosition === 'left'
          ? { position: 'fixed', top: '50%', left: 12, transform: 'translateY(-50%)' }
          : dockPosition === 'top'
            ? { position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)' }
            : { position: 'fixed', bottom: 12, left: '50%', transform: 'translateX(-50%)' };

    return (
      <nav
        ref={navRef}
        className={cn(
          "z-50 flex items-center gap-1.5 p-2 rounded-2xl bg-card/90 border border-border/50 shadow-xl select-none",
          isHorizontal && !isDragging ? "flex-row" : !isDragging ? "flex-col" : (isHorizontal ? "flex-row" : "flex-col"),
          isDragging && "cursor-grabbing shadow-2xl ring-2 ring-primary/30"
        )}
        style={dockStyles}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Drag handle */}
        <div className={cn(
          "flex items-center justify-center text-muted-foreground/50 cursor-grab active:cursor-grabbing",
          isHorizontal && !isDragging ? "h-full px-0.5" : "w-full py-0.5"
        )}>
          <GripVertical className={cn("h-4 w-4", isHorizontal && !isDragging && "rotate-90")} />
        </div>

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
              {/* Tooltip - adjust based on position */}
              <span className={cn(
                "absolute px-2.5 py-1 rounded-lg bg-foreground text-background text-xs font-medium whitespace-nowrap opacity-0 pointer-events-none scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 z-[60]",
                dockPosition === 'right' && "right-full mr-2",
                dockPosition === 'left' && "left-full ml-2",
                dockPosition === 'top' && "top-full mt-2",
                dockPosition === 'bottom' && "bottom-full mb-2",
              )}>
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
