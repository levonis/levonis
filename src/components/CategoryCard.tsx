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
      className="group block bg-gradient-to-b from-card to-card/80 rounded-2xl p-4 border border-border/40 card-premium hover:border-primary/50 transition-all hover:-translate-y-1"
    >
      <div 
        className="w-12 h-12 rounded-xl mb-3 flex items-center justify-center text-primary-foreground font-black text-sm"
        style={{ 
          background: 'var(--gradient-radial-gold)',
          border: '1px solid hsl(var(--ring))'
        }}
      >
        {icon}
      </div>
      
      <h3 className="font-bold text-lg mb-1 text-foreground group-hover:text-primary transition-colors">
        {nameAr}
      </h3>
      
      {descriptionAr && (
        <p className="text-sm text-muted-foreground">
          {descriptionAr}
        </p>
      )}
    </Link>
  );
};

export default CategoryCard;