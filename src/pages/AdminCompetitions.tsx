import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ArrowRight, Plus, Trophy, Users, Ticket, Calendar, Gift, Loader2, Trash2, Play, Crown, Upload, X, Eye, RotateCcw, ImagePlus, Settings, Save } from "lucide-react";
import { toast } from "sonner";
import { format, addHours } from "date-fns";
import { ar } from "date-fns/locale";

// Helper function to format date in Baghdad timezone (UTC+3)
const formatBaghdadTime = (dateString: string, formatStr: string = 'dd MMM yyyy - hh:mm a') => {
  const date = new Date(dateString);
  // Baghdad is UTC+3
  const baghdadDate = addHours(date, 3);
  return format(baghdadDate, formatStr, { locale: ar });
};

// Helper function to convert Baghdad local time to UTC for storage
const baghdadToUTC = (localDateString: string): string => {
  if (!localDateString) return '';
  // Input is in Baghdad local time, we need to subtract 3 hours to get UTC
  const localDate = new Date(localDateString);
  const utcDate = addHours(localDate, -3);
  return utcDate.toISOString();
};

// Helper function to convert UTC to Baghdad local time for form display
const utcToBaghdadLocal = (utcDateString: string | null): string => {
  if (!utcDateString) return '';
  const utcDate = new Date(utcDateString);
  const baghdadDate = addHours(utcDate, 3);
  // Format for datetime-local input
  return format(baghdadDate, "yyyy-MM-dd'T'HH:mm");
};
import CelebrationEffect from "@/components/CelebrationEffect";
import CompetitionParticipantsDialog from "@/components/CompetitionParticipantsDialog";

type CompetitionType = 'ticket_count' | 'all_tickets_sold' | 'timed' | 'free';
type CompetitionStatus = 'draft' | 'active' | 'completed' | 'cancelled';

interface Competition {
  id: string;
  title: string;
  title_ar: string;
  description: string | null;
  description_ar: string | null;
  image_url: string | null;
  images: string[] | null;
  prize_description: string;
  prize_description_ar: string;
  prize_value: number | null;
  ticket_price: number;
  max_tickets: number | null;
  target_participants: number | null;
  start_date: string;
  end_date: string | null;
  draw_date: string | null;
  competition_type: CompetitionType;
  status: CompetitionStatus;
  winner_user_id: string | null;
  currency: string;
  created_at: string;
  required_tickets?: number;
}

const competitionTypeLabels: Record<CompetitionType, string> = {
  ticket_count: 'عند وصول المشاركين لعدد معين',
  all_tickets_sold: 'عند بيع جميع التذاكر',
  timed: 'مسابقة بوقت محدد',
  free: 'مسابقة مجانية'
};

const statusLabels: Record<CompetitionStatus, string> = {
  draft: 'مسودة',
  active: 'نشطة',
  completed: 'مكتملة',
  cancelled: 'ملغاة'
};

const statusColors: Record<CompetitionStatus, string> = {
  draft: 'bg-gray-500',
  active: 'bg-green-500',
  completed: 'bg-blue-500',
  cancelled: 'bg-red-500'
};

