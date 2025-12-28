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
      className="group block bg-card/60 backdrop-blur-sm rounded-xl p-3 border border-border/30 hover:border-primary/50 transition-all duration-300 hover:scale-[1.03] relative overflow-hidden"
      style={{
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
        contain: 'layout paint',
      }}
    >
      {/* Simplified background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <div className="relative z-10">
        <div 
          className="w-10 h-10 rounded-lg mb-2 flex items-center justify-center text-primary-foreground font-medium text-lg mx-auto group-hover:scale-110 transition-transform duration-300"
          style={{ 
            background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))',
            boxShadow: '0 2px 8px hsl(var(--primary) / 0.3)'
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