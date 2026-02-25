import { Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface LinkRendererProps {
  url: string;
  isMe: boolean;
}

function getLinkLabel(url: string): { icon: string; label: string } {
  const lower = url.toLowerCase();
  if (lower.includes('facebook.com') || lower.includes('fb.com')) return { icon: '📘', label: 'Facebook' };
  if (lower.includes('instagram.com')) return { icon: '📸', label: 'Instagram' };
  if (lower.includes('twitter.com') || lower.includes('x.com')) return { icon: '🐦', label: 'X / Twitter' };
  if (lower.includes('tiktok.com')) return { icon: '🎵', label: 'TikTok' };
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return { icon: '▶️', label: 'YouTube' };
  if (lower.includes('wa.me') || lower.includes('whatsapp.com')) return { icon: '💬', label: 'WhatsApp' };
  if (lower.includes('t.me') || lower.includes('telegram')) return { icon: '✈️', label: 'Telegram' };
  if (lower.includes('snapchat.com')) return { icon: '👻', label: 'Snapchat' };
  if (lower.includes('linkedin.com')) return { icon: '💼', label: 'LinkedIn' };
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    return { icon: '🔗', label: hostname };
  } catch {
    return { icon: '🔗', label: 'رابط' };
  }
}

export default function LinkRenderer({ url, isMe }: LinkRendererProps) {
  const { icon, label } = getLinkLabel(url);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(url);
    toast.success('تم نسخ الرابط');
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg p-2 my-1 text-xs",
        isMe
          ? "bg-primary-foreground/10 border border-primary-foreground/20"
          : "bg-muted/50 border border-border/50"
      )}
      dir="ltr"
    >
      <span className="text-base shrink-0">{icon}</span>
      <span className={cn(
        "flex-1 truncate font-medium",
        isMe ? "text-primary-foreground" : "text-foreground"
      )}>
        {label}
      </span>
      <button
        onClick={handleCopy}
        className={cn(
          "h-7 w-7 rounded-md flex items-center justify-center shrink-0 transition-colors",
          isMe
            ? "hover:bg-primary-foreground/20 text-primary-foreground/70"
            : "hover:bg-muted text-muted-foreground"
        )}
        title="نسخ الرابط"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "h-7 w-7 rounded-md flex items-center justify-center shrink-0 transition-colors",
          isMe
            ? "hover:bg-primary-foreground/20 text-primary-foreground/70"
            : "hover:bg-muted text-muted-foreground"
        )}
        title="فتح الرابط"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}
