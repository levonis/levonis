import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useLanguage } from '@/lib/i18n';
import { ShieldCheck, AlertCircle } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customText?: string | null;
}

const InsuranceInfoDialog = ({ open, onOpenChange, customText }: Props) => {
  const { t } = useLanguage();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            {t('insurance_info_title')}
          </DialogTitle>
          <DialogDescription className="text-sm text-foreground/80 leading-relaxed pt-2">
            {customText || t('insurance_info_what')}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-foreground/80 flex gap-2">
          <AlertCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <span>{t('insurance_info_conditions')}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InsuranceInfoDialog;
