import { Link, useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { User, LogOut, Settings } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

const Header = () => {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 glass-effect border-b border-border/50 relative overflow-hidden">
      {/* Decorative top line */}
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-ring/30 to-transparent" />
      
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="text-2xl font-black text-gradient-gold">
              LEVONIS.IQ
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            <Link 
              to="/" 
              className="text-foreground/80 hover:text-foreground transition-colors font-medium"
            >
              الرئيسية
            </Link>
            <Link 
              to="/categories" 
              className="text-foreground/80 hover:text-foreground transition-colors font-medium"
            >
              الأقسام
            </Link>
            <Link 
              to="/products" 
              className="text-foreground/80 hover:text-foreground transition-colors font-medium"
            >
              المنتجات
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon"
                    className="rounded-full border-primary/30 hover:border-primary"
                  >
                    <User className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>حسابي</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {isAdmin && (
                    <DropdownMenuItem onClick={() => navigate('/admin')}>
                      <Settings className="ml-2 h-4 w-4" />
                      <span>لوحة التحكم</span>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={signOut} className="text-destructive">
                    <LogOut className="ml-2 h-4 w-4" />
                    <span>تسجيل الخروج</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button 
                onClick={() => navigate('/auth')}
                className="bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90"
              >
                تسجيل الدخول
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;