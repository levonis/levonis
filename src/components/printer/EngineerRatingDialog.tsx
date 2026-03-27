import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Star } from 'lucide-react';
import { toast } from 'sonner';

interface EngineerRatingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: string;
  engineerName: string;
  engineerId?: string;
}

export default function EngineerRatingDialog({
  open,
  onOpenChange,
  ticketId,
  engineerName,
  engineerId,
}: EngineerRatingDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');

  const submitRatingMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('يجب تسجيل الدخول');
      if (rating === 0) throw new Error('يرجى اختيار تقييم');

      const { error } = await supabase.from('engineer_ratings').insert({
        ticket_id: ticketId,
        user_id: user.id,
        engineer_name: engineerName,
        engineer_id: engineerId || null,
        rating,
        comment: comment.trim() || null,
      });

      if (error) {
        if (error.code === '23505') throw new Error('تم تقييم هذا الطلب مسبقاً');
        throw error;
      }
    },
    onSuccess: () => {
      toast.success('شكراً لتقييمك! 🌟');
      queryClient.invalidateQueries({ queryKey: ['maintenance-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['engineer-ratings'] });
      onOpenChange(false);
      setRating(0);
      setComment('');
    },
    onError: (error: any) => {
      toast.error(error.message || 'حدث خطأ');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-center">قيّم الفني</DialogTitle>
          <DialogDescription className="text-center">
            كيف كانت تجربتك مع الفني <strong>{engineerName}</strong>؟
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Star Rating */}
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className="transition-transform hover:scale-110"
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                onClick={() => setRating(star)}
              >
                <Star
                  className={`w-10 h-10 transition-colors ${
                    star <= (hoveredRating || rating)
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-muted-foreground/30'
                  }`}
                />
              </button>
            ))}
          </div>

          {rating > 0 && (
            <p className="text-center text-sm text-muted-foreground">
              {rating === 1 && 'سيئ'}
              {rating === 2 && 'مقبول'}
              {rating === 3 && 'جيد'}
              {rating === 4 && 'جيد جداً'}
              {rating === 5 && 'ممتاز!'}
            </p>
          )}

          <div className="space-y-2">
            <Label>تعليق (اختياري)</Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="شاركنا رأيك..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            لاحقاً
          </Button>
          <Button
            onClick={() => submitRatingMutation.mutate()}
            disabled={submitRatingMutation.isPending || rating === 0}
          >
            {submitRatingMutation.isPending && (
              <Loader2 className="w-4 h-4 animate-spin ml-2" />
            )}
            إرسال التقييم
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
