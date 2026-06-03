import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useStlDownload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (fileId: string) => {
      const { data, error } = await supabase.functions.invoke('stl-download', {
        body: { file_id: fileId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return (data as { url: string }).url;
    },
    onSuccess: (url) => {
      qc.invalidateQueries({ queryKey: ['stl-today-count'] });
      qc.invalidateQueries({ queryKey: ['stl-files'] });
      // Trigger download
      const a = document.createElement('a');
      a.href = url;
      a.rel = 'noopener';
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      a.remove();
    },
    onError: (e: any) => {
      const msg = e?.message || 'فشل التحميل';
      if (msg === 'daily_limit_reached') toast.error('تم استنفاد حد التحميل اليومي لبطاقتك');
      else if (msg === 'not_eligible') toast.error('تحتاج حساب تاجر معتمد وبطاقة Levo فعالة');
      else if (msg === 'insufficient_points') toast.error('رصيد النقاط غير كافٍ');
      else toast.error(msg);
    },
  });
}
