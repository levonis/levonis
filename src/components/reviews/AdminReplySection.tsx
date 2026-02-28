import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Loader2, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface AdminReplySectionProps {
  reviewId: string;
}

export default function AdminReplySection({ reviewId }: AdminReplySectionProps) {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [reply, setReply] = useState('');
  const [expanded, setExpanded] = useState(false);

  const { data: replies = [] } = useQuery({
    queryKey: ['admin-replies', reviewId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('review_admin_replies')
        .select('*')
        .eq('review_id', reviewId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('يجب تسجيل الدخول');
      const { error } = await supabase.from('review_admin_replies').insert({
        review_id: reviewId,
        admin_id: user.id,
        reply: reply.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-replies', reviewId] });
      setReply('');
      setShowForm(false);
      toast.success('تم إضافة الرد');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('review_admin_replies').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-replies', reviewId] });
      toast.success('تم حذف الرد');
    },
  });

  const displayReplies = expanded ? replies : replies.slice(0, 1);

  return (
    <div>
      {/* Existing replies */}
      {replies.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {displayReplies.map((r: any) => (
            <div key={r.id} className="bg-primary/5 backdrop-blur-sm rounded-xl p-2.5 border border-primary/15">
              <div className="flex items-center gap-1.5 mb-1">
                <ShieldCheck className="h-3 w-3 text-primary" />
                <Badge className="h-3.5 px-1 text-[9px] bg-primary/15 text-primary border-0 font-bold">
                  رد الإدارة
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: ar })}
                </span>
                {isAdmin && (
                  <button onClick={() => deleteMutation.mutate(r.id)} className="mr-auto">
                    <Trash2 className="h-3 w-3 text-destructive/50 hover:text-destructive transition" />
                  </button>
                )}
              </div>
              <p className="text-xs text-foreground/85 leading-relaxed">{r.reply}</p>
            </div>
          ))}
          {replies.length > 1 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[10px] text-primary flex items-center gap-0.5"
            >
              {expanded ? <>عرض أقل <ChevronUp className="h-2.5 w-2.5" /></> : <>عرض {replies.length - 1} ردود أخرى <ChevronDown className="h-2.5 w-2.5" /></>}
            </button>
          )}
        </div>
      )}

      {/* Admin reply form */}
      {isAdmin && (
        <>
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="text-[10px] text-primary hover:underline flex items-center gap-1"
            >
              <ShieldCheck className="h-3 w-3" />
              رد كإدارة
            </button>
          ) : (
            <AnimatePresence>
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="flex gap-2 mt-1">
                  <Textarea
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    placeholder="اكتب رد الإدارة..."
                    rows={2}
                    className="flex-1 text-xs rounded-lg resize-none border-primary/30"
                  />
                  <div className="flex flex-col gap-1">
                    <Button
                      size="sm"
                      className="h-7 px-2 rounded-lg text-[10px]"
                      onClick={() => submitMutation.mutate()}
                      disabled={submitMutation.isPending || !reply.trim()}
                    >
                      {submitMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'إرسال'}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => setShowForm(false)}>
                      إلغاء
                    </Button>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </>
      )}
    </div>
  );
}
