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
import { ArrowRight, Plus, Trophy, Users, Ticket, Calendar, Gift, Loader2, Trash2, Play, Crown, Upload, X, Eye, RotateCcw, ImagePlus, Settings, Save, Sparkles } from "lucide-react";
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
import PrizeProductsSelector from "@/components/PrizeProductsSelector";
import ProductSearchSelect from "@/components/ProductSearchSelect";
import UserTicketsManager from "@/components/UserTicketsManager";

type CompetitionType = 'ticket_count' | 'all_tickets_sold' | 'timed' | 'free' | 'instant_winner' | 'everyone_wins' | 'escalating_price' | 'mystery_box' | 'hidden_winner' | 'team_battle' | 'flash_sale' | 'growing_prize' | 'collect_letters';
type CompetitionStatus = 'draft' | 'active' | 'completed' | 'cancelled';

interface PrizeTier {
  id: string;
  name_ar: string;
  probability: number;
  quantity: number;
  remaining: number;
  image_url?: string;
  value?: number;
}

interface PriceTier {
  min_sold: number;
  max_sold: number;
  price: number;
}

interface LetterConfig {
  letter: string;
  probability: number;
}

interface PrizeWord {
  word: string;
  prize_name: string;
  prize_value: number;
  stock?: number;
  product_id?: string;
}

interface GrowingPrizeConfig {
  base_prize: number;
  increment_per_interval: number;
  interval_minutes: number;
  decrease_mode?: boolean;
}

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
  free: 'مسابقة مجانية',
  instant_winner: '⚡ فائز فوري',
  everyone_wins: '🎁 الكل رابح',
  escalating_price: '📈 السعر المتصاعد',
  mystery_box: '📦 اختر صندوقك',
  hidden_winner: '🎯 الرابح المخفي',
  team_battle: '⚔️ فريق ضد فريق',
  flash_sale: '🔥 مسابقة سريعة',
  growing_prize: '📊 الجائزة المتحولة',
  collect_letters: '🔤 اجمع أحرف واربح'
};

const competitionTypeDescriptions: Record<CompetitionType, string> = {
  ticket_count: 'يتم السحب عند وصول عدد معين من المشاركين',
  all_tickets_sold: 'يتم السحب عند بيع جميع التذاكر المتاحة',
  timed: 'يتم السحب تلقائياً عند انتهاء الوقت',
  free: 'مسابقة مجانية بدون تذاكر',
  instant_winner: 'يعرف المشترك نتيجته فوراً عند الشراء مع نسبة احتمال محددة',
  everyone_wins: 'كل مشارك يفوز بجائزة حسب مستويات الجوائز والاحتمالات',
  escalating_price: 'السعر يرتفع تلقائياً كلما قل عدد التذاكر المتبقية',
  mystery_box: 'صناديق غامضة بجوائز مختلفة مع نسب احتمالات',
  hidden_winner: 'تذكرة واحدة رابحة مخفية تظهر عند رقم معين',
  team_battle: 'المستخدمون يُقسمون عشوائياً لفريقين ويتنافسون',
  flash_sale: 'مسابقة سريعة بتصميم مميز وعروض محدودة',
  growing_prize: 'الجائزة تكبر أو تقل مع مرور الوقت',
  collect_letters: 'اجمع أحرف معينة لتفوز بجوائز'
};

