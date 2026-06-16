const logoNew = '/logo-small.webp';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/lib/i18n';

const Footer = () => {
  const { t, language } = useLanguage();
  const labels = {
    ar: { about: 'من نحن', privacy: 'الخصوصية', terms: 'الشروط والأحكام', faq: 'الأسئلة الشائعة', download: 'تحميل التطبيق' },
    en: { about: 'About', privacy: 'Privacy', terms: 'Terms', faq: 'FAQ', download: 'Download App' },
    ku: { about: 'دەربارە', privacy: 'تایبەتمەندی', terms: 'مەرجەکان', faq: 'پرسیارەکان', download: 'دابەزاندنی ئەپ' },
  }[language === 'en' ? 'en' : language === 'ku' ? 'ku' : 'ar'];

  return (
    <footer className="w-full py-12 border-t mt-16 bg-transparent border-card">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center justify-center gap-6">
          <div className="w-24 h-24 relative">
            <img 
              src={logoNew}
              alt=""
              aria-hidden="true"
              className="w-full h-full object-contain animate-fade-in bg-transparent"
              loading="lazy"
              width="192"
              height="192"
              style={{ mixBlendMode: 'normal' }}
            />
          </div>
          
          <div className="flex items-center justify-center gap-4">
            <a 
              href="https://www.facebook.com/levonisiq" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border/50 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
            >
              Facebook ▾
            </a>
            <a 
              href="https://www.instagram.com/levonis_iq?igsh=MTZpeWxqYXN4MGtzbw==" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border/50 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
            >
              Instagram ▾
            </a>
            <a
              href="https://wa.me/9647838455220?text=مرحباً%20اريد%20الاستفسار%20عن%20منتجاتكم"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border/50 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 32 32">
                <path d="M19.11 17.03c-.27-.14-1.58-.78-1.83-.87-.25-.09-.43-.14-.62.14-.18.27-.71.86-.87 1.03-.16.18-.32.2-.59.07-.27-.14-1.14-.42-2.17-1.33-.8-.71-1.34-1.58-1.5-1.85-.16-.27-.02-.42.12-.56.12-.12.27-.32.41-.48.14-.16.18-.27.27-.45.09-.18.05-.34-.02-.48-.07-.14-.62-1.5-.86-2.05-.23-.55-.46-.48-.62-.48-.16 0-.34-.02-.52-.02s-.48.07-.73.34c-.25.27-.96.94-.96 2.29 0 1.35.98 2.66 1.12 2.85.14.18 1.93 2.95 4.68 4.02.65.28 1.16.45 1.55.58.65.2 1.24.17 1.71.1.52-.08 1.58-.64 1.8-1.26.23-.62.23-1.16.16-1.26-.07-.09-.25-.16-.52-.3zM16.02 3.2C8.83 3.2 3 8.98 3 16.1c0 2.28.61 4.42 1.67 6.26L3 29l6.83-1.79c1.79.98 3.85 1.54 6.19 1.54 7.19 0 13.02-5.78 13.02-12.9C29.04 8.98 23.21 3.2 16.02 3.2zm0 22.96c-1.98 0-3.82-.53-5.4-1.45l-.39-.23-4.05 1.06 1.08-3.94-.25-.41A10.6 10.6 0 0 1 5.42 16.1c0-5.86 4.8-10.62 10.7-10.62s10.7 4.76 10.7 10.62-4.8 10.62-10.7 10.62z"/>
              </svg>
              WhatsApp
            </a>
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mt-6 text-sm">
            <Link to="/about" className="text-muted-foreground hover:text-primary transition-colors">{labels.about}</Link>
            <span className="text-border">•</span>
            <Link to="/faq" className="text-muted-foreground hover:text-primary transition-colors">{labels.faq}</Link>
            <span className="text-border">•</span>
            <Link to="/privacy" className="text-muted-foreground hover:text-primary transition-colors">{labels.privacy}</Link>
            <span className="text-border">•</span>
            <Link to="/terms" className="text-muted-foreground hover:text-primary transition-colors">{labels.terms}</Link>
            <span className="text-border">•</span>
            <Link to="/download-app" className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16"/></svg>
              {labels.download}
            </Link>
          </nav>

          <div className="text-center space-y-2 mt-2">
            <p className="text-muted-foreground text-sm">
              © {new Date().getFullYear()} {t('footer_rights')}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
