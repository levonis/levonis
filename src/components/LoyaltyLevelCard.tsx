import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Check, Lock, Star, Crown, Award, Trophy } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

interface LoyaltyLevel {
  level_key: string;
  name_ar: string;
  name_en: string;
  min_points: number;
  color: string;
  benefits: Array<{ text_ar: string; text_en: string }>;
  discount_percentage: number;
  bonus_points_percentage: number;
  free_shipping: boolean;
  display_order: number;
}

interface LoyaltyLevelCardProps {
  level: LoyaltyLevel;
  userPoints: number;
  currentLevel: string;
  nextLevel?: LoyaltyLevel;
}

const getLevelIcon = (levelKey: string) => {
  switch (levelKey) {
    case "bronze":
      return Award;
    case "silver":
      return Star;
    case "gold":
      return Crown;
    case "platinum":
      return Trophy;
    default:
      return Award;
  }
};

export default function LoyaltyLevelCard({
  level,
  userPoints,
  currentLevel,
  nextLevel,
}: LoyaltyLevelCardProps) {
  const { t, language } = useLanguage();
  const isCurrentLevel = level.level_key === currentLevel;
  const isUnlocked = userPoints >= level.min_points;
  const Icon = getLevelIcon(level.level_key);
  const levelName = language === 'ar' ? level.name_ar : (level.name_en || level.name_ar);
  
  const pointsToNextLevel = nextLevel
    ? nextLevel.min_points - userPoints
    : 0;
  
  const progressToNextLevel = nextLevel
    ? Math.min(
        ((userPoints - level.min_points) /
          (nextLevel.min_points - level.min_points)) *
          100,
        100
      )
    : 100;

  return (
    <Card
      className={`relative overflow-hidden transition-all ${
        isCurrentLevel
          ? "border-2 shadow-lg scale-105"
          : isUnlocked
          ? "border-border/50"
          : "border-border/30 opacity-75"
      }`}
      style={{
        borderColor: isCurrentLevel ? level.color : undefined,
      }}
    >
      {isCurrentLevel && (
        <div
          className="absolute top-0 left-0 right-0 h-1"
          style={{ backgroundColor: level.color }}
        />
      )}

      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="p-3 rounded-full"
              style={{
                backgroundColor: `${level.color}20`,
                color: level.color,
              }}
            >
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-xl">{levelName}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {t('loyalty_points_and_above', { n: level.min_points })}
              </p>
            </div>
          </div>
          {isCurrentLevel && (
            <Badge
              style={{
                backgroundColor: level.color,
                color: "white",
              }}
            >
              {t('loyalty_current_level')}
            </Badge>
          )}
          {!isUnlocked && (
            <Lock className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress to next level */}
        {isCurrentLevel && nextLevel && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{t('loyalty_progress_next')}</span>
              <span className="font-medium">
                {t('loyalty_points_remaining', { n: pointsToNextLevel })}
              </span>
            </div>
            <Progress
              value={progressToNextLevel}
              className="h-2"
              style={{
                backgroundColor: `${level.color}20`,
              }}
            />
          </div>
        )}

        {/* Benefits */}
        <div className="space-y-3">
          <h4 className="font-semibold text-sm">{t('loyalty_benefits')}</h4>
          <div className="space-y-2">
            {level.benefits.map((benefit, index) => (
              <div
                key={index}
                className="flex items-start gap-2 text-sm"
              >
                <Check
                  className="h-4 w-4 mt-0.5 flex-shrink-0"
                  style={{ color: level.color }}
                />
                <span className={isUnlocked ? "" : "text-muted-foreground"}>
                  {language === 'ar' ? benefit.text_ar : (benefit.text_en || benefit.text_ar)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Perks summary */}
        {(level.discount_percentage > 0 ||
          level.bonus_points_percentage > 0 ||
          level.free_shipping) && (
          <div className="pt-3 border-t space-y-1">
            {level.discount_percentage > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('loyalty_discount')}</span>
                <span className="font-medium">
                  {level.discount_percentage}%
                </span>
              </div>
            )}
            {level.bonus_points_percentage > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('loyalty_bonus_points')}</span>
                <span className="font-medium">
                  {level.bonus_points_percentage}%
                </span>
              </div>
            )}
            {level.free_shipping && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('loyalty_shipping')}</span>
                <span className="font-medium text-green-600">{t('loyalty_free')}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}