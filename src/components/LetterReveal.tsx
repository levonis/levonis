import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, X, Gift, Star, Zap } from "lucide-react";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface LettersConfig {
  target_word: string;
  prizes: { word: string; prize_name_ar: string; prize_value?: number }[];
  letter_probabilities?: Record<string, number>;
}

interface LetterRevealProps {
  isOpen: boolean;
  onClose: () => void;
  awardedLetter: string | null; // null means "better luck"
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
  const [stage, setStage] = useState<'revealing' | 'revealed' | 'better_luck' | 'prize'>('revealing');
  const [showConfetti, setShowConfetti] = useState(false);
  const [letterVisible, setLetterVisible] = useState(false);
  const [glowIntensity, setGlowIntensity] = useState(0);

  const isBetterLuck = awardedLetter === null;

  useEffect(() => {
    if (isOpen) {
      setStage('revealing');
      setLetterVisible(false);
      setGlowIntensity(0);
      setShowConfetti(false);
      
      // Start glow animation
      const glowInterval = setInterval(() => {
        setGlowIntensity(prev => {
          if (prev >= 100) {
            clearInterval(glowInterval);
            return 100;
          }
          return prev + 5;
        });
      }, 50);

      const timer1 = setTimeout(() => {
        if (isBetterLuck) {
          setStage('better_luck');
        } else {
          setStage('revealed');
          setLetterVisible(true);
          if (wonPrize) {
            setTimeout(() => {
              setStage('prize');
              setShowConfetti(true);
            }, 2000);
          }
        }
      }, 2000);
      
      return () => {
        clearTimeout(timer1);
        clearInterval(glowInterval);
      };
    }
  }, [isOpen, wonPrize, isBetterLuck]);

  const targetWord = lettersConfig.target_word || '';
  const allCollected = awardedLetter ? [...collectedLetters, awardedLetter] : collectedLetters;

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

