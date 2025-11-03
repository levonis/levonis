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
      className="group block bg-card/40 backdrop-blur-sm rounded-2xl p-5 border border-border/30 hover:border-primary/40 transition-all hover:scale-[1.02] relative overflow-hidden"
    >
      {/* Hover glow effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="relative">
        <div 
          className="w-14 h-14 rounded-xl mb-4 flex items-center justify-center text-primary-foreground font-black text-base mx-auto"
          style={{ 
            background: 'linear-gradient(135deg, hsl(44, 51%, 64%), hsl(36, 42%, 40%))',
            boxShadow: '0 4px 12px hsl(var(--ring) / 0.3)'
          }}
        >
          {icon}
        </div>
        
        <h3 className="font-black text-lg mb-1 text-foreground group-hover:text-primary transition-colors text-center">
          {nameAr}
        </h3>
        
        {descriptionAr && (
          <p className="text-xs text-muted-foreground/80 text-center leading-relaxed">
            {descriptionAr}
          </p>
        )}
      </div>
    </Link>
  );
};

export default CategoryCard;