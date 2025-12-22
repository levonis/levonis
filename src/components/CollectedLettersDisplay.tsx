import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, Trophy, Gift, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PrizeWord {
  word: string;
  prize_name_ar: string;
  prize_value: number;
  stock: number;
  product_id?: string;
}

interface LettersConfig {
  target_word: string;
  prize_words?: PrizeWord[];
  letter_probabilities?: Record<string, number>;
}

interface CollectedLettersDisplayProps {
  collectedLetters: string[];
  lettersConfig: LettersConfig;
  competitionId: string;
  onRedeemSuccess?: () => void;
}

export default function CollectedLettersDisplay({
  collectedLetters,
  lettersConfig,
  competitionId,
  onRedeemSuccess
}: CollectedLettersDisplayProps) {
  const [redeeming, setRedeeming] = useState<string | null>(null);
  
  // Get all unique letters from all prize words
  const allLetters = useMemo(() => {
    const words = lettersConfig?.prize_words || [];
    const letters = new Set<string>();
    words.forEach(w => w.word.split('').forEach(l => letters.add(l)));
    return Array.from(letters);
  }, [lettersConfig]);

  // Count collected letters
  const letterCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    collectedLetters.forEach(letter => {
      counts[letter] = (counts[letter] || 0) + 1;
    });
    return counts;
  }, [collectedLetters]);

  // Check which words can be redeemed
  const wordStatus = useMemo(() => {
    const words = lettersConfig?.prize_words || [];
    return words.map(pw => {
      const requiredCounts: Record<string, number> = {};
      pw.word.split('').forEach(l => {
        requiredCounts[l] = (requiredCounts[l] || 0) + 1;
      });
      
      const canRedeem = Object.entries(requiredCounts).every(
        ([letter, needed]) => (letterCounts[letter] || 0) >= needed
      );
      
      return {
        ...pw,
        canRedeem,
        hasStock: pw.stock > 0
      };
    });
  }, [lettersConfig, letterCounts]);

  const handleRedeem = async (word: string) => {
    setRedeeming(word);
    try {
      const { data, error } = await supabase.rpc('redeem_letters_prize', {
        p_competition_id: competitionId,
        p_word: word
      });
      
      if (error) throw error;
      
      if (data?.success) {
        toast.success(`مبروك! حصلت على ${data.prize_name}`);
        onRedeemSuccess?.();
      } else {
        toast.error(data?.error || 'حدث خطأ');
      }
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ');
    } finally {
      setRedeeming(null);
    }
  };

  if (!lettersConfig?.prize_words?.length) {
    return null;
  }

  // Get main display word (first prize word or target_word)
  const mainWord = lettersConfig.prize_words[0]?.word || lettersConfig.target_word || '';

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          تقدمك في جمع الأحرف
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Word Display - Letters with counts */}
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {mainWord.split('').filter((v, i, a) => a.indexOf(v) === i).map((letter, index) => {
            const count = letterCounts[letter] || 0;
            const hasLetter = count > 0;
            return (
              <div key={index} className="flex flex-col items-center">
                <div
                  className={`
                    w-12 h-12 rounded-lg flex items-center justify-center text-xl font-bold
                    transition-all duration-300 border-2
                    ${hasLetter 
                      ? 'bg-primary text-primary-foreground border-primary shadow-lg' 
                      : 'bg-muted/30 text-muted-foreground/40 border-muted-foreground/20'
                    }
                  `}
                >
                  {letter}
                </div>
                <span className={`text-xs mt-1 font-medium ${hasLetter ? 'text-primary' : 'text-muted-foreground'}`}>
                  ×{count}
                </span>
              </div>
            );
          })}
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
        
        {/* Available Prize Words */}
        <div className="space-y-2 border-t pt-3">
          <p className="text-sm font-medium flex items-center gap-1">
            <Gift className="h-4 w-4" />
            الجوائز المتاحة:
          </p>
          <div className="space-y-2">
            {wordStatus.map((word, idx) => (
              <div 
                key={idx} 
                className={`p-3 rounded-lg border ${word.canRedeem && word.hasStock ? 'bg-primary/10 border-primary/30' : 'bg-muted/50 border-muted'}`}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold tracking-widest">{word.word}</span>
                      <Badge variant={word.hasStock ? "secondary" : "destructive"} className="text-xs">
                        متبقي: {word.stock}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {word.prize_name_ar}
                      {word.prize_value > 0 && ` - ${word.prize_value.toLocaleString()}`}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    disabled={!word.canRedeem || !word.hasStock || redeeming === word.word}
                    onClick={() => handleRedeem(word.word)}
                  >
                    {redeeming === word.word ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Trophy className="h-4 w-4 ml-1" />
                        استبدال
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
