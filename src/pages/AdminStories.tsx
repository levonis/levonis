import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, GripVertical, Film, ArrowRight, Upload, Loader2, X, Eye, EyeOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function AdminStories() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [sectionDialog, setSectionDialog] = useState(false);
  const [videoDialog, setVideoDialog] = useState(false);
  const [editingSection, setEditingSection] = useState<any>(null);
  const [editingVideo, setEditingVideo] = useState<any>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Form states
  const [sectionForm, setSectionForm] = useState({ title_ar: '', thumbnail_url: '', display_order: 0, is_active: true });
  const [videoForm, setVideoForm] = useState({ video_url: '', duration_seconds: 0, display_order: 0, is_active: true });

  const { data: sections = [], isLoading } = useQuery({
    queryKey: ['admin-story-sections'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('story_sections')
        .select('*')
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: videos = [] } = useQuery({
    queryKey: ['admin-story-videos', selectedSectionId],
    queryFn: async () => {
      if (!selectedSectionId) return [];
      const { data, error } = await supabase
        .from('story_videos')
        .select('*')
        .eq('section_id', selectedSectionId)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedSectionId,
  });

  const saveSectionMutation = useMutation({
    mutationFn: async (values: typeof sectionForm & { id?: string }) => {
      const { id, ...rest } = values;
      if (id) {
        const { error } = await supabase.from('story_sections').update({ ...rest, updated_at: new Date().toISOString() }).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('story_sections').insert([rest]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-story-sections'] });
      queryClient.invalidateQueries({ queryKey: ['story-sections-with-videos'] });
      toast.success('تم حفظ القسم بنجاح');
      setSectionDialog(false);
      setEditingSection(null);
    },
    onError: () => toast.error('حدث خطأ أثناء حفظ القسم'),
  });

  const deleteSectionMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('story_sections').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-story-sections'] });
      queryClient.invalidateQueries({ queryKey: ['story-sections-with-videos'] });
      toast.success('تم حذف القسم');
      if (selectedSectionId) setSelectedSectionId(null);
    },
  });

  const saveVideoMutation = useMutation({
    mutationFn: async (values: typeof videoForm & { id?: string; section_id: string }) => {
      const { id, ...rest } = values;
      if (id) {
        const { error } = await supabase.from('story_videos').update({ ...rest, updated_at: new Date().toISOString() }).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('story_videos').insert([rest]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-story-videos'] });
      queryClient.invalidateQueries({ queryKey: ['story-sections-with-videos'] });
      toast.success('تم حفظ الفيديو بنجاح');
      setVideoDialog(false);
      setEditingVideo(null);
    },
    onError: () => toast.error('حدث خطأ أثناء حفظ الفيديو'),
  });

  const deleteVideoMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('story_videos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-story-videos'] });
      queryClient.invalidateQueries({ queryKey: ['story-sections-with-videos'] });
      toast.success('تم حذف الفيديو');
    },
  });

  const handleUploadThumbnail = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `story-thumbnails/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('banners').upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('banners').getPublicUrl(path);
      setSectionForm((p) => ({ ...p, thumbnail_url: urlData.publicUrl }));
      toast.success('تم رفع الصورة');
    } catch {
      toast.error('خطأ في رفع الصورة');
    }
    setUploading(false);
  };

  const handleUploadVideo = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `story-videos/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('banners').upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('banners').getPublicUrl(path);
      setVideoForm((p) => ({ ...p, video_url: urlData.publicUrl }));
      toast.success('تم رفع الفيديو');
    } catch {
      toast.error('خطأ في رفع الفيديو');
    }
    setUploading(false);
  };

  const openEditSection = (section: any) => {
    setEditingSection(section);
    setSectionForm({
      title_ar: section.title_ar,
      thumbnail_url: section.thumbnail_url || '',
      display_order: section.display_order,
      is_active: section.is_active,
    });
    setSectionDialog(true);
  };

  const openNewSection = () => {
    setEditingSection(null);
    setSectionForm({ title_ar: '', thumbnail_url: '', display_order: sections.length, is_active: true });
    setSectionDialog(true);
  };

  const openEditVideo = (video: any) => {
    setEditingVideo(video);
    setVideoForm({
      video_url: video.video_url,
      duration_seconds: video.duration_seconds || 0,
      display_order: video.display_order,
      is_active: video.is_active,
    });
    setVideoDialog(true);
  };

  const openNewVideo = () => {
    setEditingVideo(null);
    setVideoForm({ video_url: '', duration_seconds: 0, display_order: videos.length, is_active: true });
    setVideoDialog(true);
  };

  const selectedSection = sections.find((s) => s.id === selectedSectionId);

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowRight className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-foreground">إدارة الستوريات</h1>
              <p className="text-sm text-muted-foreground">أقسام وفيديوهات الصفحة الرئيسية</p>
            </div>
          </div>
          <Button onClick={openNewSection} size="sm">
            <Plus className="h-4 w-4 ml-1" /> قسم جديد
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Sections list */}
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground mb-2">الأقسام ({sections.length})</h2>
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" /></div>
            ) : sections.length === 0 ? (
              <Card className="border-dashed"><CardContent className="py-8 text-center text-muted-foreground text-sm">لا توجد أقسام بعد</CardContent></Card>
            ) : (
              sections.map((s) => (
                <Card
                  key={s.id}
                  className={`cursor-pointer transition-colors ${selectedSectionId === s.id ? 'border-primary bg-primary/5' : 'hover:border-primary/30'}`}
                  onClick={() => setSelectedSectionId(s.id)}
                >
                  <CardContent className="p-3 flex items-center gap-3">
                    <GripVertical className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-muted flex-shrink-0 border border-border">
                      {s.thumbnail_url ? (
                        <img src={s.thumbnail_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm font-bold">{s.title_ar.charAt(0)}</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{s.title_ar}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant={s.is_active ? 'default' : 'secondary'} className="text-[10px] h-4">
                          {s.is_active ? 'نشط' : 'متوقف'}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">ترتيب: {s.display_order}</span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openEditSection(s); }}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); if (confirm('حذف هذا القسم وجميع فيديوهاته؟')) deleteSectionMutation.mutate(s.id); }}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Videos panel */}
          <div className="md:col-span-2">
            {selectedSectionId ? (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">فيديوهات: {selectedSection?.title_ar}</CardTitle>
                    <Button onClick={openNewVideo} size="sm" variant="outline">
                      <Plus className="h-3 w-3 ml-1" /> إضافة فيديو
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {videos.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground">
                      <Film className="h-10 w-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">لا توجد فيديوهات في هذا القسم</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {videos.map((v) => (
                        <div key={v.id} className="relative group rounded-xl overflow-hidden bg-muted aspect-[9/16]">
                          <video src={v.video_url} className="w-full h-full object-cover" muted preload="metadata" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <Button variant="ghost" size="icon" className="h-8 w-8 bg-white/20 text-white" onClick={() => openEditVideo(v)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 bg-white/20 text-white" onClick={() => { if (confirm('حذف هذا الفيديو؟')) deleteVideoMutation.mutate(v.id); }}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between">
                            <Badge variant={v.is_active ? 'default' : 'secondary'} className="text-[9px] h-4">
                              {v.is_active ? <Eye className="h-2.5 w-2.5" /> : <EyeOff className="h-2.5 w-2.5" />}
                            </Badge>
                            <span className="text-[9px] text-white bg-black/50 px-1 rounded">#{v.display_order}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="border-dashed">
                <CardContent className="py-16 text-center text-muted-foreground">
                  <Film className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">اختر قسمًا لعرض فيديوهاته</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Section Dialog */}
      <Dialog open={sectionDialog} onOpenChange={setSectionDialog}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSection ? 'تعديل القسم' : 'قسم جديد'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>الاسم</Label>
              <Input value={sectionForm.title_ar} onChange={(e) => setSectionForm((p) => ({ ...p, title_ar: e.target.value }))} placeholder="مثلاً: عروض اليوم" />
            </div>
            <div>
              <Label>صورة الغلاف</Label>
              <div className="flex gap-2 items-center mt-1">
                {sectionForm.thumbnail_url && (
                  <div className="w-12 h-12 rounded-full overflow-hidden border border-border">
                    <img src={sectionForm.thumbnail_url} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                <Input value={sectionForm.thumbnail_url} onChange={(e) => setSectionForm((p) => ({ ...p, thumbnail_url: e.target.value }))} placeholder="رابط الصورة" className="flex-1" />
                <label className="cursor-pointer">
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleUploadThumbnail(e.target.files[0]); }} />
                  <div className="h-10 w-10 rounded-md border border-input flex items-center justify-center hover:bg-accent">
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  </div>
                </label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>الترتيب</Label>
                <Input type="number" value={sectionForm.display_order} onChange={(e) => setSectionForm((p) => ({ ...p, display_order: Number(e.target.value) }))} />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch checked={sectionForm.is_active} onCheckedChange={(v) => setSectionForm((p) => ({ ...p, is_active: v }))} />
                <Label>نشط</Label>
              </div>
            </div>
            <Button
              className="w-full"
              disabled={!sectionForm.title_ar || saveSectionMutation.isPending}
              onClick={() => saveSectionMutation.mutate({ ...sectionForm, id: editingSection?.id })}
            >
              {saveSectionMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : null}
              حفظ
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Video Dialog */}
      <Dialog open={videoDialog} onOpenChange={setVideoDialog}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingVideo ? 'تعديل الفيديو' : 'إضافة فيديو'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>رابط الفيديو</Label>
              <div className="flex gap-2 mt-1">
                <Input value={videoForm.video_url} onChange={(e) => setVideoForm((p) => ({ ...p, video_url: e.target.value }))} placeholder="رابط الفيديو" className="flex-1" />
                <label className="cursor-pointer">
                  <input type="file" accept="video/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleUploadVideo(e.target.files[0]); }} />
                  <div className="h-10 w-10 rounded-md border border-input flex items-center justify-center hover:bg-accent">
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  </div>
                </label>
              </div>
            </div>
            {videoForm.video_url && (
              <div className="aspect-[9/16] max-h-48 rounded-lg overflow-hidden bg-muted">
                <video src={videoForm.video_url} className="w-full h-full object-contain" controls muted />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>الترتيب</Label>
                <Input type="number" value={videoForm.display_order} onChange={(e) => setVideoForm((p) => ({ ...p, display_order: Number(e.target.value) }))} />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch checked={videoForm.is_active} onCheckedChange={(v) => setVideoForm((p) => ({ ...p, is_active: v }))} />
                <Label>نشط</Label>
              </div>
            </div>
            <Button
              className="w-full"
              disabled={!videoForm.video_url || !selectedSectionId || saveVideoMutation.isPending}
              onClick={() => saveVideoMutation.mutate({ ...videoForm, section_id: selectedSectionId!, id: editingVideo?.id })}
            >
              {saveVideoMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : null}
              حفظ
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
