import { useEffect, useMemo } from "react";
import { Camera, Loader2, Mail, User, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import LevelBadge from "@/components/LevelBadge";
import AvatarWithFrame from "@/components/merchant/AvatarWithFrame";
import { useUserCardFrame } from "@/hooks/useUserCardFrame";
import type { FrameAnimationType } from "@/components/merchant/AvatarWithFrame";

type ProfileState = {
  full_name: string;
  username: string;
  email: string;
  avatar_url: string;
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

  return (
    <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
      {/* Hero Banner */}
      <div className="relative h-28 bg-gradient-to-bl from-primary/20 via-primary/10 to-accent/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_80%,hsl(var(--primary)/0.15),transparent_60%)]" />
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-card to-transparent" />
      </div>

      {/* Avatar Section - overlapping banner */}
      <div className="relative px-5 -mt-14">
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
            <label htmlFor="avatar" className="absolute -bottom-1 -left-1 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center cursor-pointer shadow-lg hover:scale-110 transition-transform">
              <Camera className="h-3.5 w-3.5" />
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
          <div className="pb-2 flex-1 min-w-0">
            <h2 className="font-black text-lg text-foreground truncate">
              {profile.full_name || "مستخدم جديد"}
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              {profile.username && (
                <span className="text-xs text-muted-foreground">@{profile.username}</span>
              )}
              {userId && <LevelBadge userId={userId} size="sm" />}
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={onSubmit} className="p-5 pt-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="full_name" className="text-xs font-bold flex items-center gap-1.5">
              <User className="h-3 w-3 text-primary" />
              الاسم الكامل
            </Label>
            <Input
              id="full_name"
              value={profile.full_name}
              onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
              placeholder="أدخل اسمك الكامل"
              className="h-10 rounded-xl border-border/50 focus:border-primary/40"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="username" className="text-xs font-bold flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-primary" />
              اسم المستخدم
            </Label>
            <Input
              id="username"
              value={profile.username}
              onChange={(e) => setProfile({ ...profile, username: e.target.value })}
              placeholder="اختر اسم مستخدم فريد"
              className="h-10 rounded-xl border-border/50 focus:border-primary/40"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-xs font-bold flex items-center gap-1.5">
            <Mail className="h-3 w-3 text-primary" />
            البريد الإلكتروني
          </Label>
          <Input id="email" value={profile.email} disabled className="h-10 rounded-xl bg-muted/30 text-muted-foreground" />
          <p className="text-[10px] text-muted-foreground">لا يمكن تغيير البريد الإلكتروني</p>
        </div>

        <Button
          type="submit"
          className="w-full h-11 rounded-xl bg-gradient-to-l from-primary to-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all"
          disabled={saving || uploadingAvatar}
        >
          {(saving || uploadingAvatar) && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
          {uploadingAvatar ? "جاري رفع الصورة..." : "حفظ التغييرات"}
        </Button>
      </form>
    </div>
  );
}
