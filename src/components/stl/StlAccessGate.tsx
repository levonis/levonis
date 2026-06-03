import { Link } from 'react-router-dom';
import { Lock, Store, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStlLibraryAccess } from '@/hooks/useStlLibraryAccess';

interface Props { children?: React.ReactNode }

export default function StlAccessGate({ children }: Props) {
  const { isLoading, isMerchant, hasCard, isEligible } = useStlLibraryAccess();
  if (isLoading) return null;
  if (isEligible) return <>{children}</>;
  return (
    <div className="glass-panel p-6 rounded-2xl border border-primary/20 text-center space-y-4">
      <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
        <Lock className="h-6 w-6 text-primary" />
      </div>
      <div>
        <h3 className="font-black text-lg mb-1">قسم خاص بتجار Levo</h3>
        <p className="text-sm text-muted-foreground">
          لرفع وتحميل ملفات STL يجب أن تكون تاجراً موثقاً وأن تمتلك بطاقة Levo فعالة.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className={`p-3 rounded-xl border ${isMerchant ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-border'}`}>
          <Store className={`h-4 w-4 mx-auto mb-1 ${isMerchant ? 'text-emerald-500' : 'text-muted-foreground'}`} />
          <span className="block font-semibold">حساب تاجر معتمد</span>
        </div>
        <div className={`p-3 rounded-xl border ${hasCard ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-border'}`}>
          <CreditCard className={`h-4 w-4 mx-auto mb-1 ${hasCard ? 'text-emerald-500' : 'text-muted-foreground'}`} />
          <span className="block font-semibold">بطاقة Levo فعالة</span>
        </div>
      </div>
      <div className="flex gap-2 justify-center">
        {!isMerchant && (
          <Button asChild size="sm" variant="outline">
            <Link to="/community/merchant/signup">تسجيل كتاجر</Link>
          </Button>
        )}
        {!hasCard && (
          <Button asChild size="sm">
            <Link to="/rewards">احصل على بطاقة Levo</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
