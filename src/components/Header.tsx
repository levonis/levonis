import { Link } from 'react-router-dom';
import TopBar from './TopBar';

const Header = () => {
  return (
    <>
      <TopBar />
      <nav className="sticky top-[73px] z-40 bg-background/50 backdrop-blur-sm border-b border-border/30">
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
    </>
  );
};

export default Header;