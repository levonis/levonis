import { useEffect, useState, Suspense, lazy } from 'react';
import ImageWithLoader from '@/components/ui/ImageWithLoader';

import { useParams, Link } from 'react-router-dom';
import { Download, ArrowRight, Loader2, FileBox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStlFile } from '@/hooks/useStlFiles';
import { useStlDownload } from '@/hooks/useStlDownload';
import { useStlLibraryAccess } from '@/hooks/useStlLibraryAccess';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/lib/i18n';
import StlAccessGate from '@/components/stl/StlAccessGate';
import SEO from '@/components/SEO';

const Model3DViewer = lazy(() => import('@/components/community/viewer/Model3DViewer'));

export default function StlFileDetails() {
  const { id } = useParams<{ id: string }>();
  const { language } = useLanguage();
  const { data: file, isLoading } = useStlFile(id);
  const download = useStlDownload();
  const access = useStlLibraryAccess();
  const [activeImg, setActiveImg] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    // view counter (best-effort, non-blocking)
    (async () => {
      try {
        const { data } = await supabase.from('stl_files').select('views_count').eq('id', id).single();
        await supabase.from('stl_files').update({ views_count: (data?.views_count ?? 0) + 1 }).eq('id', id);
      } catch (_) { /* ignore */ }
    })();
  }, [id]);

  if (isLoading) return <div className="py-20 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!file) return <div className="py-20 text-center text-muted-foreground">الملف غير موجود</div>;

  const title = (language === 'en' ? file.title_en : language === 'ku' ? file.title_ku : file.title_ar) || file.title_ar;
  const desc = (language === 'en' ? file.description_en : language === 'ku' ? file.description_ku : file.description_ar) || file.description_ar;
  const gallery = [file.cover_image_url, ...(file.gallery_images || [])].filter(Boolean) as string[];
  const cover = activeImg || gallery[0];

  const pageUrl = `https://levonisiq.com/community/stl-library/${file.id}`;
  const metaDesc = (desc || `ملف ${file.file_format?.toUpperCase() || '3D'} جاهز للطباعة من مكتبة LEVONIS.`).slice(0, 155);

  return (
    <main className="container mx-auto px-4 py-6 max-w-4xl space-y-5">
      <SEO
        title={`${title} — ملف طباعة 3D`}
        description={metaDesc}
        url={pageUrl}
        image={cover || undefined}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'CreativeWork',
          name: title,
          description: metaDesc,
          image: gallery,
          url: pageUrl,
          encodingFormat: file.file_format || undefined,
          creator: { '@type': 'Organization', name: 'LEVONIS' },
        }}
      />
      <Button asChild variant="ghost" size="sm" className="gap-1">
        <Link to="/community/stl-library"><ArrowRight className="h-4 w-4" /> العودة للمكتبة</Link>
      </Button>

      <div className="grid md:grid-cols-2 gap-5">
        <div className="space-y-2">
          <div className="aspect-square rounded-2xl overflow-hidden bg-muted">
            {cover ? (
              <ImageWithLoader
                src={cover}
                alt={title}
                width={800}
                priority
                containerClassName="w-full h-full"
                className="w-full h-full object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground"><FileBox className="h-16 w-16" /></div>
            )}
          </div>
          {gallery.length > 1 && (
            <div className="grid grid-cols-5 gap-2">
              {gallery.map((g, i) => (
                <button key={i} onClick={() => setActiveImg(g)}
                  className={`aspect-square rounded-lg overflow-hidden border-2 ${cover === g ? 'border-primary' : 'border-transparent'}`}>
                  <ImageWithLoader
                    src={g}
                    alt=""
                    width={200}
                    containerClassName="w-full h-full"
                    className="w-full h-full object-cover"
                    sizes="20vw"
                  />
                </button>
              ))}
            </div>
          )}
        </div>


        <div className="space-y-3">
          <h1 className="text-xl font-black">{title}</h1>
          {desc && <p className="text-sm text-muted-foreground whitespace-pre-line">{desc}</p>}
          <div className="flex flex-wrap gap-1">
            {(file.tags ?? []).map((t) => (
              <span key={t} className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">#{t}</span>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 rounded-lg border border-border">
              <span className="block text-muted-foreground">الصيغة</span>
              <span className="font-bold uppercase">{file.file_format || '—'}</span>
            </div>
            <div className="p-2 rounded-lg border border-border">
              <span className="block text-muted-foreground">الحجم</span>
              <span className="font-bold">{file.file_size_bytes ? `${(file.file_size_bytes / 1024 / 1024).toFixed(1)} MB` : '—'}</span>
            </div>
            <div className="p-2 rounded-lg border border-border">
              <span className="block text-muted-foreground">التحميلات</span>
              <span className="font-bold">{file.downloads_count}</span>
            </div>
            <div className="p-2 rounded-lg border border-border">
              <span className="block text-muted-foreground">السعر</span>
              <span className="font-bold">{file.price_type === 'paid' ? `${file.price_points} نقطة` : file.price_type === 'daily_limit' ? 'حسب بطاقتك' : 'مجاني'}</span>
            </div>
          </div>

          {!access.isEligible ? (
            <StlAccessGate />
          ) : (
            <>
              {access.dailyLimit !== null && (
                <div className="text-[11px] text-muted-foreground bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
                  المتبقي اليوم: <span className="font-bold text-primary">{access.remaining}</span> من {access.dailyLimit}
                </div>
              )}
              <Button
                size="lg"
                className="w-full gap-2"
                disabled={download.isPending || (access.remaining !== null && access.remaining <= 0)}
                onClick={() => download.mutate(file.id)}
              >
                {download.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                تحميل الملف
              </Button>
            </>
          )}
        </div>
      </div>

      {file.video_url && (
        <section className="space-y-2">
          <h2 className="font-bold text-sm">فيديو توضيحي</h2>
          {/youtu\.?be/.test(file.video_url) ? (
            <div className="aspect-video rounded-xl overflow-hidden">
              <iframe
                src={file.video_url.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')}
                className="w-full h-full" allowFullScreen
              />
            </div>
          ) : (
            <video controls src={file.video_url} className="w-full rounded-xl" />
          )}
        </section>
      )}

      {file.model_preview_url && (
        <section className="space-y-2">
          <h2 className="font-bold text-sm">معاينة 3D</h2>
          <div className="rounded-xl overflow-hidden border border-border" style={{ height: 360 }}>
            <Suspense fallback={<div className="h-full flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
              <Model3DViewer url={file.model_preview_url} language={language as any} />
            </Suspense>
          </div>
        </section>
      )}
    </main>
  );
}