export default function AdminCompetitions() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCompetition, setEditingCompetition] = useState<Competition | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [winnerInfo, setWinnerInfo] = useState<{ name: string; ticket: string } | null>(null);
  const [participantsDialogOpen, setParticipantsDialogOpen] = useState(false);
  const [selectedCompetitionForParticipants, setSelectedCompetitionForParticipants] = useState<Competition | null>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    title_ar: '',
    description: '',
    description_ar: '',
    image_url: '',
    images: [] as string[],
    prize_description: '',
    prize_description_ar: '',
    prize_value: '',
    ticket_price: '0',
    max_tickets: '',
    target_participants: '',
    start_date: '',
    end_date: '',
    draw_date: '',
    max_tickets_per_user: '',
    terms_conditions: '',
    required_tickets: '1',
    winners_count: '1',
    competition_type: 'ticket_count' as CompetitionType,
    status: 'draft' as CompetitionStatus
  });

  const { data: competitions, isLoading, refetch: refetchCompetitions } = useQuery({
    queryKey: ['admin-competitions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('competitions')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Competition[];
    },
    staleTime: 0
  });

  const { data: ticketCounts } = useQuery({
    queryKey: ['competition-ticket-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('competition_tickets')
        .select('competition_id');
      
      if (error) throw error;
      
      const counts: Record<string, number> = {};
      data?.forEach(ticket => {
        counts[ticket.competition_id] = (counts[ticket.competition_id] || 0) + 1;
      });
      return counts;
    }
  });

  const { data: ticketSettings, refetch: refetchTicketSettings } = useQuery({
    queryKey: ['ticket-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('default_settings')
        .select('*')
        .eq('setting_key', 'ticket_price')
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data?.setting_value as { price: number } || { price: 250 };
    }
  });

  const [ticketPriceInput, setTicketPriceInput] = useState<string>('');

  const updateTicketPriceMutation = useMutation({
    mutationFn: async (newPrice: number) => {
      const { data: existing } = await supabase
        .from('default_settings')
        .select('id')
        .eq('setting_key', 'ticket_price')
        .single();

      if (existing) {
        const { error } = await supabase
          .from('default_settings')
          .update({ setting_value: { price: newPrice } })
          .eq('setting_key', 'ticket_price');
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('default_settings')
          .insert({ setting_key: 'ticket_price', setting_value: { price: newPrice } });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      refetchTicketSettings();
      toast.success('تم تحديث سعر التذكرة بنجاح');
    },
    onError: (error) => {
      toast.error('خطأ في التحديث: ' + error.message);
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        title: data.title,
        title_ar: data.title_ar,
        description: data.description || null,
        description_ar: data.description_ar || null,
        image_url: data.images.length > 0 ? data.images[0] : (data.image_url || null),
        images: data.images.length > 0 ? data.images : (data.image_url ? [data.image_url] : []),
        prize_description: data.prize_description,
        prize_description_ar: data.prize_description_ar,
        prize_value: data.prize_value ? parseFloat(data.prize_value) : null,
        max_tickets: data.max_tickets ? parseInt(data.max_tickets) : null,
        target_participants: data.target_participants ? parseInt(data.target_participants) : null,
        start_date: data.start_date ? baghdadToUTC(data.start_date) : new Date().toISOString(),
        end_date: data.end_date ? baghdadToUTC(data.end_date) : null,
        draw_date: data.draw_date ? baghdadToUTC(data.draw_date) : null,
        competition_type: data.competition_type,
        status: data.status,
        required_tickets: parseInt(data.required_tickets) || 1,
        winners_count: parseInt(data.winners_count) || 1
      };

      if (editingCompetition) {
        const { error } = await supabase
          .from('competitions')
          .update(payload)
          .eq('id', editingCompetition.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('competitions')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-competitions'] });
      await refetchCompetitions();
      toast.success(editingCompetition ? 'تم تحديث المسابقة' : 'تم إنشاء المسابقة');
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error('حدث خطأ: ' + error.message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('competitions')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-competitions'] });
      toast.success('تم حذف المسابقة');
    }
  });

  const drawWinnerMutation = useMutation({
    mutationFn: async (competitionId: string) => {
      const { data, error } = await supabase.rpc('draw_competition_winner', {
        comp_id: competitionId
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['admin-competitions'] });
      if (data.success) {
        setWinnerInfo({ name: data.winner_name, ticket: data.winner_ticket_number });
        setShowCelebration(true);
      } else {
        toast.error(data.error);
      }
    }
  });

  const reDrawMutation = useMutation({
    mutationFn: async (competitionId: string) => {
      // Reset competition status and winner
      const { error: resetError } = await supabase
        .from('competitions')
        .update({ 
          status: 'active',
          winner_user_id: null,
          winner_ticket_id: null
        })
        .eq('id', competitionId);
      
      if (resetError) throw resetError;

      // Reset all tickets to not winner
      const { error: ticketError } = await supabase
        .from('competition_tickets')
        .update({ is_winner: false })
        .eq('competition_id', competitionId);
      
      if (ticketError) throw ticketError;

      // Draw new winner
      const { data, error } = await supabase.rpc('draw_competition_winner', {
        comp_id: competitionId
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['admin-competitions'] });
      if (data.success) {
        setWinnerInfo({ name: data.winner_name, ticket: data.winner_ticket_number });
        setShowCelebration(true);
        toast.success('تم إعادة السحب بنجاح');
      } else {
        toast.error(data.error);
      }
    },
    onError: (error) => {
      toast.error('خطأ في إعادة السحب: ' + error.message);
    }
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingImage(true);
    try {
      const uploadedUrls: string[] = [];
      
      for (const file of Array.from(files)) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `prizes/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('competition-images')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('competition-images')
          .getPublicUrl(filePath);

        uploadedUrls.push(publicUrl);
      }

      setFormData({ 
        ...formData, 
        images: [...formData.images, ...uploadedUrls],
        image_url: formData.images.length === 0 && uploadedUrls.length > 0 ? uploadedUrls[0] : formData.image_url
      });
      toast.success(`تم رفع ${uploadedUrls.length} صورة بنجاح`);
    } catch (error: any) {
      toast.error('خطأ في رفع الصور: ' + error.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const removeImage = (index: number) => {
    const newImages = formData.images.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      images: newImages,
      image_url: newImages.length > 0 ? newImages[0] : ''
    });
  };

  const resetForm = () => {
    setFormData({
      title: '',
      title_ar: '',
      description: '',
      description_ar: '',
      image_url: '',
      images: [],
      prize_description: '',
      prize_description_ar: '',
      prize_value: '',
      ticket_price: '0',
      max_tickets: '',
      target_participants: '',
      start_date: '',
      end_date: '',
      draw_date: '',
      max_tickets_per_user: '',
      terms_conditions: '',
      required_tickets: '1',
      winners_count: '1',
      competition_type: 'ticket_count',
      status: 'draft'
    });
    setEditingCompetition(null);
  };

  const handleEdit = (comp: Competition) => {
    setEditingCompetition(comp);
    setFormData({
      title: comp.title,
      title_ar: comp.title_ar,
      description: comp.description || '',
      description_ar: comp.description_ar || '',
      image_url: comp.image_url || '',
      images: comp.images || (comp.image_url ? [comp.image_url] : []),
      prize_description: comp.prize_description,
      prize_description_ar: comp.prize_description_ar,
      prize_value: comp.prize_value?.toString() || '',
      ticket_price: comp.ticket_price.toString(),
      max_tickets: comp.max_tickets?.toString() || '',
      target_participants: comp.target_participants?.toString() || '',
      start_date: utcToBaghdadLocal(comp.start_date),
      end_date: utcToBaghdadLocal(comp.end_date),
      draw_date: utcToBaghdadLocal(comp.draw_date),
      max_tickets_per_user: '',
      terms_conditions: '',
      required_tickets: (comp as any).required_tickets?.toString() || '1',
      winners_count: (comp as any).winners_count?.toString() || '1',
      competition_type: comp.competition_type,
      status: comp.status
    });
    setIsDialogOpen(true);
  };

  // Calculate statistics
  const totalParticipants = Object.values(ticketCounts || {}).reduce((sum, count) => sum + count, 0);
  const activeCompetitions = competitions?.filter(c => c.status === 'active').length || 0;
  const completedCompetitions = competitions?.filter(c => c.status === 'completed').length || 0;
  const totalWinners = competitions?.filter(c => c.status === 'completed' && c.winner_user_id).length || 0;

  return (
    <>
      <div className="min-h-screen bg-background" dir="rtl">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
                <ArrowRight className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <Trophy className="h-6 w-6 text-primary" />
                  إدارة المسابقات
                </h1>
                <p className="text-muted-foreground">إنشاء وإدارة المسابقات والسحوبات</p>
              </div>
            </div>

            <Button className="gap-2" onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              إنشاء مسابقة
            </Button>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
              <CardContent className="p-4 text-center">
                <Trophy className="h-6 w-6 mx-auto mb-1 text-primary" />
                <p className="text-xl font-bold">{competitions?.length || 0}</p>
                <p className="text-xs text-muted-foreground">إجمالي المسابقات</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5">
              <CardContent className="p-4 text-center">
                <Play className="h-6 w-6 mx-auto mb-1 text-green-600" />
                <p className="text-xl font-bold">{activeCompetitions}</p>
                <p className="text-xs text-muted-foreground">مسابقات نشطة</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5">
              <CardContent className="p-4 text-center">
                <Users className="h-6 w-6 mx-auto mb-1 text-blue-600" />
                <p className="text-xl font-bold">{totalParticipants}</p>
                <p className="text-xs text-muted-foreground">إجمالي المشاركات</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-500/5">
              <CardContent className="p-4 text-center">
                <Crown className="h-6 w-6 mx-auto mb-1 text-yellow-600" />
                <p className="text-xl font-bold">{totalWinners}</p>
                <p className="text-xs text-muted-foreground">فائزين</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5">
              <CardContent className="p-4 text-center">
                <Ticket className="h-6 w-6 mx-auto mb-1 text-purple-600" />
                <p className="text-xl font-bold">{ticketSettings?.price || 250}</p>
                <p className="text-xs text-muted-foreground">سعر التذكرة</p>
              </CardContent>
            </Card>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}>
            <DialogContent className="max-w-3xl h-[85vh] flex flex-col" onPointerDownOutside={(e) => e.preventDefault()}>
              <DialogHeader className="flex-shrink-0 pb-4 border-b">
                <DialogTitle className="text-xl">{editingCompetition ? 'تعديل المسابقة' : 'إنشاء مسابقة جديدة'}</DialogTitle>
              </DialogHeader>
              
              <div className="flex-1 overflow-y-auto grid gap-6 py-6 px-1">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>العنوان (عربي)</Label>
                    <Input
                      value={formData.title_ar}
                      onChange={(e) => setFormData({ ...formData, title_ar: e.target.value })}
                      placeholder="عنوان المسابقة"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>العنوان (إنجليزي)</Label>
                    <Input
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Competition Title"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>الوصف (عربي)</Label>
                    <Textarea
                      value={formData.description_ar}
                      onChange={(e) => setFormData({ ...formData, description_ar: e.target.value })}
                      placeholder="وصف المسابقة"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>الوصف (إنجليزي)</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Competition Description"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <ImagePlus className="h-4 w-4" />
                    صور المسابقة (يمكنك رفع عدة صور)
                  </Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageUpload}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        disabled={uploadingImage}
                      />
                      <Button type="button" variant="outline" className="w-full gap-2" disabled={uploadingImage}>
                        {uploadingImage ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            جاري الرفع...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4" />
                            اختر صور للرفع
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  {formData.images.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {formData.images.map((url, index) => (
                        <div key={index} className="relative w-24 h-24 group">
                          <img
                            src={url}
                            alt={`صورة ${index + 1}`}
                            className="w-full h-full object-cover rounded-lg border"
                          />
                          {index === 0 && (
                            <span className="absolute bottom-0 left-0 right-0 bg-primary/80 text-primary-foreground text-xs text-center py-0.5 rounded-b-lg">
                              الرئيسية
                            </span>
                          )}
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => removeImage(index)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {formData.images.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      لم يتم رفع أي صور بعد. الصورة الأولى ستكون الصورة الرئيسية.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>الجائزة (عربي)</Label>
                    <Input
                      value={formData.prize_description_ar}
                      onChange={(e) => setFormData({ ...formData, prize_description_ar: e.target.value })}
                      placeholder="وصف الجائزة"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>الجائزة (إنجليزي)</Label>
                    <Input
                      value={formData.prize_description}
                      onChange={(e) => setFormData({ ...formData, prize_description: e.target.value })}
                      placeholder="Prize Description"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>قيمة الجائزة (اختياري)</Label>
                    <Input
                      type="number"
                      value={formData.prize_value}
                      onChange={(e) => setFormData({ ...formData, prize_value: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>التذاكر المطلوبة للدخول</Label>
                    <Input
                      type="number"
                      min="1"
                      value={formData.required_tickets}
                      onChange={(e) => setFormData({ ...formData, required_tickets: e.target.value })}
                      placeholder="1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Crown className="h-4 w-4 text-primary" />
                      عدد الفائزين
                    </Label>
                    <Input
                      type="number"
                      min="1"
                      value={formData.winners_count}
                      onChange={(e) => setFormData({ ...formData, winners_count: e.target.value })}
                      placeholder="1"
                    />
                    <p className="text-xs text-muted-foreground">يمكن تحديد أكثر من فائز للجائزة نفسها</p>
                  </div>
                </div>

                {/* قسم التواريخ */}
                <div className="border rounded-lg p-4 bg-muted/30">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    التواريخ والمواعيد
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>تاريخ البداية</Label>
                      <Input
                        type="datetime-local"
                        value={formData.start_date}
                        onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>تاريخ الانتهاء</Label>
                      <Input
                        type="datetime-local"
                        value={formData.end_date}
                        onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>تاريخ السحب</Label>
                      <Input
                        type="datetime-local"
                        value={formData.draw_date}
                        onChange={(e) => setFormData({ ...formData, draw_date: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* قسم نوع المسابقة والحالة */}
                <div className="border rounded-lg p-4 bg-muted/30">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Trophy className="h-4 w-4" />
                    نوع المسابقة والإعدادات
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>نوع المسابقة</Label>
                      <Select
                        value={formData.competition_type}
                        onValueChange={(value: CompetitionType) => setFormData({ ...formData, competition_type: value })}
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="z-[100] bg-background border shadow-lg">
                          <SelectItem value="ticket_count">عند وصول المشاركين لعدد معين</SelectItem>
                          <SelectItem value="all_tickets_sold">عند بيع جميع التذاكر</SelectItem>
                          <SelectItem value="timed">مسابقة بوقت محدد</SelectItem>
                          <SelectItem value="free">مسابقة مجانية</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>حالة المسابقة</Label>
                      <Select
                        value={formData.status}
                        onValueChange={(value: CompetitionStatus) => setFormData({ ...formData, status: value })}
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="z-[100] bg-background border shadow-lg">
                          <SelectItem value="draft">مسودة</SelectItem>
                          <SelectItem value="active">نشطة</SelectItem>
                          <SelectItem value="completed">مكتملة</SelectItem>
                          <SelectItem value="cancelled">ملغاة</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* إعدادات عدد المشاركين - تظهر لجميع أنواع المسابقات */}
                <div className="border rounded-lg p-4 bg-muted/30">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    إعدادات المشاركين والحدود
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>الحد الأقصى للمشاركين</Label>
                      <Input
                        type="number"
                        value={formData.target_participants}
                        onChange={(e) => setFormData({ ...formData, target_participants: e.target.value })}
                        placeholder="بدون حد"
                      />
                      <p className="text-xs text-muted-foreground">اتركه فارغاً = بدون حد</p>
                    </div>
                    <div className="space-y-2">
                      <Label>الحد الأقصى للتذاكر</Label>
                      <Input
                        type="number"
                        value={formData.max_tickets}
                        onChange={(e) => setFormData({ ...formData, max_tickets: e.target.value })}
                        placeholder="بدون حد"
                      />
                      <p className="text-xs text-muted-foreground">اتركه فارغاً = بدون حد</p>
                    </div>
                    <div className="space-y-2">
                      <Label>الحد الأقصى لكل مستخدم</Label>
                      <Input
                        type="number"
                        value={formData.max_tickets_per_user}
                        onChange={(e) => setFormData({ ...formData, max_tickets_per_user: e.target.value })}
                        placeholder="0 = بلا حد"
                      />
                    </div>
                  </div>
                </div>

                {/* الشروط والأحكام */}
                <div className="space-y-2">
                  <Label>الشروط والأحكام (اختياري)</Label>
                  <Textarea
                    value={formData.terms_conditions}
                    onChange={(e) => setFormData({ ...formData, terms_conditions: e.target.value })}
                    placeholder="أدخل شروط وأحكام المسابقة..."
                    rows={3}
                  />
                </div>

              </div>

              <div className="flex-shrink-0 pt-4 border-t bg-background">
                <Button 
                  onClick={() => createMutation.mutate(formData)}
                  disabled={createMutation.isPending || !formData.title_ar || !formData.prize_description_ar}
                  className="w-full h-12 text-lg"
                >
                  {createMutation.isPending && <Loader2 className="h-5 w-5 animate-spin ml-2" />}
                  {editingCompetition ? 'تحديث المسابقة' : 'إنشاء المسابقة'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Ticket Price Settings */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              إعدادات التذاكر
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1 max-w-xs">
                <Label className="text-sm text-muted-foreground mb-1 block">سعر التذكرة الواحدة (دينار عراقي)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    placeholder={ticketSettings?.price?.toString() || '1000'}
                    defaultValue={ticketSettings?.price}
                    onChange={(e) => setTicketPriceInput(e.target.value)}
                    className="w-40"
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      const price = parseInt(ticketPriceInput) || ticketSettings?.price || 1000;
                      updateTicketPriceMutation.mutate(price);
                    }}
                    disabled={updateTicketPriceMutation.isPending}
                    className="gap-1"
                  >
                    {updateTicketPriceMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    حفظ
                  </Button>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                السعر الحالي: <span className="font-bold text-primary">{ticketSettings?.price?.toLocaleString() || 1000} دينار</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : competitions?.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Trophy className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">لا توجد مسابقات حتى الآن</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {competitions?.map((comp) => (
              <Card key={comp.id} className="overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    {comp.image_url && (
                      <img 
                        src={comp.image_url} 
                        alt={comp.title_ar}
                        className="w-24 h-24 object-cover rounded-lg"
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold">{comp.title_ar}</h3>
                        <Badge className={statusColors[comp.status]}>
                          {statusLabels[comp.status]}
                        </Badge>
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-3">{comp.description_ar}</p>
                      
                      <div className="flex flex-wrap gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Gift className="h-4 w-4 text-primary" />
                          <span>{comp.prize_description_ar}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Ticket className="h-4 w-4 text-primary" />
                          <span>{comp.required_tickets || 1} تذكرة للدخول</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4 text-primary" />
                          <span>{ticketCounts?.[comp.id] || 0} مشارك</span>
                          {(comp.max_tickets || comp.target_participants) && (
                            <span className="text-muted-foreground">/ {comp.max_tickets || comp.target_participants}</span>
                          )}
                          {!comp.max_tickets && !comp.target_participants && (
                            <span className="text-muted-foreground">(بدون حد)</span>
                          )}
                        </div>
                        {comp.end_date && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4 text-primary" />
                            <span>ينتهي: {formatBaghdadTime(comp.end_date, 'dd MMM yyyy - hh:mm a')}</span>
                          </div>
                        )}
                        {comp.draw_date && (
                          <div className="flex items-center gap-1">
                            <Trophy className="h-4 w-4 text-yellow-500" />
                            <span>السحب: {formatBaghdadTime(comp.draw_date, 'dd MMM yyyy - hh:mm a')}</span>
                          </div>
                        )}
                      </div>
                      
                      <p className="text-xs text-muted-foreground mt-2">
                        {competitionTypeLabels[comp.competition_type]}
                      </p>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(comp)}>
                        تعديل
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="gap-1"
                        onClick={() => {
                          setSelectedCompetitionForParticipants(comp);
                          setParticipantsDialogOpen(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                        المشاركين
                      </Button>
                      {comp.status === 'active' && (ticketCounts?.[comp.id] || 0) > 0 && (
                        <Button 
                          size="sm" 
                          className="gap-1"
                          onClick={() => drawWinnerMutation.mutate(comp.id)}
                          disabled={drawWinnerMutation.isPending}
                        >
                          <Crown className="h-4 w-4" />
                          سحب الفائز
                        </Button>
                      )}
                      {comp.status === 'completed' && comp.winner_user_id && (
                        <>
                          <Badge variant="outline" className="justify-center">
                            <Crown className="h-3 w-3 ml-1" />
                            تم السحب
                          </Badge>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="gap-1 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                            onClick={() => {
                              if (window.confirm('هل أنت متأكد من إعادة السحب؟ سيتم إلغاء الفائز الحالي واختيار فائز جديد.')) {
                                reDrawMutation.mutate(comp.id);
                              }
                            }}
                            disabled={reDrawMutation.isPending}
                          >
                            {reDrawMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RotateCcw className="h-4 w-4" />
                            )}
                            إعادة السحب
                          </Button>
                        </>
                      )}
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => deleteMutation.mutate(comp.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      
      <CelebrationEffect
        isActive={showCelebration}
        winnerName={winnerInfo?.name}
        ticketNumber={winnerInfo?.ticket}
        onComplete={() => {
          setShowCelebration(false);
          setWinnerInfo(null);
        }}
      />

      {selectedCompetitionForParticipants && (
        <CompetitionParticipantsDialog
          open={participantsDialogOpen}
          onOpenChange={setParticipantsDialogOpen}
          competitionId={selectedCompetitionForParticipants.id}
          competitionTitle={selectedCompetitionForParticipants.title_ar}
          requiredTickets={selectedCompetitionForParticipants.required_tickets || 1}
        />
      )}
    </>
  );
}
