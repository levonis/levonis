import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useShippingSettings } from '@/hooks/useShippingCalculator';

interface Props {
  /** Target currency to write back to the parent field. */
  targetCurrency: 'USD' | 'IQD';
  /** Called with the converted numeric value. */
  onConvert: (value: number) => void;
}

const CnyConvertButton = ({ targetCurrency, onConvert }: Props) => {
  const [open, setOpen] = useState(false);
  const [cny, setCny] = useState('');
  const { data: settings } = useShippingSettings();
  const cnyToUsd = settings?.cny_to_usd_rate || 6.7;
  const usdToIqd = settings?.usd_to_iqd_rate || 1410;

  const val = Number(cny);
  const usd = val > 0 ? val / cnyToUsd : 0;
  const preview = targetCurrency === 'USD' ? usd : usd * usdToIqd;

  const apply = () => {
    if (!(val > 0)) return;
    const rounded = targetCurrency === 'USD'
      ? Math.round(usd * 100) / 100
      : Math.round(usd * usdToIqd);
    onConvert(rounded);
    setCny('');
    setOpen(false);
  };

  return (
    <div className="space-y-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 px-2 text-[11px]"
        onClick={() => setOpen((v) => !v)}
      >
        ¥ {open ? 'إخفاء' : 'تحويل من يوان'}
      </Button>
      {open && (
        <div className="flex items-center gap-2 p-2 rounded-md bg-muted/40 border">
          <Input
            type="number"
            step="0.01"
            min="0"
            value={cny}
            onChange={(e) => setCny(e.target.value)}
            placeholder="¥ يوان"
            className="h-8 w-24"
          />
          <Button type="button" size="sm" className="h-8" disabled={!(val > 0)} onClick={apply}>
            تحويل
          </Button>
          {val > 0 && (
            <span className="text-xs text-muted-foreground">
              = {targetCurrency === 'USD' ? `${preview.toFixed(2)}$` : `${Math.round(preview).toLocaleString()} د.ع`}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default CnyConvertButton;
