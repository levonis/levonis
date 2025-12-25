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
  display_word?: string; // Custom display order for the word
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
      
      const result = data as { 
        success?: boolean; 
        prize_name?: string; 
        coupon_code?: string; 
        error?: string;
        send_telegram?: boolean;
        user_name?: string;
        user_phone?: string;
        user_governorate?: string;
        competition_title?: string;
      } | null;
      
      if (result?.success) {
        toast.success(
          <div className="space-y-1">
            <p>مبروك! حصلت على {result.prize_name}</p>
            <p className="font-bold text-lg">كود الخصم: {result.coupon_code}</p>
          </div>,
          { duration: 10000 }
        );
        
        // Send telegram notifications
        if (result.send_telegram) {
          // Get current user for telegram notification
          const { data: userData } = await supabase.auth.getUser();
          
          // Send notification to user via telegram
          if (userData?.user?.id) {
            try {
              await supabase.functions.invoke('send-user-telegram-notification', {
                body: {
                  user_id: userData.user.id,
                  title: '🎉 مبروك! ربحت جائزة',
                  message: `أكملت كلمة "${word}" في مسابقة "${result.competition_title}"!\n\n🎁 الجائزة: ${result.prize_name}\n🎟️ كود الخصم: ${result.coupon_code}\n\n⏰ صالح لمدة 30 يوم`,
                  notification_type: 'success'
                }
              });
            } catch (e) {
              console.log('Failed to send user telegram notification:', e);
            }
          }
          
          // Send notification to admin via telegram
          try {
            await supabase.functions.invoke('send-telegram-notification', {
              body: {
                message: `🏆 *فائز جديد في مسابقة الأحرف*\n\n👤 الفائز: ${result.user_name}\n📱 الهاتف: ${result.user_phone}\n📍 المحافظة: ${result.user_governorate}\n\n🏅 المسابقة: ${result.competition_title}\n🔤 الكلمة: "${word}"\n🎁 الجائزة: ${result.prize_name}\n🎟️ كود الخصم: \`${result.coupon_code}\``,
                parse_mode: 'Markdown'
              }
            });
          } catch (e) {
            console.log('Failed to send admin telegram notification:', e);
          }
        }
        
        onRedeemSuccess?.();
      } else {
        toast.error(result?.error || 'حدث خطأ');
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

  // Get the word to display - prioritize display_word, then longest prize word
  const mainWord = useMemo(() => {
    // First check for custom display word
    if (lettersConfig?.display_word) {
      return lettersConfig.display_word;
    }
    
    const words = lettersConfig?.prize_words || [];
    if (words.length === 0) return lettersConfig.target_word || '';
    // Find the longest word (usually the main word)
    const longestWord = words.reduce((prev, curr) => 
      (curr.word?.length || 0) > (prev.word?.length || 0) ? curr : prev
    , words[0]);
    return longestWord?.word || lettersConfig.target_word || '';
  }, [lettersConfig]);

  // Check if the word is Arabic (contains Arabic characters)
  const isArabic = useMemo(() => /[\u0600-\u06FF]/.test(mainWord), [mainWord]);

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          تقدمك في جمع الأحرف
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Word Display - Show all letters in one line with count below */}
        <div className="flex items-start justify-center gap-1 overflow-x-auto pb-2" dir="rtl">
          {mainWord.split('').map((letter, index) => {
            const count = letterCounts[letter] || 0;
            // Count how many of this letter we need up to this position (from start)
            const sameLettersBefore = mainWord.slice(0, index + 1).split('').filter(l => l === letter).length;
            const letterAvailable = count >= sameLettersBefore;
            
            return (
              <div key={index} className="flex flex-col items-center flex-shrink-0">
                <div
                  className={`
                    w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center text-lg sm:text-xl font-bold
                    transition-all duration-300 border-2
                    ${letterAvailable 
                      ? 'bg-primary text-primary-foreground border-primary shadow-lg' 
                      : 'bg-muted/20 text-muted-foreground/30 border-dashed border-muted-foreground/20'
                    }
                  `}
                >
                  {letter}
                </div>
                <span className={`text-xs mt-1 font-medium ${letterAvailable ? 'text-primary' : 'text-muted-foreground/50'}`}>
                  {count > 0 ? count : '-'}
                </span>
              </div>
            );
          })}
        </div>
        
        {/* Word completion status */}
        <div className="text-center">
          {wordStatus[0]?.canRedeem ? (
            <Badge className="bg-green-500 text-white">الكلمة مكتملة! يمكنك الاستبدال</Badge>
          ) : (
            <p className="text-sm text-muted-foreground">
              اجمع كل الأحرف لتكوين الكلمة والفوز بالجائزة
            </p>
          )}
        </div>
        
        {/* Collected Letters Summary (all letters collected) */}
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">الأحرف المجمعة:</p>
          <div className="flex flex-wrap gap-1">
            {Object.entries(letterCounts)
              .sort(([a], [b]) => a.localeCompare(b, 'ar'))
              .map(([letter, count]) => (
                <Badge key={letter} variant="secondary" className="gap-1">
                  <span className="font-bold">{letter}</span>
                  <span className="text-xs opacity-70">×{count}</span>
                </Badge>
              ))}
            {Object.keys(letterCounts).length === 0 && (
              <span className="text-sm text-muted-foreground">لم تجمع أي حرف بعد</span>
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
