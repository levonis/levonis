import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Sparkles, Trophy, Lock } from 'lucide-react';

interface LettersConfig {
  target_word: string;
  prizes: Array<{
    name_ar: string;
    value?: number;
  }>;
  letter_probabilities?: Record<string, number>;
}

interface CollectedLettersDisplayProps {
  collectedLetters: string[];
  lettersConfig: LettersConfig;
}

export default function CollectedLettersDisplay({
  collectedLetters,
  lettersConfig
}: CollectedLettersDisplayProps) {
  const targetWord = lettersConfig?.target_word || '';
  const targetLetters = targetWord.split('');
  
  // Count collected letters
  const letterCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    collectedLetters.forEach(letter => {
      counts[letter] = (counts[letter] || 0) + 1;
    });
    return counts;
  }, [collectedLetters]);
  
  // Check which letters are collected
  const progress = useMemo(() => {
    const needed: Record<string, number> = {};
    targetLetters.forEach(letter => {
      needed[letter] = (needed[letter] || 0) + 1;
    });
    
    let collected = 0;
    let total = targetLetters.length;
    
    const letterStatus: Array<{ letter: string; collected: boolean; count: number; needed: number }> = [];
    const usedCounts: Record<string, number> = {};
    
    targetLetters.forEach(letter => {
      usedCounts[letter] = (usedCounts[letter] || 0) + 1;
      const hasEnough = (letterCounts[letter] || 0) >= usedCounts[letter];
      if (hasEnough) collected++;
      letterStatus.push({
        letter,
        collected: hasEnough,
        count: letterCounts[letter] || 0,
        needed: needed[letter]
      });
    });
    
    return {
      collected,
      total,
      percentage: total > 0 ? (collected / total) * 100 : 0,
      letterStatus,
      isComplete: collected === total
    };
  }, [targetLetters, letterCounts]);

  if (!targetWord) {
    return null;
  }

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          تقدمك في جمع الأحرف
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Target Word Display */}
        <div className="flex items-center justify-center gap-1 flex-wrap">
          {progress.letterStatus.map((item, index) => (
            <div
              key={index}
              className={`
                w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold
                transition-all duration-300 border-2
                ${item.collected 
                  ? 'bg-primary text-primary-foreground border-primary shadow-lg scale-105' 
                  : 'bg-muted/50 text-muted-foreground border-muted-foreground/30'
                }
              `}
            >
              {item.collected ? item.letter : (
                <Lock className="h-4 w-4 opacity-50" />
              )}
            </div>
          ))}
        </div>
        
        {/* Progress Bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">التقدم</span>
            <span className="font-medium">{progress.collected}/{progress.total}</span>
          </div>
          <Progress value={progress.percentage} className="h-2" />
        </div>
        
        {/* Collected Letters Summary */}
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">الأحرف المجمعة:</p>
          <div className="flex flex-wrap gap-1">
            {Object.entries(letterCounts).map(([letter, count]) => (
              <Badge key={letter} variant="secondary" className="gap-1">
                <span className="font-bold">{letter}</span>
                <span className="text-xs opacity-70">×{count}</span>
              </Badge>
            ))}
            {Object.keys(letterCounts).length === 0 && (
              <span className="text-sm text-muted-foreground">لم تجمع أي أحرف بعد</span>
            )}
          </div>
        </div>
        
        {/* Complete Message */}
        {progress.isComplete && (
          <div className="bg-primary/10 rounded-lg p-3 text-center border border-primary/30">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Trophy className="h-5 w-5 text-primary" />
              <span className="font-bold text-primary">مبروك! أكملت الكلمة</span>
            </div>
            {lettersConfig.prizes?.[0] && (
              <p className="text-sm text-muted-foreground">
                الجائزة: {lettersConfig.prizes[0].name_ar}
                {lettersConfig.prizes[0].value && ` (${lettersConfig.prizes[0].value.toLocaleString()})`}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
