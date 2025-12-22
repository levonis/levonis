import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, X, Gift, Star } from "lucide-react";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface LettersConfig {
  target_word: string;
  prizes: { word: string; prize_name_ar: string; prize_value?: number }[];
  letter_probabilities?: Record<string, number>;
}

interface LetterRevealProps {
  isOpen: boolean;
  onClose: () => void;
  awardedLetter: string;
  collectedLetters: string[];
  lettersConfig: LettersConfig;
  wonPrize: { word: string; prize_name_ar: string; prize_value?: number } | null;
}

export default function LetterReveal({
  isOpen,
  onClose,
  awardedLetter,
  collectedLetters,
  lettersConfig,
  wonPrize
}: LetterRevealProps) {
  const [stage, setStage] = useState<'revealing' | 'revealed' | 'prize'>('revealing');
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStage('revealing');
      const timer1 = setTimeout(() => {
        setStage('revealed');
        if (wonPrize) {
          setTimeout(() => {
            setStage('prize');
            setShowConfetti(true);
          }, 1500);
        }
      }, 1500);
      return () => clearTimeout(timer1);
    }
  }, [isOpen, wonPrize]);

  const targetWord = lettersConfig.target_word || '';
  const allCollected = [...collectedLetters, awardedLetter];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="max-w-sm p-0 overflow-hidden border-0 bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <VisuallyHidden>
          <DialogTitle>حرف جديد</DialogTitle>
        </VisuallyHidden>
        
        <Button 
          variant="ghost" 
          size="icon" 
          className="absolute top-2 right-2 z-10 text-white/80 hover:text-white hover:bg-white/20"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </Button>

        <div className="relative min-h-[400px] flex flex-col items-center justify-center p-6 text-white text-center">
          {/* Confetti Effect */}
          {showConfetti && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {[...Array(30)].map((_, i) => (
                <div
                  key={i}
                  className="absolute animate-bounce"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 2}s`,
                    animationDuration: `${1 + Math.random() * 2}s`
                  }}
                >
                  <Star 
                    className="h-4 w-4" 
                    style={{ color: ['#FFD700', '#FF69B4', '#00CED1', '#FF6347', '#7B68EE'][Math.floor(Math.random() * 5)] }} 
                  />
                </div>
              ))}
            </div>
          )}

          {stage === 'revealing' && (
            <div className="space-y-6">
              <div className="relative">
                <div className="w-32 h-32 mx-auto bg-white/20 rounded-2xl flex items-center justify-center animate-pulse">
                  <span className="text-6xl font-bold">?</span>
                </div>
              </div>
              <h2 className="text-2xl font-bold">جاري الكشف عن الحرف...</h2>
              <div className="flex justify-center gap-1">
                <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
              </div>
            </div>
          )}

          {stage === 'revealed' && !wonPrize && (
            <div className="space-y-6 animate-scale-in">
              <div className="relative">
                <div className="absolute inset-0 bg-white/30 blur-3xl rounded-full" />
                <div className="relative w-32 h-32 mx-auto bg-gradient-to-br from-amber-400 to-yellow-500 rounded-2xl flex items-center justify-center shadow-2xl transform hover:scale-105 transition-transform">
                  <span className="text-6xl font-bold text-white">{awardedLetter}</span>
                </div>
              </div>
              
              <div>
                <h2 className="text-2xl font-bold mb-2">حصلت على الحرف!</h2>
                <p className="text-lg opacity-90">{awardedLetter}</p>
              </div>
              
              {/* Progress toward word */}
              <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 space-y-3">
                <p className="text-sm opacity-80">تقدمك في الكلمة:</p>
                <div className="flex justify-center gap-2 flex-wrap">
                  {targetWord.split('').map((letter, idx) => {
                    const hasLetter = allCollected.includes(letter);
                    return (
                      <div
                        key={idx}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl font-bold transition-all ${
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
                <p className="text-xs opacity-70">
                  {allCollected.length} / {targetWord.length} حروف
                </p>
              </div>
              
              <Button 
                onClick={onClose}
                className="bg-white text-gray-900 hover:bg-white/90 font-bold px-8"
              >
                حسناً
              </Button>
            </div>
          )}

          {stage === 'prize' && wonPrize && (
            <div className="space-y-6 animate-scale-in">
              <div className="relative">
                <div className="absolute inset-0 bg-yellow-500/50 blur-3xl rounded-full" />
                <Gift className="h-20 w-20 mx-auto relative text-yellow-300" />
              </div>
              
              <div>
                <h2 className="text-3xl font-bold mb-2">🎉 مبروك! 🎉</h2>
                <p className="text-xl">أكملت كلمة <span className="font-bold text-yellow-300">{wonPrize.word}</span>!</p>
              </div>
              
              <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6 space-y-3">
                <h3 className="text-xl font-bold">{wonPrize.prize_name_ar}</h3>
                {wonPrize.prize_value && (
                  <Badge className="bg-yellow-500 text-white border-0 text-lg px-4 py-1">
                    {wonPrize.prize_value.toLocaleString()} دينار
                  </Badge>
                )}
              </div>
              
              <Button 
                onClick={onClose}
                className="bg-white text-gray-900 hover:bg-white/90 font-bold px-8"
              >
                رائع!
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
