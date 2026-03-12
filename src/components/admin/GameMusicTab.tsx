import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminSection, AdminEmptyState, AdminLoading } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Music, Plus, Trash2, Upload, GripVertical, Pencil, Play, Pause, Loader2 } from "lucide-react";

interface MusicStation {
  id: string;
  name_ar: string;
  file_url: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export default function GameMusicTab() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MusicStation | null>(null);
  const [nameAr, setNameAr] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState("");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { data: stations, isLoading } = useQuery({
    queryKey: ["game-music-stations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_music_stations")
        .select("*")
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data as MusicStation[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (station: { id?: string; name_ar: string; file_url: string; display_order: number; is_active: boolean }) => {
      if (station.id) {
        const { error } = await supabase
          .from("game_music_stations")
          .update({ name_ar: station.name_ar, file_url: station.file_url, is_active: station.is_active })
          .eq("id", station.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("game_music_stations")
          .insert({ name_ar: station.name_ar, file_url: station.file_url, display_order: station.display_order });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["game-music-stations"] });
      toast.success(editing ? "تم تحديث المحطة" : "تم إضافة المحطة");
      closeDialog();
    },
    onError: () => toast.error("حدث خطأ"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (station: MusicStation) => {
      const path = station.file_url.split("/game-music/")[1];
      if (path) {
        await supabase.storage.from("game-music").remove([decodeURIComponent(path)]);
      }
      const { error } = await supabase.from("game_music_stations").delete().eq("id", station.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["game-music-stations"] });
      toast.success("تم حذف المحطة");
    },
    onError: () => toast.error("حدث خطأ في الحذف"),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("game_music_stations").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["game-music-stations"] }),
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedTypes = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg", "audio/webm", "audio/aac", "audio/m4a"];
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|ogg|webm|aac|m4a)$/i)) {
      toast.error("يرجى رفع ملف صوتي (MP3, WAV, OGG, AAC)");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("حجم الملف يجب أن يكون أقل من 20MB");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("game-music").upload(fileName, file);
    if (error) { toast.error("فشل رفع الملف"); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("game-music").getPublicUrl(fileName);
    setUploadedUrl(urlData.publicUrl);
    setUploading(false);
    toast.success("تم رفع الملف بنجاح");
  };

  const openAdd = () => { setEditing(null); setNameAr(""); setUploadedUrl(""); setDialogOpen(true); };
  const openEdit = (station: MusicStation) => { setEditing(station); setNameAr(station.name_ar); setUploadedUrl(station.file_url); setDialogOpen(true); };
  const closeDialog = () => { setDialogOpen(false); setEditing(null); setNameAr(""); setUploadedUrl(""); };

  const handleSave = () => {
    if (!nameAr.trim() || !uploadedUrl) { toast.error("يرجى إدخال الاسم ورفع ملف الموسيقى"); return; }
    saveMutation.mutate({ id: editing?.id, name_ar: nameAr.trim(), file_url: uploadedUrl, display_order: stations?.length || 0, is_active: true });
  };

  const togglePlay = (station: MusicStation) => {
    if (playingId === station.id) { audioRef.current?.pause(); setPlayingId(null); }
    else {
      if (audioRef.current) audioRef.current.pause();
      const audio = new Audio(station.file_url);
      audio.play();
      audio.onended = () => setPlayingId(null);
      audioRef.current = audio;
      setPlayingId(station.id);
    }
  };

  if (isLoading) return <AdminLoading />;

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold">محطات الموسيقى</h3>
        <Button onClick={openAdd} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> إضافة محطة
        </Button>
      </div>

      {!stations?.length ? (
        <AdminEmptyState
          icon={<Music className="h-8 w-8" />}
          title="لا توجد محطات موسيقى"
          description="أضف محطات موسيقى ليتم تشغيلها في صفحة الألعاب"
          action={<Button onClick={openAdd} className="gap-1.5"><Plus className="h-4 w-4" /> إضافة أول محطة</Button>}
        />
      ) : (
        <div className="space-y-3">
          {stations.map((station) => (
            <div key={station.id} className="flex items-center gap-3 p-4 rounded-xl border border-border/50 bg-card hover:border-border transition-colors">
              <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
              <button onClick={() => togglePlay(station)} className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors shrink-0">
                {playingId === station.id ? <Pause className="h-4 w-4 text-primary" /> : <Play className="h-4 w-4 text-primary" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground truncate">{station.name_ar}</p>
                <p className="text-xs text-muted-foreground truncate">{station.file_url.split("/").pop()}</p>
              </div>
              <Switch checked={station.is_active} onCheckedChange={(checked) => toggleMutation.mutate({ id: station.id, is_active: checked })} />
              <Button variant="ghost" size="icon" onClick={() => openEdit(station)}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => { if (confirm("هل أنت متأكد من حذف هذه المحطة؟")) deleteMutation.mutate(station); }}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editing ? "تعديل المحطة" : "إضافة محطة جديدة"}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>اسم المحطة</Label>
              <Input value={nameAr} onChange={(e) => setNameAr(e.target.value)} placeholder="مثال: موسيقى هادئة 🌙" dir="rtl" />
            </div>
            <div className="space-y-2">
              <Label>ملف الموسيقى</Label>
              {uploadedUrl ? (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border/50">
                  <Music className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm truncate flex-1">{uploadedUrl.split("/").pop()}</span>
                  <Button variant="ghost" size="sm" onClick={() => setUploadedUrl("")} className="h-7 text-xs">تغيير</Button>
                </div>
              ) : (
                <label className="flex flex-col items-center gap-2 p-6 rounded-lg border-2 border-dashed border-border/60 hover:border-primary/50 cursor-pointer transition-colors bg-muted/20">
                  {uploading ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <Upload className="h-8 w-8 text-muted-foreground" />}
                  <span className="text-sm text-muted-foreground">{uploading ? "جاري الرفع..." : "اضغط لرفع ملف صوتي (MP3, WAV, OGG)"}</span>
                  <span className="text-xs text-muted-foreground">الحد الأقصى 20MB</span>
                  <input type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                </label>
              )}
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={closeDialog}>إلغاء</Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending || !nameAr.trim() || !uploadedUrl}>
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : null}
                {editing ? "تحديث" : "إضافة"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
