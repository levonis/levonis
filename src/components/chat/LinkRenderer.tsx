import { useState, useEffect } from 'react';
import { Copy, ExternalLink, Package } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

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

// Extract product slug from URL
function extractProductSlug(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const match = urlObj.pathname.match(/\/product\/([^/?#]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

interface ProductPreview {
  name_ar: string;
  image_url: string | null;
  images: string[] | null;
  price: number;
  currency: string;
  slug: string;
}

function ProductLinkPreview({ url, slug, isMe }: { url: string; slug: string; isMe: boolean }) {
  const [product, setProduct] = useState<ProductPreview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('products')
      .select('name_ar, image_url, images, price, currency, slug')
      .eq('slug', slug)
      .single()
      .then(({ data }) => {
        if (data) setProduct(data as ProductPreview);
        setLoading(false);
      });
  }, [slug]);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(url);
    toast.success('تم نسخ الرابط');
  };

  if (loading) {
    return (
      <div className={cn(
        "rounded-xl overflow-hidden my-1 border animate-pulse",
        isMe ? "border-primary-foreground/20" : "border-border/50"
      )}>
        <div className="h-28 bg-muted/30" />
        <div className="p-2 space-y-1.5">
          <div className="h-3 bg-muted/30 rounded w-3/4" />
          <div className="h-3 bg-muted/30 rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (!product) {
    return <DefaultLinkRenderer url={url} isMe={isMe} />;
  }

  const displayImage = (product.images && product.images.length > 0) ? product.images[0] : product.image_url;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "block rounded-xl overflow-hidden my-1 border transition-all hover:shadow-md",
        isMe ? "border-primary-foreground/20" : "border-border/50"
      )}
      dir="rtl"
    >
      {/* Product Image */}
      <div className="relative h-32 bg-muted/20">
        {displayImage ? (
          <img
            src={displayImage}
            alt={product.name_ar}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="h-8 w-8 text-muted-foreground/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
        
        {/* Price badge */}
        <div className="absolute bottom-2 start-2 bg-card/90 backdrop-blur-sm px-2 py-0.5 rounded-full border border-primary/20">
          <span className="text-xs font-bold text-primary">
            {product.price.toLocaleString()}
          </span>
          <span className="text-[9px] text-muted-foreground mr-1">{product.currency}</span>
        </div>
      </div>

      {/* Product Info */}
      <div className={cn(
        "px-3 py-2 flex items-center justify-between gap-2",
        isMe ? "bg-primary-foreground/5" : "bg-muted/30"
      )}>
        <div className="flex-1 min-w-0">
          <p className={cn(
            "text-xs font-bold truncate",
            isMe ? "text-primary-foreground" : "text-foreground"
          )}>
            {product.name_ar}
          </p>
          <p className={cn(
            "text-[10px]",
            isMe ? "text-primary-foreground/60" : "text-muted-foreground"
          )}>
            عرض المنتج
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleCopy}
            className={cn(
              "h-7 w-7 rounded-md flex items-center justify-center transition-colors",
              isMe
                ? "hover:bg-primary-foreground/20 text-primary-foreground/70"
                : "hover:bg-muted text-muted-foreground"
            )}
            title="نسخ الرابط"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <div className={cn(
            "h-7 w-7 rounded-md flex items-center justify-center",
            isMe ? "text-primary-foreground/70" : "text-muted-foreground"
          )}>
            <ExternalLink className="h-3.5 w-3.5" />
          </div>
        </div>
      </div>
    </a>
  );
}

function DefaultLinkRenderer({ url, isMe }: LinkRendererProps) {
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

export default function LinkRenderer({ url, isMe }: LinkRendererProps) {
  const slug = extractProductSlug(url);

  if (slug) {
    return <ProductLinkPreview url={url} slug={slug} isMe={isMe} />;
  }

  return <DefaultLinkRenderer url={url} isMe={isMe} />;
}
