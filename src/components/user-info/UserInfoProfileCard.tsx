import { useEffect, useMemo, useState } from "react";
import { Camera, Loader2, Mail, User, Sparkles, AtSign, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import LevelBadge from "@/components/LevelBadge";
import AvatarWithFrame from "@/components/merchant/AvatarWithFrame";
import { useUserCardFrame } from "@/hooks/useUserCardFrame";
import type { FrameAnimationType } from "@/components/merchant/AvatarWithFrame";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type ProfileState = {
  full_name: string;
  username: string;
  email: string;
  avatar_url: string;
  cover_image_url?: string;
};

export default function UserInfoProfileCard({
  userId,
  profile,
  setProfile,
  avatarFile,
  setAvatarFile,
  saving,
  uploadingAvatar,
  onSubmit,
}: {
  userId?: string;
  profile: ProfileState;
  setProfile: (next: ProfileState) => void;
  avatarFile: File | null;
  setAvatarFile: (f: File | null) => void;
  saving: boolean;
  uploadingAvatar: boolean;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const [uploadingCover, setUploadingCover] = useState(false);

  const objectUrl = useMemo(() => {
    if (!avatarFile) return null;
    return URL.createObjectURL(avatarFile);
  }, [avatarFile]);

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  const previewSrc = objectUrl || profile.avatar_url || undefined;
  const { data: cardFrame } = useUserCardFrame(userId);

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setUploadingCover(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${userId}/cover.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('covers').upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from('covers').getPublicUrl(path);
      const coverUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      await supabase.from('profiles').update({ cover_image_url: coverUrl }).eq('id', userId);
      setProfile({ ...profile, cover_image_url: coverUrl });
      toast.success('تم تحديث صورة الخلفية');
    } catch (err) {
      console.error(err);
      toast.error('فشل رفع صورة الخلفية');
    } finally {
      setUploadingCover(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border/30 bg-card overflow-hidden">
      {/* Hero Banner / Cover */}
      <div className="relative h-28 overflow-hidden group">
        {profile.cover_image_url ? (
          <img src={profile.cover_image_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-bl from-primary/20 via-primary/10 to-accent/5">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_80%,hsl(var(--primary)/0.12),transparent_60%)]" />
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 h-14 bg-gradient-to-t from-card to-transparent" />
        {/* Cover upload button */}
        <label htmlFor="cover-upload" className="absolute top-2 left-2 h-7 px-2 rounded-lg bg-card/80 text-foreground flex items-center gap-1 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold border border-border/30 hover:bg-card">
          {uploadingCover ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImageIcon className="h-3 w-3" />}
          تغيير الخلفية
          <Input id="cover-upload" type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
        </label>
      </div>

      {/* Profile Section */}
      <div className="relative px-5 -mt-12">
        <div className="flex items-end gap-4">
          <div className="relative">
            <AvatarWithFrame
              imageUrl={previewSrc}
              frameUrl={cardFrame?.frame_url}
              size="lg"
              animated={!!cardFrame?.frame_url}
              animationType={cardFrame?.frame_animation as FrameAnimationType}
              badgeColor={cardFrame?.card_color}
              isUser
            />
            <label htmlFor="avatar" className="absolute -bottom-1 -left-1 h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center cursor-pointer shadow-lg hover:scale-110 transition-transform">
              <Camera className="h-3 w-3" />
              <Input
                id="avatar"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) setAvatarFile(e.target.files[0]);
                }}
              />
            </label>
          </div>
          <div className="pb-1.5 flex-1 min-w-0">
            <h2 className="font-black text-base text-foreground truncate">
              {profile.full_name || "مستخدم جديد"}
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              {profile.username && (
                <span className="text-[10px] text-muted-foreground">@{profile.username}</span>
              )}
              {userId && <LevelBadge userId={userId} size="sm" />}
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={onSubmit} className="p-5 pt-4 space-y-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="full_name" className="text-[10px] font-bold flex items-center gap-1.5 text-muted-foreground">
              <User className="h-3 w-3 text-primary" />
              الاسم الكامل
            </Label>
            <Input
              id="full_name"
              value={profile.full_name}
              onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
              placeholder="أدخل اسمك الكامل"
              className="h-10 rounded-xl border-border/40 focus:border-primary/40 bg-muted/20"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="username" className="text-[10px] font-bold flex items-center gap-1.5 text-muted-foreground">
              <AtSign className="h-3 w-3 text-primary" />
              اسم المستخدم
            </Label>
            <Input
              id="username"
              value={profile.username}
              onChange={(e) => setProfile({ ...profile, username: e.target.value })}
              placeholder="اختر اسم مستخدم فريد"
              className="h-10 rounded-xl border-border/40 focus:border-primary/40 bg-muted/20"
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="email" className="text-[10px] font-bold flex items-center gap-1.5 text-muted-foreground">
            <Mail className="h-3 w-3 text-primary" />
            البريد الإلكتروني
          </Label>
          <Input id="email" value={profile.email} disabled className="h-10 rounded-xl bg-muted/30 text-muted-foreground border-border/20" />
          <p className="text-[9px] text-muted-foreground/60">لا يمكن تغيير البريد الإلكتروني</p>
        </div>

        {/* Theme Switcher */}
        <div className="flex items-center justify-between pt-2 border-t border-border/20">
          <ThemeSwitcher />
        </div>

        <Button
          type="submit"
          className="w-full h-10 rounded-xl font-bold text-sm shadow-lg shadow-primary/15 hover:shadow-xl hover:shadow-primary/25 transition-all"
          disabled={saving || uploadingAvatar || uploadingCover}
        >
          {(saving || uploadingAvatar) && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
          {uploadingAvatar ? "جاري رفع الصورة..." : "حفظ التغييرات"}
        </Button>
      </form>
    </div>
  );
}
