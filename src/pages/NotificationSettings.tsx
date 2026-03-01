import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle, Send, ArrowLeft, Settings, BellRing, Bell } from 'lucide-react';
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

const NotificationSettings = () => {
  const { t } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [telegramChatId, setTelegramChatId] = useState('');
  const [savingTelegram, setSavingTelegram] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile-telegram', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('telegram_chat_id')
        .eq('id', user?.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (profile?.telegram_chat_id) setTelegramChatId(profile.telegram_chat_id);
  }, [profile]);

  const saveTelegramChatId = async () => {
    if (!user?.id) return;
    setSavingTelegram(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ telegram_chat_id: telegramChatId || null })
        .eq('id', user.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['profile-telegram'] });
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
          <button
            onClick={() => navigate('/notifications')}
            className="w-full"
          >
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
            <div className="flex items-center gap-3 mb-3">
              <div className="relative h-10 w-10 rounded-xl bg-gradient-to-br from-primary/25 to-primary/10 backdrop-blur-sm flex items-center justify-center border border-primary/20 shadow-lg shadow-primary/10">
                <Bell className="h-5 w-5 text-primary" />
                <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
              </div>
              <div>
                <h3 className="text-sm font-black text-foreground">إشعارات الموقع</h3>
                <p className="text-xs text-muted-foreground">تصلك إشعارات داخل الموقع تلقائياً</p>
              </div>
            </div>
            <div className="rounded-xl bg-background/40 border border-border/20 p-4">
              <p className="text-xs text-muted-foreground leading-relaxed flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                إشعارات الموقع مفعّلة تلقائياً. ستصلك إشعارات حول طلباتك، المكافآت، والعروض.
              </p>
            </div>
          </GlassCard>
        </motion.div>

        {/* Telegram Card */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.1 }}>
          <GlassCard glow className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative h-10 w-10 rounded-xl bg-gradient-to-br from-[#0088cc]/30 to-[#0088cc]/10 backdrop-blur-sm flex items-center justify-center border border-[#0088cc]/20 shadow-lg shadow-[#0088cc]/10">
                <Send className="h-5 w-5 text-[#0088cc]" />
                <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
              </div>
              <div>
                <h3 className="text-sm font-black text-foreground">{t('notif_telegram_title')}</h3>
                <p className="text-xs text-muted-foreground">{t('notif_telegram_desc')}</p>
              </div>
            </div>

            <div className="rounded-xl bg-background/40 border border-border/20 p-4 mb-4 space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t('notif_telegram_get_id')}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 rounded-xl border-[#0088cc]/30 hover:bg-[#0088cc]/10 text-foreground font-bold"
                asChild
              >
                <a href="https://t.me/Updatelevobot?start=getid" target="_blank" rel="noopener noreferrer">
                  <Send className="h-4 w-4 text-[#0088cc]" />
                  {t('notif_telegram_open_bot')}
                </a>
              </Button>
              <p className="text-[11px] text-muted-foreground text-center">{t('notif_telegram_paste')}</p>
            </div>

            <div className="flex gap-2 items-end">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="telegram_chat_id" className="text-xs font-bold">{t('notif_telegram_id_label')}</Label>
                <Input
                  id="telegram_chat_id"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  placeholder="123456789"
                  dir="ltr"
                  className="font-mono rounded-xl bg-background/50 border-border/30 h-10"
                />
              </div>
              <Button
                onClick={saveTelegramChatId}
                disabled={savingTelegram}
                size="sm"
                className="rounded-xl h-10 px-5 font-bold"
              >
                {savingTelegram && <Loader2 className="ml-1.5 h-3.5 w-3.5 animate-spin" />}
                {profile?.telegram_chat_id ? t('common_update') : t('common_save')}
              </Button>
            </div>
            {profile?.telegram_chat_id && (
              <p className="text-xs text-emerald-400 flex items-center gap-1.5 mt-2 font-bold">
                <CheckCircle className="h-3.5 w-3.5" />
                {t('notif_telegram_active')}
              </p>
            )}
          </GlassCard>
        </motion.div>
      </main>
    </div>
  );
};

export default NotificationSettings;
