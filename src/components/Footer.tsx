import logo from '@/assets/logo.png';

const Footer = () => {
  return (
    <footer className="w-full py-12 bg-card/50 border-t border-border/30 mt-16">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center justify-center gap-6">
          <div className="w-48 h-48 relative">
            <img 
              src={logo} 
              alt="Logo" 
              className="w-full h-full object-contain animate-fade-in"
            />
          </div>
          
          <div className="text-center space-y-2">
            <p className="text-muted-foreground text-sm">
              © {new Date().getFullYear()} جميع الحقوق محفوظة
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
