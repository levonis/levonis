import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil, Trash2, Megaphone, Image, Save, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import AdminLayout, { AdminSection, AdminCard, AdminCardContent, AdminLoading, AdminEmptyState } from '@/components/admin/AdminLayout';
import { ADMIN_ROUTES } from '@/config/adminConfig';
import IslandPromoPreview from '@/components/admin/IslandPromoPreview';

interface AnnouncementSettings {
  id?: string;
  speed: number;
  direction: 'left' | 'right';
  gap: number;
  color: string;
  auto_rotate: boolean;
  display_duration: number;
  always_move: boolean;
}

const DEFAULT_SETTINGS: AnnouncementSettings = {
  speed: 20,
  direction: 'right',
  gap: 16,
  color: '#3b82f6',
  auto_rotate: true,
  display_duration: 5,
  always_move: false,
};

const AdminAnnouncements = () => {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [textForm, setTextForm] = useState({
    message_ar: '',
    message: '',
    active: true,
  });
  const [settings, setSettings] = useState<AnnouncementSettings>(DEFAULT_SETTINGS);
  const [settingsDirty, setSettingsDirty] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate('/');
      toast.error('ليس لديك صلاحية الوصول');
    }
  }, [user, isAdmin, authLoading, navigate]);

  /* ---------------- Texts ---------------- */
  const { data: announcements, isLoading } = useQuery({
    queryKey: ['announcements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!isAdmin,
  });

  /* ---------------- Settings (singleton) ---------------- */
  const { data: settingsRow } = useQuery({
    queryKey: ['announcement-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcement_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!isAdmin,
  });

  useEffect(() => {
    if (settingsRow) {
      setSettings({
        id: (settingsRow as any).id,
        speed: (settingsRow as any).speed ?? DEFAULT_SETTINGS.speed,
        direction: ((settingsRow as any).direction === 'left' ? 'left' : 'right'),
        gap: (settingsRow as any).gap ?? DEFAULT_SETTINGS.gap,
        color: (settingsRow as any).color ?? DEFAULT_SETTINGS.color,
        auto_rotate: (settingsRow as any).auto_rotate ?? DEFAULT_SETTINGS.auto_rotate,
        display_duration: (settingsRow as any).display_duration ?? DEFAULT_SETTINGS.display_duration,
        always_move: (settingsRow as any).always_move ?? DEFAULT_SETTINGS.always_move,
      });
      setSettingsDirty(false);
    }
  }, [settingsRow]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['announcements'] });
    queryClient.invalidateQueries({ queryKey: ['active-announcements'] });
    queryClient.invalidateQueries({ queryKey: ['island-announcements'] });
  };

  const saveSettings = useMutation({
    mutationFn: async (values: AnnouncementSettings) => {
      const payload = {
        speed: values.speed,
        direction: values.direction,
        gap: values.gap,
        color: values.color,
        auto_rotate: values.auto_rotate,
        display_duration: values.display_duration,
        always_move: values.always_move,
      };
      if (values.id) {
        const { error } = await supabase
          .from('announcement_settings')
          .update(payload)
          .eq('id', values.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('announcement_settings')
          .insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcement-settings'] });
      queryClient.invalidateQueries({ queryKey: ['island-settings'] });
      toast.success('تم حفظ الإعدادات');
      setSettingsDirty(false);
    },
    onError: (e) => {
      console.error(e);
      toast.error('تعذّر حفظ الإعدادات');
    },
  });

  const createAnnouncement = useMutation({
    mutationFn: async (values: typeof textForm) => {
      const { error } = await supabase.from('announcements').insert([values]);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success('تم إضافة النص بنجاح');
      setDialogOpen(false);
      resetTextForm();
    },
    onError: (e) => {
      console.error(e);
      toast.error('حدث خطأ أثناء إضافة النص');
    },
  });

  const updateAnnouncement = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: typeof textForm }) => {
      const { error } = await supabase.from('announcements').update(values).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success('تم تحديث النص بنجاح');
      setDialogOpen(false);
      setEditing(null);
      resetTextForm();
    },
    onError: (e) => {
      console.error(e);
      toast.error('حدث خطأ أثناء تحديث النص');
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from('announcements').update({ active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(),
  });

  const deleteAnnouncement = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success('تم حذف النص بنجاح');
    },
    onError: (e) => {
      console.error(e);
      toast.error('حدث خطأ أثناء الحذف');
    },
  });

  const handleSubmitText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textForm.message_ar.trim()) {
      toast.error('يجب إدخال نص الإعلان بالعربي');
      return;
    }
    if (editing) {
      updateAnnouncement.mutate({ id: editing.id, values: textForm });
    } else {
      createAnnouncement.mutate(textForm);
    }
  };

  const handleEdit = (announcement: any) => {
    setEditing(announcement);
    setTextForm({
      message_ar: announcement.message_ar || '',
      message: announcement.message || '',
      active: announcement.active ?? true,
    });
    setDialogOpen(true);
  };

  const resetTextForm = () => {
    setTextForm({ message_ar: '', message: '', active: true });
    setEditing(null);
  };

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) resetTextForm();
  };

  const updateSetting = <K extends keyof AnnouncementSettings>(key: K, value: AnnouncementSettings[K]) => {
    setSettings((s) => ({ ...s, [key]: value }));
    setSettingsDirty(true);
  };

  const activeMessages = (announcements || [])
    .filter((a: any) => a.active)
    .map((a: any) => a.message_ar || a.message)
    .filter(Boolean) as string[];

  if (authLoading || isLoading) {
    return <AdminLoading />;
  }

  return (
    <AdminLayout
      title="إدارة الشريط الإخباري"
      description="نصوص الإعلانات تُدار بشكل مستقل، أما السرعة والاتجاه والمسافة فهي إعدادات عامة تُطبَّق على جميع النصوص"
      icon={<Megaphone className="h-5 w-5" />}
      actions={
        <div className="flex items-center gap-2">
          <Link to={ADMIN_ROUTES.banners}>
            <Button variant="outline">
              <Image className="ml-2 h-4 w-4" />
              البانرات الإعلانية
            </Button>
          </Link>
          <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
            <DialogTrigger asChild>
              <Button className="admin-btn-primary">
                <Plus className="ml-2 h-4 w-4" />
                إضافة نص
              </Button>
            </DialogTrigger>
            <DialogContent className="admin-dialog max-w-lg !max-h-[90vh] !overflow-hidden flex flex-col p-0">
              <DialogHeader className="p-6 pb-2 shrink-0">
                <DialogTitle>{editing ? 'تعديل النص' : 'إضافة نص جديد'}</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={handleSubmitText}
                className="space-y-4 overflow-y-auto overscroll-contain flex-1 px-6 pb-6 touch-pan-y"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                <div className="admin-form-group">
                  <Label htmlFor="message_ar">نص الإعلان (عربي)</Label>
                  <Input
                    id="message_ar"
                    value={textForm.message_ar}
                    onChange={(e) => setTextForm({ ...textForm, message_ar: e.target.value })}
                    placeholder="مثال: عرض خاص - خصم 20% على جميع المنتجات"
                    required
                  />
                </div>
                <div className="admin-form-group">
                  <Label htmlFor="message">نص الإعلان (إنجليزي - اختياري)</Label>
                  <Input
                    id="message"
                    value={textForm.message}
                    onChange={(e) => setTextForm({ ...textForm, message: e.target.value })}
                    placeholder="Special offer - 20% off all products"
                  />
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <div className="space-y-0.5">
                    <Label htmlFor="active" className="text-base">تفعيل النص</Label>
                    <p className="text-xs text-muted-foreground">عرضه ضمن الشريط الإخباري</p>
                  </div>
                  <Switch
                    id="active"
                    checked={textForm.active}
                    onCheckedChange={(checked) => setTextForm({ ...textForm, active: checked })}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full admin-btn-primary"
                  disabled={createAnnouncement.isPending || updateAnnouncement.isPending}
                >
                  {editing ? 'تحديث' : 'إضافة'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      }
    >
      {/* ---------------- Global Settings Card ---------------- */}
      <AdminSection>
        <AdminCard hover={false}>
          <AdminCardContent>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="text-base font-semibold">الإعدادات العامة للحركة</h3>
                  <p className="text-xs text-muted-foreground">تُطبَّق على جميع النصوص</p>
                </div>
              </div>
              <Button
                onClick={() => saveSettings.mutate(settings)}
                disabled={!settingsDirty || saveSettings.isPending}
                className="admin-btn-primary"
              >
                <Save className="ml-2 h-4 w-4" />
                حفظ الإعدادات
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="admin-form-group">
                <Label htmlFor="color">لون الشريط</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    id="color"
                    type="color"
                    value={settings.color}
                    onChange={(e) => updateSetting('color', e.target.value)}
                    className="w-20 h-10"
                  />
                  <Input
                    type="text"
                    value={settings.color}
                    onChange={(e) => updateSetting('color', e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="admin-form-group">
                <Label htmlFor="direction">اتجاه الحركة</Label>
                <Select
                  value={settings.direction}
                  onValueChange={(value) => updateSetting('direction', value as 'left' | 'right')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="right">يمين ← يسار</SelectItem>
                    <SelectItem value="left">يسار → يمين</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="admin-form-group">
                <Label htmlFor="speed">سرعة الحركة (ثانية)</Label>
                <Input
                  id="speed"
                  type="number"
                  min={4}
                  max={120}
                  value={settings.speed}
                  onChange={(e) => updateSetting('speed', parseInt(e.target.value) || DEFAULT_SETTINGS.speed)}
                />
              </div>

              <div className="admin-form-group">
                <Label htmlFor="gap">المسافة بين التكرارات (px)</Label>
                <Input
                  id="gap"
                  type="number"
                  min={4}
                  max={64}
                  value={settings.gap}
                  onChange={(e) => updateSetting('gap', parseInt(e.target.value) || DEFAULT_SETTINGS.gap)}
                />
              </div>

            </div>

            <div className="space-y-3 pt-4 mt-4 border-t border-border/50">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="always_move" className="text-base">إبقاء الشريط ظاهراً دائماً</Label>
                  <p className="text-xs text-muted-foreground">
                    عند التفعيل يبقى الشريط ظاهراً ومتحركاً حتى بعد التمرير للأسفل
                  </p>
                </div>
                <Switch
                  id="always_move"
                  checked={settings.always_move}
                  onCheckedChange={(v) => updateSetting('always_move', v)}
                />
              </div>
            </div>

            {/* Live Preview */}
            <div className="space-y-2 pt-4 mt-4 border-t border-border/50">
              <Label>معاينة مباشرة داخل الجزيرة</Label>
              <div className="flex justify-center py-4 rounded-md bg-gradient-to-b from-background to-muted/30">
                <IslandPromoPreview
                  messages={activeMessages.length > 0 ? activeMessages : ['نص الإعلان']}
                  color={settings.color}
                  speed={settings.speed}
                  direction={settings.direction}
                  gap={settings.gap}
                  autoRotate={settings.auto_rotate}
                  displayDuration={settings.display_duration}
                />
              </div>
            </div>
          </AdminCardContent>
        </AdminCard>
      </AdminSection>

      {/* ---------------- Texts Table ---------------- */}
      <AdminSection>
        <AdminCard hover={false}>
          <AdminCardContent noPadding>
            {!announcements || announcements.length === 0 ? (
              <AdminEmptyState
                icon={<Megaphone className="h-12 w-12" />}
                title="لا توجد نصوص"
                description="قم بإضافة نص جديد ليظهر في الشريط الإخباري"
              />
            ) : (
              <div className="admin-table-container">
                <Table>
                  <TableHeader>
                    <TableRow className="admin-table-header">
                      <TableHead>نص الإعلان</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {announcements.map((announcement: any) => (
                      <TableRow key={announcement.id} className="admin-table-row">
                        <TableCell className="font-medium max-w-md truncate">
                          {announcement.message_ar}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={announcement.active}
                            onCheckedChange={(checked) =>
                              toggleActive.mutate({ id: announcement.id, active: checked })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => handleEdit(announcement)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => {
                                if (confirm('هل أنت متأكد من حذف هذا النص؟')) {
                                  deleteAnnouncement.mutate(announcement.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </AdminCardContent>
        </AdminCard>
      </AdminSection>
    </AdminLayout>
  );
};

export default AdminAnnouncements;
