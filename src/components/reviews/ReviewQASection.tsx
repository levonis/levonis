import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { MessageCircleQuestion, Send, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { sendAllNotifications } from '@/lib/notifications';

interface ReviewQASectionProps {
  reviewId: string;
  productId: string;
  reviewerId: string;
  reviewerName: string;
}

export default function ReviewQASection({ reviewId, productId, reviewerId, reviewerName }: ReviewQASectionProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [question, setQuestion] = useState('');
  const [expandedQ, setExpandedQ] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [answeringId, setAnsweringId] = useState<string | null>(null);

  const { data: questions = [] } = useQuery({
    queryKey: ['review-questions', reviewId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('review_questions')
        .select('*')
        .eq('review_id', reviewId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (!data?.length) return [];

      const userIds = Array.from(new Set(data.map(q => q.asker_id)));
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url')
        .in('id', userIds);
      const pMap = new Map(profiles?.map(p => [p.id, p]) || []);

      // Fetch answers for all questions
      const qIds = data.map(q => q.id);
      const { data: answers } = await supabase
        .from('review_answers')
        .select('*')
        .in('question_id', qIds)
        .order('created_at', { ascending: true });

      const answerUserIds = Array.from(new Set((answers || []).map(a => a.answerer_id)));
      const allUserIds = Array.from(new Set([...userIds, ...answerUserIds]));
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url')
        .in('id', allUserIds);
      const allPMap = new Map(allProfiles?.map(p => [p.id, p]) || []);

      return data.map(q => ({
        ...q,
        profile: allPMap.get(q.asker_id),
        answers: (answers || []).filter(a => a.question_id === q.id).map(a => ({
          ...a,
          profile: allPMap.get(a.answerer_id),
        })),
      }));
    },
  });

  const askMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('يجب تسجيل الدخول');
      if (!question.trim()) throw new Error('اكتب سؤالك');
      const { error } = await supabase.from('review_questions').insert({
        review_id: reviewId,
        product_id: productId,
        asker_id: user.id,
        question: question.trim(),
      });
      if (error) throw error;

      // Send notification + Telegram with reply button
      sendAllNotifications({
        userId: reviewerId,
        title: 'سؤال جديد على تقييمك',
        message: `سأل أحدهم: "${question.trim().slice(0, 80)}"`,
        type: 'info',
        relatedId: reviewId,
      });

      // Send Telegram with inline reply button
      const { data: insertedQ } = await supabase
        .from('review_questions')
        .select('id')
        .eq('review_id', reviewId)
        .eq('asker_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (insertedQ) {
        supabase.functions.invoke('send-user-telegram-notification', {
          body: {
            user_id: reviewerId,
            title: '❓ سؤال جديد على تقييمك',
            message: `سأل أحدهم: "${question.trim().slice(0, 80)}"\n\n💡 للرد، اكتب رسالتك هنا مباشرة`,
            notification_type: 'info',
            review_question_id: insertedQ.id,
          },
        }).catch(() => {});
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review-questions', reviewId] });
      setQuestion('');
      setShowForm(false);
      toast.success('تم إرسال سؤالك');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const answerMutation = useMutation({
    mutationFn: async ({ questionId, askerId }: { questionId: string; askerId: string }) => {
      if (!user?.id) throw new Error('يجب تسجيل الدخول');
      if (!answerText.trim()) throw new Error('اكتب إجابتك');
      const { error } = await supabase.from('review_answers').insert({
        question_id: questionId,
        answerer_id: user.id,
        answer: answerText.trim(),
      });
      if (error) throw error;

      // Award 5 points to answerer
      const { data: currentPoints } = await supabase
        .from('user_points')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (currentPoints) {
        await supabase.from('user_points').update({
          total_points: (currentPoints.total_points || 0) + 5,
          available_points: (currentPoints.available_points || 0) + 5,
        }).eq('user_id', user.id);
      } else {
        await supabase.from('user_points').insert({
          user_id: user.id,
          total_points: 5,
          available_points: 5,
        });
      }

      await supabase.from('points_transactions').insert({
        user_id: user.id,
        points: 5,
        type: 'earned',
        source: 'review_answer',
        description: 'إجابة على سؤال في التقييمات',
      });

      // Notify the asker
      sendAllNotifications({
        userId: askerId,
        title: 'تم الرد على سؤالك',
        message: `رد ${reviewerName}: "${answerText.trim().slice(0, 80)}"`,
        type: 'success',
        relatedId: reviewId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review-questions', reviewId] });
      setAnswerText('');
      setAnsweringId(null);
      toast.success('تم إرسال إجابتك (+5 نقاط)');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (questions.length === 0 && !showForm && (!user || user.id === reviewerId)) return null;

  return (
    <div className="mt-2 space-y-2">
      {/* Ask button */}
      {user && user.id !== reviewerId && (
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-glow transition"
        >
          <MessageCircleQuestion className="h-3 w-3" />
          اسأل صاحب التقييم
        </button>
      )}

      {/* Ask form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex gap-2">
              <Textarea
                value={question}
                onChange={e => setQuestion(e.target.value)}
                placeholder="اكتب سؤالك..."
                rows={2}
                maxLength={300}
                className="flex-1 text-xs rounded-lg resize-none border-border/50"
              />
              <Button
                size="sm"
                className="h-auto px-3 rounded-lg"
                onClick={() => askMutation.mutate()}
                disabled={askMutation.isPending || !question.trim()}
              >
                {askMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Questions list */}
      {questions.length > 0 && (
        <div className="space-y-2">
          {questions.map((q: any) => (
            <div key={q.id} className="bg-background/30 backdrop-blur-sm rounded-xl p-3 border border-border/20">
              <div className="flex items-start gap-2">
                <Avatar className="h-6 w-6 shrink-0">
                  <AvatarImage src={q.profile?.avatar_url || undefined} />
                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                    {(q.profile?.username || q.profile?.full_name || 'م').charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-foreground truncate">
                      {q.profile?.username || q.profile?.full_name || 'مستخدم'}
                    </span>
                    <Badge variant="outline" className="h-3.5 px-1 text-[9px] border-primary/30 text-primary">سؤال</Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(q.created_at), { addSuffix: true, locale: ar })}
                    </span>
                  </div>
                  <p className="text-xs text-foreground/80 mt-0.5">{q.question}</p>

                  {/* Answers */}
                  {q.answers.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {(expandedQ === q.id ? q.answers : q.answers.slice(0, 1)).map((a: any) => (
                        <div key={a.id} className="flex items-start gap-1.5 pr-3 border-r-2 border-primary/30">
                          <Avatar className="h-5 w-5 shrink-0">
                            <AvatarImage src={a.profile?.avatar_url || undefined} />
                            <AvatarFallback className="text-[9px] bg-accent/20 text-accent-foreground">
                              {(a.profile?.username || 'م').charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] font-semibold">{a.profile?.username || a.profile?.full_name || 'مستخدم'}</span>
                              {a.answerer_id === reviewerId && (
                                <Badge className="h-3 px-1 text-[8px] bg-primary/15 text-primary border-0">صاحب التقييم</Badge>
                              )}
                            </div>
                            <p className="text-[11px] text-foreground/75">{a.answer}</p>
                          </div>
                        </div>
                      ))}
                      {q.answers.length > 1 && (
                        <button
                          onClick={() => setExpandedQ(expandedQ === q.id ? null : q.id)}
                          className="text-[10px] text-primary flex items-center gap-0.5"
                        >
                          {expandedQ === q.id ? (
                            <>عرض أقل <ChevronUp className="h-2.5 w-2.5" /></>
                          ) : (
                            <>عرض {q.answers.length - 1} إجابات أخرى <ChevronDown className="h-2.5 w-2.5" /></>
                          )}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Answer form for reviewer */}
                  {user?.id === reviewerId && (
                    answeringId === q.id ? (
                      <div className="flex gap-1.5 mt-2">
                        <Textarea
                          value={answerText}
                          onChange={e => setAnswerText(e.target.value)}
                          placeholder="اكتب إجابتك..."
                          rows={1}
                          maxLength={300}
                          className="flex-1 text-[11px] rounded-lg resize-none border-border/50 min-h-[32px]"
                        />
                        <Button
                          size="sm"
                          className="h-8 px-2 rounded-lg text-[10px]"
                          onClick={() => answerMutation.mutate({ questionId: q.id, askerId: q.asker_id })}
                          disabled={answerMutation.isPending}
                        >
                          {answerMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'رد'}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 px-2 text-[10px]" onClick={() => setAnsweringId(null)}>إلغاء</Button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setAnsweringId(q.id); setAnswerText(''); }}
                        className="text-[10px] text-primary mt-1 hover:underline"
                      >
                        أجب على السؤال (+5 نقاط)
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
