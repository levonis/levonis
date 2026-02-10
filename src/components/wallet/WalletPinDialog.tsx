import { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock, Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface WalletPinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: () => void;
  mode?: 'verify' | 'set';
}

export default function WalletPinDialog({ open, onOpenChange, onVerified, mode = 'verify' }: WalletPinDialogProps) {
  const [pin, setPin] = useState(['', '', '', '']);
  const [confirmPin, setConfirmPin] = useState(['', '', '', '']);
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const confirmRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (open) {
      setPin(['', '', '', '']);
      setConfirmPin(['', '', '', '']);
      setStep('enter');
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [open]);

  const handlePinChange = (index: number, value: string, isConfirm = false) => {
    if (!/^\d?$/.test(value)) return;
    
    const setter = isConfirm ? setConfirmPin : setPin;
    const refs = isConfirm ? confirmRefs : inputRefs;
    
    setter(prev => {
      const newPin = [...prev];
      newPin[index] = value;
      return newPin;
    });
    
    if (value && index < 3) {
      refs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent, isConfirm = false) => {
    const refs = isConfirm ? confirmRefs : inputRefs;
    const currentPin = isConfirm ? confirmPin : pin;
    
    if (e.key === 'Backspace' && !currentPin[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const pinCode = pin.join('');
    if (pinCode.length !== 4) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('verify_wallet_pin', { pin_code: pinCode });
      if (error) throw error;
      
      if (data) {
        onVerified();
        onOpenChange(false);
      } else {
        toast.error('رمز PIN غير صحيح');
        setPin(['', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch (error: any) {
      toast.error('حدث خطأ في التحقق');
    } finally {
      setLoading(false);
    }
  };

  const handleSetPin = async () => {
    const pinCode = pin.join('');
    const confirmCode = confirmPin.join('');
    
    if (step === 'enter') {
      if (pinCode.length !== 4) return;
      setStep('confirm');
      setTimeout(() => confirmRefs.current[0]?.focus(), 100);
      return;
    }

    if (confirmCode.length !== 4) return;
    
    if (pinCode !== confirmCode) {
      toast.error('رمز PIN غير متطابق');
      setConfirmPin(['', '', '', '']);
      confirmRefs.current[0]?.focus();
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.rpc('set_wallet_pin', { pin_code: pinCode });
      if (error) throw error;
      
      toast.success('تم تعيين رمز PIN بنجاح');
      onVerified();
      onOpenChange(false);
    } catch (error: any) {
      toast.error('حدث خطأ في تعيين رمز PIN');
    } finally {
      setLoading(false);
    }
  };

  const renderPinInputs = (values: string[], refs: React.MutableRefObject<(HTMLInputElement | null)[]>, isConfirm = false) => (
    <div className="flex gap-3 justify-center" dir="ltr">
      {values.map((digit, i) => (
        <Input
          key={i}
          ref={el => { refs.current[i] = el; }}
          type="password"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={e => handlePinChange(i, e.target.value, isConfirm)}
          onKeyDown={e => handleKeyDown(i, e, isConfirm)}
          className="w-12 h-14 text-center text-xl font-bold rounded-xl"
          autoComplete="off"
        />
      ))}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" dir="rtl">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            {mode === 'set' ? (
              <ShieldCheck className="h-6 w-6 text-primary" />
            ) : (
              <Lock className="h-6 w-6 text-primary" />
            )}
          </div>
          <DialogTitle>
            {mode === 'set' 
              ? (step === 'confirm' ? 'تأكيد رمز PIN' : 'تعيين رمز PIN') 
              : 'أدخل رمز PIN'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'set'
              ? (step === 'confirm' ? 'أعد إدخال الرمز للتأكيد' : 'اختر رمز PIN مكون من 4 أرقام لحماية محفظتك')
              : 'أدخل رمز PIN الخاص بك للمتابعة'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {mode === 'set' && step === 'confirm' 
            ? renderPinInputs(confirmPin, confirmRefs, true)
            : renderPinInputs(pin, inputRefs)
          }
        </div>

        <Button
          className="w-full"
          onClick={mode === 'set' ? handleSetPin : handleVerify}
          disabled={loading || (mode === 'set' && step === 'confirm' ? confirmPin.join('').length !== 4 : pin.join('').length !== 4)}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin ml-2" />
          ) : null}
          {mode === 'set' 
            ? (step === 'confirm' ? 'تأكيد وحفظ' : 'التالي')
            : 'تحقق'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
