import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Send, ArrowLeft, Settings, BellRing, Bell } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/i18n';
import { motion } from 'framer-motion';

const GlassCard = ({ children, className = '', glow = false, ...props }: any) => (
  <div
    className={`relative rounded-2xl border border-border/30 bg-card/40 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] ${glow ? 'shadow-[0_8px_32px_rgba(199,180,108,0.15)]' : ''} ${className}`}
    {...props}
  >
    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent rounded-t-2xl" />
    {children}
  </div>
);

interface NotificationPrefs {
  orders: boolean;
  wallet: boolean;
  community: boolean;
  promotions: boolean;
  competitions: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  orders: true,
  wallet: true,
  community: true,
  promotions: true,
  competitions: true,
};

const NOTIF_CATEGORIES: { key: keyof NotificationPrefs; label: string; desc: string }[] = [
  { key: 'orders', label: 'الطلبات', desc: 'تحديثات حالة الطلبات والشحن' },
  { key: 'wallet', label: 'المحفظة', desc: 'الإيداعات والسحوبات وتغييرات الرصيد' },
  { key: 'community', label: 'المجتمع', desc: 'إشعارات المجتمع والطلبات المخصصة' },
  { key: 'promotions', label: 'العروض', desc: 'عروض وخصومات حصرية' },
  { key: 'competitions', label: 'المسابقات', desc: 'إشعارات المسابقات والجوائز' },
];

const NotificationSettings = () => {
  const { t } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [telegramChatId, setTelegramChatId] = useState('');
  const [savingTelegram, setSavingTelegram] = useState(false);
  const [sitePrefs, setSitePrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [telegramPrefs, setTelegramPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile-notifications', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('telegram_chat_id, telegram_notifications, site_notifications')
        .eq('id', user?.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (profile) {
      if (profile.telegram_chat_id) setTelegramChatId(profile.telegram_chat_id);
      if (profile.site_notifications) {
        setSitePrefs({ ...DEFAULT_PREFS, ...(profile.site_notifications as unknown as NotificationPrefs) });
      }
      if (profile.telegram_notifications) {
        setTelegramPrefs({ ...DEFAULT_PREFS, ...(profile.telegram_notifications as unknown as NotificationPrefs) });
      }
    }
  }, [profile]);

  const updatePrefs = useCallback(async (column: 'site_notifications' | 'telegram_notifications', prefs: NotificationPrefs) => {
    if (!user?.id) return;
    const { error } = await supabase
      .from('profiles')
      .update({ [column]: prefs as any })
      .eq('id', user.id);
    if (error) {
      toast.error('حدث خطأ في حفظ الإعدادات');
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['profile-notifications'] });
    toast.success('تم تحديث الإعدادات');
  }, [user?.id, queryClient]);

  const toggleSitePref = (key: keyof NotificationPrefs) => {
    const updated = { ...sitePrefs, [key]: !sitePrefs[key] };
    setSitePrefs(updated);
    updatePrefs('site_notifications', updated);
  };

  const toggleTelegramPref = (key: keyof NotificationPrefs) => {
    const updated = { ...telegramPrefs, [key]: !telegramPrefs[key] };
    setTelegramPrefs(updated);
    updatePrefs('telegram_notifications', updated);
  };

  const saveTelegramChatId = async () => {
    if (!user?.id) return;
    setSavingTelegram(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ telegram_chat_id: telegramChatId || null })
        .eq('id', user.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['profile-notifications'] });
      toast.success(telegramChatId ? t('notif_telegram_saved') : t('notif_telegram_removed'));
    } catch {
      toast.error(t('notif_telegram_save_error'));
    } finally {
      setSavingTelegram(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background pt-6 flex items-center justify-center">
        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/30 to-accent/20 backdrop-blur-xl flex items-center justify-center border border-primary/20 shadow-lg shadow-primary/10">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const NotifCheckboxList = ({ prefs, onToggle }: { prefs: NotificationPrefs; onToggle: (key: keyof NotificationPrefs) => void }) => (
    <div className="space-y-2 mt-3">
      {NOTIF_CATEGORIES.map(({ key, label, desc }) => (
        <label
          key={key}
          className="flex items-center gap-3 rounded-xl bg-background/40 border border-border/20 p-3 cursor-pointer hover:bg-background/60 transition-colors"
        >
          <Checkbox
            checked={prefs[key]}
            onCheckedChange={() => onToggle(key)}
            className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground">{label}</p>
            <p className="text-xs text-muted-foreground">{desc}</p>
          </div>
        </label>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-background pt-6 pb-24" dir="rtl">
      {/* Hero Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/8 via-primary/3 to-transparent" />
        <div className="absolute top-6 right-12 h-32 w-32 rounded-full bg-primary/5 blur-3xl" />

        <div className="relative container mx-auto px-4 py-6 max-w-2xl">
          <button
            onClick={() => navigate(-1)}
            className="mb-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            رجوع
          </button>

          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/25 to-accent/15 backdrop-blur-xl flex items-center justify-center border border-primary/30 shadow-lg shadow-primary/10">
                <Settings className="h-7 w-7 text-primary" />
              </div>
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-foreground">إعدادات الإشعارات</h1>
              <p className="text-sm text-muted-foreground mt-0.5">تحكم بطريقة وصول الإشعارات</p>
            </div>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 max-w-2xl space-y-4 mt-4">
        {/* Quick link to inbox */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          <button onClick={() => navigate('/notifications')} className="w-full">
            <GlassCard className="p-4 flex items-center justify-between hover:border-primary/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/25 to-accent/15 flex items-center justify-center border border-primary/20">
                  <BellRing className="h-5 w-5 text-primary" />
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-foreground">صندوق الإشعارات</p>
                  <p className="text-xs text-muted-foreground">عرض جميع الإشعارات الواردة</p>
                </div>
              </div>
              <ArrowLeft className="h-4 w-4 text-muted-foreground" />
            </GlassCard>
          </button>
        </motion.div>

        {/* Site Notifications */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}>
          <GlassCard className="p-5">
            <div className="flex items-center gap-3 mb-1">
              <div className="relative h-10 w-10 rounded-xl bg-gradient-to-br from-primary/25 to-primary/10 backdrop-blur-sm flex items-center justify-center border border-primary/20 shadow-lg shadow-primary/10">
                <Bell className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-black text-foreground">إشعارات الموقع</h3>
                <p className="text-xs text-muted-foreground">اختر أنواع الإشعارات التي تريد استقبالها</p>
              </div>
            </div>
            <NotifCheckboxList prefs={sitePrefs} onToggle={toggleSitePref} />
          </GlassCard>
        </motion.div>

        {/* Telegram Link */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.1 }}>
          <button onClick={() => navigate('/telegram-settings')} className="w-full">
            <GlassCard glow className="p-4 flex items-center justify-between hover:border-[#0088cc]/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className="relative h-10 w-10 rounded-xl bg-gradient-to-br from-[#0088cc]/30 to-[#0088cc]/10 backdrop-blur-sm flex items-center justify-center border border-[#0088cc]/20 shadow-lg shadow-[#0088cc]/10">
                  <Send className="h-5 w-5 text-[#0088cc]" />
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-foreground">ربط حساب تليجرام</p>
                  <p className="text-xs text-muted-foreground">إعداد وإدارة إشعارات تليجرام</p>
                </div>
              </div>
              <ArrowLeft className="h-4 w-4 text-muted-foreground" />
            </GlassCard>
          </button>
        </motion.div>
      </main>
    </div>
  );
};

export default NotificationSettings;
