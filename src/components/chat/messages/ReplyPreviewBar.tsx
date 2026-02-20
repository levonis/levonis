import { X, Reply } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ReplyToMessage {
  id: string;
  content: string;
  senderName: string;
  isMe: boolean;
}

interface ReplyPreviewBarProps {
  replyTo: ReplyToMessage;
  onClose: () => void;
}

export default function ReplyPreviewBar({ replyTo, onClose }: ReplyPreviewBarProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b bg-card/50">
      <Reply className="h-4 w-4 text-primary shrink-0" />
      <div className="flex-1 min-w-0 border-r-2 border-primary pr-2">
        <p className="text-[11px] font-bold text-primary truncate">
          {replyTo.isMe ? 'أنت' : replyTo.senderName}
        </p>
        <p className="text-[11px] text-muted-foreground truncate">
          {replyTo.content || '📷 وسائط'}
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="shrink-0 h-6 w-6 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
      >
        <X className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    </div>
  );
}
