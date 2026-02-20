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
        "w-full text-right rounded-lg px-2.5 py-1.5 mb-1 border-r-2 border-primary/70",
        isParentMe 
          ? "bg-card/60" 
          : "bg-card/40"
      )}
    >
      <p className="text-[10px] font-bold text-primary-foreground truncate">
        {isMe ? 'أنت' : senderName}
      </p>
      <p className={cn(
        "text-[10px] truncate",
        isParentMe ? "text-primary-foreground/70" : "text-muted-foreground"
      )}>
        {content || '📷 وسائط'}
      </p>
    </button>
  );
}
