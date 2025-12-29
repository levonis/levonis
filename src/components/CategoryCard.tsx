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
      className="group block bg-card/80 backdrop-blur-sm rounded-xl p-4 border border-border/40 hover:border-primary/60 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg relative overflow-hidden h-[140px]"
      style={{
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.06)',
      }}
    >
      {/* Background gradient on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-accent/8 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <div className="relative z-10 flex flex-col items-center h-full">
        {/* Icon */}
        <div 
          className="w-12 h-12 rounded-xl mb-3 flex items-center justify-center text-primary-foreground font-medium text-xl shrink-0 group-hover:scale-105 transition-transform duration-300"
          style={{ 
            background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))',
            boxShadow: '0 4px 12px hsl(var(--primary) / 0.25)'
          }}
        >
          <span>{icon}</span>
        </div>
        
        {/* Title */}
        <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors duration-200 text-center w-full leading-tight mb-1 line-clamp-2">
          {nameAr}
        </h3>
        
        {/* Description - fixed height area */}
        <div className="flex-1 flex items-start justify-center w-full overflow-hidden">
          {descriptionAr && (
            <p className="text-[11px] text-muted-foreground text-center leading-relaxed line-clamp-2 w-full">
              {descriptionAr}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
};

export default memo(CategoryCard);