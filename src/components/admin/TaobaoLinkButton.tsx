import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface TaobaoLinkButtonProps {
  taobaoUrl: string | null | undefined;
  className?: string;
  size?: 'sm' | 'default' | 'lg' | 'icon';
  variant?: 'default' | 'ghost' | 'outline' | 'link';
}

/**
 * Admin-only button to quickly access Taobao product page
 * This component should only be rendered when user is admin
 */
export function TaobaoLinkButton({ 
  taobaoUrl, 
  className = '',
  size = 'icon',
  variant = 'ghost'
}: TaobaoLinkButtonProps) {
  if (!taobaoUrl) return null;
  
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(taobaoUrl, '_blank', 'noopener,noreferrer');
  };
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={variant}
            size={size}
            className={`text-orange-500 hover:text-orange-600 hover:bg-orange-100/20 ${className}`}
            onClick={handleClick}
          >
            <ExternalLink className="h-4 w-4" />
            {size !== 'icon' && size !== 'sm' && <span className="mr-2">Taobao</span>}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>فتح صفحة Taobao</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default TaobaoLinkButton;
