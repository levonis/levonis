import { memo } from "react";
import { Link } from "react-router-dom";

interface CategoryCardProps {
  name: string;
  nameAr: string;
  slug: string;
  icon: string;
  description?: string;
  descriptionAr?: string;
}

const CategoryCard = ({ name, nameAr, slug, icon, description, descriptionAr }: CategoryCardProps) => {
  const iconText = (icon ?? "").trim();
  const isLongIcon = iconText.length > 3;

  return (
    <Link
      to={`/category/${slug}`}
      className="group block bg-card/92 backdrop-blur-sm rounded-xl border border-border/45 hover:border-primary/65 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg relative overflow-hidden h-[160px] sm:h-[172px] p-3 sm:p-4"
      aria-label={nameAr || name}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="relative z-10 flex flex-col items-center h-full">
        {/* Icon / Badge */}
        <div
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg mb-2 flex items-center justify-center text-primary-foreground shrink-0 group-hover:scale-105 transition-transform duration-300 overflow-hidden"
          style={{
            background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))",
            boxShadow: "0 4px 10px hsl(var(--primary) / 0.18)",
          }}
          aria-hidden="true"
        >
          <span
            className={
              isLongIcon
                ? "text-[7px] sm:text-[8px] font-bold leading-tight text-center px-0.5 line-clamp-2 break-all"
                : "text-sm sm:text-base leading-none"
            }
          >
            {iconText}
          </span>
        </div>

        {/* Title */}
        <div className="w-full min-h-[36px] sm:min-h-[40px] flex items-start justify-center px-0.5 overflow-hidden">
          <h3 className="font-bold text-[12px] sm:text-[13px] text-foreground group-hover:text-primary transition-colors duration-200 text-center leading-snug line-clamp-2 break-words w-full">
            {nameAr}
          </h3>
        </div>

        {/* Description */}
        <div className="w-full flex-1 flex items-start justify-center px-0.5 overflow-hidden">
          {descriptionAr ? (
            <p className="text-[10px] sm:text-[11px] font-medium text-foreground/75 text-center leading-relaxed line-clamp-2 break-words w-full">
              {descriptionAr}
            </p>
          ) : (
            <p className="text-[10px] sm:text-[11px] text-foreground/0 select-none">{description || "_"}</p>
          )}
        </div>
      </div>
    </Link>
  );
};

export default memo(CategoryCard);
