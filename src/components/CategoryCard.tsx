import { memo } from "react";
import { Link } from "react-router-dom";
import DirectSaleRibbon from "./ui/DirectSaleRibbon";

interface CategoryCardProps {
  name: string;
  nameAr: string;
  slug: string;
  icon: string;
  description?: string;
  descriptionAr?: string;
  hasDirectSale?: boolean;
}

const CategoryCard = ({ name, nameAr, slug, icon, description, descriptionAr, hasDirectSale }: CategoryCardProps) => {
  const iconText = (icon ?? "").trim();
  const isLongIcon = iconText.length > 3;

  return (
    <Link
      to={`/category/${slug}`}
      className="group block bg-card/70 backdrop-blur-sm rounded-2xl border border-border/30 hover:border-primary/50 transition-all duration-400 hover:scale-[1.03] hover:shadow-xl relative overflow-hidden h-[180px] sm:h-[200px] lg:h-[220px] p-4 sm:p-5"
      aria-label={nameAr || name}
    >
      {hasDirectSale && <DirectSaleRibbon />}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-accent/8 opacity-0 group-hover:opacity-100 transition-opacity duration-400" />

      <div className="relative z-10 flex flex-col items-center h-full">
        {/* Icon / Badge */}
        <div
          className="w-16 h-16 sm:w-18 sm:h-18 lg:w-20 lg:h-20 rounded-2xl mb-3 flex items-center justify-center text-primary-foreground shrink-0 group-hover:scale-110 transition-transform duration-400 overflow-hidden"
          style={{
            background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))",
            boxShadow: "0 8px 20px hsl(var(--primary) / 0.20)",
          }}
          aria-hidden="true"
        >
          <span
            className={
              isLongIcon
                ? "text-[10px] sm:text-[11px] font-extrabold leading-tight text-center px-1 line-clamp-2 break-all"
                : "text-2xl sm:text-3xl font-bold leading-none"
            }
          >
            {iconText}
          </span>
        </div>

        {/* Title */}
        <div className="w-full min-h-[40px] sm:min-h-[44px] flex items-start justify-center px-0.5 overflow-hidden">
          <h3 className="font-bold text-[13px] sm:text-[14px] lg:text-[15px] text-foreground group-hover:text-primary transition-colors duration-300 text-center leading-snug line-clamp-2 break-words w-full">
            {nameAr}
          </h3>
        </div>

        {/* Description */}
        <div className="w-full flex-1 flex items-start justify-center px-0.5 overflow-hidden">
          {descriptionAr ? (
            <p className="text-[10px] sm:text-[11px] lg:text-xs font-medium text-foreground/60 text-center leading-relaxed line-clamp-2 break-words w-full">
              {descriptionAr}
            </p>
          ) : (
            <p className="text-[10px] text-foreground/0 select-none">{description || "_"}</p>
          )}
        </div>
      </div>
    </Link>
  );
};

export default memo(CategoryCard);
