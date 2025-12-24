import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Play, Sparkles, Gift, RotateCcw, Ticket } from "lucide-react";
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

interface SimulatedResult {
  index: number;
  type: string;
  letter?: string;
  isBetterLuck?: boolean;
  isWinner?: boolean;
  prize?: any;
}

interface CompetitionTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  competition: Competition | null;
}

export default function CompetitionTestDialog({ open, onOpenChange, competition }: CompetitionTestDialogProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [testQuantity, setTestQuantity] = useState(1);
  
  // Simulation queue for collect_letters
  const [simulatedResults, setSimulatedResults] = useState<SimulatedResult[]>([]);
  const [currentResultIndex, setCurrentResultIndex] = useState(0);
  const [collectedLettersInSession, setCollectedLettersInSession] = useState<string[]>([]);
  
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
  const [testResults, setTestResults] = useState<SimulatedResult[]>([]);

  // Show next result in queue (for scratch card one-by-one)
  const showNextScratchResult = useCallback(() => {
    if (!competition || currentResultIndex >= simulatedResults.length) {
      return;
    }
    
    const result = simulatedResults[currentResultIndex];
    const newCollected = result.letter && !result.isBetterLuck
      ? [...collectedLettersInSession, result.letter]
      : collectedLettersInSession;
    
    setCollectedLettersInSession(newCollected);
    
    setLetterRevealData({
      letter: result.isBetterLuck ? null : (result.letter || null),
      collected: collectedLettersInSession,
      config: competition?.letters_config || {},
      prize: null
    });
    
    setShowScratchReveal(true);
  }, [currentResultIndex, simulatedResults, collectedLettersInSession, competition]);

  // Handle scratch reveal close - go to next or finish
  const handleScratchClose = useCallback(() => {
    setShowScratchReveal(false);
    
    const nextIndex = currentResultIndex + 1;
    if (nextIndex < simulatedResults.length && competition) {
      setCurrentResultIndex(nextIndex);
      // Show next after a short delay
      setTimeout(() => {
        const result = simulatedResults[nextIndex];
        const newCollected = result.letter && !result.isBetterLuck
          ? [...collectedLettersInSession, result.letter]
          : collectedLettersInSession;
        
        setCollectedLettersInSession(newCollected);
        
        setLetterRevealData({
          letter: result.isBetterLuck ? null : (result.letter || null),
          collected: newCollected,
          config: competition?.letters_config || {},
          prize: null
        });
        
        setShowScratchReveal(true);
      }, 300);
    }
  }, [currentResultIndex, simulatedResults, collectedLettersInSession, competition]);

  // Handle letter reveal close (for bags animation type single)
  const handleLetterClose = useCallback(() => {
    setShowLetterReveal(false);
  }, []);

  if (!competition) return null;

  const animationType = competition.letters_config?.animation_type || 'bags';

  // Simulate instant win logic locally
  const simulateInstantWin = (): SimulatedResult => {
    const winProbability = competition.win_probability || 10;
    const randomVal = Math.random() * 100;
    const isWinner = randomVal <= winProbability;
    
    let prize = null;
    if (isWinner && competition.prize_tiers && competition.prize_tiers.length > 0) {
      const randomIndex = Math.floor(Math.random() * competition.prize_tiers.length);
      prize = competition.prize_tiers[randomIndex];
    } else if (isWinner) {
      prize = {
        name_ar: competition.prize_description_ar,
        value: competition.prize_value
      };
    }
    
    return { index: 0, type: 'instant_winner', isWinner, prize };
  };

  // Simulate mystery box logic
  const simulateMysteryBox = (): SimulatedResult => {
    const boxes = competition.mystery_boxes || [];
    if (boxes.length === 0) {
      return { index: 0, type: 'mystery_box', prize: { name_ar: "لا توجد صناديق", probability: 100 } };
    }
    
    const randomVal = Math.random() * 100;
    let cumulative = 0;
    
    for (const box of boxes) {
      cumulative += box.probability || 10;
      if (randomVal <= cumulative) {
        return { index: 0, type: 'mystery_box', prize: box };
      }
    }
    
    return { index: 0, type: 'mystery_box', prize: boxes[0] };
  };

  // Simulate everyone wins logic
  const simulateEveryoneWins = (): SimulatedResult => {
    const tiers = competition.prize_tiers || [];
    if (tiers.length === 0) {
      return { index: 0, type: 'everyone_wins', prize: { name_ar: "لا توجد جوائز", probability: 100 } };
    }
    
    const randomVal = Math.random() * 100;
    let cumulative = 0;
    
    for (const tier of tiers) {
      cumulative += tier.probability || 10;
      if (randomVal <= cumulative) {
        return { index: 0, type: 'everyone_wins', prize: tier };
      }
    }
    
    return { index: 0, type: 'everyone_wins', prize: tiers[0] };
  };

  // Simulate collect letters logic
  const simulateCollectLetters = (): SimulatedResult => {
    const config = competition.letters_config || {};
    const targetWord = config.target_word || "فوز";
    const betterLuckProb = config.better_luck_probability || 0;
    const letterProbs = config.letter_probabilities || {};
    
    // Check if better luck
    if (Math.random() * 100 < betterLuckProb) {
      return { index: 0, type: 'collect_letters', letter: undefined, isBetterLuck: true };
    }
    
    // Get unique letters from target word
    const letters: string[] = [...new Set(targetWord.split(''))].filter((l): l is string => l !== '');
    
    // Select letter based on probabilities
    const randomVal = Math.random() * 100;
    let cumulative = 0;
    const typedLetterProbs = letterProbs as Record<string, number>;

    // Only include letters with probability > 0
    const entries = letters.map((letter) => {
      const prob = typedLetterProbs[letter] ?? undefined;
      return { letter, prob };
    });

    const hasAnyExplicit = entries.some((e) => typeof e.prob === 'number');
    const usable = entries.filter((e) => {
      if (!hasAnyExplicit) return true;
      return (e.prob ?? 0) > 0;
    });

    if (usable.length === 0) {
      return { index: 0, type: 'collect_letters', letter: undefined, isBetterLuck: true };
    }

    const fallbackProb = 100 / usable.length;

    for (let i = 0; i < usable.length; i++) {
      const { letter, prob } = usable[i];
      const weight = hasAnyExplicit ? (prob ?? 0) : fallbackProb;
      cumulative += weight;
      if (randomVal <= cumulative) {
        return { index: 0, type: 'collect_letters', letter, isBetterLuck: false };
      }
    }

    return { index: 0, type: 'collect_letters', letter: usable[0]?.letter || '', isBetterLuck: false };
  };


  const runTest = () => {
    setIsRunning(true);
    const results: SimulatedResult[] = [];
    
    // Reset session state
    setSimulatedResults([]);
    setCurrentResultIndex(0);
    setCollectedLettersInSession([]);
    
    setTimeout(() => {
      for (let i = 0; i < testQuantity; i++) {
        let result: SimulatedResult;
        
        switch (competition.competition_type) {
          case 'instant_winner':
            result = { ...simulateInstantWin(), index: i + 1 };
            break;
            
          case 'mystery_box':
            result = { ...simulateMysteryBox(), index: i + 1 };
            break;
            
          case 'everyone_wins':
            result = { ...simulateEveryoneWins(), index: i + 1 };
            break;
            
          case 'collect_letters':
            result = { ...simulateCollectLetters(), index: i + 1 };
            break;
            
          default:
            result = { index: i + 1, type: competition.competition_type };
        }
        
        results.push(result);
      }
      
      setTestResults(prev => [...results, ...prev]);
      
      // Show animation
      if (results.length > 0) {
        const firstResult = results[0];
        
        if (firstResult.type === 'instant_winner') {
          setInstantRevealResult({ isWinner: firstResult.isWinner || false, prize: firstResult.prize });
          setShowInstantReveal(true);
          if (firstResult.isWinner) setShowCelebration(true);
        } else if (firstResult.type === 'mystery_box' || firstResult.type === 'everyone_wins') {
          setInstantRevealResult({ isWinner: true, prize: firstResult.prize });
          setShowInstantReveal(true);
          setShowCelebration(true);
        } else if (firstResult.type === 'collect_letters') {
          if (animationType === 'scratch') {
            // For scratch: show one by one
            setSimulatedResults(results);
            setCurrentResultIndex(0);
            setCollectedLettersInSession([]);
            
            // Start with first result
            setLetterRevealData({
              letter: firstResult.isBetterLuck ? null : (firstResult.letter || null),
              collected: [],
              config: competition.letters_config || {},
              prize: null
            });
            setShowScratchReveal(true);
          } else {
            // For bags animation - always use BagOpenReveal
            const bagResults = results.map(r => ({
              letter: r.isBetterLuck ? null : (r.letter || null),
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
    setCollectedLettersInSession([]);
  };

  const getResultBadge = (result: SimulatedResult) => {
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
                {competition.competition_type === 'collect_letters' && (
                  <>
                    الكلمة: {competition.letters_config?.target_word || 'فوز'}
                    {' | '}
                    الأنميشن: {animationType === 'scratch' ? '🎫 مسح تذكرة' : '🛍️ فتح كيس'}
                  </>
                )}
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

                {/* Collected letters in current session */}
                {competition.competition_type === 'collect_letters' && collectedLettersInSession.length > 0 && (
                  <div className="p-3 bg-violet-500/10 rounded-lg">
                    <p className="text-sm font-medium mb-2 flex items-center gap-1">
                      <Ticket className="h-4 w-4" />
                      الأحرف المجمعة في هذه الجلسة:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(
                        collectedLettersInSession.reduce<Record<string, number>>((acc, l) => {
                          acc[l] = (acc[l] ?? 0) + 1;
                          return acc;
                        }, {})
                      ).map(([letter, count]) => (
                        <Badge key={letter} className="bg-violet-500">
                          {letter} {count > 1 && `×${count}`}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {testResults.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>نتائج الاختبار ({testResults.length})</Label>
                      <Button variant="ghost" size="sm" onClick={clearResults} className="gap-1 text-muted-foreground">
                        <RotateCcw className="h-3 w-3" />
                        مسح
                      </Button>
                    </div>
                    <ScrollArea className="h-48 border rounded-lg p-2">
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
                            <p>حظاً أوفر: {testResults.filter(r => r.isBetterLuck).length} ({((testResults.filter(r => r.isBetterLuck).length / testResults.length) * 100).toFixed(1)}%)</p>
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
        onClose={handleLetterClose}
        awardedLetter={letterRevealData?.letter || null}
        collectedLetters={letterRevealData?.collected || []}
        lettersConfig={letterRevealData?.config || { target_word: '', prizes: [] }}
        wonPrize={letterRevealData?.prize}
      />

      <ScratchCardReveal
        isOpen={showScratchReveal}
        onClose={handleScratchClose}
        awardedLetter={letterRevealData?.letter || null}
        collectedLetters={collectedLettersInSession}
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
