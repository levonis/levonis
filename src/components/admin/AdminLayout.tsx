import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { ADMIN_BASE_PATH } from '@/config/adminConfig';

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  backTo?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | '6xl' | '7xl' | 'full';
}

const maxWidthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '4xl': 'max-w-4xl',
  '6xl': 'max-w-6xl',
  '7xl': 'max-w-7xl',
  full: 'max-w-full',
};

export default function AdminLayout({
  children,
  title,
  description,
  icon,
  actions,
  backTo = ADMIN_BASE_PATH,
  maxWidth = '7xl',
}: AdminLayoutProps) {
  const navigate = useNavigate();

  return (
    <div className="admin-page" dir="rtl">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-lg border-b border-border/40">
        <div className={`container mx-auto px-4 md:px-6 ${maxWidthClasses[maxWidth]}`}>
          <div className="flex items-center justify-between h-16 md:h-18">
            {/* Left: Back button + Title */}
            <div className="flex items-center gap-3 min-w-0">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => navigate(backTo)}
                className="shrink-0 h-9 w-9 rounded-lg hover:bg-muted/50"
              >
                <ArrowRight className="h-5 w-5" />
              </Button>
              <div className="min-w-0">
                <h1 className="text-lg md:text-xl font-bold text-foreground flex items-center gap-2 truncate">
                  {icon && <span className="text-primary shrink-0">{icon}</span>}
                  <span className="truncate">{title}</span>
                </h1>
                {description && (
                  <p className="text-xs md:text-sm text-muted-foreground truncate hidden sm:block">
                    {description}
                  </p>
                )}
              </div>
            </div>
            
            {/* Right: Actions */}
            {actions && (
              <div className="flex items-center gap-2 shrink-0">
                {actions}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={`container mx-auto px-4 md:px-6 py-6 md:py-8 ${maxWidthClasses[maxWidth]}`}>
        {children}
      </main>
    </div>
  );
}

// Reusable sub-components for consistent admin UI
export function AdminSection({ 
  title, 
  description, 
  children,
  className = '',
  actions,
}: { 
  title?: string; 
  description?: string;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <section className={`space-y-4 ${className}`}>
      {(title || description || actions) && (
        <div className="flex items-center justify-between gap-4">
          <div>
            {title && <h2 className="text-lg font-bold text-foreground">{title}</h2>}
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function AdminCard({ 
  children, 
  className = '',
  hover = true,
}: { 
  children: ReactNode; 
  className?: string;
  hover?: boolean;
}) {
  return (
    <div className={`admin-card ${hover ? '' : 'hover:shadow-md hover:border-border/50'} ${className}`}>
      {children}
    </div>
  );
}

export function AdminCardHeader({ 
  title, 
  icon,
  description,
  actions,
}: { 
  title: string;
  icon?: ReactNode;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="admin-card-header">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="admin-card-title">
            {icon && <span className="text-primary">{icon}</span>}
            {title}
          </h3>
          {description && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
    </div>
  );
}

export function AdminCardContent({ 
  children, 
  className = '',
  noPadding = false,
}: { 
  children: ReactNode; 
  className?: string;
  noPadding?: boolean;
}) {
  return (
    <div className={noPadding ? className : `admin-card-content ${className}`}>
      {children}
    </div>
  );
}

export function AdminStatsGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
      {children}
    </div>
  );
}

export function AdminStatCard({ 
  icon, 
  value, 
  label,
  colorClass = 'text-primary',
  bgClass = 'bg-primary/10',
}: { 
  icon: ReactNode;
  value: string | number;
  label: string;
  colorClass?: string;
  bgClass?: string;
}) {
  return (
    <div className="admin-stat-card">
      <div className={`w-10 h-10 rounded-lg ${bgClass} flex items-center justify-center mb-3`}>
        <span className={colorClass}>{icon}</span>
      </div>
      <p className="admin-stat-value">{value}</p>
      <p className="admin-stat-label">{label}</p>
    </div>
  );
}

export function AdminEmptyState({ 
  icon, 
  title, 
  description,
  action,
}: { 
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="admin-empty-state">
      <div className="admin-empty-state-icon">{icon}</div>
      <h3 className="admin-empty-state-title">{title}</h3>
      {description && <p className="admin-empty-state-desc">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function AdminLoading() {
  return (
    <div className="admin-loading">
      <div className="admin-loading-spinner" />
    </div>
  );
}
