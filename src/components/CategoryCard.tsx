import { memo } from 'react';
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
      className="group block bg-card/50 rounded-2xl p-4 border border-border/40 hover:border-primary/60 transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 relative overflow-hidden"
      style={{
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
        contain: 'layout paint',
      }}
    >
      {/* Simplified background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <div className="relative z-10">
        <div 
          className="w-12 h-12 rounded-xl mb-3 flex items-center justify-center text-primary-foreground font-black text-sm mx-auto group-hover:scale-105 transition-transform duration-300"
          style={{ 
            background: 'linear-gradient(135deg, hsl(44, 51%, 64%), hsl(36, 42%, 40%))',
            boxShadow: '0 4px 12px hsl(var(--ring) / 0.25)'
          }}
        >
          <span>{icon}</span>
        </div>
        
        <h3 className="font-black text-sm mb-1 text-foreground group-hover:text-primary transition-colors duration-200 text-center">
          {nameAr}
        </h3>
        
        {descriptionAr && (
          <p className="text-xs text-muted-foreground/80 text-center leading-relaxed line-clamp-2">
            {descriptionAr}
          </p>
        )}
      </div>
    </Link>
  );
};

export default memo(CategoryCard);