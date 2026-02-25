import { CheckCheck, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseEmojisInText } from '../emojiData';
import ImageLightbox from '../ImageLightbox';
import LinkRenderer from '../LinkRenderer';

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

// URL regex pattern
const URL_REGEX = /(https?:\/\/[^\s<>"']+)/gi;

// Extract URLs from text
function extractUrls(text: string): string[] {
  return text.match(URL_REGEX) || [];
}

// Get text without URLs
function getTextWithoutUrls(text: string): string {
  return text.replace(URL_REGEX, '').trim();
}

// Component to render text with inline emojis
function RenderTextWithEmojis({ text }: { text: string }) {
  const parsed = parseEmojisInText(text);
  
  return (
    <>
      {parsed.map((item, index) => {
        if (typeof item === 'string') {
          return <span key={index}>{item}</span>;
        }
        return (
          <img
            key={index}
            src={item.src}
            alt={item.alt}
            className="inline-block w-5 h-5 align-text-bottom mx-0.5"
            loading="lazy"
          />
        );
      })}
    </>
  );
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
  const urls = content ? extractUrls(content) : [];
  const textWithoutUrls = content ? getTextWithoutUrls(content) : '';
  const hasTextContent = textWithoutUrls && textWithoutUrls !== '📷 وسائط' && textWithoutUrls !== '📷 صورة';

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
        {/* Sender Name */}
        {showSenderName && senderName && !isMe && (
          <p className="text-xs font-medium text-primary mb-1">{senderName}</p>
        )}

        {/* Image with Lightbox */}
        {imageUrl && (
          <ImageLightbox src={imageUrl} alt="صورة">
            {(open) => (
              <div className="mb-1.5">
                <img
                  src={imageUrl}
                  alt=""
                  className="rounded-lg max-w-full max-h-64 cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={open}
                />
              </div>
            )}
          </ImageLightbox>
        )}

        {/* Text Content with Inline Emojis */}
        {hasTextContent && (
          <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
            <RenderTextWithEmojis text={textWithoutUrls} />
          </p>
        )}

        {/* Rendered Links */}
        {urls.map((url, i) => (
          <LinkRenderer key={i} url={url} isMe={isMe} />
        ))}

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
