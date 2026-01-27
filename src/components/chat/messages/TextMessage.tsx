import { CheckCheck, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TextMessageProps {
  content: string;
  imageUrl?: string | null;
  isMe: boolean;
  timestamp: string;
  isRead?: boolean;
  senderName?: string;
  showSenderName?: boolean;
  showTail?: boolean;
}

export default function TextMessage({
  content,
  imageUrl,
  isMe,
  timestamp,
  isRead = false,
  senderName,
  showSenderName = false,
  showTail = true,
}: TextMessageProps) {
  return (
    <div className={cn("flex", isMe ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[85%] sm:max-w-[70%] rounded-2xl px-3 py-2 shadow-sm relative",
          isMe
            ? "bg-primary text-primary-foreground rounded-tl-sm"
            : "bg-card border border-border/50 rounded-tr-sm",
          showTail && (isMe ? "rounded-tl-2xl" : "rounded-tr-2xl")
        )}
      >
        {/* Sender Name - for group chats or admin view */}
        {showSenderName && senderName && !isMe && (
          <p className="text-xs font-medium text-primary mb-1">{senderName}</p>
        )}

        {/* Image */}
        {imageUrl && (
          <div className="mb-1.5">
            <img
              src={imageUrl}
              alt=""
              className="rounded-lg max-w-full max-h-64 cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => window.open(imageUrl, '_blank')}
            />
          </div>
        )}

        {/* Text Content */}
        {content && content !== '📷 وسائط' && content !== '📷 صورة' && (
          <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
            {content}
          </p>
        )}

        {/* Time & Status */}
        <div
          className={cn(
            "flex items-center gap-1 mt-1",
            isMe ? "justify-start" : "justify-end"
          )}
        >
          <span
            className={cn(
              "text-[10px]",
              isMe ? "text-primary-foreground/70" : "text-muted-foreground"
            )}
          >
            {timestamp}
          </span>
          {isMe && (
            isRead ? (
              <CheckCheck className="h-3.5 w-3.5 text-whatsapp" />
            ) : (
              <Check className="h-3.5 w-3.5 text-primary-foreground/50" />
            )
          )}
        </div>
      </div>
    </div>
  );
}
