import { cn } from '@/lib/utils';
import { 
  Info, 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  Bell,
  Clock,
  CreditCard,
  Truck,
  Package,
  ShieldCheck,
} from 'lucide-react';

type MessageVariant = 'info' | 'success' | 'warning' | 'error' | 'neutral';

interface SystemMessageProps {
  content: string;
  variant?: MessageVariant;
  timestamp?: string;
}

const VARIANT_CONFIG: Record<MessageVariant, {
  bgColor: string;
  textColor: string;
  borderColor: string;
  icon: any;
}> = {
  info: {
    bgColor: 'bg-blue-500/10',
    textColor: 'text-blue-600',
    borderColor: 'border-blue-500/20',
    icon: Info,
  },
  success: {
    bgColor: 'bg-green-500/10',
    textColor: 'text-green-600',
    borderColor: 'border-green-500/20',
    icon: CheckCircle,
  },
  warning: {
    bgColor: 'bg-amber-500/10',
    textColor: 'text-amber-600',
    borderColor: 'border-amber-500/20',
    icon: AlertTriangle,
  },
  error: {
    bgColor: 'bg-red-500/10',
    textColor: 'text-red-600',
    borderColor: 'border-red-500/20',
    icon: XCircle,
  },
  neutral: {
    bgColor: 'bg-muted/50',
    textColor: 'text-muted-foreground',
    borderColor: 'border-border',
    icon: Bell,
  },
};

// Auto-detect variant from content
function detectVariant(content: string): MessageVariant {
  if (content.includes('مرحبًا') || content.includes('👋') || content.includes('أهلًا')) {
    return 'info';
  }
  if (content.includes('تم إنشاء') || content.includes('تمت الموافقة') || content.includes('✓') || content.includes('✅')) {
    return 'success';
  }
  if (content.includes('تعديل') || content.includes('انتظار') || content.includes('بانتظار') || content.includes('⚠️')) {
    return 'warning';
  }
  if (content.includes('رفض') || content.includes('إلغاء') || content.includes('ملغي') || content.includes('🚫')) {
    return 'error';
  }
  return 'neutral';
}

// Detect icon from content
function detectIcon(content: string): any {
  if (content.includes('دفع') || content.includes('الدفع')) return CreditCard;
  if (content.includes('شحن') || content.includes('توصيل')) return Truck;
  if (content.includes('طلب') || content.includes('الطلب')) return Package;
  if (content.includes('موافقة') || content.includes('تأكيد')) return CheckCircle;
  if (content.includes('انتظار') || content.includes('بانتظار')) return Clock;
  if (content.includes('إدارة') || content.includes('الإدارة')) return ShieldCheck;
  return null;
}

export default function SystemMessage({
  content,
  variant,
  timestamp,
}: SystemMessageProps) {
  const detectedVariant = variant || detectVariant(content);
  const config = VARIANT_CONFIG[detectedVariant];
  const DetectedIcon = detectIcon(content) || config.icon;

  return (
    <div className="flex justify-center my-3">
      <div className={cn(
        "max-w-[90%] sm:max-w-[70%] rounded-xl px-4 py-2.5 text-center",
        "border shadow-sm",
        config.bgColor,
        config.borderColor
      )}>
        <div className="flex items-center justify-center gap-2 mb-0.5">
          <DetectedIcon className={cn("h-3.5 w-3.5", config.textColor)} />
          <span className={cn("text-[10px] font-medium", config.textColor)}>
            رسالة النظام
          </span>
        </div>
        <p className={cn("text-xs font-medium whitespace-pre-wrap", config.textColor)}>
          {content}
        </p>
        {timestamp && (
          <p className="text-[10px] text-muted-foreground mt-1">
            {timestamp}
          </p>
        )}
      </div>
    </div>
  );
}
