import { useState, useRef, type MouseEvent } from "react";
import type { OriginRect } from "./OriginExpandShell";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Coins, Ticket, Wallet, TrendingUp, ChevronLeft, Shield, LayoutDashboard } from "lucide-react";
import AvatarWithFrame from "@/components/merchant/AvatarWithFrame";
import type { FrameAnimationType } from "@/components/merchant/AvatarWithFrame";
import LevelBadge from "@/components/LevelBadge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { ADMIN_ROUTES } from "@/config/adminConfig";
import WalletDialog from "@/components/WalletDialog";
import SavingsPopup from "./SavingsPopup";
import CouponsPopup from "./CouponsPopup";
import { useLanguage } from "@/lib/i18n";

interface ProfileHeaderProps {
  userId: string;
  profile: {
    full_name?: string | null;
    username?: string | null;
    avatar_url?: string | null;
  } | null;
  cardFrame: {
    frame_url?: string | null;
    frame_animation?: string | null;
    card_color?: string | null;
  } | null;
}

export default function ProfileHeader({ userId, profile, cardFrame }: ProfileHeaderProps) {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { t, language } = useLanguage();
  const [walletOpen, setWalletOpen] = useState(false);
  const [savingsOpen, setSavingsOpen] = useState(false);
  const [couponsOpen, setCouponsOpen] = useState(false);
  const [walletOrigin, setWalletOrigin] = useState<OriginRect | null>(null);
  const [savingsOrigin, setSavingsOrigin] = useState<OriginRect | null>(null);
  const [couponsOrigin, setCouponsOrigin] = useState<OriginRect | null>(null);

  const captureOrigin = (e: MouseEvent<HTMLButtonElement>): OriginRect => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height };
  };


  // Detect active card → drives both VIP+ CTA and the card background color
  const { data: activeCard } = useQuery({
    queryKey: ["profile-header-active-card", userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_cards")
        .select("card_id, membership_cards:card_id(level_key, name_ar, color, min_points, is_vip_plus)")
        .eq("user_id", userId)
        .eq("is_active", true)
        .maybeSingle();
      return data;
    },
  });
  const vipPlusActive = !!(activeCard?.membership_cards as any)?.is_vip_plus;
  const cardLevelData = (activeCard?.membership_cards as any) || null;

  const { data: userPoints, isLoading: pointsLoading } = useQuery({
    queryKey: ["profile-user-points", userId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_points")
        .select("total_points, available_points, level")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: wallet, isLoading: walletLoading } = useQuery({
    queryKey: ["profile-wallet", userId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_wallets")
        .select("balance, currency")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: couponsCount, isLoading: couponsLoading } = useQuery({
    queryKey: ["profile-coupons-count", userId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("user_coupons")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_used", false)
        .gte("expires_at", new Date().toISOString());
      if (error) throw error;
      return count ?? 0;
    },
  });

  // Calculate real savings from orders
  const { data: totalSavings, isLoading: savingsLoading } = useQuery({
    queryKey: ["profile-total-savings", userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: orders, error } = await supabase
        .from("orders")
        .select(`
          discount_amount,
          order_items!order_items_order_id_fkey(
            unit_price, quantity,
            products!order_items_product_id_fkey(price, original_price)
          )
        `)
        .eq("user_id", userId)
        .in("status", ["delivered", "confirmed", "processing", "shipped", "arrived_warehouse", "arrived_iraq", "on_the_way", "purchased"]);

      if (error) throw error;

      let savings = 0;
      orders?.forEach((order) => {
        // Product discount savings
        order.order_items?.forEach((item: any) => {
          const product = item.products;
          if (product?.original_price && product.original_price > item.unit_price) {
            savings += (product.original_price - item.unit_price) * item.quantity;
          }
        });
        // Coupon savings
        savings += Number(order.discount_amount) || 0;
      });

      return savings;
    },
  });

  const { data: loyaltyLevels } = useQuery({
    queryKey: ["all-loyalty-levels"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loyalty_levels")
        .select("level_key, name_ar, min_points, color")
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Calculate progress to next tier
  const currentPoints = userPoints?.total_points ?? 0;
  const currentLevel = userPoints?.level ?? "bronze";
  const currentLevelIndex = loyaltyLevels?.findIndex(l => l.level_key === currentLevel) ?? 0;
  const nextLevel = loyaltyLevels?.[currentLevelIndex + 1];
  const currentLevelData = loyaltyLevels?.[currentLevelIndex];
  const currentMin = currentLevelData?.min_points ?? 0;
  const nextMin = nextLevel?.min_points ?? currentMin;
  const progressPercent = nextLevel
    ? Math.min(100, Math.round(((currentPoints - currentMin) / (nextMin - currentMin)) * 100))
    : 100;

  // Active purchased card overrides the points-based level color
  const levelColor = cardLevelData?.color ?? currentLevelData?.color ?? "hsl(var(--primary))";

  const stats = [
    {
      icon: Coins,
      label: t('ph_label_points'),
      value: userPoints?.available_points ?? 0,
      loading: pointsLoading,
      onClick: (_e: MouseEvent<HTMLButtonElement>) => navigate("/rewards?tab=points&sub=summary"),
    },
    {
      icon: Ticket,
      label: t('ph_label_coupons'),
      value: couponsCount ?? 0,
      loading: couponsLoading,
      onClick: (e: MouseEvent<HTMLButtonElement>) => {
        setCouponsOrigin(captureOrigin(e));
        setCouponsOpen(true);
      },
    },
    {
      icon: Wallet,
      label: t('ph_label_wallet'),
      value: wallet?.balance ?? 0,
      loading: walletLoading,
      suffix: t('ph_currency_iqd'),
      onClick: (e: MouseEvent<HTMLButtonElement>) => {
        setWalletOrigin(captureOrigin(e));
        setWalletOpen(true);
      },
    },
    {
      icon: TrendingUp,
      label: t('ph_label_savings'),
      value: totalSavings ?? 0,
      loading: savingsLoading,
      suffix: t('ph_currency_iqd'),
      onClick: (e: MouseEvent<HTMLButtonElement>) => {
        setSavingsOrigin(captureOrigin(e));
        setSavingsOpen(true);
      },
    },
  ];

  return (
    <>
      <div
        className="glass-card relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${levelColor}99, ${levelColor}55, ${levelColor}22)`,
        }}
      >
        {/* Glassmorphism overlay */}
        <div className="relative p-5 backdrop-blur-xl">
          {/* Admin quick access */}
          {isAdmin && (
            <button
              onClick={() => navigate(ADMIN_ROUTES.dashboard)}
              className="absolute top-3 left-3 flex items-center gap-1.5 rounded-xl bg-white/20 backdrop-blur-md border border-white/25 px-3 py-1.5 text-[11px] font-semibold text-white transition-all duration-200 active:scale-[0.95] hover:bg-white/30 z-10"
            >
              <Shield className="h-3.5 w-3.5" />
              <span>{t('profile_admin_panel')}</span>
            </button>
          )}

          {/* Top row: Avatar + Info */}
          <div className="flex items-center gap-4">
            <AvatarWithFrame
              imageUrl={profile?.avatar_url}
              frameUrl={cardFrame?.frame_url}
              size="lg"
              animated={!!cardFrame?.frame_url}
              animationType={cardFrame?.frame_animation as FrameAnimationType}
              badgeColor={cardFrame?.card_color}
              isUser
            />

            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-white truncate">
                {profile?.full_name || profile?.username || t('ph_user_default')}
              </h1>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-sm text-white/70 truncate">@{profile?.username || "—"}</span>
                <LevelBadge userId={userId} size="sm" />
              </div>

              {/* Progress to next tier */}
              {nextLevel && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px] text-white/80 mb-1.5">
                    <span>{currentLevelData?.name_ar}</span>
                    <span>{nextLevel.name_ar}</span>
                  </div>
                  <Progress
                    value={progressPercent}
                    className="h-2 bg-white/20 [&>div]:bg-white"
                  />
                  <div className="mt-1 text-[10px] text-white/60 text-center">
                    {nextMin - currentPoints > 0
                      ? t('profile_points_to_next', { points: nextMin - currentPoints })
                      : t('profile_level_complete')}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Stats Row */}
          <div className="mt-4 grid grid-cols-4 gap-2">
            {stats.map((s) => (
              <button
                key={s.label}
                onClick={s.onClick}
                className="glass-card-inner flex flex-col items-center gap-1 rounded-2xl px-2 py-3 transition-all duration-200 active:scale-[0.95]"
              >
                <s.icon className="h-4 w-4 text-white/90" />
                {s.loading ? (
                  <Skeleton className="h-4 w-8 bg-white/20" />
                ) : (
                  <span className="text-sm font-bold text-white tabular-nums">
                    {typeof s.value === "number" ? s.value.toLocaleString(language === 'en' ? 'en-US' : language === 'ku' ? 'ckb-IQ' : 'ar-IQ') : s.value}
                  </span>
                )}
                <span className="text-[10px] text-white/70">{s.label}</span>
              </button>
            ))}
          </div>

          {/* CTA */}
          <button
            onClick={() => navigate(vipPlusActive ? "/my-referral" : "/rewards?tab=cards")}
            className="glass-card-inner mt-4 w-full flex items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-semibold text-white transition-all duration-200 active:scale-[0.97]"
          >
            <span>{vipPlusActive ? t('profile_manage_referral') : t('profile_upgrade_membership')}</span>
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>

        {/* Decorative circles */}
        <div
          className="absolute -top-10 -left-10 h-32 w-32 rounded-full opacity-20"
          style={{ background: `radial-gradient(circle, white 0%, transparent 70%)` }}
        />
        <div
          className="absolute -bottom-8 -right-8 h-24 w-24 rounded-full opacity-15"
          style={{ background: `radial-gradient(circle, white 0%, transparent 70%)` }}
        />
      </div>

      {/* Popups */}
      <WalletDialog
        open={walletOpen}
        onOpenChange={setWalletOpen}
        originRect={walletOrigin}
      />
      <SavingsPopup
        open={savingsOpen}
        onOpenChange={setSavingsOpen}
        userId={userId}
        originRect={savingsOrigin}
      />
      <CouponsPopup
        open={couponsOpen}
        onOpenChange={setCouponsOpen}
        originRect={couponsOrigin}
      />
    </>
  );
}
