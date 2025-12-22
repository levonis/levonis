import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Play, Sparkles, Gift, Ticket, RotateCcw } from "lucide-react";
import InstantWinReveal from "./InstantWinReveal";
import LetterReveal from "./LetterReveal";
import ScratchCardReveal from "./ScratchCardReveal";
import BagOpenReveal from "./BagOpenReveal";
import CelebrationEffect from "./CelebrationEffect";

type CompetitionType = 'ticket_count' | 'all_tickets_sold' | 'timed' | 'free' | 'instant_winner' | 'everyone_wins' | 'escalating_price' | 'mystery_box' | 'hidden_winner' | 'team_battle' | 'flash_sale' | 'growing_prize' | 'collect_letters';

interface Competition {
  id: string;
  title_ar: string;
  competition_type: CompetitionType;
  win_probability?: number;
  prize_tiers?: any;
  mystery_boxes?: any;
  letters_config?: any;
  prize_description_ar: string;
  prize_value?: number;
}

interface CompetitionTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  competition: Competition | null;
}

export default function CompetitionTestDialog({ open, onOpenChange, competition }: CompetitionTestDialogProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [testQuantity, setTestQuantity] = useState(1);
  
  // Animation states
  const [showInstantReveal, setShowInstantReveal] = useState(false);
  const [instantRevealResult, setInstantRevealResult] = useState<{ isWinner: boolean; prize: any } | null>(null);
  const [showLetterReveal, setShowLetterReveal] = useState(false);
  const [showScratchReveal, setShowScratchReveal] = useState(false);
  const [showBagReveal, setShowBagReveal] = useState(false);
  const [letterRevealData, setLetterRevealData] = useState<{ letter: string | null; collected: string[]; config: any; prize: any } | null>(null);
  const [bagRevealResults, setBagRevealResults] = useState<{ letter: string | null; isNew: boolean }[]>([]);
  const [showCelebration, setShowCelebration] = useState(false);
  
  // Test results log
  const [testResults, setTestResults] = useState<any[]>([]);

  if (!competition) return null;

  // Simulate instant win logic locally (no DB calls)
  const simulateInstantWin = () => {
    const winProbability = competition.win_probability || 10;
    const randomVal = Math.random() * 100;
    const isWinner = randomVal <= winProbability;
    
    let prize = null;
    if (isWinner && competition.prize_tiers && competition.prize_tiers.length > 0) {
      // Random selection from prize tiers
      const randomIndex = Math.floor(Math.random() * competition.prize_tiers.length);
      prize = competition.prize_tiers[randomIndex];
    } else if (isWinner) {
      prize = {
        name_ar: competition.prize_description_ar,
        value: competition.prize_value
      };
    }
    
    return { isWinner, prize };
  };

  // Simulate mystery box logic
  const simulateMysteryBox = () => {
    const boxes = competition.mystery_boxes || [];
    if (boxes.length === 0) {
      return { prize: { name_ar: "لا توجد صناديق", probability: 100 } };
    }
    
    const randomVal = Math.random() * 100;
    let cumulative = 0;
    
    for (const box of boxes) {
      cumulative += box.probability || 10;
      if (randomVal <= cumulative) {
        return { prize: box };
      }
    }
    
    return { prize: boxes[0] };
  };

  // Simulate everyone wins logic
  const simulateEveryoneWins = () => {
    const tiers = competition.prize_tiers || [];
    if (tiers.length === 0) {
      return { prize: { name_ar: "لا توجد جوائز", probability: 100 } };
    }
    
    const randomVal = Math.random() * 100;
    let cumulative = 0;
    
    for (const tier of tiers) {
      cumulative += tier.probability || 10;
      if (randomVal <= cumulative) {
        return { prize: tier };
      }
    }
    
    return { prize: tiers[0] };
  };

  // Simulate collect letters logic
  const simulateCollectLetters = () => {
    const config = competition.letters_config || {};
    const targetWord = config.target_word || "فوز";
    const betterLuckProb = config.better_luck_probability || 0;
    const letterProbs = config.letter_probabilities || {};
    
    // Check if better luck
    if (Math.random() * 100 < betterLuckProb) {
      return { letter: null, isBetterLuck: true };
    }
    
    // Get unique letters from target word
    const letters: string[] = [...new Set(targetWord.split(''))].filter((l): l is string => l !== '');
    
    // Select letter based on probabilities
    const randomVal = Math.random() * 100;
    let cumulative = 0;
    const typedLetterProbs = letterProbs as Record<string, number>;
    
    for (let i = 0; i < letters.length; i++) {
      const letter = letters[i];
      const prob = typedLetterProbs[letter] || (100 / letters.length);
      cumulative += prob;
      if (randomVal <= cumulative) {
        return { letter, isBetterLuck: false };
      }
    }
    
    return { letter: letters[0] || '', isBetterLuck: false };
  };

  const runTest = () => {
    setIsRunning(true);
    const results: any[] = [];
    
    setTimeout(() => {
      for (let i = 0; i < testQuantity; i++) {
        let result: any = { index: i + 1 };
        
        switch (competition.competition_type) {
          case 'instant_winner':
            const instantResult = simulateInstantWin();
            result = { ...result, ...instantResult, type: 'instant_winner' };
            break;
            
          case 'mystery_box':
            const mysteryResult = simulateMysteryBox();
            result = { ...result, ...mysteryResult, type: 'mystery_box' };
            break;
            
          case 'everyone_wins':
            const everyoneResult = simulateEveryoneWins();
            result = { ...result, ...everyoneResult, type: 'everyone_wins' };
            break;
            
          case 'collect_letters':
            const lettersResult = simulateCollectLetters();
            result = { ...result, ...lettersResult, type: 'collect_letters' };
            break;
            
          default:
            result = { ...result, message: 'نوع المسابقة لا يدعم الاختبار', type: competition.competition_type };
        }
        
        results.push(result);
      }
      
      setTestResults(prev => [...results, ...prev]);
      
      // Show animation for the first result
      if (results.length > 0) {
        const firstResult = results[0];
        
        if (firstResult.type === 'instant_winner') {
          setInstantRevealResult({ isWinner: firstResult.isWinner, prize: firstResult.prize });
          setShowInstantReveal(true);
          if (firstResult.isWinner) setShowCelebration(true);
        } else if (firstResult.type === 'mystery_box' || firstResult.type === 'everyone_wins') {
          setInstantRevealResult({ isWinner: true, prize: firstResult.prize });
          setShowInstantReveal(true);
          setShowCelebration(true);
        } else if (firstResult.type === 'collect_letters') {
          const animationType = competition.letters_config?.animation_type || 'bags';
          
          if (testQuantity === 1) {
            setLetterRevealData({
              letter: firstResult.isBetterLuck ? null : firstResult.letter,
              collected: [],
              config: competition.letters_config || {},
              prize: null
            });
            
            if (animationType === 'scratch') {
              setShowScratchReveal(true);
            } else {
              setShowLetterReveal(true);
            }
          } else {
            const bagResults = results.map(r => ({
              letter: r.isBetterLuck ? null : r.letter,
              isNew: true
            }));
            
            setBagRevealResults(bagResults);
            setLetterRevealData({
              letter: null,
              collected: [],
              config: competition.letters_config || {},
              prize: null
            });
            setShowBagReveal(true);
          }
        }
      }
      
      setIsRunning(false);
    }, 300);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const getResultBadge = (result: any) => {
    if (result.type === 'instant_winner') {
      return result.isWinner ? (
        <Badge className="bg-green-500">فائز 🎉</Badge>
      ) : (
        <Badge variant="secondary">لم يحالفك الحظ</Badge>
      );
    }
    if (result.type === 'collect_letters') {
      return result.isBetterLuck ? (
        <Badge variant="secondary">حظاً أوفر</Badge>
      ) : (
        <Badge className="bg-violet-500">حرف: {result.letter}</Badge>
      );
    }
    if (result.prize) {
      return <Badge className="bg-green-500">{result.prize.name_ar}</Badge>;
    }
    return <Badge variant="secondary">لا نتيجة</Badge>;
  };

  const competitionTypeSupportsTest = ['instant_winner', 'everyone_wins', 'mystery_box', 'collect_letters'].includes(competition.competition_type);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="h-5 w-5 text-primary" />
              اختبار المسابقة
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="font-semibold">{competition.title_ar}</p>
              <p className="text-sm text-muted-foreground">
                {competition.competition_type === 'instant_winner' && `نسبة الفوز: ${competition.win_probability || 10}%`}
                {competition.competition_type === 'collect_letters' && `الكلمة المستهدفة: ${competition.letters_config?.target_word || 'فوز'}`}
                {competition.competition_type === 'mystery_box' && `عدد الصناديق: ${competition.mystery_boxes?.length || 0}`}
                {competition.competition_type === 'everyone_wins' && `عدد مستويات الجوائز: ${competition.prize_tiers?.length || 0}`}
              </p>
            </div>

            {competitionTypeSupportsTest ? (
              <>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Label>عدد المحاولات</Label>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={testQuantity}
                      onChange={(e) => setTestQuantity(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                    />
                  </div>
                  <div className="pt-6">
                    <Button onClick={runTest} disabled={isRunning} className="gap-2">
                      {isRunning ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      تشغيل الاختبار
                    </Button>
                  </div>
                </div>

                {testResults.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>نتائج الاختبار ({testResults.length})</Label>
                      <Button variant="ghost" size="sm" onClick={clearResults} className="gap-1 text-muted-foreground">
                        <RotateCcw className="h-3 w-3" />
                        مسح
                      </Button>
                    </div>
                    <ScrollArea className="h-64 border rounded-lg p-2">
                      <div className="space-y-2">
                        {testResults.map((result, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-muted/30 rounded text-sm">
                            <span className="text-muted-foreground">#{result.index}</span>
                            {getResultBadge(result)}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                    
                    {/* Statistics */}
                    {testResults.length > 1 && (
                      <div className="p-3 bg-primary/5 rounded-lg text-sm">
                        <p className="font-semibold mb-2">إحصائيات:</p>
                        {competition.competition_type === 'instant_winner' && (
                          <>
                            <p>عدد الفائزين: {testResults.filter(r => r.isWinner).length} ({((testResults.filter(r => r.isWinner).length / testResults.length) * 100).toFixed(1)}%)</p>
                            <p>عدد الخاسرين: {testResults.filter(r => !r.isWinner).length}</p>
                          </>
                        )}
                        {competition.competition_type === 'collect_letters' && (
                          <>
                            <p>حظاً أوفر: {testResults.filter(r => r.isBetterLuck).length}</p>
                            <p>توزيع الأحرف:</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {[...new Set(testResults.filter(r => r.letter).map(r => r.letter))].map(letter => (
                                <Badge key={letter} variant="outline">
                                  {letter}: {testResults.filter(r => r.letter === letter).length}
                                </Badge>
                              ))}
                            </div>
                          </>
                        )}
                        {(competition.competition_type === 'mystery_box' || competition.competition_type === 'everyone_wins') && (
                          <>
                            <p>توزيع الجوائز:</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {[...new Set(testResults.map(r => r.prize?.name_ar))].filter(Boolean).map(name => (
                                <Badge key={name} variant="outline">
                                  {name}: {testResults.filter(r => r.prize?.name_ar === name).length}
                                </Badge>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Gift className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>هذا النوع من المسابقات لا يدعم الاختبار</p>
                <p className="text-sm">المسابقات المدعومة: الفائز الفوري، الكل رابح، صندوق الغموض، جمع الأحرف</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Animation overlays */}
      <InstantWinReveal
        isOpen={showInstantReveal}
        onClose={() => setShowInstantReveal(false)}
        isWinner={instantRevealResult?.isWinner || false}
        prize={instantRevealResult?.prize}
        competitionType={competition?.competition_type === 'mystery_box' ? 'mystery_box' : competition?.competition_type === 'everyone_wins' ? 'everyone_wins' : 'instant_winner'}
      />

      <LetterReveal
        isOpen={showLetterReveal}
        onClose={() => setShowLetterReveal(false)}
        awardedLetter={letterRevealData?.letter || null}
        collectedLetters={letterRevealData?.collected || []}
        lettersConfig={letterRevealData?.config || { target_word: '', prizes: [] }}
        wonPrize={letterRevealData?.prize}
      />

      <ScratchCardReveal
        isOpen={showScratchReveal}
        onClose={() => setShowScratchReveal(false)}
        awardedLetter={letterRevealData?.letter || null}
        collectedLetters={letterRevealData?.collected || []}
        lettersConfig={letterRevealData?.config || { target_word: '', prizes: [] }}
        wonPrize={letterRevealData?.prize}
      />

      <BagOpenReveal
        isOpen={showBagReveal}
        onClose={() => setShowBagReveal(false)}
        results={bagRevealResults}
        collectedLetters={letterRevealData?.collected || []}
        lettersConfig={letterRevealData?.config || { target_word: '', prizes: [] }}
        wonPrize={letterRevealData?.prize}
      />

      <CelebrationEffect
        isActive={showCelebration}
        winnerName="اختبار"
        onComplete={() => setShowCelebration(false)}
      />
    </>
  );
}
