import { Link } from 'react-router-dom';
import { Download, Eye, FileBox } from 'lucide-react';
import type { StlFile } from '@/hooks/useStlFiles';
import { useLanguage } from '@/lib/i18n';

export default function StlFileCard({ file }: { file: StlFile }) {
  const { language } = useLanguage();
  const title = (language === 'en' ? file.title_en : language === 'ku' ? file.title_ku : file.title_ar)
    || file.title_ar;
  const priceLabel = file.price_type === 'paid'
    ? `${file.price_points} نقطة`
    : file.price_type === 'daily_limit'
      ? 'حسب حد البطاقة'
      : 'مجاني';

  return (
    <Link
      to={`/community/stl-library/${file.id}`}
      className="group glass-panel rounded-2xl overflow-hidden border border-border/40 hover:border-primary/40 transition-all"
    >
      <div className="aspect-square bg-muted relative overflow-hidden">
        {file.cover_image_url ? (
          <img
            src={file.cover_image_url}
            alt={title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <FileBox className="h-12 w-12" />
          </div>
        )}
        <span className="absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/90 text-primary-foreground">
          {priceLabel}
        </span>
      </div>
      <div className="p-3 space-y-1">
        <h3 className="text-sm font-bold line-clamp-1">{title}</h3>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><Download className="h-3 w-3" />{file.downloads_count}</span>
          <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{file.views_count}</span>
          {file.file_format && <span className="uppercase">{file.file_format}</span>}
        </div>
      </div>
    </Link>
  );
}
