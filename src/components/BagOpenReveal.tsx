import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, Sparkles, Star, Gift, X, SkipForward } from "lucide-react";
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

  useEffect(() => {
    if (!isOpen || skipped) return;
    
    if (stage === 'bag_closed') {
      const timer = setTimeout(() => setStage('bag_opening'), 800);
      return () => clearTimeout(timer);
    }
    
    if (stage === 'bag_opening') {
      const timer = setTimeout(() => setStage('bag_opened'), 1200);
      return () => clearTimeout(timer);
    }
    
    if (stage === 'bag_opened') {
      const timer = setTimeout(() => {
        setStage('letter_revealed');
        setRevealedLetters(prev => [...prev, currentResult]);
      }, 600);
      return () => clearTimeout(timer);
    }
    
    if (stage === 'letter_revealed') {
      const timer = setTimeout(proceedToNextBag, 1500);
      return () => clearTimeout(timer);
    }
  }, [isOpen, stage, skipped, currentResult, proceedToNextBag]);

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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="max-w-md p-0 overflow-hidden border-0 bg-gradient-to-br from-amber-600 via-orange-600 to-red-600"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <VisuallyHidden>
          <DialogTitle>فتح الأكياس</DialogTitle>
        </VisuallyHidden>
        
        {/* Top bar with skip and close */}
        <div className="absolute top-2 right-2 left-2 z-10 flex justify-between items-center">
          {allowSkip && !skipped && stage !== 'all_done' && stage !== 'prize' && (
            <Button 
              variant="ghost" 
              size="sm"
              className="text-white/80 hover:text-white hover:bg-white/20 gap-1"
              onClick={skipToEnd}
            >
              <SkipForward className="h-4 w-4" />
              تخطي
            </Button>
          )}
          <div className="flex-1" />
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-white/80 hover:text-white hover:bg-white/20"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="relative min-h-[500px] flex flex-col items-center justify-center p-6 text-white text-center overflow-hidden">
          {/* Background particles */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {[...Array(30)].map((_, i) => (
              <div
                key={i}
                className="absolute w-1 h-1 bg-white/20 rounded-full animate-pulse"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 3}s`,
                  animationDuration: `${2 + Math.random() * 2}s`
                }}
              />
            ))}
          </div>

          {/* Progress indicator */}
          {!skipped && stage !== 'all_done' && stage !== 'prize' && (
            <div className="absolute top-14 left-1/2 -translate-x-1/2 flex items-center gap-2">
              <span className="text-sm font-medium">كيس {currentBagIndex + 1} من {totalBags}</span>
              <div className="flex gap-1">
                {results.map((_, idx) => (
                  <div 
                    key={idx} 
                    className={`w-2 h-2 rounded-full transition-all ${
                      idx < currentBagIndex ? 'bg-green-400' : 
                      idx === currentBagIndex ? 'bg-yellow-300 scale-125' : 
                      'bg-white/30'
                    }`} 
                  />
                ))}
              </div>
            </div>
          )}

          {/* Bag animation stages */}
          {(stage === 'bag_closed' || stage === 'bag_opening' || stage === 'bag_opened' || stage === 'letter_revealed') && !skipped && (
            <div className="space-y-6">
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
                    className={`w-32 h-40 mx-auto relative transition-all duration-500 ${
                      stage === 'bag_opened' || stage === 'letter_revealed' ? 'opacity-50 scale-95' : ''
                    }`}
                  >
                    {/* Bag body */}
                    <div className="absolute inset-0 bg-gradient-to-b from-amber-300 via-amber-400 to-amber-600 rounded-b-3xl rounded-t-lg shadow-2xl">
                      {/* Bag tie/ribbon */}
                      <div 
                        className={`absolute -top-2 left-1/2 -translate-x-1/2 w-16 h-6 bg-red-500 rounded-full transition-all duration-500 ${
                          stage === 'bag_opened' || stage === 'letter_revealed' ? 'opacity-0 -translate-y-4' : ''
                        }`}
                      />
                      {/* Bag shine */}
                      <div className="absolute top-4 left-4 w-4 h-12 bg-white/30 rounded-full rotate-12" />
                      {/* Package icon */}
                      <Package className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-12 w-12 text-amber-800/50" />
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

                {/* Letter reveal */}
                {stage === 'letter_revealed' && currentResult && (
                  <div 
                    className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${
                      currentResult.letter ? 'animate-pop-in' : ''
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
                          ? '0 0 40px 15px rgba(255, 215, 0, 0.4)' 
                          : '0 0 20px 5px rgba(128, 128, 128, 0.3)'
                      }}
                    >
                      <span className="text-5xl font-bold text-white">
                        {currentResult.letter || '😔'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Text */}
              <div className="h-16 flex items-center justify-center">
                {stage === 'bag_closed' && (
                  <h2 className="text-xl font-bold">جاري فتح الكيس...</h2>
                )}
                {stage === 'bag_opening' && (
                  <h2 className="text-xl font-bold animate-pulse">🎁 يتم الفتح...</h2>
                )}
                {stage === 'letter_revealed' && currentResult?.letter && (
                  <div className="animate-scale-in">
                    <h2 className="text-2xl font-bold">حصلت على الحرف <span className="text-yellow-300 text-3xl">{currentResult.letter}</span>!</h2>
                  </div>
                )}
                {stage === 'letter_revealed' && !currentResult?.letter && (
                  <div className="animate-scale-in">
                    <h2 className="text-xl font-bold">حظ أوفر! 😔</h2>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* All done summary */}
          {stage === 'all_done' && (
            <div className="space-y-6 animate-scale-in">
              <div className="relative">
                <Package className="h-20 w-20 mx-auto text-yellow-300" />
              </div>
              
              <h2 className="text-2xl font-bold">تم فتح جميع الأكياس! 🎉</h2>
              
              {/* Summary of letters */}
              <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 space-y-3">
                <p className="text-sm opacity-80">الأحرف المكتسبة:</p>
                <div className="flex justify-center gap-2 flex-wrap">
                  {revealedLetters.map((result, idx) => (
                    <div
                      key={idx}
                      className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold ${
                        result.letter 
                          ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow-lg' 
                          : 'bg-gray-500/50 text-white/50'
                      }`}
                    >
                      {result.letter || '✗'}
                    </div>
                  ))}
                </div>
                
                <p className="text-sm mt-4 opacity-80">تقدمك في الكلمة:</p>
                <div className="flex justify-center gap-2 flex-wrap">
                  {targetWord.split('').map((letter, idx) => {
                    const hasLetter = uniqueCollected.includes(letter);
                    return (
                      <div
                        key={idx}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold ${
                          hasLetter 
                            ? 'bg-gradient-to-br from-green-400 to-emerald-500 text-white shadow-lg' 
                            : 'bg-white/20 text-white/40'
                        }`}
                      >
                        {hasLetter ? letter : '?'}
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
            10% { transform: translateX(-5px) rotate(-2deg); }
            20% { transform: translateX(5px) rotate(2deg); }
            30% { transform: translateX(-5px) rotate(-2deg); }
            40% { transform: translateX(5px) rotate(2deg); }
            50% { transform: translateX(-5px) rotate(-2deg); }
            60% { transform: translateX(5px) rotate(2deg); }
            70% { transform: translateX(-5px) rotate(-2deg); }
            80% { transform: translateX(5px) rotate(2deg); }
            90% { transform: translateX(-3px) rotate(-1deg); }
          }
          .animate-shake {
            animation: shake 0.8s ease-in-out;
          }
          @keyframes sparkle-burst {
            0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
            50% { opacity: 1; }
            100% { transform: translate(-50%, -50%) scale(2) translateY(-30px); opacity: 0; }
          }
          @keyframes pop-in {
            0% { transform: scale(0) rotate(-45deg); opacity: 0; }
            60% { transform: scale(1.2) rotate(5deg); }
            100% { transform: scale(1) rotate(0deg); opacity: 1; }
          }
          .animate-pop-in {
            animation: pop-in 0.5s ease-out forwards;
          }
          @keyframes confetti-fall {
            0% { transform: translateY(-100%) rotate(0deg); }
            100% { transform: translateY(100vh) rotate(720deg); }
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}
