import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus, UserCheck, Loader2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface StoreFollowButtonProps {
  storeId: string;
  showCount?: boolean;
  compact?: boolean;
}

export default function StoreFollowButton({
  storeId,
  showCount = true,
  compact = false,
}: StoreFollowButtonProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch follow status and count
  const { data: followData } = useQuery({
    queryKey: ["store-follow", storeId, user?.id],
    queryFn: async () => {
      const [countRes, userFollowRes] = await Promise.all([
        supabase
          .from("store_followers")
          .select("id", { count: "exact" })
          .eq("store_id", storeId),
        user?.id
          ? supabase
              .from("store_followers")
              .select("id")
              .eq("store_id", storeId)
              .eq("user_id", user.id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      return {
        count: countRes.count || 0,
        isFollowing: !!userFollowRes.data,
      };
    },
  });

  const toggleFollowMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("يجب تسجيل الدخول");

      if (followData?.isFollowing) {
        const { error } = await supabase
          .from("store_followers")
          .delete()
          .eq("store_id", storeId)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("store_followers").insert({
          store_id: storeId,
          user_id: user.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-follow", storeId] });
      toast({
        title: followData?.isFollowing ? "تم إلغاء المتابعة" : "تمت المتابعة",
        description: followData?.isFollowing
          ? "لن تتلقى تحديثات من هذا المتجر"
          : "ستتلقى تحديثات جديدة من هذا المتجر",
      });
    },
    onError: (err: Error) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  const isFollowing = followData?.isFollowing || false;
  const followersCount = followData?.count || 0;

  if (compact) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleFollowMutation.mutate();
        }}
        disabled={toggleFollowMutation.isPending || !user}
        className={`flex items-center gap-1 text-[9px] px-2 py-1 rounded-full transition-all ${
          isFollowing
            ? "bg-primary/20 text-primary"
            : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
        }`}
      >
        {toggleFollowMutation.isPending ? (
          <Loader2 className="h-2.5 w-2.5 animate-spin" />
        ) : isFollowing ? (
          <UserCheck className="h-2.5 w-2.5" />
        ) : (
          <UserPlus className="h-2.5 w-2.5" />
        )}
        {showCount && followersCount > 0 && followersCount}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant={isFollowing ? "secondary" : "default"}
        size="sm"
        onClick={() => toggleFollowMutation.mutate()}
        disabled={toggleFollowMutation.isPending || !user}
        className="gap-1.5"
      >
        {toggleFollowMutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isFollowing ? (
          <UserCheck className="h-4 w-4" />
        ) : (
          <UserPlus className="h-4 w-4" />
        )}
        {isFollowing ? "متابَع" : "متابعة"}
      </Button>
      {showCount && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          {followersCount}
        </div>
      )}
    </div>
  );
}
