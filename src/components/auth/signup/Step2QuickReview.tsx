import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import { SignupStepProps } from './types';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n';

interface Props extends SignupStepProps {
  onSubmit: () => void;
  submitting: boolean;
}

export default function Step2QuickReview({ data, onBack, onSubmit, loading, submitting }: Props) {
  const { t, isRtl } = useLanguage();

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-500/10 mb-3">
          <CheckCircle2 className="w-7 h-7 text-green-500" />
        </div>
        <h2 className="text-2xl font-bold">{t('signup_s5_title')}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t('signup_s5_subtitle')}</p>
      </div>

      <div className="flex items-center gap-4 p-4 rounded-2xl bg-muted/40">
        <img src={data.avatarUrl} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-primary/30" />
        <div className="flex-1 min-w-0">
          <p className="font-bold truncate">{data.fullName}</p>
          <p className="text-sm text-muted-foreground truncate" dir="ltr">@{data.username}</p>
          <p className="text-xs text-muted-foreground truncate mt-0.5" dir="ltr">{data.email}</p>
        </div>
      </div>

      <Button onClick={onSubmit} disabled={loading || submitting}
        className="w-full h-12 bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold text-base">
        {submitting ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <>
            <CheckCircle2 className={cn("w-5 h-5", isRtl ? "ml-2" : "mr-2")} />
            {t('signup_create_account')}
          </>
        )}
      </Button>

      <Button type="button" variant="ghost" onClick={onBack} disabled={loading || submitting} className="w-full">
        <ArrowRight className={cn("w-4 h-4", isRtl ? "ml-2" : "mr-2 rotate-180")} />
        {t('signup_edit')}
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        {t('signup_terms_prefix')}{' '}
        <a href="/terms" className="text-primary hover:underline">{t('signup_terms_link')}</a>
        {' '}{t('signup_and')}{' '}
        <a href="/privacy" className="text-primary hover:underline">{t('signup_privacy_link')}</a>
      </p>
    </div>
  );
}
