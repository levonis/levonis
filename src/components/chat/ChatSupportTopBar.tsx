import { ArrowRight, Headphones, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ChatSupportTopBarProps {
  onBack: () => void;
}

export default function ChatSupportTopBar({ onBack }: ChatSupportTopBarProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-3 border-b bg-gradient-to-l from-primary/10 via-primary/5 to-transparent shadow-sm">
      {/* Back Button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-full shrink-0"
        onClick={onBack}
      >
        <ArrowRight className="h-5 w-5" />
      </Button>

      {/* Support Icon */}
      <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center shrink-0">
        <Headphones className="h-5 w-5 text-primary-foreground" />
      </div>

      {/* Support Info */}
      <div className="flex-1 min-w-0 text-right">
        <h1 className="font-bold text-sm">خدمة العملاء</h1>
        <p className="text-xs text-muted-foreground">فريق الدعم الفني</p>
      </div>

      {/* Info Button */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full shrink-0">
              <Info className="h-4 w-4 text-muted-foreground" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="end" className="max-w-xs">
            <p className="text-xs">
              فريق الدعم متاح للإجابة على استفساراتك ومساعدتك في أي مشكلة تواجهها.
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
