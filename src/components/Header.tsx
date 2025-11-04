import React from 'react';
import { Link } from 'react-router-dom';
import TopBar from './TopBar';

const Header = () => {
  const [isScrolled, setIsScrolled] = React.useState(false);

  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <TopBar />
      <nav className={`bg-background/50 backdrop-blur-sm border-b border-border/30 transition-all duration-500 ${
        isScrolled ? 'fixed top-[73px] left-0 right-0 z-40' : 'mt-20'
      }`}>
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-center gap-8">
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
        </div>
      </nav>
      {isScrolled && <div className="h-[120px]" />}
    </>
  );
};

export default Header;