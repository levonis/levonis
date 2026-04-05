import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';

interface Props {
  children: ReactNode;
}

const CommunityGardenTransition = ({ children }: Props) => {
  return (
    <section className="relative overflow-hidden">
      {/* Layered background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-[hsl(var(--emerald-deep))] to-background" />
      
      {/* Decorative glowing orbs */}
      <div className="absolute top-20 right-[15%] w-72 h-72 rounded-full bg-primary/8 blur-3xl pointer-events-none" />
      <div className="absolute bottom-32 left-[10%] w-96 h-96 rounded-full bg-accent/6 blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-primary/4 blur-3xl pointer-events-none" />

      {/* Top transition gradient */}
      <div className="h-24 bg-gradient-to-b from-background to-transparent relative z-10" />

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-10 py-12 md:py-20">
        {/* Section header */}
        <div className="text-center mb-10 md:mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 mb-4">
            <Users className="w-4 h-4 text-primary" />
            <span className="text-xs text-primary font-medium">مجتمع LEVONIS</span>
          </div>
          <h2 className="font-amiri text-3xl md:text-4xl font-bold text-foreground mb-3">
            انضم إلى مجتمعنا
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto text-sm md:text-base">
            تعرّف على صنّاعنا ومبدعينا، شارك أفكارك واطلب تصاميم مخصصة
          </p>
        </div>

        {/* Community content */}
        {children}

        {/* CTA */}
        <div className="text-center mt-10 md:mt-16">
          <Link
            to="/community"
            className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-full bg-primary text-primary-foreground font-bold text-base shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300"
          >
            استكشف المجتمع
            <svg className="w-4 h-4 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </div>

      {/* Bottom transition gradient */}
      <div className="h-24 bg-gradient-to-t from-background to-transparent relative z-10" />
    </section>
  );
};

export default CommunityGardenTransition;
