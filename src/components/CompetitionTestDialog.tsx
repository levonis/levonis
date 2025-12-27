import { useState, useCallback, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Play, Sparkles, Gift, RotateCcw, Ticket, Trophy, Eye, Zap, Target, Package } from "lucide-react";
import InstantWinReveal from "./InstantWinReveal";
import LetterReveal from "./LetterReveal";
import ScratchCardReveal from "./ScratchCardReveal";
import BagOpenReveal from "./BagOpenReveal";
import MysteryBoxReveal from "./MysteryBoxReveal";
import CelebrationEffect from "./CelebrationEffect";
import { toast } from "sonner";

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
  const [activeTab, setActiveTab] = useState("random");
  
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
  const [showMysteryBoxReveal, setShowMysteryBoxReveal] = useState(false);
  const [mysteryBoxWonPrize, setMysteryBoxWonPrize] = useState<any>(null);
  const [letterRevealData, setLetterRevealData] = useState<{ letter: string | null; collected: string[]; config: any; prize: any } | null>(null);
  const [bagRevealResults, setBagRevealResults] = useState<{ letter: string | null; isNew: boolean }[]>([]);
  const [showCelebration, setShowCelebration] = useState(false);
  
  // Test results log
  const [testResults, setTestResults] = useState<SimulatedResult[]>([]);

  // Scenario testing states
  const [selectedScenario, setSelectedScenario] = useState<string>("");
  const [selectedPrize, setSelectedPrize] = useState<string>("");

  // Customer preview collected letters (persistent across tests)
  const [customerCollectedLetters, setCustomerCollectedLetters] = useState<string[]>([]);

  // Calculate letter counts for customer preview
  const letterCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    customerCollectedLetters.forEach(letter => {
      counts[letter] = (counts[letter] || 0) + 1;
    });
    return counts;
  }, [customerCollectedLetters]);

  // Check which words can be redeemed
  const wordStatus = useMemo(() => {
    if (!competition?.letters_config?.prize_words) return [];
    const words = competition.letters_config.prize_words || [];
    return words.map((pw: any) => {
      const requiredCounts: Record<string, number> = {};
      pw.word.split('').forEach((l: string) => {
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
  }, [competition, letterCounts]);

  // Handle scratch reveal close - go to next or finish
  const handleScratchClose = useCallback(() => {
    setShowScratchReveal(false);
    
    const nextIndex = currentResultIndex + 1;
    if (nextIndex < simulatedResults.length && competition) {
      setCurrentResultIndex(nextIndex);
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

  // Handle letter reveal close
  const handleLetterClose = useCallback(() => {
    setShowLetterReveal(false);
  }, []);

  // Handle bag reveal close - update customer preview
  const handleBagClose = useCallback(() => {
    setShowBagReveal(false);
    // Add collected letters to customer preview
    const newLetters = bagRevealResults
      .filter(r => r.letter !== null)
      .map(r => r.letter as string);
    setCustomerCollectedLetters(prev => [...prev, ...newLetters]);
  }, [bagRevealResults]);

  if (!competition) return null;

  const animationType = competition.letters_config?.animation_type || 'bags';
  const mainWord = competition.letters_config?.prize_words?.[0]?.word || competition.letters_config?.target_word || '';

  // Simulate instant win logic locally
  const simulateInstantWin = (forceWin?: boolean): SimulatedResult => {
    const winProbability = competition.win_probability || 10;
    const randomVal = Math.random() * 100;
    const isWinner = forceWin !== undefined ? forceWin : randomVal <= winProbability;
    
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
  const simulateMysteryBox = (specificPrize?: string): SimulatedResult => {
    const boxes = competition.mystery_boxes || [];
    if (boxes.length === 0) {
      return { index: 0, type: 'mystery_box', prize: { name_ar: "لا توجد صناديق", probability: 100 } };
    }
    
    if (specificPrize) {
      const prize = boxes.find((b: any) => b.name_ar === specificPrize);
      if (prize) return { index: 0, type: 'mystery_box', prize };
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
  const simulateEveryoneWins = (specificPrize?: string): SimulatedResult => {
    const tiers = competition.prize_tiers || [];
    if (tiers.length === 0) {
      return { index: 0, type: 'everyone_wins', prize: { name_ar: "لا توجد جوائز", probability: 100 } };
    }
    
    if (specificPrize) {
      const prize = tiers.find((t: any) => t.name_ar === specificPrize);
      if (prize) return { index: 0, type: 'everyone_wins', prize };
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
  const simulateCollectLetters = (specificLetter?: string): SimulatedResult => {
    const config = competition.letters_config || {};
    const targetWord = config.target_word || "فوز";
    const betterLuckProb = config.better_luck_probability || 0;
    const letterProbs = config.letter_probabilities || {};
    
    // If specific letter requested
    if (specificLetter) {
      if (specificLetter === 'better_luck') {
        return { index: 0, type: 'collect_letters', letter: undefined, isBetterLuck: true };
      }
      return { index: 0, type: 'collect_letters', letter: specificLetter, isBetterLuck: false };
    }
    
    // Check if better luck
    if (Math.random() * 100 < betterLuckProb) {
      return { index: 0, type: 'collect_letters', letter: undefined, isBetterLuck: true };
    }
    
    // Get unique letters from target word
    const letters: string[] = [...new Set(targetWord.split(''))].filter((l): l is string => l !== '');
    
    const randomVal = Math.random() * 100;
    let cumulative = 0;
    const typedLetterProbs = letterProbs as Record<string, number>;

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

  // Run scenario test
  const runScenarioTest = () => {
    if (!selectedScenario) {
      toast.error('الرجاء اختيار سيناريو');
      return;
    }

    setIsRunning(true);
    const results: SimulatedResult[] = [];

    setTimeout(() => {
      if (competition.competition_type === 'collect_letters') {
        if (selectedScenario === 'complete_word') {
          // Generate letters to complete the word
          const targetWord = competition.letters_config?.target_word || '';
          const neededLetters: string[] = [];
          
          for (const letter of targetWord) {
            const currentCount = customerCollectedLetters.filter(l => l === letter).length;
            const neededCount = targetWord.split('').filter(l => l === letter).length;
            const stillNeeded = neededCount - currentCount;
            for (let i = 0; i < stillNeeded; i++) {
              neededLetters.push(letter);
            }
          }
          
          if (neededLetters.length === 0) {
            toast.info('الكلمة مكتملة بالفعل!');
            setIsRunning(false);
            return;
          }
          
          neededLetters.forEach((letter, i) => {
            results.push({ index: i + 1, type: 'collect_letters', letter, isBetterLuck: false });
          });
        } else if (selectedScenario === 'specific_letter' && selectedPrize) {
          results.push({ ...simulateCollectLetters(selectedPrize), index: 1 });
        } else if (selectedScenario === 'better_luck') {
          results.push({ index: 1, type: 'collect_letters', letter: undefined, isBetterLuck: true });
        }
      } else if (competition.competition_type === 'instant_winner') {
        if (selectedScenario === 'win') {
          results.push({ ...simulateInstantWin(true), index: 1 });
        } else if (selectedScenario === 'lose') {
          results.push({ ...simulateInstantWin(false), index: 1 });
        }
      } else if (competition.competition_type === 'mystery_box' || competition.competition_type === 'everyone_wins') {
        if (selectedScenario === 'specific_prize' && selectedPrize) {
          const result = competition.competition_type === 'mystery_box' 
            ? simulateMysteryBox(selectedPrize) 
            : simulateEveryoneWins(selectedPrize);
          results.push({ ...result, index: 1 });
        }
      }

      if (results.length === 0) {
        toast.error('لا توجد نتائج للسيناريو المحدد');
        setIsRunning(false);
        return;
      }

      setTestResults(prev => [...results, ...prev]);
      
      // Show animation
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
        const bagResults = results.map(r => ({
          letter: r.isBetterLuck ? null : (r.letter || null),
          isNew: true
        }));
        
        setBagRevealResults(bagResults);
        setLetterRevealData({
          letter: null,
          collected: customerCollectedLetters,
          config: competition.letters_config || {},
          prize: null
        });
        setShowBagReveal(true);
      }
      
      setIsRunning(false);
    }, 300);
  };

  const runTest = () => {
    setIsRunning(true);
    const results: SimulatedResult[] = [];
    
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
      
      if (results.length > 0) {
        const firstResult = results[0];
        
        if (firstResult.type === 'instant_winner') {
          setInstantRevealResult({ isWinner: firstResult.isWinner || false, prize: firstResult.prize });
          setShowInstantReveal(true);
          if (firstResult.isWinner) setShowCelebration(true);
        } else if (firstResult.type === 'mystery_box') {
          // Use dedicated mystery box animation
          const boxes = competition.prize_tiers || [];
          const boxesData = boxes.map((b: any) => ({
            id: b.id || crypto.randomUUID(),
            name_ar: b.name_ar || 'جائزة',
            probability: b.probability || 0,
            value: b.value || 0,
            image_url: b.image_url,
            is_better_luck: b.is_better_luck,
            is_ticket_reward: b.is_ticket_reward,
            tickets_reward: b.tickets_reward
          }));
          setMysteryBoxWonPrize(firstResult.prize);
          setShowMysteryBoxReveal(true);
          if (!firstResult.prize?.is_better_luck) setShowCelebration(true);
        } else if (firstResult.type === 'everyone_wins') {
          setInstantRevealResult({ isWinner: true, prize: firstResult.prize });
          setShowInstantReveal(true);
          setShowCelebration(true);
        } else if (firstResult.type === 'collect_letters') {
          if (animationType === 'scratch') {
            setSimulatedResults(results);
            setCurrentResultIndex(0);
            setCollectedLettersInSession([]);
            
            setLetterRevealData({
              letter: firstResult.isBetterLuck ? null : (firstResult.letter || null),
              collected: customerCollectedLetters,
              config: competition.letters_config || {},
              prize: null
            });
            setShowScratchReveal(true);
          } else {
            const bagResults = results.map(r => ({
              letter: r.isBetterLuck ? null : (r.letter || null),
              isNew: true
            }));
            
            setBagRevealResults(bagResults);
            setLetterRevealData({
              letter: null,
              collected: customerCollectedLetters,
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

  const resetCustomerPreview = () => {
    setCustomerCollectedLetters([]);
    setTestResults([]);
  };

  // Simulate prize redemption
  const handleTestRedeem = (word: string, prizeName: string) => {
    // Deduct letters from customer collected
    const requiredCounts: Record<string, number> = {};
    word.split('').forEach((l: string) => {
      requiredCounts[l] = (requiredCounts[l] || 0) + 1;
    });

    const newLetters = [...customerCollectedLetters];
    for (const [letter, count] of Object.entries(requiredCounts)) {
      for (let i = 0; i < count; i++) {
        const idx = newLetters.indexOf(letter);
        if (idx !== -1) {
          newLetters.splice(idx, 1);
        }
      }
    }

    setCustomerCollectedLetters(newLetters);
    
    // Generate fake coupon code
    const couponCode = `TEST-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    
    toast.success(
      <div className="space-y-1">
        <p>مبروك! حصلت على {prizeName}</p>
        <p className="font-bold text-lg">كود الخصم: {couponCode}</p>
        <p className="text-xs text-muted-foreground">(هذا اختبار فقط)</p>
      </div>,
      { duration: 8000 }
    );
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

  // Get available scenarios based on competition type
  const getScenarios = () => {
    switch (competition.competition_type) {
      case 'instant_winner':
        return [
          { value: 'win', label: 'فوز بالجائزة' },
          { value: 'lose', label: 'حظاً أوفر' }
        ];
      case 'collect_letters':
        return [
          { value: 'complete_word', label: 'إكمال الكلمة' },
          { value: 'specific_letter', label: 'حرف معين' },
          { value: 'better_luck', label: 'حظاً أوفر' }
        ];
      case 'mystery_box':
      case 'everyone_wins':
        return [
          { value: 'specific_prize', label: 'جائزة معينة' }
        ];
      default:
        return [];
    }
  };

  // Get available prizes/letters for secondary selection
  const getSecondaryOptions = () => {
    if (competition.competition_type === 'collect_letters' && selectedScenario === 'specific_letter') {
      const targetWord = competition.letters_config?.target_word || '';
      return [...new Set(targetWord.split(''))].map(l => ({ value: l, label: l }));
    }
    if (competition.competition_type === 'mystery_box' && selectedScenario === 'specific_prize') {
      return (competition.mystery_boxes || []).map((b: any) => ({ value: b.name_ar, label: b.name_ar }));
    }
    if (competition.competition_type === 'everyone_wins' && selectedScenario === 'specific_prize') {
      return (competition.prize_tiers || []).map((t: any) => ({ value: t.name_ar, label: t.name_ar }));
    }
    return [];
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
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
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid grid-cols-3 w-full">
                  <TabsTrigger value="random" className="gap-1">
                    <Sparkles className="h-4 w-4" />
                    عشوائي
                  </TabsTrigger>
                  <TabsTrigger value="scenario" className="gap-1">
                    <Target className="h-4 w-4" />
                    سيناريو
                  </TabsTrigger>
                  <TabsTrigger value="preview" className="gap-1">
                    <Eye className="h-4 w-4" />
                    معاينة الزبون
                  </TabsTrigger>
                </TabsList>

                {/* Random Test Tab */}
                <TabsContent value="random" className="space-y-4">
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
                        تشغيل
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
                      <ScrollArea className="h-36 border rounded-lg p-2">
                        <div className="space-y-2">
                          {testResults.map((result, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 bg-muted/30 rounded text-sm">
                              <span className="text-muted-foreground">#{result.index}</span>
                              {getResultBadge(result)}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                      
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
                </TabsContent>

                {/* Scenario Test Tab */}
                <TabsContent value="scenario" className="space-y-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Zap className="h-4 w-4" />
                        اختبار سيناريو محدد
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <Label>اختر السيناريو</Label>
                        <Select value={selectedScenario} onValueChange={(v) => { setSelectedScenario(v); setSelectedPrize(''); }}>
                          <SelectTrigger>
                            <SelectValue placeholder="اختر سيناريو..." />
                          </SelectTrigger>
                          <SelectContent>
                            {getScenarios().map(s => (
                              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {getSecondaryOptions().length > 0 && (
                        <div>
                          <Label>
                            {selectedScenario === 'specific_letter' ? 'اختر الحرف' : 'اختر الجائزة'}
                          </Label>
                          <Select value={selectedPrize} onValueChange={setSelectedPrize}>
                            <SelectTrigger>
                              <SelectValue placeholder="اختر..." />
                            </SelectTrigger>
                            <SelectContent>
                              {getSecondaryOptions().map(o => (
                                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <Button onClick={runScenarioTest} disabled={isRunning || !selectedScenario} className="w-full gap-2">
                        {isRunning ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                        تشغيل السيناريو
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Customer Preview Tab */}
                <TabsContent value="preview" className="space-y-4">
                  {competition.competition_type === 'collect_letters' && (
                    <>
                      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                              <Sparkles className="h-4 w-4 text-primary" />
                              تقدمك في جمع الأحرف (معاينة الزبون)
                            </CardTitle>
                            <Button variant="ghost" size="sm" onClick={resetCustomerPreview} className="gap-1">
                              <RotateCcw className="h-3 w-3" />
                              إعادة تعيين
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {/* Main Word Display */}
                          <div className="flex items-center justify-center gap-2 flex-wrap" dir="rtl">
                            {mainWord.split('').map((letter: string, index: number) => {
                              const count = letterCounts[letter] || 0;
                              const sameLettersBefore = mainWord.slice(0, index + 1).split('').filter((l: string) => l === letter).length;
                              const letterAvailable = count >= sameLettersBefore;
                              
                              return (
                                <div key={index} className="flex flex-col items-center">
                                  <div
                                    className={`
                                      w-12 h-12 rounded-lg flex items-center justify-center text-xl font-bold
                                      transition-all duration-300 border-2
                                      ${letterAvailable 
                                        ? 'bg-primary text-primary-foreground border-primary shadow-lg' 
                                        : 'bg-muted/20 text-muted-foreground/30 border-dashed border-muted-foreground/20'
                                      }
                                    `}
                                  >
                                    {letter}
                                  </div>
                                  {letterAvailable && (
                                    <span className="text-xs mt-1 font-medium text-primary">✓</span>
                                  )}
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
                          
                          {/* Collected Letters Summary */}
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
                          {wordStatus.length > 0 && (
                            <div className="space-y-2 border-t pt-3">
                              <p className="text-sm font-medium flex items-center gap-1">
                                <Gift className="h-4 w-4" />
                                الجوائز المتاحة:
                              </p>
                              <div className="space-y-2">
                                {wordStatus.map((word: any, idx: number) => (
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
                                        disabled={!word.canRedeem || !word.hasStock}
                                        onClick={() => handleTestRedeem(word.word, word.prize_name_ar)}
                                      >
                                        <Trophy className="h-4 w-4 ml-1" />
                                        استبدال (تجريبي)
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      <div className="text-center">
                        <Button onClick={runTest} disabled={isRunning} variant="outline" className="gap-2">
                          {isRunning ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Ticket className="h-4 w-4" />
                          )}
                          شراء تذكرة تجريبية
                        </Button>
                      </div>
                    </>
                  )}

                  {competition.competition_type !== 'collect_letters' && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Eye className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>معاينة الزبون متاحة فقط لمسابقة جمع الأحرف</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
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
        onClose={handleBagClose}
        results={bagRevealResults}
        collectedLetters={letterRevealData?.collected || []}
        lettersConfig={letterRevealData?.config || { target_word: '', prizes: [] }}
        wonPrize={letterRevealData?.prize}
      />

      <MysteryBoxReveal
        isOpen={showMysteryBoxReveal}
        onClose={() => setShowMysteryBoxReveal(false)}
        boxes={(competition?.prize_tiers || []).map((b: any) => ({
          id: b.id || crypto.randomUUID(),
          name_ar: b.name_ar || (b.is_better_luck ? 'حظ أوفر 🍀' : b.is_ticket_reward ? `${b.tickets_reward || 1} تذكرة 🎫` : 'جائزة'),
          probability: b.probability || 0,
          value: b.value || 0,
          image_url: b.image_url
        }))}
        wonPrize={mysteryBoxWonPrize ? {
          id: mysteryBoxWonPrize.id || 'won',
          name_ar: mysteryBoxWonPrize.name_ar || (mysteryBoxWonPrize.is_better_luck ? 'حظ أوفر 🍀' : mysteryBoxWonPrize.is_ticket_reward ? `${mysteryBoxWonPrize.tickets_reward || 1} تذكرة 🎫` : 'جائزة'),
          probability: mysteryBoxWonPrize.probability || 0,
          value: mysteryBoxWonPrize.value || 0,
          image_url: mysteryBoxWonPrize.image_url
        } : null}
      />

      <CelebrationEffect
        isActive={showCelebration}
        winnerName="اختبار"
        onComplete={() => setShowCelebration(false)}
      />
    </>
  );
}
