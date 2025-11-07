import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Loader2, Plus, Pencil, Trash2, Megaphone } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

const AdminAnnouncements = () => {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [formData, setFormData] = useState({
    message_ar: '',
    message: '',
    type: 'info',
    active: true,
    color: '#3b82f6',
    speed: 20,
    direction: 'right',
    auto_rotate: true,
    display_duration: 5,
    always_move: false,
    gap: 16,
  });

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate('/');
      toast.error('ليس لديك صلاحية الوصول');
    }
  }, [user, isAdmin, authLoading, navigate]);

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

  const createAnnouncement = useMutation({
    mutationFn: async (values: any) => {
      const { error } = await supabase
        .from('announcements')
        .insert([values]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      queryClient.invalidateQueries({ queryKey: ['active-announcements'] });
      toast.success('تم إضافة الإعلان بنجاح');
      setDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error('حدث خطأ أثناء إضافة الإعلان');
      console.error(error);
    },
  });

  const updateAnnouncement = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: any }) => {
      const { error } = await supabase
        .from('announcements')
        .update(values)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      queryClient.invalidateQueries({ queryKey: ['active-announcements'] });
      toast.success('تم تحديث الإعلان بنجاح');
      setDialogOpen(false);
      setEditing(null);
      resetForm();
    },
    onError: (error) => {
      toast.error('حدث خطأ أثناء تحديث الإعلان');
      console.error(error);
    },
  });

  const deleteAnnouncement = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      queryClient.invalidateQueries({ queryKey: ['active-announcements'] });
      toast.success('تم حذف الإعلان بنجاح');
    },
    onError: (error) => {
      toast.error('حدث خطأ أثناء حذف الإعلان');
      console.error(error);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.message_ar.trim()) {
      toast.error('يجب إدخال نص الإعلان بالعربي');
      return;
    }

    if (editing) {
      updateAnnouncement.mutate({ id: editing.id, values: formData });
    } else {
      createAnnouncement.mutate(formData);
    }
  };

  const handleEdit = (announcement: any) => {
    setEditing(announcement);
    setFormData({
      message_ar: announcement.message_ar,
      message: announcement.message || '',
      type: announcement.type,
      active: announcement.active,
      color: announcement.color || '#3b82f6',
      speed: announcement.speed || 20,
      direction: announcement.direction || 'right',
      auto_rotate: announcement.auto_rotate ?? true,
      display_duration: announcement.display_duration || 5,
      always_move: announcement.always_move ?? false,
      gap: announcement.gap || 16,
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      message_ar: '',
      message: '',
      type: 'info',
      active: true,
      color: '#3b82f6',
      speed: 20,
      direction: 'right',
      auto_rotate: true,
      display_duration: 5,
      always_move: false,
      gap: 16,
    });
    setEditing(null);
  };

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      resetForm();
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background/95 backdrop-blur-sm pt-24">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background/95 backdrop-blur-sm pt-24">
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-black text-primary mb-2 flex items-center gap-3">
              <Megaphone className="h-8 w-8" />
              إدارة الشريط الإخباري
            </h1>
            <p className="text-muted-foreground">إدارة الإعلانات المتحركة في أعلى الموقع</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90">
                <Plus className="ml-2 h-4 w-4" />
                إضافة إعلان
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editing ? 'تعديل الإعلان' : 'إضافة إعلان جديد'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="message_ar">نص الإعلان (عربي)</Label>
                  <Input
                    id="message_ar"
                    value={formData.message_ar}
                    onChange={(e) => setFormData({ ...formData, message_ar: e.target.value })}
                    placeholder="مثال: عرض خاص - خصم 20% على جميع المنتجات"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">نص الإعلان (إنجليزي - اختياري)</Label>
                  <Input
                    id="message"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Special offer - 20% off all products"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="color">لون الشريط</Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      id="color"
                      type="color"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="w-20 h-10"
                    />
                    <Input
                      type="text"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      placeholder="#3b82f6"
                      className="flex-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="speed">سرعة الحركة (ثانية)</Label>
                    <Input
                      id="speed"
                      type="number"
                      min="5"
                      max="60"
                      value={formData.speed}
                      onChange={(e) => setFormData({ ...formData, speed: parseInt(e.target.value) })}
                    />
                    <p className="text-xs text-muted-foreground">من 5 إلى 60 ثانية</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="direction">اتجاه الحركة</Label>
                    <Select value={formData.direction} onValueChange={(value) => setFormData({ ...formData, direction: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="right">يمين ← يسار</SelectItem>
                        <SelectItem value="left">يسار → يمين</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gap">المسافة بين التكرارات (gap)</Label>
                  <Input
                    id="gap"
                    type="number"
                    min="4"
                    max="64"
                    value={formData.gap}
                    onChange={(e) => setFormData({ ...formData, gap: parseInt(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground">المسافة بين كل تكرار والآخر (من 4 إلى 64)</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="display_duration">مدة عرض الإعلان (ثانية)</Label>
                  <Input
                    id="display_duration"
                    type="number"
                    min="3"
                    max="30"
                    value={formData.display_duration}
                    onChange={(e) => setFormData({ ...formData, display_duration: parseInt(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground">
                    مدة عرض هذا الإعلان قبل الانتقال للإعلان التالي (من 3 إلى 30 ثانية)
                  </p>
                </div>

                <div className="space-y-3 pt-2 border-t border-border/50">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="active" className="text-base">تفعيل الإعلان</Label>
                      <p className="text-xs text-muted-foreground">عرض هذا الإعلان في الموقع</p>
                    </div>
                    <Switch
                      id="active"
                      checked={formData.active}
                      onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="auto_rotate" className="text-base">التقلب التلقائي</Label>
                      <p className="text-xs text-muted-foreground">
                        الانتقال تلقائياً للإعلان التالي (عند وجود أكثر من إعلان)
                      </p>
                    </div>
                    <Switch
                      id="auto_rotate"
                      checked={formData.auto_rotate}
                      onCheckedChange={(checked) => setFormData({ ...formData, auto_rotate: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="always_move" className="text-base">تحريك دائم</Label>
                      <p className="text-xs text-muted-foreground">
                        الحركة المستمرة للنص بدون توقف
                      </p>
                    </div>
                    <Switch
                      id="always_move"
                      checked={formData.always_move}
                      onCheckedChange={(checked) => setFormData({ ...formData, always_move: checked })}
                    />
                  </div>
                </div>

                {/* Preview */}
                <div className="space-y-2 pt-4 border-t border-border/50">
                  <Label>معاينة الإعلان</Label>
                  <div 
                    className="text-white py-2 px-4 rounded-md overflow-hidden"
                    style={{ backgroundColor: formData.color }}
                  >
                    {formData.always_move ? (
                      <div className="relative">
                        <div
                          className="flex whitespace-nowrap w-max"
                          style={{
                            animation: `marquee-${formData.direction} ${formData.speed}s linear infinite`,
                          }}
                        >
                          <div className={`flex flex-shrink-0 items-center gap-${formData.gap}`}>
                            <span className="inline-block">{formData.message_ar || 'نص الإعلان'}</span>
                            <span className="inline-block opacity-60">•</span>
                            <span className="inline-block">{formData.message_ar || 'نص الإعلان'}</span>
                            <span className="inline-block opacity-60">•</span>
                            <span className="inline-block">{formData.message_ar || 'نص الإعلان'}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center">
                        <span>{formData.message_ar || 'نص الإعلان'}</span>
                      </div>
                    )}
                  </div>
                  <style>{`
                    @keyframes marquee-left {
                      0% { transform: translateX(0%); }
                      100% { transform: translateX(-50%); }
                    }
                    @keyframes marquee-right {
                      0% { transform: translateX(-50%); }
                      100% { transform: translateX(0%); }
                    }
                  `}</style>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90"
                  disabled={createAnnouncement.isPending || updateAnnouncement.isPending}
                >
                  {(createAnnouncement.isPending || updateAnnouncement.isPending) && (
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  )}
                  {editing ? 'تحديث' : 'إضافة'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="glass-effect border-border/50">
          <CardHeader>
            <CardTitle>الإعلانات الحالية</CardTitle>
            <CardDescription>جميع الإعلانات المتحركة في الموقع</CardDescription>
          </CardHeader>
          <CardContent>
            {!announcements || announcements.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">لا توجد إعلانات بعد</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>نص الإعلان</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead className="text-left">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {announcements.map((announcement) => (
                    <TableRow key={announcement.id}>
                      <TableCell className="font-medium">{announcement.message_ar}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            announcement.type === 'success'
                              ? 'default'
                              : announcement.type === 'warning'
                              ? 'secondary'
                              : announcement.type === 'error'
                              ? 'destructive'
                              : 'outline'
                          }
                        >
                          {announcement.type === 'info' && 'معلومات'}
                          {announcement.type === 'success' && 'نجاح'}
                          {announcement.type === 'warning' && 'تحذير'}
                          {announcement.type === 'error' && 'تنبيه'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={announcement.active ? 'default' : 'secondary'}>
                          {announcement.active ? 'فعال' : 'غير فعال'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-left">
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(announcement)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (confirm('هل أنت متأكد من حذف هذا الإعلان؟')) {
                                deleteAnnouncement.mutate(announcement.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AdminAnnouncements;