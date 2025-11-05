import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { X } from 'lucide-react';
import { useState } from 'react';

const AnnouncementBar = () => {
  const [dismissed, setDismissed] = useState(false);

  const { data: announcements } = useQuery({
    queryKey: ['active-announcements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('active', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    refetchInterval: 60000, // Refetch every minute
  });

  if (!announcements || announcements.length === 0 || dismissed) {
    return null;
  }

  const announcement = announcements[0];
  
  const bgColor = {
    info: 'bg-blue-500/90',
    warning: 'bg-yellow-500/90',
    success: 'bg-green-500/90',
    error: 'bg-red-500/90',
  }[announcement.type] || 'bg-blue-500/90';

  return (
    <div className={`${bgColor} text-white py-2 px-4 relative overflow-hidden`}>
      <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
        <div className="flex-1 overflow-hidden">
          <div className="animate-marquee whitespace-nowrap">
            <span className="inline-block px-4">{announcement.message_ar}</span>
            <span className="inline-block px-4">{announcement.message_ar}</span>
            <span className="inline-block px-4">{announcement.message_ar}</span>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="flex-shrink-0 hover:bg-white/20 rounded-full p-1 transition-colors"
          aria-label="إغلاق"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default AnnouncementBar;