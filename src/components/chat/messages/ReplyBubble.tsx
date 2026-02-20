import { cn } from '@/lib/utils';

interface ReplyBubbleProps {
  senderName: string;
  content: string;
  isMe: boolean;
  isParentMe: boolean;
  onClick?: () => void;
}

export default function ReplyBubble({ senderName, content, isMe, isParentMe, onClick }: ReplyBubbleProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-right rounded-lg px-2.5 py-1.5 mb-1 border-r-2",
        isParentMe 
          ? "bg-primary-foreground/15 border-primary-foreground/50" 
          : "bg-background/60 border-primary/50"
      )}
    >
      <p className={cn(
        "text-[10px] font-bold truncate",
        isParentMe ? "text-primary-foreground" : "text-primary"
      )}>
        {isMe ? 'أنت' : senderName}
      </p>
      <p className={cn(
        "text-[10px] truncate",
        isParentMe ? "text-primary-foreground/70" : "text-foreground/60"
      )}>
        {content || '📷 وسائط'}
      </p>
    </button>
  );
}
