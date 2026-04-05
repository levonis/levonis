const logoNew = '/og-logo.png';
import { useLanguage } from '@/lib/i18n';

const Footer = () => {
  const { t } = useLanguage();

  return (
    <footer className="relative w-full py-16 md:py-20 border-t border-border/20 mt-20 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background to-[hsl(var(--emerald-deep))]" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-primary/4 blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-10">
        <div className="flex flex-col items-center justify-center gap-8">
          <div className="w-20 h-20 relative">
            <img 
              src={logoNew}
              alt="LEVONIS Logo" 
              className="w-full h-full object-contain bg-transparent"
              loading="lazy"
              width="160"
              height="160"
            />
          </div>
          
          <div className="flex items-center justify-center gap-3">
            <a 
              href="https://www.facebook.com/levonisiq" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-border/40 text-sm text-foreground/70 hover:border-primary/50 hover:text-primary transition-all duration-300"
            >
              Facebook
            </a>
            <a 
              href="https://www.instagram.com/levonis_iq" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-border/40 text-sm text-foreground/70 hover:border-primary/50 hover:text-primary transition-all duration-300"
            >
              Instagram
            </a>
            <a
              href="https://wa.me/9647838455220?text=مرحباً%20اريد%20الاستفسار%20عن%20منتجاتكم"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-border/40 text-sm text-foreground/70 hover:border-primary/50 hover:text-primary transition-all duration-300"
            >
              WhatsApp
            </a>
          </div>

          <div className="text-center mt-4">
            <p className="text-foreground/40 text-sm">
              © {new Date().getFullYear()} {t('footer_rights')}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