const competitionTypeColors: Record<CompetitionType, string> = {
  ticket_count: 'bg-blue-500',
  all_tickets_sold: 'bg-green-500',
  timed: 'bg-purple-500',
  free: 'bg-gray-500',
  instant_winner: 'bg-yellow-500',
  everyone_wins: 'bg-pink-500',
  escalating_price: 'bg-orange-500',
  mystery_box: 'bg-indigo-500',
  hidden_winner: 'bg-red-500',
  team_battle: 'bg-cyan-500',
  flash_sale: 'bg-rose-500',
  growing_prize: 'bg-emerald-500',
  collect_letters: 'bg-violet-500'
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
  const [ticketsManagerOpen, setTicketsManagerOpen] = useState(false);
  
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
    status: 'draft' as CompetitionStatus,
    // Fields for advanced competition types
    prize_tiers: [] as PrizeTier[],
    price_tiers: [] as PriceTier[],
    is_flash: false,
    flash_badge_text: '',
    theme_color: '#d4af37',
    remaining_prizes: '',
    instant_reveal: false,
    // New fields
    win_probability: '',
    hidden_winner_trigger_ticket: '',
    letters_config: [] as LetterConfig[],
    better_luck_probability: '0',
    prize_words: [] as PrizeWord[],
    growing_prize_config: {
      base_prize: 0,
      increment_per_interval: 0,
      interval_minutes: 60,
      decrease_mode: false
    } as GrowingPrizeConfig,
    // New options
    hide_participants: false,
    unlimited_winners: false,
    is_featured: false,
    prize_product_id: '' as string,
    prize_products: [] as { product_id: string; quantity: number }[],
    // Bag animation settings
    bags_per_reveal: 1 as number,
    allow_skip_animation: true as boolean
  });

  // Fetch products for prize selection
  const { data: products } = useQuery({
    queryKey: ['products-for-prizes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name_ar, image_url, price')
        .order('name_ar');
      if (error) throw error;
      return data;
    }
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
      // Build letters_config for collect_letters type
      const lettersConfig = data.competition_type === 'collect_letters' ? {
        target_word: data.prize_words.map(p => p.word).join('').split('').filter((v, i, a) => a.indexOf(v) === i).join(''),
        letter_probabilities: data.letters_config.reduce((acc, l) => {
          if (l.letter) acc[l.letter] = l.probability;
          return acc;
        }, {} as Record<string, number>),
        better_luck_probability: parseFloat(data.better_luck_probability) || 0,
        prize_words: data.prize_words.map(pw => ({
          word: pw.word,
          prize_name_ar: pw.prize_name,
          prize_value: pw.prize_value,
          stock: pw.stock || 999,
          product_id: pw.product_id || null
        }))
      } : null;

      const payload: Record<string, any> = {
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
        winners_count: data.unlimited_winners ? 9999 : (parseInt(data.winners_count) || 1),
        // New fields
        hide_participants: data.hide_participants,
        unlimited_winners: data.unlimited_winners,
        is_featured: data.is_featured,
        prize_product_id: data.prize_product_id || null,
        prize_products: data.prize_products.length > 0 ? data.prize_products : []
      };

      // Add type-specific fields
      if (data.competition_type === 'mystery_box' || data.competition_type === 'instant_winner' || data.competition_type === 'everyone_wins') {
        payload.prize_tiers = data.prize_tiers;
        // For mystery_box, prize_tiers are stored in mystery_boxes field
        if (data.competition_type === 'mystery_box') {
          payload.mystery_boxes = data.prize_tiers;
        }
      }

      if (data.competition_type === 'escalating_price') {
        payload.price_tiers = data.price_tiers;
      }

      if (data.competition_type === 'flash_sale') {
        payload.is_flash = data.is_flash;
        payload.flash_badge_text = data.flash_badge_text;
        payload.theme_color = data.theme_color;
      }

      if (data.competition_type === 'growing_prize') {
        payload.growing_prize_config = data.growing_prize_config;
      }

      if (data.competition_type === 'collect_letters') {
        payload.letters_config = lettersConfig;
      }

      if (data.competition_type === 'hidden_winner') {
        payload.hidden_winner_trigger_ticket = data.hidden_winner_trigger_ticket ? parseInt(data.hidden_winner_trigger_ticket) : null;
        payload.win_probability = data.win_probability ? parseFloat(data.win_probability) : null;
      }

      if (data.competition_type === 'instant_winner') {
        payload.instant_reveal = data.instant_reveal;
        payload.remaining_prizes = data.remaining_prizes ? parseInt(data.remaining_prizes) : null;
        payload.win_probability = data.win_probability ? parseFloat(data.win_probability) : null;
      }

      if (editingCompetition) {
        const { error } = await supabase
          .from('competitions')
          .update(payload as any)
          .eq('id', editingCompetition.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('competitions')
          .insert(payload as any);
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
      status: 'draft',
      prize_tiers: [],
      price_tiers: [],
      is_flash: false,
      flash_badge_text: '',
      theme_color: '#d4af37',
      remaining_prizes: '',
      instant_reveal: false,
      win_probability: '',
      hidden_winner_trigger_ticket: '',
      letters_config: [],
      better_luck_probability: '0',
      prize_words: [],
      growing_prize_config: {
        base_prize: 0,
        increment_per_interval: 0,
        interval_minutes: 60,
        decrease_mode: false
      },
      hide_participants: false,
      unlimited_winners: false,
      is_featured: false,
      prize_product_id: '',
      prize_products: [],
      bags_per_reveal: 1,
      allow_skip_animation: true
    });
    setEditingCompetition(null);
  };

  const handleEdit = (comp: Competition) => {
    setEditingCompetition(comp);
    const compAny = comp as any;
    
    // Parse letters_config properly from letter_probabilities object
    let lettersConfigArray: LetterConfig[] = [];
    if (compAny.letters_config?.letter_probabilities) {
      const letterProbs = compAny.letters_config.letter_probabilities;
      lettersConfigArray = Object.entries(letterProbs).map(([letter, probability]) => ({
        letter,
        probability: typeof probability === 'number' ? probability : 100
      }));
    } else if (compAny.letters_config?.target_word) {
      // Fallback: extract unique letters from target_word
      const uniqueLetters = [...new Set(compAny.letters_config.target_word.split(''))].filter(Boolean);
      lettersConfigArray = uniqueLetters.map((letter: string) => ({ letter, probability: 100 }));
    }
    
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
      required_tickets: compAny.required_tickets?.toString() || '1',
      winners_count: compAny.winners_count?.toString() || '1',
      competition_type: comp.competition_type,
      status: comp.status,
      prize_tiers: compAny.prize_tiers || [],
      price_tiers: compAny.price_tiers || [],
      is_flash: compAny.is_flash || false,
      flash_badge_text: compAny.flash_badge_text || '',
      theme_color: compAny.theme_color || '#d4af37',
      remaining_prizes: compAny.remaining_prizes?.toString() || '',
      instant_reveal: compAny.instant_reveal || false,
      win_probability: compAny.win_probability?.toString() || '',
      hidden_winner_trigger_ticket: compAny.hidden_winner_trigger_ticket?.toString() || '',
      letters_config: lettersConfigArray,
      better_luck_probability: compAny.letters_config?.better_luck_probability?.toString() || '0',
      prize_words: compAny.letters_config?.prize_words?.map((p: any) => ({
        word: p.word || '',
        prize_name: p.prize_name_ar || '',
        prize_value: p.prize_value || 0,
        stock: p.stock || 0,
        product_id: p.product_id || ''
      })) || [],
      growing_prize_config: compAny.growing_prize_config || {
        base_prize: 0,
        increment_per_interval: 0,
        interval_minutes: 60,
        decrease_mode: false
      },
      hide_participants: compAny.hide_participants || false,
      unlimited_winners: compAny.unlimited_winners || false,
      is_featured: compAny.is_featured || false,
      prize_product_id: compAny.prize_product_id || '',
      prize_products: compAny.prize_products || [],
      bags_per_reveal: compAny.letters_config?.bags_per_reveal || 1,
      allow_skip_animation: compAny.letters_config?.allow_skip_animation !== false
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

            <div className="flex gap-2">
              <Button variant="outline" className="gap-2" onClick={() => setTicketsManagerOpen(true)}>
                <Ticket className="h-4 w-4" />
                إدارة التذاكر
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => navigate('/admin/ticket-bundles')}>
                <Gift className="h-4 w-4" />
                عروض التذاكر
              </Button>
              <Button className="gap-2" onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                إنشاء مسابقة
              </Button>
            </div>
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
                      disabled={formData.unlimited_winners}
                    />
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="checkbox"
                        id="unlimited_winners"
                        checked={formData.unlimited_winners}
                        onChange={(e) => setFormData({ ...formData, unlimited_winners: e.target.checked })}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="unlimited_winners" className="text-xs">فائزين بلا حدود</Label>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Gift className="h-4 w-4" />
                      منتجات الجائزة (يمكن إضافة أكثر من منتج)
                    </Label>
                    <PrizeProductsSelector
                      products={products || []}
                      selectedProducts={formData.prize_products}
                      onChange={(products) => setFormData({ ...formData, prize_products: products })}
                    />
                    <p className="text-xs text-muted-foreground">ابحث عن المنتجات وأضفها كجوائز مع تحديد الكمية</p>
                  </div>
                </div>

                {/* خيارات إضافية */}
                <div className="border rounded-lg p-4 bg-muted/30">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    خيارات العرض
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="hide_participants"
                        checked={formData.hide_participants}
                        onChange={(e) => setFormData({ ...formData, hide_participants: e.target.checked })}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="hide_participants" className="text-sm">إخفاء عدد المشاركين</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="is_featured"
                        checked={formData.is_featured}
                        onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="is_featured" className="text-sm flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-yellow-500" />
                        مسابقة مميزة
                      </Label>
                    </div>
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
                        <SelectContent className="z-[100] bg-background border shadow-lg max-h-[300px]">
                          <div className="px-2 py-1 text-xs font-semibold text-muted-foreground border-b">المسابقات التقليدية</div>
                          <SelectItem value="ticket_count">🎯 عند وصول المشاركين لعدد معين</SelectItem>
                          <SelectItem value="all_tickets_sold">🎫 عند بيع جميع التذاكر</SelectItem>
                          <SelectItem value="timed">⏰ مسابقة بوقت محدد</SelectItem>
                          <SelectItem value="free">🆓 مسابقة مجانية</SelectItem>
                          
                          <div className="px-2 py-1 text-xs font-semibold text-muted-foreground border-b border-t mt-1">مسابقات الفوز الفوري</div>
                          <SelectItem value="instant_winner">⚡ فائز فوري</SelectItem>
                          <SelectItem value="everyone_wins">🎁 الكل رابح</SelectItem>
                          <SelectItem value="mystery_box">📦 اختر صندوقك</SelectItem>
                          <SelectItem value="hidden_winner">🎯 الرابح المخفي</SelectItem>
                          
                          <div className="px-2 py-1 text-xs font-semibold text-muted-foreground border-b border-t mt-1">مسابقات خاصة</div>
                          <SelectItem value="escalating_price">📈 السعر المتصاعد</SelectItem>
                          <SelectItem value="flash_sale">🔥 مسابقة سريعة</SelectItem>
                          <SelectItem value="team_battle">⚔️ فريق ضد فريق</SelectItem>
                          <SelectItem value="growing_prize">📊 الجائزة المتحولة</SelectItem>
                          <SelectItem value="collect_letters">🔤 اجمع أحرف واربح</SelectItem>
                        </SelectContent>
                      </Select>
                      {formData.competition_type && (
                        <p className="text-xs text-muted-foreground">
                          {competitionTypeDescriptions[formData.competition_type]}
                        </p>
                      )}
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

                  {/* إعدادات خاصة بنوع المسابقة */}
                  
                  {/* الفائز الفوري */}
                  {formData.competition_type === 'instant_winner' && (
                    <div className="mt-4 p-4 bg-yellow-500/5 rounded-lg border border-yellow-500/20">
                      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2 text-yellow-600">
                        ⚡ إعدادات الفائز الفوري
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">نسبة احتمال الفوز (%)</Label>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            placeholder="مثال: 10"
                            value={formData.win_probability}
                            onChange={(e) => setFormData({ ...formData, win_probability: e.target.value })}
                          />
                          <p className="text-xs text-muted-foreground">النسبة المئوية لاحتمال الفوز عند كل شراء</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">عدد الجوائز الإجمالي</Label>
                          <Input
                            type="number"
                            placeholder="بدون حد"
                            value={formData.remaining_prizes}
                            onChange={(e) => setFormData({ ...formData, remaining_prizes: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <input
                          type="checkbox"
                          id="instant_reveal"
                          checked={formData.instant_reveal}
                          onChange={(e) => setFormData({ ...formData, instant_reveal: e.target.checked })}
                          className="h-4 w-4"
                        />
                        <Label htmlFor="instant_reveal" className="text-sm">كشف النتيجة فوراً مع أنيميشن</Label>
                      </div>
                    </div>
                  )}

                  {/* الكل رابح */}
                  {formData.competition_type === 'everyone_wins' && (
                    <div className="mt-4 p-4 bg-pink-500/5 rounded-lg border border-pink-500/20">
                      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2 text-pink-600">
                        🎁 إعدادات الكل رابح - مستويات الجوائز
                      </h4>
                      <p className="text-xs text-muted-foreground mb-3">
                        حدد مستويات الجوائز مع نسب الاحتمالات (يجب أن يكون المجموع 100%)
                      </p>
                      
                      {formData.prize_tiers.map((tier, index) => (
                        <div key={tier.id} className="flex items-center gap-2 mb-2 p-2 bg-background rounded border">
                          <Input
                            placeholder="اسم الجائزة"
                            value={tier.name_ar}
                            onChange={(e) => {
                              const newTiers = [...formData.prize_tiers];
                              newTiers[index].name_ar = e.target.value;
                              setFormData({ ...formData, prize_tiers: newTiers });
                            }}
                            className="flex-1"
                          />
                          <Input
                            type="number"
                            placeholder="الاحتمال %"
                            value={tier.probability}
                            onChange={(e) => {
                              const newTiers = [...formData.prize_tiers];
                              newTiers[index].probability = parseFloat(e.target.value) || 0;
                              setFormData({ ...formData, prize_tiers: newTiers });
                            }}
                            className="w-24"
                          />
                          <Input
                            type="number"
                            placeholder="الكمية"
                            value={tier.quantity}
                            onChange={(e) => {
                              const newTiers = [...formData.prize_tiers];
                              newTiers[index].quantity = parseInt(e.target.value) || 0;
                              newTiers[index].remaining = parseInt(e.target.value) || 0;
                              setFormData({ ...formData, prize_tiers: newTiers });
                            }}
                            className="w-24"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setFormData({
                                ...formData,
                                prize_tiers: formData.prize_tiers.filter((_, i) => i !== index)
                              });
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            prize_tiers: [...formData.prize_tiers, {
                              id: crypto.randomUUID(),
                              name_ar: '',
                              probability: 0,
                              quantity: 0,
                              remaining: 0
                            }]
                          });
                        }}
                      >
                        <Plus className="h-4 w-4 ml-1" />
                        إضافة مستوى جائزة
                      </Button>
                      
                      <div className="mt-3 text-xs">
                        مجموع الاحتمالات: 
                        <span className={`font-bold mr-1 ${formData.prize_tiers.reduce((sum, t) => sum + t.probability, 0) === 100 ? 'text-green-600' : 'text-red-600'}`}>
                          {formData.prize_tiers.reduce((sum, t) => sum + t.probability, 0)}%
                        </span>
                      </div>
                    </div>
                  )}

                  {/* اختر صندوقك */}
                  {formData.competition_type === 'mystery_box' && (
                    <div className="mt-4 p-4 bg-indigo-500/5 rounded-lg border border-indigo-500/20">
                      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2 text-indigo-600">
                        📦 إعدادات الصناديق الغامضة
                      </h4>
                      <p className="text-xs text-muted-foreground mb-3">
                        أضف صناديق مختلفة بجوائز مختلفة - يتم خلطها عشوائياً للمشتري
                      </p>
                      
                      {formData.prize_tiers.map((tier, index) => (
                        <div key={tier.id} className="flex items-center gap-2 mb-2 p-2 bg-background rounded border">
                          <div className="w-8 h-8 bg-indigo-500 rounded flex items-center justify-center text-white font-bold">
                            {index + 1}
                          </div>
                          <Input
                            placeholder="محتوى الصندوق"
                            value={tier.name_ar}
                            onChange={(e) => {
                              const newTiers = [...formData.prize_tiers];
                              newTiers[index].name_ar = e.target.value;
                              setFormData({ ...formData, prize_tiers: newTiers });
                            }}
                            className="flex-1"
                          />
                          <Input
                            type="number"
                            placeholder="القيمة"
                            value={tier.value || ''}
                            onChange={(e) => {
                              const newTiers = [...formData.prize_tiers];
                              newTiers[index].value = parseFloat(e.target.value) || 0;
                              setFormData({ ...formData, prize_tiers: newTiers });
                            }}
                            className="w-24"
                          />
                          <Input
                            type="number"
                            placeholder="الاحتمال %"
                            value={tier.probability}
                            onChange={(e) => {
                              const newTiers = [...formData.prize_tiers];
                              newTiers[index].probability = parseFloat(e.target.value) || 0;
                              setFormData({ ...formData, prize_tiers: newTiers });
                            }}
                            className="w-24"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setFormData({
                                ...formData,
                                prize_tiers: formData.prize_tiers.filter((_, i) => i !== index)
                              });
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            prize_tiers: [...formData.prize_tiers, {
                              id: crypto.randomUUID(),
                              name_ar: '',
                              probability: 0,
                              quantity: 1,
                              remaining: 1,
                              value: 0
                            }]
                          });
                        }}
                      >
                        <Plus className="h-4 w-4 ml-1" />
                        إضافة صندوق
                      </Button>
                    </div>
                  )}

                  {/* الرابح المخفي */}
                  {formData.competition_type === 'hidden_winner' && (
                    <div className="mt-4 p-4 bg-red-500/5 rounded-lg border border-red-500/20">
                      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2 text-red-600">
                        🎯 إعدادات الرابح المخفي
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">رقم التذكرة الفائزة</Label>
                          <Input
                            type="number"
                            min="1"
                            placeholder="مثال: 50"
                            value={formData.hidden_winner_trigger_ticket}
                            onChange={(e) => setFormData({ ...formData, hidden_winner_trigger_ticket: e.target.value })}
                          />
                          <p className="text-xs text-muted-foreground">التذكرة رقم X ستكون الفائزة</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">أو نسبة ظهور الفائز (%)</Label>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            placeholder="اختياري"
                            value={formData.win_probability}
                            onChange={(e) => setFormData({ ...formData, win_probability: e.target.value })}
                          />
                          <p className="text-xs text-muted-foreground">احتمال ظهور التذكرة الفائزة</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* فريق ضد فريق */}
                  {formData.competition_type === 'team_battle' && (
                    <div className="mt-4 p-4 bg-cyan-500/5 rounded-lg border border-cyan-500/20">
                      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2 text-cyan-600">
                        ⚔️ إعدادات فريق ضد فريق
                      </h4>
                      <p className="text-xs text-muted-foreground mb-3">
                        المستخدمون يُوزعون عشوائياً على الفريقين (أزرق وأحمر)
                      </p>
                      <div className="grid grid-cols-2 gap-4 mt-3">
                        <div className="p-3 bg-blue-500/10 rounded-lg text-center">
                          <div className="text-2xl mb-1">🔵</div>
                          <p className="font-semibold text-blue-600">الفريق الأزرق</p>
                          <p className="text-xs text-muted-foreground">يتم توزيع المستخدمين تلقائياً</p>
                        </div>
                        <div className="p-3 bg-red-500/10 rounded-lg text-center">
                          <div className="text-2xl mb-1">🔴</div>
                          <p className="font-semibold text-red-600">الفريق الأحمر</p>
                          <p className="text-xs text-muted-foreground">يتم توزيع المستخدمين تلقائياً</p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-3 text-center">
                        الفريق الذي يشتري تذاكر أكثر يفوز بجائزة إضافية لجميع أعضائه
                      </p>
                    </div>
                  )}

                  {/* السعر المتصاعد */}
                  {formData.competition_type === 'escalating_price' && (
                    <div className="mt-4 p-4 bg-orange-500/5 rounded-lg border border-orange-500/20">
                      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2 text-orange-600">
                        📈 إعدادات السعر المتصاعد
                      </h4>
                      <p className="text-xs text-muted-foreground mb-3">
                        حدد مستويات الأسعار بناءً على عدد التذاكر المُباعة
                      </p>
                      
                      {formData.price_tiers.map((tier, index) => (
                        <div key={index} className="flex items-center gap-2 mb-2 p-2 bg-background rounded border">
                          <span className="text-xs whitespace-nowrap">من</span>
                          <Input
                            type="number"
                            placeholder="0"
                            value={tier.min_sold}
                            onChange={(e) => {
                              const newTiers = [...formData.price_tiers];
                              newTiers[index].min_sold = parseInt(e.target.value) || 0;
                              setFormData({ ...formData, price_tiers: newTiers });
                            }}
                            className="w-20"
                          />
                          <span className="text-xs whitespace-nowrap">إلى</span>
                          <Input
                            type="number"
                            placeholder="∞"
                            value={tier.max_sold}
                            onChange={(e) => {
                              const newTiers = [...formData.price_tiers];
                              newTiers[index].max_sold = parseInt(e.target.value) || 0;
                              setFormData({ ...formData, price_tiers: newTiers });
                            }}
                            className="w-20"
                          />
                          <span className="text-xs whitespace-nowrap">السعر:</span>
                          <Input
                            type="number"
                            placeholder="السعر"
                            value={tier.price}
                            onChange={(e) => {
                              const newTiers = [...formData.price_tiers];
                              newTiers[index].price = parseInt(e.target.value) || 0;
                              setFormData({ ...formData, price_tiers: newTiers });
                            }}
                            className="w-28"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setFormData({
                                ...formData,
                                price_tiers: formData.price_tiers.filter((_, i) => i !== index)
                              });
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => {
                          const lastMax = formData.price_tiers.length > 0 
                            ? formData.price_tiers[formData.price_tiers.length - 1].max_sold + 1 
                            : 0;
                          setFormData({
                            ...formData,
                            price_tiers: [...formData.price_tiers, {
                              min_sold: lastMax,
                              max_sold: lastMax + 49,
                              price: 1000
                            }]
                          });
                        }}
                      >
                        <Plus className="h-4 w-4 ml-1" />
                        إضافة مستوى سعر
                      </Button>
                    </div>
                  )}

                  {/* المسابقة السريعة */}
                  {formData.competition_type === 'flash_sale' && (
                    <div className="mt-4 p-4 bg-rose-500/5 rounded-lg border border-rose-500/20">
                      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2 text-rose-600">
                        🔥 إعدادات المسابقة السريعة
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">نص البادج المميز</Label>
                          <Input
                            placeholder="عرض محدود! ⏰"
                            value={formData.flash_badge_text}
                            onChange={(e) => setFormData({ ...formData, flash_badge_text: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">لون السمة</Label>
                          <div className="flex gap-2">
                            <Input
                              type="color"
                              value={formData.theme_color}
                              onChange={(e) => setFormData({ ...formData, theme_color: e.target.value })}
                              className="w-14 h-9 p-1"
                            />
                            <Input
                              value={formData.theme_color}
                              onChange={(e) => setFormData({ ...formData, theme_color: e.target.value })}
                              className="flex-1"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <input
                          type="checkbox"
                          id="is_flash"
                          checked={formData.is_flash}
                          onChange={(e) => setFormData({ ...formData, is_flash: e.target.checked })}
                          className="h-4 w-4"
                        />
                        <Label htmlFor="is_flash" className="text-sm">تفعيل التصميم المميز مع تأثيرات بصرية</Label>
                      </div>
                    </div>
                  )}

                  {/* الجائزة المتحولة */}
                  {formData.competition_type === 'growing_prize' && (
                    <div className="mt-4 p-4 bg-emerald-500/5 rounded-lg border border-emerald-500/20">
                      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2 text-emerald-600">
                        📊 إعدادات الجائزة المتحولة
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">قيمة الجائزة الأساسية</Label>
                          <Input
                            type="number"
                            placeholder="مثال: 100000"
                            value={formData.growing_prize_config.base_prize}
                            onChange={(e) => setFormData({
                              ...formData,
                              growing_prize_config: {
                                ...formData.growing_prize_config,
                                base_prize: parseInt(e.target.value) || 0
                              }
                            })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">الزيادة/النقصان لكل فترة</Label>
                          <Input
                            type="number"
                            placeholder="مثال: 5000"
                            value={formData.growing_prize_config.increment_per_interval}
                            onChange={(e) => setFormData({
                              ...formData,
                              growing_prize_config: {
                                ...formData.growing_prize_config,
                                increment_per_interval: parseInt(e.target.value) || 0
                              }
                            })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">الفترة الزمنية (بالدقائق)</Label>
                          <Input
                            type="number"
                            placeholder="مثال: 60"
                            value={formData.growing_prize_config.interval_minutes}
                            onChange={(e) => setFormData({
                              ...formData,
                              growing_prize_config: {
                                ...formData.growing_prize_config,
                                interval_minutes: parseInt(e.target.value) || 60
                              }
                            })}
                          />
                        </div>
                        <div className="space-y-1 flex items-end">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="decrease_mode"
                              checked={formData.growing_prize_config.decrease_mode}
                              onChange={(e) => setFormData({
                                ...formData,
                                growing_prize_config: {
                                  ...formData.growing_prize_config,
                                  decrease_mode: e.target.checked
                                }
                              })}
                              className="h-4 w-4"
                            />
                            <Label htmlFor="decrease_mode" className="text-sm">وضع النقصان (الجائزة تقل)</Label>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* جمع الأحرف */}
                  {formData.competition_type === 'collect_letters' && (
                    <div className="mt-4 p-4 bg-violet-500/5 rounded-lg border border-violet-500/20">
                      <h4 className="text-sm font-semibold mb-4 flex items-center gap-2 text-violet-600">
                        🔤 إعدادات جمع الأحرف
                      </h4>
                      
                      {/* Animation settings */}
                      <div className="mb-4 p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                        <Label className="text-xs font-semibold mb-3 block flex items-center gap-2">
                          🎬 إعدادات الأنيميشن
                        </Label>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-xs">عدد الأكياس المفتوحة دفعة واحدة</Label>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant={formData.bags_per_reveal === 1 ? "default" : "outline"}
                                size="sm"
                                onClick={() => setFormData({ ...formData, bags_per_reveal: 1 })}
                                className="flex-1"
                              >
                                كيس واحد
                              </Button>
                              <Button
                                type="button"
                                variant={formData.bags_per_reveal === 10 ? "default" : "outline"}
                                size="sm"
                                onClick={() => setFormData({ ...formData, bags_per_reveal: 10 })}
                                className="flex-1"
                              >
                                10 أكياس
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {formData.bags_per_reveal === 10 ? 'سيتم فتح 10 أكياس بالتتابع مع إمكانية التخطي' : 'فتح كيس واحد في كل مرة'}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">السماح بتخطي الأنيميشن</Label>
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id="allow_skip_animation"
                                checked={formData.allow_skip_animation !== false}
                                onChange={(e) => setFormData({ ...formData, allow_skip_animation: e.target.checked })}
                                className="h-4 w-4"
                              />
                              <Label htmlFor="allow_skip_animation" className="text-xs cursor-pointer">
                                تمكين زر التخطي للمستخدم
                              </Label>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Letters configuration */}
                      <div className="mb-4 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                        <Label className="text-xs font-semibold mb-3 block flex items-center gap-2">
                          ✨ الأحرف ونسبة ظهورها
                        </Label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-3">
                          {formData.letters_config.map((letter, index) => (
                            <div key={index} className="flex items-center gap-1 p-2 bg-background rounded-lg border shadow-sm">
                              <Input
                                placeholder="حرف"
                                value={letter.letter}
                                maxLength={1}
                                onChange={(e) => {
                                  const newLetters = [...formData.letters_config];
                                  newLetters[index].letter = e.target.value.toUpperCase();
                                  setFormData({ ...formData, letters_config: newLetters });
                                }}
                                className="w-10 text-center text-lg font-bold p-1"
                              />
                              <div className="flex items-center gap-0.5 flex-1">
                                <Input
                                  type="number"
                                  min="1"
                                  max="100"
                                  placeholder="%"
                                  value={letter.probability}
                                  onChange={(e) => {
                                    const newLetters = [...formData.letters_config];
                                    newLetters[index].probability = Math.max(1, Math.min(100, parseInt(e.target.value) || 100));
                                    setFormData({ ...formData, letters_config: newLetters });
                                  }}
                                  className="w-12 text-center text-xs p-1"
                                />
                                <span className="text-xs text-muted-foreground">%</span>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                                onClick={() => {
                                  setFormData({
                                    ...formData,
                                    letters_config: formData.letters_config.filter((_, i) => i !== index)
                                  });
                                }}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setFormData({
                                ...formData,
                                letters_config: [...formData.letters_config, { letter: '', probability: 100 }]
                              });
                            }}
                          >
                            <Plus className="h-4 w-4 ml-1" />
                            إضافة حرف
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              // Extract unique letters from all prize words
                              const allLetters = formData.prize_words
                                .map(w => w.word)
                                .join('')
                                .split('')
                                .filter((letter, idx, arr) => letter && arr.indexOf(letter) === idx);
                              
                              if (allLetters.length > 0) {
                                setFormData({
                                  ...formData,
                                  letters_config: allLetters.map(letter => ({ letter: letter.toUpperCase(), probability: 100 }))
                                });
                              }
                            }}
                          >
                            استيراد من الكلمات
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          نسب أعلى = ظهور أكثر للحرف (مثال: حرف بنسبة 50% يظهر نصف المرات التي يظهر فيها حرف بنسبة 100%)
                        </p>
                      </div>
                      
                      {/* Better luck probability */}
                      <div className="mb-4 p-3 bg-gray-500/10 rounded-lg border">
                        <Label className="text-xs font-semibold mb-2 block">احتمال "حظ أوفر" (لا يحصل على حرف)</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            placeholder="0"
                            value={formData.better_luck_probability}
                            onChange={(e) => setFormData({ ...formData, better_luck_probability: e.target.value })}
                            className="w-24"
                          />
                          <span className="text-sm">%</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          مثال: 20 = 20% من المحاولات لا تحصل على حرف
                        </p>
                      </div>
                      
                      {/* Prize words */}
                      <div className="border-t pt-4 mt-4">
                        <Label className="text-xs font-semibold mb-3 block flex items-center gap-2">
                          🏆 الكلمات الفائزة والجوائز
                        </Label>
                        <div className="space-y-2">
                          {formData.prize_words.map((word, index) => (
                            <div key={index} className="p-3 bg-background rounded-lg border shadow-sm">
                              <div className="grid grid-cols-12 gap-2 items-center">
                                <div className="col-span-3">
                                  <Label className="text-xs text-muted-foreground mb-1 block">الكلمة</Label>
                                  <Input
                                    placeholder="LEVONIS"
                                    value={word.word}
                                    onChange={(e) => {
                                      const newWords = [...formData.prize_words];
                                      newWords[index].word = e.target.value.toUpperCase();
                                      setFormData({ ...formData, prize_words: newWords });
                                    }}
                                    className="font-bold"
                                  />
                                </div>
                                <div className="col-span-3">
                                  <Label className="text-xs text-muted-foreground mb-1 block">اسم الجائزة</Label>
                                  <Input
                                    placeholder="جائزة نقدية"
                                    value={word.prize_name}
                                    onChange={(e) => {
                                      const newWords = [...formData.prize_words];
                                      newWords[index].prize_name = e.target.value;
                                      setFormData({ ...formData, prize_words: newWords });
                                    }}
                                  />
                                </div>
                                <div className="col-span-2">
                                  <Label className="text-xs text-muted-foreground mb-1 block">القيمة</Label>
                                  <Input
                                    type="number"
                                    placeholder="1000000"
                                    value={word.prize_value}
                                    onChange={(e) => {
                                      const newWords = [...formData.prize_words];
                                      newWords[index].prize_value = parseFloat(e.target.value) || 0;
                                      setFormData({ ...formData, prize_words: newWords });
                                    }}
                                  />
                                </div>
                                <div className="col-span-1">
                                  <Label className="text-xs text-muted-foreground mb-1 block">المخزون</Label>
                                  <Input
                                    type="number"
                                    placeholder="999"
                                    value={word.stock || ''}
                                    onChange={(e) => {
                                      const newWords = [...formData.prize_words];
                                      newWords[index].stock = parseInt(e.target.value) || 0;
                                      setFormData({ ...formData, prize_words: newWords });
                                    }}
                                  />
                                </div>
                                <div className="col-span-2">
                                  <Label className="text-xs text-muted-foreground mb-1 block">منتج (اختياري)</Label>
                                  <ProductSearchSelect
                                    products={products || []}
                                    value={word.product_id || ''}
                                    onChange={(value) => {
                                      const newWords = [...formData.prize_words];
                                      newWords[index].product_id = value;
                                      setFormData({ ...formData, prize_words: newWords });
                                    }}
                                    placeholder="بحث..."
                                  />
                                </div>
                                <div className="col-span-1 flex items-end justify-center pb-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                                    onClick={() => {
                                      setFormData({
                                        ...formData,
                                        prize_words: formData.prize_words.filter((_, i) => i !== index)
                                      });
                                    }}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-3"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              prize_words: [...formData.prize_words, { word: '', prize_name: '', prize_value: 0, stock: 999, product_id: '' }]
                            });
                          }}
                        >
                          <Plus className="h-4 w-4 ml-1" />
                          إضافة كلمة فائزة
                        </Button>
                        <p className="text-xs text-muted-foreground mt-2">
                          يمكن للمستخدم استبدال الأحرف المجمعة بجوائز عند تكوين الكلمة
                        </p>
                      </div>
                    </div>
                  )}
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

      <UserTicketsManager
        open={ticketsManagerOpen}
        onOpenChange={setTicketsManagerOpen}
      />
    </>
  );
}
