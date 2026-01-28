import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, MessageCircle, Share2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface SocialActionsProps {
  targetType: "product" | "request";
  targetId: string;
  showComments?: boolean;
  onCommentsClick?: () => void;
  compact?: boolean;
}

export default function SocialActions({
  targetType,
  targetId,
  showComments = true,
  onCommentsClick,
  compact = false,
}: SocialActionsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch like status and count
  const { data: likesData } = useQuery({
    queryKey: ["likes", targetType, targetId],
    queryFn: async () => {
      const [countRes, userLikeRes] = await Promise.all([
        supabase
          .from("community_likes")
          .select("id", { count: "exact" })
          .eq("target_type", targetType)
          .eq("target_id", targetId),
        user?.id
          ? supabase
              .from("community_likes")
              .select("id")
              .eq("target_type", targetType)
              .eq("target_id", targetId)
              .eq("user_id", user.id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      return {
        count: countRes.count || 0,
        isLiked: !!userLikeRes.data,
      };
    },
  });

  // Fetch comments count
  const { data: commentsCount = 0 } = useQuery({
    queryKey: ["comments-count", targetType, targetId],
    queryFn: async () => {
      const { count } = await supabase
        .from("community_comments")
        .select("id", { count: "exact" })
        .eq("target_type", targetType)
        .eq("target_id", targetId);
      return count || 0;
    },
  });

  const toggleLikeMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("يجب تسجيل الدخول");

      if (likesData?.isLiked) {
        const { error } = await supabase
          .from("community_likes")
          .delete()
          .eq("target_type", targetType)
          .eq("target_id", targetId)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("community_likes").insert({
          target_type: targetType,
          target_id: targetId,
          user_id: user.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["likes", targetType, targetId] });
    },
    onError: (err: Error) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  const handleShare = async () => {
    const url = `${window.location.origin}/community/${targetType}/${targetId}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: targetType === "product" ? "منتج مميز" : "طلب طباعة",
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        toast({ title: "تم النسخ", description: "تم نسخ الرابط" });
      }
    } catch {
      // User cancelled
    }
  };

  const isLiked = likesData?.isLiked || false;
  const likesCount = likesData?.count || 0;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleLikeMutation.mutate();
          }}
          disabled={toggleLikeMutation.isPending || !user}
          className={`flex items-center gap-1 text-[9px] ${
            isLiked ? "text-red-400" : "text-muted-foreground hover:text-red-400"
          } transition-colors`}
        >
          <Heart className={`h-3 w-3 ${isLiked ? "fill-current" : ""}`} />
          {likesCount > 0 && likesCount}
        </button>
        {showComments && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCommentsClick?.();
            }}
            className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-primary transition-colors"
          >
            <MessageCircle className="h-3 w-3" />
            {commentsCount > 0 && commentsCount}
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleShare();
          }}
          className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-primary transition-colors"
        >
          <Share2 className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => toggleLikeMutation.mutate()}
        disabled={toggleLikeMutation.isPending || !user}
        className={`h-8 px-2 gap-1.5 ${isLiked ? "text-red-400" : ""}`}
      >
        {toggleLikeMutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Heart className={`h-4 w-4 ${isLiked ? "fill-current" : ""}`} />
        )}
        <span className="text-xs">{likesCount}</span>
      </Button>

      {showComments && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onCommentsClick}
          className="h-8 px-2 gap-1.5"
        >
          <MessageCircle className="h-4 w-4" />
          <span className="text-xs">{commentsCount}</span>
        </Button>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={handleShare}
        className="h-8 px-2"
      >
        <Share2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
