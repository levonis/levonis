import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Sparkles, Star, Gift, X, SkipForward } from "lucide-react";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface LettersConfig {
  target_word: string;
  prizes: { word: string; prize_name_ar: string; prize_value?: number }[];
  letter_probabilities?: Record<string, number>;
}

interface BagResult {
  letter: string | null; // null = better luck
  isNew: boolean;
}

interface BagOpenRevealProps {
  isOpen: boolean;
  onClose: () => void;
  results: BagResult[];
  collectedLetters: string[];
  lettersConfig: LettersConfig;
  wonPrize: { word: string; prize_name_ar: string; prize_value?: number } | null;
  allowSkip?: boolean;
}

export default function BagOpenReveal({
  isOpen,
  onClose,
  results,
  collectedLetters,
  lettersConfig,
  wonPrize,
  allowSkip = true
}: BagOpenRevealProps) {
  const [currentBagIndex, setCurrentBagIndex] = useState(0);
  const [stage, setStage] = useState<'bag_closed' | 'bag_opening' | 'bag_opened' | 'letter_revealed' | 'all_done' | 'prize'>('bag_closed');
  const [skipped, setSkipped] = useState(false);
  const [revealedLetters, setRevealedLetters] = useState<BagResult[]>([]);

  const totalBags = results.length;
  const currentResult = results[currentBagIndex];
  const targetWord = lettersConfig.target_word || '';

  const skipToEnd = useCallback(() => {
    setSkipped(true);
    setRevealedLetters(results);
    if (wonPrize) {
      setStage('prize');
    } else {
      setStage('all_done');
    }
  }, [results, wonPrize]);

  const proceedToNextBag = useCallback(() => {
    if (currentBagIndex < totalBags - 1) {
      setCurrentBagIndex(prev => prev + 1);
      setStage('bag_closed');
    } else {
      if (wonPrize) {
        setStage('prize');
      } else {
        setStage('all_done');
      }
    }
  }, [currentBagIndex, totalBags, wonPrize]);

  const startOpening = useCallback(() => {
    if (skipped) return;
    if (stage !== 'bag_closed') return;
    setStage('bag_opening');
  }, [skipped, stage]);

  useEffect(() => {
    if (!isOpen || skipped) return;

    if (stage === 'bag_opening') {
      const timer = setTimeout(() => setStage('bag_opened'), 900);
      return () => clearTimeout(timer);
    }

    if (stage === 'bag_opened') {
      const timer = setTimeout(() => {
        setStage('letter_revealed');
        setRevealedLetters(prev => [...prev, currentResult]);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isOpen, stage, skipped, currentResult]);

  useEffect(() => {
    if (isOpen) {
      setCurrentBagIndex(0);
      setStage('bag_closed');
      setSkipped(false);
      setRevealedLetters([]);
    }
  }, [isOpen]);

  // Get all collected letters including newly revealed ones
  const allCollected = [...collectedLetters, ...revealedLetters.filter(r => r.letter).map(r => r.letter!)];
  const uniqueCollected = [...new Set(allCollected)];
  const letterCounts = allCollected.reduce<Record<string, number>>((acc, l) => {
    acc[l] = (acc[l] ?? 0) + 1;
    return acc;
  }, {});

  const MAX_REVEALED_SHOWN = 24;
  const shownRevealed = revealedLetters.slice(0, MAX_REVEALED_SHOWN);
  const hiddenRevealedCount = Math.max(0, revealedLetters.length - MAX_REVEALED_SHOWN);

  const revealedLetterCounts = revealedLetters.reduce<Record<string, number>>((acc, r) => {
    if (!r.letter) return acc;
    acc[r.letter] = (acc[r.letter] ?? 0) + 1;
    return acc;
  }, {});
  const revealedBetterLuckCount = revealedLetters.filter(r => !r.letter).length;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="max-w-md p-0 overflow-hidden border-0"
        onPointerDownOutside={(e) => e.preventDefault()}
        style={{
          background: 'radial-gradient(ellipse at top, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)'
        }}
      >
        <VisuallyHidden>
          <DialogTitle>فتح الأكياس</DialogTitle>
        </VisuallyHidden>
        
        {/* Animated background stars */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-white"
              style={{
                width: Math.random() * 3 + 1 + 'px',
                height: Math.random() * 3 + 1 + 'px',
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                opacity: Math.random() * 0.7 + 0.3,
                animation: `twinkle ${2 + Math.random() * 3}s ease-in-out infinite`,
                animationDelay: `${Math.random() * 2}s`
              }}
            />
          ))}
        </div>
        
        {/* Top bar with skip and close */}
        <div className="absolute top-3 right-3 left-3 z-20 flex justify-between items-center">
          {allowSkip && !skipped && stage !== 'all_done' && stage !== 'prize' && (
            <Button 
              variant="outline" 
              size="sm"
              className="bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white gap-2 backdrop-blur-sm"
              onClick={skipToEnd}
            >
              <SkipForward className="h-4 w-4" />
              تخطي الكل
            </Button>
          )}
          <div className="flex-1" />
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-white/80 hover:text-white hover:bg-white/20 rounded-full"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="relative min-h-[520px] flex flex-col items-center justify-center p-6 text-white text-center overflow-hidden">
          {/* Floating golden particles */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 rounded-full"
                style={{
                  background: `radial-gradient(circle, rgba(255,215,0,0.8) 0%, rgba(255,165,0,0.4) 100%)`,
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animation: `float-up ${4 + Math.random() * 4}s ease-in-out infinite`,
                  animationDelay: `${Math.random() * 3}s`
                }}
              />
            ))}
          </div>

          {/* Progress indicator */}
          {!skipped && stage !== 'all_done' && stage !== 'prize' && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3">
              <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 text-sm px-4 py-1">
                كيس {currentBagIndex + 1} من {totalBags}
              </Badge>
              <div className="flex gap-1.5">
                {results.map((_, idx) => (
                  <div 
                    key={idx} 
                    className={`w-3 h-3 rounded-full transition-all duration-300 ${
                      idx < currentBagIndex 
                        ? 'bg-gradient-to-br from-green-400 to-emerald-500 shadow-lg shadow-green-500/50' 
                        : idx === currentBagIndex 
                          ? 'bg-gradient-to-br from-yellow-400 to-amber-500 scale-125 shadow-lg shadow-amber-500/50 animate-pulse' 
                          : 'bg-white/20 border border-white/30'
                    }`} 
                  />
                ))}
              </div>
            </div>
          )}
          {/* Bag animation stages */}
          {(stage === 'bag_closed' || stage === 'bag_opening' || stage === 'bag_opened' || stage === 'letter_revealed') && !skipped && (
            <div className="space-y-6 pointer-events-none">
              {/* Bag visual */}
              <div className="relative">
                {/* Glow effect */}
                <div 
                  className={`absolute inset-0 bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-400 blur-3xl rounded-full transition-all duration-500 ${
                    stage === 'bag_opening' || stage === 'bag_opened' ? 'opacity-60 scale-150' : 'opacity-30'
                  }`}
                />
                
                {/* Bag container */}
                <div 
                  className={`relative transition-all duration-700 ${
                    stage === 'bag_opening' ? 'animate-shake' : ''
                  } ${stage === 'bag_opened' ? 'scale-110' : ''}`}
                >
                  {/* Bag shape */}
                  <div 
                    className={`w-32 h-44 mx-auto relative transition-all duration-500 ${
                      stage === 'bag_opened' || stage === 'letter_revealed' ? 'opacity-50 scale-95' : ''
                    }`}
                  >
                    {/* Bag body */}
                    <div className="absolute inset-0 bg-gradient-to-b from-amber-200 via-amber-400 to-amber-700 rounded-[28px] shadow-2xl">
                      {/* Bag handle */}
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-20 h-10 rounded-t-full border-[6px] border-amber-200/80" />

                      {/* Bag mouth/tie */}
                      <div 
                        className={`absolute top-0 left-0 right-0 h-10 bg-gradient-to-r from-red-500 via-rose-500 to-red-600 rounded-t-[28px] transition-all duration-500 ${
                          stage === 'bag_opened' || stage === 'letter_revealed' ? 'opacity-0 -translate-y-4' : ''
                        }`}
                      />

                      {/* Shine */}
                      <div className="absolute top-10 left-4 w-4 h-16 bg-white/25 rounded-full rotate-12" />

                      {/* Icon */}
                      <ShoppingBag className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-12 w-12 text-amber-900/40" />

                      {/* Stitch lines */}
                      <div className="absolute bottom-6 left-6 right-6 h-px bg-amber-900/15" />
                      <div className="absolute bottom-10 left-10 right-10 h-px bg-amber-900/10" />
                    </div>
                  </div>
                  
                  {/* Sparkles when opening */}
                  {(stage === 'bag_opening' || stage === 'bag_opened') && (
                    <>
                      {[...Array(12)].map((_, i) => (
                        <Sparkles
                          key={i}
                          className="absolute h-5 w-5 text-yellow-300"
                          style={{
                            left: `${50 + 60 * Math.cos(i * Math.PI / 6)}%`,
                            top: `${50 + 60 * Math.sin(i * Math.PI / 6)}%`,
                            transform: 'translate(-50%, -50%)',
                            animation: `sparkle-burst 1s ease-out forwards`,
                            animationDelay: `${i * 0.05}s`
                          }}
                        />
                      ))}
                    </>
                  )}
                </div>

                {/* Letter reveal (rises from inside the bag) */}
                {stage === 'letter_revealed' && currentResult && (
                  <div className="absolute inset-0 flex items-end justify-center pb-10 pointer-events-none">
                    <div
                      className={`transition-all duration-500 ${
                        currentResult.letter ? 'animate-letter-rise' : 'animate-letter-rise'
                      }`}
                    >
                      <div 
                        className={`w-24 h-24 rounded-2xl flex items-center justify-center shadow-2xl ${
                          currentResult.letter 
                            ? 'bg-gradient-to-br from-yellow-400 via-amber-500 to-amber-600' 
                            : 'bg-gradient-to-br from-gray-400 to-gray-500'
                        }`}
                        style={{
                          boxShadow: currentResult.letter 
                            ? '0 0 40px 15px rgba(255, 215, 0, 0.35)' 
                            : '0 0 20px 5px rgba(128, 128, 128, 0.25)'
                        }}
                      >
                        <span className="text-5xl font-bold text-white">
                          {currentResult.letter || '😔'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Text */}
              <div className="flex flex-col items-center justify-center gap-3">
                {stage === 'bag_closed' && (
                  <>
                    <h2 className="text-xl font-bold">اضغط زر فتح الكيس</h2>
                    <Button
                      onClick={startOpening}
                      className="bg-white/10 border border-white/20 text-white hover:bg-white/20 hover:text-white backdrop-blur-sm pointer-events-auto"
                      variant="outline"
                    >
                      افتح الكيس
                    </Button>
                  </>
                )}
                {stage === 'bag_opening' && (
                  <h2 className="text-xl font-bold animate-pulse">🎁 يتم الفتح...</h2>
                )}
                {stage === 'bag_opened' && (
                  <h2 className="text-xl font-bold">✨ لحظة...</h2>
                )}
                {stage === 'letter_revealed' && currentResult?.letter && (
                  <div className="animate-scale-in space-y-3">
                    <h2 className="text-2xl font-bold">حصلت على الحرف <span className="text-yellow-300 text-3xl">{currentResult.letter}</span>!</h2>
                    <Button
                      onClick={proceedToNextBag}
                      className="bg-white text-gray-900 hover:bg-white/90 font-bold px-8 pointer-events-auto"
                    >
                      {currentBagIndex < totalBags - 1 ? 'التالي' : 'عرض النتيجة'}
                    </Button>
                  </div>
                )}
                {stage === 'letter_revealed' && !currentResult?.letter && (
                  <div className="animate-scale-in space-y-3">
                    <h2 className="text-xl font-bold">حظ أوفر! 😔</h2>
                    <Button
                      onClick={proceedToNextBag}
                      className="bg-white text-gray-900 hover:bg-white/90 font-bold px-8 pointer-events-auto"
                    >
                      {currentBagIndex < totalBags - 1 ? 'التالي' : 'عرض النتيجة'}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* All done summary */}
          {stage === 'all_done' && (
            <div className="space-y-6 animate-scale-in">
              <div className="relative">
                <ShoppingBag className="h-20 w-20 mx-auto text-yellow-300" />
              </div>
              
              <h2 className="text-2xl font-bold">تم فتح جميع الأكياس! 🎉</h2>
              
              {/* Summary of letters */}
              <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 space-y-3">
                <p className="text-sm opacity-80">ملخص ما حصلت عليه:</p>

                <div className="flex justify-center gap-2 flex-wrap">
                  {Object.keys(revealedLetterCounts).length === 0 && revealedBetterLuckCount === 0 ? (
                    <span className="text-sm opacity-70">لا توجد نتائج</span>
                  ) : (
                    <>
                      {Object.entries(revealedLetterCounts).map(([letter, count]) => (
                        <div
                          key={letter}
                          className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow-lg flex items-center justify-center font-bold text-xl relative"
                        >
                          {letter}
                          {count > 1 && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-600 rounded-full text-xs flex items-center justify-center">
                              {count}
                            </span>
                          )}
                        </div>
                      ))}
                      {revealedBetterLuckCount > 0 && (
                        <div className="w-12 h-12 rounded-xl bg-gray-500/50 text-white/80 flex items-center justify-center font-bold text-lg">
                          ✗
                          <span className="sr-only">حظ أوفر</span>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {hiddenRevealedCount > 0 && (
                  <p className="text-xs opacity-70">تم إخفاء {hiddenRevealedCount} نتيجة لتجنب تعليق الشاشة</p>
                )}

                <p className="text-sm mt-4 opacity-80">تقدمك في الكلمة:</p>
                <div className="flex justify-center gap-2 flex-wrap">
                  {[...new Set(targetWord.split(''))].map((letter, idx) => {
                    const hasLetter = uniqueCollected.includes(letter);
                    const count = letterCounts[letter] ?? 0;
                    const isNewlyRevealed = revealedLetters.some(r => r.letter === letter);
                    return (
                      <div
                        key={idx}
                        className={`relative w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold transition-all ${
                          hasLetter 
                            ? isNewlyRevealed
                              ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow-lg ring-2 ring-yellow-300' 
                              : 'bg-gradient-to-br from-green-400 to-emerald-500 text-white shadow-lg' 
                            : 'bg-white/10 text-white/30 border border-white/20'
                        }`}
                      >
                        {hasLetter ? letter : '?'}
                        {count > 1 && (
                          <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 rounded-full text-xs flex items-center justify-center">
                            {count}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <Button 
                onClick={onClose}
                className="bg-white text-gray-900 hover:bg-white/90 font-bold px-8"
              >
                حسناً
              </Button>
            </div>
          )}

          {/* Prize won */}
          {stage === 'prize' && wonPrize && (
            <div className="space-y-6 animate-scale-in">
              {/* Confetti */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {[...Array(50)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute"
                    style={{
                      left: `${Math.random() * 100}%`,
                      animation: `confetti-fall ${2 + Math.random() * 3}s linear infinite`,
                      animationDelay: `${Math.random() * 2}s`,
                    }}
                  >
                    <Star 
                      className="h-4 w-4" 
                      style={{ 
                        color: ['#FFD700', '#FF69B4', '#00CED1', '#FF6347', '#7B68EE', '#32CD32'][Math.floor(Math.random() * 6)],
                        animation: `spin ${1 + Math.random()}s linear infinite`
                      }} 
                    />
                  </div>
                ))}
              </div>
              
              <div className="relative">
                <div className="absolute inset-0 bg-yellow-500/50 blur-3xl rounded-full animate-pulse" />
                <Gift className="h-24 w-24 mx-auto relative text-yellow-300 animate-bounce" />
              </div>
              
              <div>
                <h2 className="text-4xl font-bold mb-2">🎉🏆🎉</h2>
                <h3 className="text-2xl font-bold">مبروووك!</h3>
                <p className="text-xl mt-2">أكملت كلمة <span className="font-bold text-yellow-300 text-2xl">{wonPrize.word}</span>!</p>
              </div>
              
              <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6 space-y-3">
                <h3 className="text-2xl font-bold">{wonPrize.prize_name_ar}</h3>
                {wonPrize.prize_value && (
                  <Badge className="bg-yellow-500 text-white border-0 text-xl px-6 py-2 animate-pulse">
                    {wonPrize.prize_value.toLocaleString()} دينار
                  </Badge>
                )}
              </div>
              
              <Button 
                onClick={onClose}
                className="bg-white text-gray-900 hover:bg-white/90 font-bold px-10 py-3 text-lg"
              >
                رائع! 🎊
              </Button>
            </div>
          )}
        </div>

        <style>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0) rotate(0deg); }
            10% { transform: translateX(-8px) rotate(-3deg); }
            20% { transform: translateX(8px) rotate(3deg); }
            30% { transform: translateX(-8px) rotate(-3deg); }
            40% { transform: translateX(8px) rotate(3deg); }
            50% { transform: translateX(-6px) rotate(-2deg); }
            60% { transform: translateX(6px) rotate(2deg); }
            70% { transform: translateX(-4px) rotate(-1deg); }
            80% { transform: translateX(4px) rotate(1deg); }
            90% { transform: translateX(-2px) rotate(-0.5deg); }
          }
          .animate-shake {
            animation: shake 1s ease-in-out;
          }
          @keyframes sparkle-burst {
            0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
            50% { opacity: 1; }
            100% { transform: translate(-50%, -50%) scale(2) translateY(-30px); opacity: 0; }
          }
          @keyframes pop-in {
            0% { transform: scale(0) rotate(-45deg); opacity: 0; }
            60% { transform: scale(1.3) rotate(5deg); }
            100% { transform: scale(1) rotate(0deg); opacity: 1; }
          }
          .animate-pop-in {
            animation: pop-in 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards;
          }
          @keyframes letter-rise {
            0% { transform: translateY(24px) scale(0.9); opacity: 0; }
            60% { transform: translateY(-6px) scale(1.05); opacity: 1; }
            100% { transform: translateY(0) scale(1); opacity: 1; }
          }
          .animate-letter-rise {
            animation: letter-rise 0.55s ease-out forwards;
          }
          @keyframes confetti-fall {
            0% { transform: translateY(-100%) rotate(0deg); opacity: 1; }
            100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes twinkle {
            0%, 100% { opacity: 0.3; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.5); }
          }
          @keyframes float-up {
            0%, 100% { 
              transform: translateY(0) translateX(0);
              opacity: 0.6;
            }
            50% { 
              transform: translateY(-30px) translateX(10px);
              opacity: 1;
            }
          }
          @keyframes bag-glow {
            0%, 100% { box-shadow: 0 0 20px 5px rgba(255, 215, 0, 0.3); }
            50% { box-shadow: 0 0 40px 15px rgba(255, 215, 0, 0.6); }
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}
