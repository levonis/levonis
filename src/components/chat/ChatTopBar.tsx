import { useNavigate } from 'react-router-dom';
import { 
  ArrowRight, 
  Store, 
  MoreVertical,
  Flag,
  FileText,
  MessageSquareWarning,
  Star,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import AvatarWithFrame from '@/components/merchant/AvatarWithFrame';

interface ChatTopBarProps {
  storeName: string;
  storeId: string;
  storeImage?: string | null;
  storeFrameUrl?: string | null;
  rating?: number;
  customerId?: string;
  onBack: () => void;
  onReportStore?: () => void;
  onContactAdmin?: () => void;
  onViewPolicies?: () => void;
  onViewCustomerProfile?: () => void;
  status?: 'open' | 'disputed' | 'resolved';
  isSeller?: boolean;
}

export default function ChatTopBar({
  storeName,
  storeId,
  storeImage,
  storeFrameUrl,
  rating = 0,
  customerId,
  onBack,
  onReportStore,
  onContactAdmin,
  onViewPolicies,
  onViewCustomerProfile,
  status = 'open',
  isSeller = false,
}: ChatTopBarProps) {
  const navigate = useNavigate();

  const goToStore = () => {
    navigate(`/store/${storeId}`);
  };

  const goToCustomerProfile = () => {
    if (customerId) {
      navigate(`/community/customer/${customerId}`);
    }
    onViewCustomerProfile?.();
  };

  return (
    <div className="flex items-center gap-2 px-2 py-2.5 border-b bg-card shadow-sm">
      {/* Back Button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-full shrink-0"
        onClick={onBack}
      >
        <ArrowRight className="h-5 w-5" />
      </Button>

      {/* Store Avatar - Clickable */}
      <button onClick={goToStore} className="shrink-0 hover:opacity-80 transition-opacity">
        <AvatarWithFrame
          imageUrl={storeImage}
          frameUrl={storeFrameUrl}
          size="xs"
        />
      </button>

      {/* Store Name - Center, Clickable */}
      <button 
        onClick={goToStore}
        className="flex-1 min-w-0 text-right hover:opacity-80 transition-opacity"
      >
        <div className="flex items-center gap-2">
          <h1 className="font-bold text-sm truncate">{storeName}</h1>
          {status === 'disputed' && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
              نزاع
            </Badge>
          )}
        </div>
        {rating > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Star className="h-3 w-3 fill-primary text-primary" />
            <span>{rating.toFixed(1)}</span>
          </div>
        )}
      </button>

      {/* Store Button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-full shrink-0"
        onClick={goToStore}
      >
        <Store className="h-5 w-5 text-primary" />
      </Button>

      {/* More Options Menu - Role Based */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full shrink-0">
            <MoreVertical className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {isSeller ? (
            // Seller sees customer profile option
            <>
              <DropdownMenuItem onClick={goToCustomerProfile} className="gap-2">
                <User className="h-4 w-4" />
                ملف العميل
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          ) : (
            // Customer sees store visit option
            <>
              <DropdownMenuItem onClick={goToStore} className="gap-2">
                <Store className="h-4 w-4" />
                زيارة المتجر
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          
          <DropdownMenuItem onClick={onReportStore} className="gap-2 text-orange-500">
            <Flag className="h-4 w-4" />
            شكوى / إبلاغ
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={onContactAdmin} className="gap-2 text-amber-500">
            <MessageSquareWarning className="h-4 w-4" />
            تواصل مع الإدارة
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={onViewPolicies} className="gap-2">
            <FileText className="h-4 w-4" />
            سياسات المتجر
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
