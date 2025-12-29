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
      className="group block bg-card/92 backdrop-blur-sm rounded-2xl border border-border/45 hover:border-primary/65 transition-all duration-300 hover:scale-[1.015] hover:shadow-lg relative overflow-hidden h-[236px] sm:h-[228px] p-4 sm:p-5"
      aria-label={nameAr || name}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/12 via-transparent to-accent/12 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="relative z-10 flex flex-col items-center h-full">
        {/* Icon / Badge */}
        <div
          className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl mb-3 flex items-center justify-center text-primary-foreground shrink-0 group-hover:scale-105 transition-transform duration-300 overflow-hidden"
          style={{
            background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))",
            boxShadow: "0 10px 22px hsl(var(--primary) / 0.20)",
          }}
          aria-hidden="true"
        >
          <span
            className={
              isLongIcon
                ? "text-[11px] sm:text-xs font-bold leading-tight text-center px-1 line-clamp-2 break-words"
                : "text-2xl sm:text-[28px] leading-none"
            }
          >
            {iconText}
          </span>
        </div>

        {/* Title */}
        <div className="w-full min-h-[52px] sm:min-h-[56px] flex items-start justify-center px-1 overflow-hidden">
          <h3 className="font-extrabold text-[14px] sm:text-sm text-foreground group-hover:text-primary transition-colors duration-200 text-center leading-snug line-clamp-2 break-words w-full">
            {nameAr}
          </h3>
        </div>

        {/* Description */}
        <div className="w-full min-h-[64px] sm:min-h-[66px] flex items-start justify-center px-1 overflow-hidden">
          {descriptionAr ? (
            <p className="text-[12px] sm:text-xs font-medium text-foreground/80 text-center leading-relaxed line-clamp-3 break-words w-full">
              {descriptionAr}
            </p>
          ) : (
            // Invisible placeholder keeps all cards same height
            <p className="text-[12px] sm:text-xs text-foreground/0 select-none">{description || "_"}</p>
          )}
        </div>
      </div>
    </Link>
  );
};

export default memo(CategoryCard);
