import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Coins, LogIn, Share2, UserPlus, Gift } from "lucide-react";
import { cn } from "@/lib/utils";

interface DailyTaskCardProps {
  task: {
    task_key: string;
    title_ar: string;
    description_ar: string;
    icon: string;
    points_reward: number;
    task_type: string;
  };
  isCompleted: boolean;
  onComplete: (taskKey: string) => void;
  isLoading?: boolean;
}

const getIcon = (iconName: string) => {
  const icons: { [key: string]: any } = {
    LogIn,
    Share2,
    UserPlus,
    Gift,
    Coins,
  };
  const Icon = icons[iconName] || Circle;
  return <Icon className="h-6 w-6" />;
};

export default function DailyTaskCard({ task, isCompleted, onComplete, isLoading }: DailyTaskCardProps) {
  return (
    <Card className={cn(
      "relative overflow-hidden transition-all hover:shadow-lg",
      isCompleted && "bg-muted/50 border-green-500/50"
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-full",
              isCompleted ? "bg-green-500/20 text-green-500" : "bg-primary/20 text-primary"
            )}>
              {getIcon(task.icon)}
            </div>
            <div>
              <CardTitle className="text-lg">{task.title_ar}</CardTitle>
              <CardDescription className="text-sm mt-1">
                {task.description_ar}
              </CardDescription>
            </div>
          </div>
          {isCompleted && (
            <CheckCircle2 className="h-6 w-6 text-green-500" />
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <Badge variant="secondary" className="gap-1">
            <Coins className="h-3 w-3" />
            {task.points_reward} نقطة
          </Badge>
          {!isCompleted ? (
            <Button
              size="sm"
              onClick={() => onComplete(task.task_key)}
              disabled={isLoading}
            >
              {isLoading ? "جاري..." : "إكمال"}
            </Button>
          ) : (
            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/50">
              تم الإكمال
            </Badge>
          )}
        </div>
        {task.task_type === 'daily' && (
          <p className="text-xs text-muted-foreground mt-2">
            * يمكن إكمال هذه المهمة يومياً
          </p>
        )}
      </CardContent>
    </Card>
  );
}