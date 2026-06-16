import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useStlFiles, useStlCategories } from '@/hooks/useStlFiles';
import { useStlLibraryAccess } from '@/hooks/useStlLibraryAccess';
import StlFileCard from '@/components/stl/StlFileCard';
import StlAccessGate from '@/components/stl/StlAccessGate';
import { useLanguage } from '@/lib/i18n';
import SEO from '@/components/SEO';

export default function StlLibrary() {
  const { language } = useLanguage();
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [sort, setSort] = useState<'newest' | 'most_downloaded'>('newest');
  const { data: cats } = useStlCategories();
  const { data: files, isLoading } = useStlFiles({ search, categoryId, sort });
  const access = useStlLibraryAccess();

  return (
    <main className="container mx-auto px-4 py-6 max-w-6xl space-y-4">
      <SEO
        title="مكتبة ملفات الطباعة 3D — STL / OBJ / 3MF"
        description="تصفح وحمّل ملفات STL و OBJ و 3MF جاهزة للطباعة ثلاثية الأبعاد من مجتمع تجار LEVONIS في العراق."
        url="https://levonisiq.com/community/stl-library"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'مكتبة ملفات الطباعة 3D',
          description: 'مجموعة ملفات STL/OBJ/3MF للطباعة ثلاثية الأبعاد على LEVONIS.',
          url: 'https://levonisiq.com/community/stl-library',
          isPartOf: { '@type': 'WebSite', name: 'LEVONIS', url: 'https://levonisiq.com' },
        }}
      />
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black">مكتبة ملفات الطباعة 3D</h1>
          <p className="text-xs text-muted-foreground">تصفح ملفات STL/OBJ/3MF وشاركها مع تجار ليفو</p>
        </div>
        {access.isEligible && (
          <Button asChild size="sm" className="gap-1">
            <Link to="/community/stl-library/upload"><Plus className="h-4 w-4" />رفع ملف</Link>
          </Button>
        )}
      </header>

      {!access.isEligible && <StlAccessGate />}

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث عن ملف، علامة، فئة..."
          className="pr-10 h-10"
        />
      </div>

      {access.isEligible && access.dailyLimit !== null && (
        <div className="text-[11px] text-muted-foreground bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
          المتبقي اليوم: <span className="font-bold text-primary">{access.remaining}</span> من {access.dailyLimit} حسب بطاقتك
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <button
          onClick={() => setCategoryId(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border ${categoryId === null ? 'bg-primary text-primary-foreground border-primary' : 'border-border'}`}
        >
          الكل
        </button>
        {cats?.map((c: any) => {
          const name = (language === 'en' ? c.name_en : language === 'ku' ? c.name_ku : c.name_ar) || c.name_ar;
          return (
            <button
              key={c.id}
              onClick={() => setCategoryId(c.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border ${categoryId === c.id ? 'bg-primary text-primary-foreground border-primary' : 'border-border'}`}
            >
              {name}
            </button>
          );
        })}
      </div>

      <div className="flex justify-end gap-2 text-xs">
        <button
          onClick={() => setSort('newest')}
          className={`px-2 py-1 rounded-md ${sort === 'newest' ? 'bg-primary/10 text-primary font-bold' : 'text-muted-foreground'}`}
        >الأحدث</button>
        <button
          onClick={() => setSort('most_downloaded')}
          className={`px-2 py-1 rounded-md ${sort === 'most_downloaded' ? 'bg-primary/10 text-primary font-bold' : 'text-muted-foreground'}`}
        >الأكثر تحميلاً</button>
      </div>

      {isLoading ? (
        <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : !files?.length ? (
        <div className="py-12 text-center text-sm text-muted-foreground">لا توجد ملفات مطابقة</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {files.map((f) => <StlFileCard key={f.id} file={f} />)}
        </div>
      )}
    </main>
  );
}
