import { useEffect, useMemo } from "react";
import { Camera, Loader2, Mail, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import LevelBadge from "@/components/LevelBadge";

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

  return (
    <Card className="glass-effect border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5 text-primary" />
          معلومات الحساب
        </CardTitle>
        <CardDescription>قم بتحديث معلوماتك الشخصية</CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-4 pb-6 border-b border-border/30">
            <div className="flex flex-col items-center gap-2">
              <Avatar className="h-24 w-24">
                <AvatarImage src={previewSrc} />
                <AvatarFallback className="text-2xl">
                  {profile.username?.[0] || profile.full_name?.[0] || "م"}
                </AvatarFallback>
              </Avatar>
              {userId && <LevelBadge userId={userId} size="lg" />}
            </div>

            <div>
              <Input
                id="avatar"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) setAvatarFile(e.target.files[0]);
                }}
              />
              <Label htmlFor="avatar" className="cursor-pointer">
                <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors">
                  <Camera className="h-4 w-4" />
                  <span className="text-sm">تغيير الصورة</span>
                </div>
              </Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="full_name">الاسم الكامل</Label>
            <Input
              id="full_name"
              value={profile.full_name}
              onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
              placeholder="أدخل اسمك الكامل"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">اسم المستخدم</Label>
            <Input
              id="username"
              value={profile.username}
              onChange={(e) => setProfile({ ...profile, username: e.target.value })}
              placeholder="اختر اسم مستخدم فريد"
            />
            <p className="text-xs text-muted-foreground">يستخدم للبحث في قائمة الطلبات وظهوره في التقييمات</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">البريد الإلكتروني</Label>
            <div className="relative">
              <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="email" value={profile.email} disabled className="pr-10 bg-muted/50" />
            </div>
            <p className="text-xs text-muted-foreground">لا يمكن تغيير البريد الإلكتروني</p>
          </div>

          <Button
            type="submit"
            className="w-full bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90"
            disabled={saving || uploadingAvatar}
          >
            {(saving || uploadingAvatar) && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
            {uploadingAvatar ? "جاري رفع الصورة..." : "حفظ التغييرات"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
