import { Link, useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { User, LogOut, Settings, ShoppingCart, Package, FileText, Heart, Bell } from 'lucide-react';
import CustomProductRequestDialog from './CustomProductRequestDialog';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

const TopBar = () => {
  const { user, isAdmin, signOut } = useAuth();
  const { itemCount } = useCart();
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);

  const { data: unreadNotifications } = useQuery({
    queryKey: ['unread-notifications', user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.id)
        .eq('read', false);
      
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className={`sticky top-0 z-50 border-b overflow-hidden transition-all duration-500 ${
      isScrolled 
        ? 'bg-background/30 backdrop-blur-2xl border-border/20 shadow-2xl' 
        : 'bg-background/95 backdrop-blur-3xl border-border/40 shadow-lg'
    }`}>
      {/* Animated decorative line */}
      <div className="absolute top-0 left-0 w-full h-px overflow-hidden">
        <div className="h-full w-full bg-gradient-to-r from-transparent via-ring to-transparent animate-shimmer" 
             style={{ 
               backgroundSize: '200% 100%',
               animation: 'shimmer 3s linear infinite'
             }} 
        />
      </div>
      
      {/* Floating ornamental dots */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute top-1/2 left-10 w-1 h-1 rounded-full bg-ring animate-float" />
        <div className="absolute top-1/2 left-32 w-1 h-1 rounded-full bg-primary animate-float" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 right-32 w-1 h-1 rounded-full bg-accent animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 right-10 w-1 h-1 rounded-full bg-ring animate-float" style={{ animationDelay: '3s' }} />
      </div>
      
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="text-2xl font-black text-gradient-gold">
              LEVONIS.IQ
            </div>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-6">
            <Link 
              to="/" 
              className="text-foreground/80 hover:text-foreground transition-colors font-medium hover-scale"
            >
              الرئيسية
            </Link>
            <Link 
              to="/categories" 
              className="text-foreground/80 hover:text-foreground transition-colors font-medium hover-scale"
            >
              الأقسام
            </Link>
            <Link 
              to="/products" 
              className="text-foreground/80 hover:text-foreground transition-colors font-medium hover-scale"
            >
              المنتجات
            </Link>
          </div>

          {/* Cart and User Actions */}
          <div className="flex items-center gap-3">
            {/* Custom Product Request Button */}
            <CustomProductRequestDialog>
              <Button
                variant="outline"
                size="icon"
                className="rounded-full border-primary/30 hover:border-primary"
                title="طلب منتج مخصص"
              >
                <Package className="h-5 w-5" />
              </Button>
            </CustomProductRequestDialog>

            {/* Notifications Button */}
            {user && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigate('/notifications')}
                className="relative rounded-full border-primary/30 hover:border-primary"
                title="الإشعارات"
              >
                <Bell className="h-5 w-5" />
                {unreadNotifications && unreadNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                    {unreadNotifications > 9 ? '9+' : unreadNotifications}
                  </span>
                )}
              </Button>
            )}

            {/* Cart Button */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate('/cart')}
              className="relative rounded-full border-primary/30 hover:border-primary"
            >
              <ShoppingCart className="h-5 w-5" />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                  {itemCount > 9 ? '9+' : itemCount}
                </span>
              )}
            </Button>

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
                <DropdownMenuContent align="end" className="w-56 bg-background backdrop-blur-sm border-border z-50">
                  <DropdownMenuLabel>حسابي</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/user-info')}>
                    <User className="ml-2 h-4 w-4" />
                    <span>معلومات الحساب</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/my-requests')}>
                    <FileText className="ml-2 h-4 w-4" />
                    <span>طلباتي المخصصة</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/favorites')}>
                    <Heart className="ml-2 h-4 w-4" />
                    <span>المفضلة</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/notifications')}>
                    <Bell className="ml-2 h-4 w-4" />
                    <span>الإشعارات</span>
                    {unreadNotifications && unreadNotifications > 0 && (
                      <span className="mr-auto bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded-full">
                        {unreadNotifications}
                      </span>
                    )}
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem onClick={() => navigate('/admin')}>
                      <Settings className="ml-2 h-4 w-4" />
                      <span>لوحة التحكم</span>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
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
    </div>
  );
};

export default TopBar;
