import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useStlLibraryAccess } from '@/hooks/useStlLibraryAccess';
import { useStlCategories } from '@/hooks/useStlFiles';
import StlAccessGate from '@/components/stl/StlAccessGate';
import { toast } from 'sonner';

export default function StlLibraryUpload() {
  const { user } = useAuth();
  const access = useStlLibraryAccess();
  const navigate = useNavigate();
  const { data: cats } = useStlCategories();

  const [titleAr, setTitleAr] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [descAr, setDescAr] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [tags, setTags] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [downloadFile, setDownloadFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  if (!access.isLoading && !access.isEligible) {
    return <main className="container mx-auto px-4 py-6 max-w-2xl"><StlAccessGate /></main>;
  }

  async function uploadTo(bucket: string, file: File): Promise<string> {
    const ext = file.name.split('.').pop();
    const path = `${user!.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });
    if (error) throw error;
    return path;
  }

  async function publicUrl(bucket: string, path: string) {
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !titleAr || !downloadFile) {
      toast.error('املأ العنوان واختر ملف التحميل');
      return;
    }
    setBusy(true); setProgress(5);
    try {
      let cover: string | null = null;
      let preview: string | null = null;

      if (coverFile) {
        const p = await uploadTo('stl-previews', coverFile);
        cover = await publicUrl('stl-previews', p);
        setProgress(25);
      }
      if (previewFile) {
        const p = await uploadTo('stl-previews', previewFile);
        preview = await publicUrl('stl-previews', p);
        setProgress(45);
      }
      const dlPath = await uploadTo('stl-files', downloadFile);
      setProgress(85);

      const tagArr = tags.split(',').map((t) => t.trim()).filter(Boolean);
      const ext = downloadFile.name.split('.').pop()?.toLowerCase() || null;

      const { error } = await supabase.from('stl_files').insert({
        uploader_id: user.id,
        category_id: categoryId || null,
        status: 'pending',
        title_ar: titleAr,
        title_en: titleEn || null,
        description_ar: descAr || null,
        cover_image_url: cover,
        model_preview_url: preview,
        video_url: videoUrl || null,
        download_file_path: dlPath,
        file_size_bytes: downloadFile.size,
        file_format: ext,
        tags: tagArr,
        price_type: 'free',
        price_points: 0,
      });
      if (error) throw error;
      setProgress(100);
      toast.success('تم رفع الملف، بانتظار موافقة الأدمن');
      navigate('/community/stl-library');
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'فشل الرفع');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="container mx-auto px-4 py-6 max-w-2xl">
      <h1 className="text-xl font-black mb-4">رفع ملف STL جديد</h1>
      <form onSubmit={handleSubmit} className="glass-panel p-4 rounded-2xl border border-border space-y-3">
        <div>
          <Label>العنوان (عربي) *</Label>
          <Input value={titleAr} onChange={(e) => setTitleAr(e.target.value)} required />
        </div>
        <div>
          <Label>Title (English)</Label>
          <Input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} />
        </div>
        <div>
          <Label>الوصف</Label>
          <Textarea value={descAr} onChange={(e) => setDescAr(e.target.value)} rows={3} />
        </div>
        <div>
          <Label>الفئة</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger><SelectValue placeholder="اختر فئة" /></SelectTrigger>
            <SelectContent>
              {cats?.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>{c.name_ar}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>العلامات (مفصولة بفواصل)</Label>
          <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="ديكور, لعبة, شخصية" />
        </div>
        <div>
          <Label>رابط فيديو (اختياري — YouTube/Vimeo)</Label>
          <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://..." />
        </div>
        <div>
          <Label>صورة الغلاف</Label>
          <Input type="file" accept="image/*" onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)} />
        </div>
        <div>
          <Label>ملف معاينة 3D (STL/OBJ/GLB صغير للعرض)</Label>
          <Input type="file" accept=".stl,.obj,.glb,.gltf,.3mf" onChange={(e) => setPreviewFile(e.target.files?.[0] ?? null)} />
        </div>
        <div>
          <Label>ملف التحميل الفعلي * (أي صيغة حتى 10GB)</Label>
          <Input type="file" onChange={(e) => setDownloadFile(e.target.files?.[0] ?? null)} required />
        </div>
        {busy && (
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
        <Button type="submit" disabled={busy} className="w-full gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          رفع الملف
        </Button>
      </form>
    </main>
  );
}
