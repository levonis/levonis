import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Send, Loader2, ChevronDown, User, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

interface Comment {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  user?: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

interface CommentsSectionProps {
  targetType: "product" | "request";
  targetId: string;
  initialVisibleCount?: number;
}

export default function CommentsSection({
  targetType,
  targetId,
  initialVisibleCount = 3,
}: CommentsSectionProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState("");
  const [visibleCount, setVisibleCount] = useState(initialVisibleCount);

  // Fetch comments
  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["comments", targetType, targetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_comments")
        .select("id, content, user_id, created_at")
        .eq("target_type", targetType)
        .eq("target_id", targetId)
        .eq("is_hidden", false)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch user profiles
      const userIds = [...new Set((data || []).map(c => c.user_id))];
      if (userIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds);

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      return (data || []).map(comment => ({
        ...comment,
        user: profileMap.get(comment.user_id) || null,
      })) as Comment[];
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!user?.id) throw new Error("يجب تسجيل الدخول");
      if (!content.trim()) throw new Error("التعليق فارغ");

      const { error } = await supabase.from("community_comments").insert({
        target_type: targetType,
        target_id: targetId,
        user_id: user.id,
        content: content.trim(),
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", targetType, targetId] });
      queryClient.invalidateQueries({ queryKey: ["comments-count", targetType, targetId] });
      setNewComment("");
      toast({ title: "تم إضافة التعليق" });
    },
    onError: (err: Error) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      if (!user?.id) throw new Error("يجب تسجيل الدخول");

      const { error } = await supabase
        .from("community_comments")
        .delete()
        .eq("id", commentId)
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", targetType, targetId] });
      queryClient.invalidateQueries({ queryKey: ["comments-count", targetType, targetId] });
      toast({ title: "تم حذف التعليق" });
    },
    onError: (err: Error) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newComment.trim()) {
      addCommentMutation.mutate(newComment);
    }
  };

  const visibleComments = comments.slice(0, visibleCount);
  const hasMore = comments.length > visibleCount;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold">التعليقات ({comments.length})</span>
      </div>

      {/* Add Comment Form */}
      {user ? (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="أضف تعليقاً..."
            className="flex-1 h-9 text-xs bg-white/5 border-white/10"
            disabled={addCommentMutation.isPending}
          />
          <Button
            type="submit"
            size="sm"
            className="h-9 px-3"
            disabled={addCommentMutation.isPending || !newComment.trim()}
          >
            {addCommentMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      ) : (
        <p className="text-[10px] text-muted-foreground text-center py-2 bg-white/5 rounded-lg">
          سجل دخولك لإضافة تعليق
        </p>
      )}

      {/* Comments List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-[10px] text-muted-foreground text-center py-4">
          لا توجد تعليقات بعد
        </p>
      ) : (
        <div className="space-y-2">
          {visibleComments.map((comment) => (
            <div
              key={comment.id}
              className="flex gap-2 p-2 rounded-lg bg-white/5 border border-white/5"
            >
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarImage src={comment.user?.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/20 text-primary text-[10px]">
                  <User className="h-3 w-3" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-medium text-foreground truncate">
                    {comment.user?.full_name || "مستخدم"}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-muted-foreground shrink-0">
                      {formatDistanceToNow(new Date(comment.created_at), {
                        addSuffix: true,
                        locale: ar,
                      })}
                    </span>
                    {user?.id === comment.user_id && (
                      <button
                        onClick={() => deleteCommentMutation.mutate(comment.id)}
                        disabled={deleteCommentMutation.isPending}
                        className="p-0.5 rounded hover:bg-destructive/20 text-destructive/70 hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-foreground/80 mt-0.5 break-words">
                  {comment.content}
                </p>
              </div>
            </div>
          ))}

          {/* Show More Button */}
          {hasMore && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-8 text-[10px] text-muted-foreground hover:text-foreground"
              onClick={() => setVisibleCount((c) => c + 5)}
            >
              <ChevronDown className="h-3 w-3 ml-1" />
              عرض المزيد ({comments.length - visibleCount} تعليق)
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
