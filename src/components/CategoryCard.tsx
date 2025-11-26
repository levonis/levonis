import { Link } from 'react-router-dom';

interface CategoryCardProps {
  name: string;
  nameAr: string;
  slug: string;
  icon: string;
  description?: string;
  descriptionAr?: string;
}

const CategoryCard = ({ 
  name, 
  nameAr, 
  slug, 
  icon, 
  description, 
  descriptionAr 
}: CategoryCardProps) => {
  return (
    <Link 
      to={`/category/${slug}`}
      className="group block bg-card/50 backdrop-blur-md rounded-2xl p-4 border border-border/40 hover:border-primary/60 transition-all duration-500 hover:scale-105 hover:-translate-y-2 relative overflow-hidden animate-slide-in-up"
      style={{
        boxShadow: '0 6px 20px rgba(0, 0, 0, 0.18)',
      }}
    >
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 opacity-0 group-hover:opacity-100 transition-all duration-500" />
      
      {/* Shimmer effect on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/20 to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
      </div>
      
      {/* Glow border effect */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-all duration-500 animate-pulse-glow" 
           style={{ 
             boxShadow: '0 0 30px hsl(var(--ring) / 0.4), inset 0 0 20px hsl(var(--ring) / 0.1)' 
           }} />
      
      <div className="relative z-10">
      <div 
        className="w-14 h-14 rounded-xl mb-3 flex items-center justify-center text-primary-foreground font-black text-base mx-auto transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-500"
        style={{ 
          background: 'linear-gradient(135deg, hsl(44, 51%, 64%), hsl(36, 42%, 40%))',
          boxShadow: '0 6px 16px hsl(var(--ring) / 0.3), 0 0 30px hsl(var(--ring) / 0.15)'
        }}
      >
        <span className="group-hover:animate-pulse">{icon}</span>
      </div>
      
      <h3 className="font-black text-base mb-1 text-foreground group-hover:text-primary transition-all duration-300 text-center transform group-hover:scale-105">
        {nameAr}
      </h3>
      
      {descriptionAr && (
        <p className="text-xs text-muted-foreground/85 group-hover:text-muted-foreground transition-colors duration-300 text-center leading-relaxed">
          {descriptionAr}
        </p>
      )}
      </div>
      
      {/* Corner decoration */}
      <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary/30 group-hover:bg-primary/60 transition-colors duration-500" />
      <div className="absolute bottom-2 left-2 w-2 h-2 rounded-full bg-accent/30 group-hover:bg-accent/60 transition-colors duration-500" />
    </Link>
  );
};

export default CategoryCard;