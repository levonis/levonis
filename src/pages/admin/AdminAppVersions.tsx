import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload, Trash2, Star, StarOff, Loader2, Smartphone, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';

const AdminAppVersions = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [version, setVersion] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const { data: versions = [], isLoading } = useQuery({
    queryKey: ['admin-app-versions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_versions')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  if (!authLoading && !isAdmin) return <Navigate to="/" replace />;

  const handleUpload = async () => {
    if (!file || !version.trim()) {
      toast({ title: 'الإصدار وملف APK مطلوبان', variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      const safeVersion = version.replace(/[^0-9a-zA-Z.\-_]/g, '_');
      const fileName = `levonis-v${safeVersion}-${Date.now()}.apk`;

      const { error: uploadError } = await supabase.storage
        .from('app-releases')
        .upload(fileName, file, {
          contentType: 'application/vnd.android.package-archive',
          upsert: false,
        });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('app-releases')
        .getPublicUrl(fileName);

      const { error: insertError } = await supabase.from('app_versions').insert({
        version: version.trim(),
        platform: 'android',
        download_url: urlData.publicUrl,
        file_size_mb: Math.round((file.size / (1024 * 1024)) * 10) / 10,
        release_notes_ar: notes.trim() || null,
        is_latest: true,
        is_active: true,
      });
      if (insertError) throw insertError;

      toast({ title: 'تم نشر الإصدار بنجاح ✓' });
      setVersion('');
      setNotes('');
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ['admin-app-versions'] });
      queryClient.invalidateQueries({ queryKey: ['latest-app-version', 'android'] });
    } catch (e: any) {
      toast({ title: 'خطأ في الرفع', description: e.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const setLatest = async (id: string) => {
    const { error } = await supabase
      .from('app_versions')
      .update({ is_latest: true })
      .eq('id', id);
    if (error) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'تم تعيينه كأحدث إصدار' });
      queryClient.invalidateQueries({ queryKey: ['admin-app-versions'] });
      queryClient.invalidateQueries({ queryKey: ['latest-app-version', 'android'] });
    }
  };

  const remove = async (id: string, url: string) => {
    if (!confirm('هل تريد حذف هذا الإصدار نهائياً؟')) return;
    try {
      const path = url.split('/app-releases/')[1];
      if (path) await supabase.storage.from('app-releases').remove([path]);
      await supabase.from('app_versions').delete().eq('id', id);
      toast({ title: 'تم الحذف' });
      queryClient.invalidateQueries({ queryKey: ['admin-app-versions'] });
      queryClient.invalidateQueries({ queryKey: ['latest-app-version', 'android'] });
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Smartphone className="h-7 w-7 text-primary" />
          إدارة إصدارات التطبيق
        </h1>
        <p className="text-muted-foreground mt-2">رفع وإدارة ملفات APK الخاصة بالتطبيق</p>
      </div>

      {/* Upload form */}
      <Card className="p-6 mb-8">
        <h2 className="font-bold mb-4 flex items-center gap-2">
          <Upload className="h-5 w-5" />
          رفع إصدار جديد
        </h2>
        <div className="space-y-4">
          <div>
            <Label>رقم الإصدار (مثال: 1.0.0)</Label>
            <Input
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="1.0.0"
              dir="ltr"
            />
          </div>
          <div>
            <Label>ملاحظات التحديث (اختياري)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ما الجديد في هذا الإصدار..."
              rows={3}
            />
          </div>
          <div>
            <Label>ملف APK</Label>
            <Input
              type="file"
              accept=".apk,application/vnd.android.package-archive"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && (
              <p className="text-xs text-muted-foreground mt-1">
                {file.name} — {(file.size / (1024 * 1024)).toFixed(1)} MB
              </p>
            )}
          </div>
          <Button
            onClick={handleUpload}
            disabled={uploading || !file || !version.trim()}
            className="w-full"
          >
            {uploading ? (
              <><Loader2 className="ml-2 h-4 w-4 animate-spin" /> جاري الرفع...</>
            ) : (
              <><Upload className="ml-2 h-4 w-4" /> نشر الإصدار</>
            )}
          </Button>
        </div>
      </Card>

      {/* Versions list */}
      <Card className="p-6">
        <h2 className="font-bold mb-4">الإصدارات المنشورة</h2>
        {isLoading ? (
          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
        ) : versions.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">لا توجد إصدارات بعد</p>
        ) : (
          <div className="space-y-3">
            {versions.map((v) => (
              <div key={v.id} className="flex items-center gap-3 p-4 border rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold">v{v.version}</span>
                    <Badge variant="outline">{v.platform}</Badge>
                    {v.is_latest && <Badge className="bg-primary">أحدث</Badge>}
                    {v.file_size_mb && (
                      <Badge variant="secondary">{v.file_size_mb} MB</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(v.created_at).toLocaleString('ar-IQ')}
                  </p>
                  {v.release_notes_ar && (
                    <p className="text-sm mt-2 text-muted-foreground line-clamp-2">
                      {v.release_notes_ar}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" asChild title="تنزيل">
                    <a href={v.download_url} target="_blank" rel="noreferrer">
                      <Download className="h-4 w-4" />
                    </a>
                  </Button>
                  {!v.is_latest && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setLatest(v.id)}
                      title="تعيين كأحدث"
                    >
                      <Star className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => remove(v.id, v.download_url)}
                    title="حذف"
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default AdminAppVersions;
