import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import AvatarWithFrame from "./AvatarWithFrame";

interface StandaloneShellProps {
  merchantName: string;
  merchantImage?: string | null;
  frameUrl?: string | null;
  slug: string;
  children: ReactNode;
  /** Right-side action (e.g., dashboard link for owner) */
  headerAction?: ReactNode;
}

/**
 * Standalone storefront shell — used when a merchant store is opened
 * as if it were its own website (e.g. /s/<slug> or <slug>.levonisiq.com).
 * Hides the global Levonis chrome and shows a merchant-branded header
 * plus a small "Powered by Levonis" footer.
 */
export default function StandaloneShell({
  merchantName,
  merchantImage,
  frameUrl,
  slug,
  children,
  headerAction,
}: StandaloneShellProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background" dir="rtl">
      {/* Merchant-branded header */}
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/85 backdrop-blur-xl">
        <div className="container mx-auto max-w-5xl px-4 py-3 flex items-center justify-between gap-3">
          <Link
            to={`/s/${slug}`}
            className="flex items-center gap-3 min-w-0 group"
            aria-label={merchantName}
          >
            <AvatarWithFrame
              imageUrl={merchantImage}
              frameUrl={frameUrl}
              size="sm"
              alt={merchantName}
            />
            <div className="min-w-0">
              <div className="text-sm sm:text-base font-bold text-foreground truncate group-hover:text-primary transition-colors">
                {merchantName}
              </div>
              <div className="text-[10px] text-muted-foreground/80 truncate">
                {slug}.levonisiq.com
              </div>
            </div>
          </Link>
          {headerAction}
        </div>
      </header>

      {/* Page body */}
      <main className="flex-1">{children}</main>

      {/* Powered by Levonis footer */}
      <footer className="mt-8 border-t border-border/40 bg-card/30">
        <div className="container mx-auto max-w-5xl px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span>مدعوم من</span>
            <a
              href="https://levonisiq.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-foreground hover:text-primary inline-flex items-center gap-1"
            >
              Levonis
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div className="opacity-70">
            © {new Date().getFullYear()} {merchantName}
          </div>
        </div>
      </footer>
    </div>
  );
}
