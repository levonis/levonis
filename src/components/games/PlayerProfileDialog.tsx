import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Trophy, Swords, Calendar, ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import LevelBadge from "@/components/LevelBadge";

interface PlayerProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
}

export default function PlayerProfileDialog({ open, onOpenChange, userId }: PlayerProfileDialogProps) {
  const navigate = useNavigate();

  const { data: profile } = useQuery({
    queryKey: ['player-profile-dialog', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url, created_at')
        .eq('id', userId)
        .single();
      return data;
    },
    enabled: open && !!userId,
  });

  const { data: stackScore } = useQuery({
    queryKey: ['player-stack-score', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase
        .from('stack_game_high_scores')
        .select('high_score')
        .eq('user_id', userId)
        .maybeSingle();
      return (data as any)?.high_score ?? 0;
    },
    enabled: open && !!userId,
  });

  const { data: knifeScore } = useQuery({
    queryKey: ['player-knife-score', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase
        .from('knife_rain_high_scores')
        .select('high_score')
        .eq('user_id', userId)
        .maybeSingle();
      return (data as any)?.high_score ?? 0;
    },
    enabled: open && !!userId,
  });

  if (!userId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-sm">ملف اللاعب</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center gap-3 py-2">
          <Avatar className="h-16 w-16 border-2 border-primary/30">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">
              {(profile?.full_name || profile?.username || '?')[0]}
            </AvatarFallback>
          </Avatar>
          
          <div className="text-center">
            <h3 className="font-bold text-foreground">{profile?.full_name || 'لاعب'}</h3>
            {profile?.username && (
              <p className="text-xs text-muted-foreground">@{profile.username}</p>
            )}
            <div className="mt-1">
              <LevelBadge userId={userId} size="sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 w-full">
            <div className="bg-muted/30 rounded-xl p-3 text-center">
              <Trophy className="h-4 w-4 text-primary mx-auto mb-1" />
              <div className="text-lg font-bold text-foreground">{stackScore ?? 0}</div>
              <div className="text-[10px] text-muted-foreground">البرج</div>
            </div>
            <div className="bg-muted/30 rounded-xl p-3 text-center">
              <Swords className="h-4 w-4 text-primary mx-auto mb-1" />
              <div className="text-lg font-bold text-foreground">{knifeScore ?? 0}</div>
              <div className="text-[10px] text-muted-foreground">السكاكين</div>
            </div>
          </div>

          {profile?.created_at && (
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Calendar className="h-3 w-3" />
              عضو منذ {new Date(profile.created_at).toLocaleDateString('ar-IQ')}
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1.5 text-xs"
            onClick={() => {
              onOpenChange(false);
              navigate(`/profile/${userId}?tab=games`);
            }}
          >
            <ExternalLink className="h-3 w-3" />
            عرض الملف الكامل
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
