// Banner style presets for VIP+ referral coupons
// Used in /my-referral (customization) and /cart (display)

export type ReferralBannerStyleKey =
  | "amber"
  | "rose"
  | "emerald"
  | "sky"
  | "violet"
  | "midnight";

export interface ReferralBannerStyle {
  key: ReferralBannerStyleKey;
  label: string;
  // Tailwind classes
  container: string;
  border: string;
  title: string;
  progressTrack: string;
  progressFill: string;
  highlight: string;
}

export const REFERRAL_BANNER_STYLES: Record<ReferralBannerStyleKey, ReferralBannerStyle> = {
  amber: {
    key: "amber",
    label: "ذهبي كلاسيكي",
    container: "bg-gradient-to-br from-amber-500/15 via-yellow-500/10 to-orange-500/15",
    border: "border-2 border-amber-500/40",
    title: "text-amber-700 dark:text-amber-400",
    progressTrack: "bg-amber-500/15",
    progressFill: "bg-gradient-to-r from-amber-500 to-orange-500",
    highlight: "text-amber-600",
  },
  rose: {
    key: "rose",
    label: "وردي حالم",
    container: "bg-gradient-to-br from-rose-500/15 via-pink-500/10 to-fuchsia-500/15",
    border: "border-2 border-rose-500/40",
    title: "text-rose-700 dark:text-rose-400",
    progressTrack: "bg-rose-500/15",
    progressFill: "bg-gradient-to-r from-rose-500 to-fuchsia-500",
    highlight: "text-rose-600",
  },
  emerald: {
    key: "emerald",
    label: "أخضر طبيعي",
    container: "bg-gradient-to-br from-emerald-500/15 via-green-500/10 to-teal-500/15",
    border: "border-2 border-emerald-500/40",
    title: "text-emerald-700 dark:text-emerald-400",
    progressTrack: "bg-emerald-500/15",
    progressFill: "bg-gradient-to-r from-emerald-500 to-teal-500",
    highlight: "text-emerald-600",
  },
  sky: {
    key: "sky",
    label: "أزرق سماوي",
    container: "bg-gradient-to-br from-sky-500/15 via-blue-500/10 to-indigo-500/15",
    border: "border-2 border-sky-500/40",
    title: "text-sky-700 dark:text-sky-400",
    progressTrack: "bg-sky-500/15",
    progressFill: "bg-gradient-to-r from-sky-500 to-indigo-500",
    highlight: "text-sky-600",
  },
  violet: {
    key: "violet",
    label: "بنفسجي ملكي",
    container: "bg-gradient-to-br from-violet-500/15 via-purple-500/10 to-fuchsia-500/15",
    border: "border-2 border-violet-500/40",
    title: "text-violet-700 dark:text-violet-400",
    progressTrack: "bg-violet-500/15",
    progressFill: "bg-gradient-to-r from-violet-500 to-fuchsia-500",
    highlight: "text-violet-600",
  },
  midnight: {
    key: "midnight",
    label: "ليلي فاخر",
    container: "bg-gradient-to-br from-slate-700/30 via-slate-800/20 to-slate-900/30",
    border: "border-2 border-slate-500/40",
    title: "text-slate-200",
    progressTrack: "bg-slate-500/20",
    progressFill: "bg-gradient-to-r from-slate-400 to-slate-200",
    highlight: "text-slate-200",
  },
};

export function getReferralBannerStyle(key?: string | null): ReferralBannerStyle {
  if (key && key in REFERRAL_BANNER_STYLES) {
    return REFERRAL_BANNER_STYLES[key as ReferralBannerStyleKey];
  }
  return REFERRAL_BANNER_STYLES.amber;
}