        <div className="relative min-h-[450px] flex flex-col items-center justify-center p-6 text-white text-center overflow-hidden">
          {/* Background particles */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="absolute w-1 h-1 bg-white/30 rounded-full animate-pulse"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 3}s`,
                  animationDuration: `${2 + Math.random() * 2}s`
                }}
              />
            ))}
          </div>

          {/* Confetti Effect */}
          {showConfetti && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {[...Array(40)].map((_, i) => (
                <div
                  key={i}
                  className="absolute"
                  style={{
                    left: `${Math.random() * 100}%`,
                    animation: `fall ${2 + Math.random() * 3}s linear infinite`,
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
          )}

          {stage === 'revealing' && (
            <div className="space-y-6 relative">
              {/* Animated revealing box */}
              <div className="relative">
                {/* Glow effect */}
                <div 
                  className="absolute inset-0 bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-400 blur-2xl rounded-3xl transition-opacity duration-300"
                  style={{ opacity: glowIntensity / 100 * 0.6 }}
                />
                
                {/* Lightning effects */}
                <div className="absolute -inset-4">
                  {[...Array(8)].map((_, i) => (
                    <Zap
                      key={i}
                      className="absolute h-6 w-6 text-yellow-300 animate-pulse"
                      style={{
                        left: `${10 + (i % 4) * 25}%`,
                        top: i < 4 ? '-10px' : 'calc(100% - 10px)',
                        transform: `rotate(${i * 45}deg)`,
                        animationDelay: `${i * 0.1}s`,
                        opacity: glowIntensity / 100
                      }}
                    />
                  ))}
                </div>
                
                <div 
                  className="relative w-36 h-36 mx-auto rounded-2xl flex items-center justify-center shadow-2xl transition-all duration-500"
                  style={{
                    background: `linear-gradient(135deg, 
                      rgba(255,255,255,${0.1 + glowIntensity / 200}) 0%, 
                      rgba(255,255,255,${0.05 + glowIntensity / 300}) 100%)`,
                    boxShadow: `0 0 ${20 + glowIntensity / 2}px ${10 + glowIntensity / 4}px rgba(255,215,0,${glowIntensity / 200})`,
                    transform: `scale(${1 + glowIntensity / 500})`
                  }}
                >
                  <span 
                    className="text-7xl font-bold transition-all duration-300"
                    style={{ 
                      textShadow: `0 0 ${10 + glowIntensity / 5}px rgba(255,215,0,${glowIntensity / 100})`,
                      transform: `scale(${0.8 + glowIntensity / 250})` 
                    }}
                  >
                    ?
                  </span>
                  
                  {/* Sparkles around */}
                  <Sparkles 
                    className="absolute -top-3 -right-3 h-8 w-8 text-yellow-300 animate-pulse" 
                    style={{ animationDelay: '0s' }}
                  />
                  <Sparkles 
                    className="absolute -bottom-3 -left-3 h-8 w-8 text-yellow-300 animate-pulse" 
                    style={{ animationDelay: '0.5s' }}
                  />
                </div>
              </div>
              
              <h2 className="text-2xl font-bold animate-pulse">جاري الكشف عن الحرف...</h2>
              
              {/* Loading dots */}
              <div className="flex justify-center gap-2">
                {[0, 1, 2, 3, 4].map(i => (
                  <span 
                    key={i}
                    className="w-3 h-3 bg-gradient-to-r from-yellow-300 to-amber-400 rounded-full"
                    style={{ 
                      animation: 'bounce 0.8s infinite',
                      animationDelay: `${i * 0.15}s` 
                    }} 
                  />
                ))}
              </div>
            </div>
          )}

          {stage === 'better_luck' && (
            <div className="space-y-6 animate-scale-in">
              <div className="relative">
                <div className="absolute inset-0 bg-gray-500/30 blur-3xl rounded-full" />
                <div className="relative w-32 h-32 mx-auto bg-gradient-to-br from-gray-400 to-gray-500 rounded-2xl flex items-center justify-center shadow-2xl">
                  <span className="text-5xl">😔</span>
                </div>
              </div>
              
              <div>
                <h2 className="text-2xl font-bold mb-2">حظ أوفر!</h2>
                <p className="text-lg opacity-90">لم تحصل على حرف هذه المرة</p>
                <p className="text-sm opacity-70 mt-2">حاول مرة أخرى!</p>
              </div>
              
              {/* Show current progress */}
              {targetWord && (
                <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 space-y-3">
                  <p className="text-sm opacity-80">تقدمك الحالي:</p>
                  <div className="flex justify-center gap-2 flex-wrap">
                    {targetWord.split('').map((letter, idx) => {
                      const hasLetter = collectedLetters.includes(letter);
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
                </div>
              )}
              
              <Button 
                onClick={onClose}
                className="bg-white text-gray-900 hover:bg-white/90 font-bold px-8"
              >
                حاول مرة أخرى
              </Button>
            </div>
          )}

          {stage === 'revealed' && !wonPrize && (
            <div className="space-y-6">
              <div className="relative">
                {/* Epic glow effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-400 blur-3xl rounded-full animate-pulse" />
                
                {/* Floating sparkles */}
                {[...Array(12)].map((_, i) => (
                  <Sparkles
                    key={i}
                    className="absolute h-5 w-5 text-yellow-300"
                    style={{
                      left: `${50 + 50 * Math.cos(i * Math.PI / 6)}%`,
                      top: `${50 + 50 * Math.sin(i * Math.PI / 6)}%`,
                      transform: 'translate(-50%, -50%)',
                      animation: `float ${2 + Math.random()}s ease-in-out infinite`,
                      animationDelay: `${i * 0.1}s`
                    }}
                  />
                ))}
                
                {/* Letter box with entrance animation */}
                <div 
                  className={`relative w-36 h-36 mx-auto bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 rounded-2xl flex items-center justify-center shadow-2xl transition-all duration-700 ${
                    letterVisible ? 'scale-100 rotate-0' : 'scale-0 rotate-180'
                  }`}
                  style={{
                    boxShadow: '0 0 60px 20px rgba(255, 215, 0, 0.4), 0 20px 40px -10px rgba(0, 0, 0, 0.3)'
                  }}
                >
                  <span 
                    className={`text-7xl font-bold text-white transition-all duration-500 ${
                      letterVisible ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
                    }`}
                    style={{
                      textShadow: '0 4px 20px rgba(0, 0, 0, 0.3), 0 0 40px rgba(255, 255, 255, 0.5)',
                      animationDelay: '0.3s'
                    }}
                  >
                    {awardedLetter}
                  </span>
                </div>
              </div>
              
              <div className={`transition-all duration-500 delay-300 ${letterVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                <h2 className="text-3xl font-bold mb-2">🎉 مبروك!</h2>
                <p className="text-xl opacity-90">حصلت على الحرف <span className="font-bold text-yellow-300 text-2xl">{awardedLetter}</span></p>
              </div>
              
              {/* Progress toward word */}
              <div className={`bg-white/20 backdrop-blur-sm rounded-2xl p-4 space-y-3 transition-all duration-500 delay-500 ${letterVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                <p className="text-sm opacity-80">تقدمك في الكلمة:</p>
                <div className="flex justify-center gap-2 flex-wrap">
                  {targetWord.split('').map((letter, idx) => {
                    const hasLetter = allCollected.includes(letter);
                    const isNew = letter === awardedLetter && !collectedLetters.includes(letter);
                    return (
                      <div
                        key={idx}
                        className={`w-11 h-11 rounded-lg flex items-center justify-center text-xl font-bold transition-all duration-500 ${
                          hasLetter 
                            ? isNew
                              ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow-lg scale-110 ring-2 ring-yellow-300' 
                              : 'bg-gradient-to-br from-green-400 to-emerald-500 text-white shadow-lg' 
                            : 'bg-white/20 text-white/40'
                        }`}
                        style={{ 
                          animationDelay: `${idx * 0.1}s`,
                          transitionDelay: `${0.6 + idx * 0.05}s`
                        }}
                      >
                        {hasLetter ? letter : '?'}
                      </div>
                    );
                  })}
                </div>
                <p className="text-sm opacity-70">
                  {allCollected.length} / {targetWord.length} حروف
                </p>
              </div>
              
              <Button 
                onClick={onClose}
                className={`bg-white text-gray-900 hover:bg-white/90 font-bold px-8 transition-all duration-500 delay-700 ${letterVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
              >
                حسناً
              </Button>
            </div>
          )}

          {stage === 'prize' && wonPrize && (
            <div className="space-y-6 animate-scale-in">
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
          @keyframes fall {
            0% { transform: translateY(-100%) rotate(0deg); }
            100% { transform: translateY(100vh) rotate(720deg); }
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes float {
            0%, 100% { transform: translate(-50%, -50%) translateY(0px); }
            50% { transform: translate(-50%, -50%) translateY(-10px); }
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}