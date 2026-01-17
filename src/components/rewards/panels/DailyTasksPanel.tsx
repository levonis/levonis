import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, Circle, Coins } from "lucide-react";

export default function DailyTasksPanel() {
  const { user } = useAuth();

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['daily-tasks-panel'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_tasks')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: completedTasks } = useQuery({
    queryKey: ['user-completed-tasks-today', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('user_task_completions')
        .select('task_key')
        .eq('user_id', user.id)
        .gte('completed_at', today);
      if (error && error.code !== 'PGRST116') return [];
      return data?.map(t => t.task_key) || [];
    },
    enabled: !!user,
    staleTime: 1 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (!tasks || tasks.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          لا توجد مهام متاحة حالياً
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => {
        const isCompleted = completedTasks?.includes(task.task_key);
        
        return (
          <Card key={task.id} className={isCompleted ? 'opacity-60' : ''}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  isCompleted ? 'bg-green-500/20' : 'bg-primary/10'
                }`}>
                  {isCompleted ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <Circle className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{task.title_ar}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{task.description_ar}</p>
                  <div className="flex items-center gap-1 mt-2">
                    <Coins className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-xs font-bold text-amber-600">+{task.points_reward} نقطة</span>
                  </div>
                </div>
                {!isCompleted && (
                  <Button size="sm" variant="outline" className="shrink-0">
                    ابدأ
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
