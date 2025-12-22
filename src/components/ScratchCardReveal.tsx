import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Star, Gift, X, SkipForward, RefreshCw } from "lucide-react";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface LettersConfig {
  target_word: string;
  prizes: { word: string; prize_name_ar: string; prize_value?: number }[];
  letter_probabilities?: Record<string, number>;
}

interface ScratchCardRevealProps {
  isOpen: boolean;
  onClose: () => void;
  awardedLetter: string | null; // null means "better luck" or ticket reward
  collectedLetters: string[];
  lettersConfig: LettersConfig;
  wonPrize: { word: string; prize_name_ar: string; prize_value?: number } | null;
  allowSkip?: boolean;
  isTicketReward?: boolean;
  ticketsAwarded?: number;
}

export default function ScratchCardReveal({
  isOpen,
  onClose,
  awardedLetter,
  collectedLetters,
  lettersConfig,
  wonPrize,
  allowSkip = true,
  isTicketReward = false,
  ticketsAwarded = 0
}: ScratchCardRevealProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isScratching, setIsScratching] = useState(false);
  const [scratchPercentage, setScratchPercentage] = useState(0);
  const [isReadyToReveal, setIsReadyToReveal] = useState(false); // Scratched enough but not revealed yet
  const [isRevealed, setIsRevealed] = useState(false);
  const [showPrize, setShowPrize] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const isBetterLuck = awardedLetter === null && !isTicketReward;
  const targetWord = lettersConfig.target_word || '';
  const allCollected = awardedLetter ? [...collectedLetters, awardedLetter] : collectedLetters;

  const SCRATCH_THRESHOLD = 40; // 40% scratched to be ready to reveal

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Create premium golden scratch overlay
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#d4a574');
    gradient.addColorStop(0.3, '#c9a86c');
    gradient.addColorStop(0.5, '#b8956b');
    gradient.addColorStop(0.7, '#a38560');
    gradient.addColorStop(1, '#8b7355');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Add metallic scratch texture
    ctx.globalAlpha = 0.15;
    for (let i = 0; i < 300; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      ctx.fillStyle = Math.random() > 0.5 ? '#ffffff' : '#000000';
      ctx.fillRect(x, y, Math.random() * 3, 1);
    }
    
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 15; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const radius = Math.random() * 20 + 10;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.globalAlpha = 1;
    
    // Draw "امسح هنا" text with shadow
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;
    ctx.font = 'bold 22px Cairo, Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fillText('امسح هنا', canvas.width / 2, canvas.height / 2 - 12);
    
    ctx.shadowBlur = 0;
    ctx.font = '32px Arial';
    ctx.fillText('👆', canvas.width / 2, canvas.height / 2 + 22);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setIsScratching(false);
      setScratchPercentage(0);
      setIsReadyToReveal(false);
      setIsRevealed(false);
      setShowPrize(false);
      setShowConfetti(false);
      
      // Wait for canvas to be mounted
      setTimeout(initCanvas, 100);
    }
  }, [isOpen, initCanvas]);

  const calculateScratchPercentage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return 0;

    const ctx = canvas.getContext('2d');
    if (!ctx) return 0;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    let transparentPixels = 0;
    const totalPixels = pixels.length / 4;

    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] < 128) {
        transparentPixels++;
      }
    }

    return (transparentPixels / totalPixels) * 100;
  }, []);

  const scratchAt = useCallback(
    (clientX: number, clientY: number) => {
      if (isRevealed) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const rect = canvas.getBoundingClientRect();
      let x = clientX - rect.left;
      let y = clientY - rect.top;

      // Scale coordinates
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      x *= scaleX;
      y *= scaleY;

      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(x, y, 28, 0, Math.PI * 2);
      ctx.fill();

      const percentage = calculateScratchPercentage();
      setScratchPercentage(percentage);

      // Mark as ready but don't reveal yet - wait for finger lift
      if (percentage >= SCRATCH_THRESHOLD && !isReadyToReveal) {
        setIsReadyToReveal(true);
      }
    },
    [isRevealed, isReadyToReveal, calculateScratchPercentage]
  );

  // Reveal only when user lifts finger AND has scratched enough
  const doReveal = useCallback(() => {
    if (isReadyToReveal && !isRevealed) {
      setIsRevealed(true);
      if (!isBetterLuck) {
        setShowConfetti(true);
      }
      if (wonPrize) {
        setTimeout(() => setShowPrize(true), 1500);
      }
    }
  }, [isReadyToReveal, isRevealed, isBetterLuck, wonPrize]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
    setIsScratching(true);
    scratchAt(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isScratching) return;
    scratchAt(e.clientX, e.clientY);
  };

  const handlePointerUp = () => {
    setIsScratching(false);
    doReveal(); // Only reveal when finger is lifted
  };
  const handlePointerCancel = () => setIsScratching(false);

  const skipToEnd = () => {
    setIsRevealed(true);
    if (!isBetterLuck) {
      setShowConfetti(true);
    }
    if (wonPrize) {
      setTimeout(() => setShowPrize(true), 500);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="max-w-sm p-0 overflow-hidden border-0 shadow-2xl"
        onPointerDownOutside={(e) => e.preventDefault()}
        style={{
          background: 'linear-gradient(145deg, #0c0c1d 0%, #1a1a3e 40%, #0f0f2d 100%)'
        }}
      >
        <VisuallyHidden>
          <DialogTitle>مسح التذكرة</DialogTitle>
        </VisuallyHidden>
        
        {/* Decorative border glow */}
        <div 
          className="absolute inset-0 pointer-events-none rounded-lg"
          style={{
            background: 'linear-gradient(135deg, rgba(212,165,116,0.3) 0%, transparent 50%, rgba(212,165,116,0.2) 100%)',
            padding: '1px'
          }}
        />
        
        {/* Animated shimmer background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div 
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(135deg, transparent 0%, rgba(212,165,116,0.08) 50%, transparent 100%)',
              animation: 'shimmer 4s infinite linear'
            }}
          />
        </div>
        
        {/* Top bar */}
        <div className="absolute top-3 right-3 left-3 z-20 flex justify-between items-center">
          {allowSkip && !isRevealed && !showPrize && (
            <Button 
              variant="outline" 
              size="sm"
              className="bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white gap-2 backdrop-blur-sm"
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
            className="text-white/80 hover:text-white hover:bg-white/20 rounded-full"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="relative min-h-[500px] flex flex-col items-center justify-center p-6 text-white text-center overflow-hidden">
          {/* Background particles */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {[...Array(20)].map((_, i) => (
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

          {/* Main content */}
          {!showPrize && (
            <div className="space-y-4 w-full">
              <h2 className="text-xl font-bold mb-2">
                {isRevealed 
                  ? isBetterLuck 
                    ? 'حظ أوفر! 😔' 
                    : isTicketReward 
                      ? '🎫 ربحت تذاكر!' 
                      : '🎉 مبروك!' 
                  : '🎫 امسح التذكرة لكشف الحرف'}
              </h2>
              
              {/* Scratch card area - Premium ticket design */}
              <div 
                className="relative mx-auto w-72 h-52 rounded-xl overflow-hidden"
                style={{
                  boxShadow: '0 10px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(212,165,116,0.3), inset 0 1px 0 rgba(255,255,255,0.1)'
                }}
              >
                {/* Ticket notches */}
                <div className="absolute top-0 left-0 w-4 h-4 bg-[#0c0c1d] rounded-br-full" />
                <div className="absolute top-0 right-0 w-4 h-4 bg-[#0c0c1d] rounded-bl-full" />
                <div className="absolute bottom-0 left-0 w-4 h-4 bg-[#0c0c1d] rounded-tr-full" />
                <div className="absolute bottom-0 right-0 w-4 h-4 bg-[#0c0c1d] rounded-tl-full" />
                
                {/* Background with letter/result */}
                <div 
                  className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${
                    isBetterLuck 
                      ? 'bg-gradient-to-br from-slate-500 via-slate-600 to-slate-700' 
                      : isTicketReward
                        ? 'bg-gradient-to-br from-cyan-400 via-teal-500 to-cyan-600'
                        : 'bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-500'
                  }`}
                >
                  {/* Decorative pattern */}
                  <div 
                    className="absolute inset-0 opacity-10"
                    style={{
                      backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                      backgroundSize: '16px 16px'
                    }}
                  />
                  
                  {isRevealed ? (
                    <div className="animate-scale-in relative z-10">
                      {isBetterLuck ? (
                        <div className="text-center">
                          <span className="text-7xl">😔</span>
                          <p className="text-white text-base mt-3 font-medium">لم تحصل على حرف</p>
                        </div>
                      ) : isTicketReward ? (
                        <div className="text-center">
                          <span className="text-7xl">🎫</span>
                          <div className="flex items-center justify-center gap-2 mt-3">
                            <Sparkles className="h-5 w-5 text-cyan-100 animate-pulse" />
                            <span className="text-white text-xl font-bold">+{ticketsAwarded} تذكرة</span>
                            <Sparkles className="h-5 w-5 text-cyan-100 animate-pulse" />
                          </div>
                        </div>
                      ) : (
                        <div className="text-center">
                          <div 
                            className="relative inline-block"
                            style={{
                              filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.3))'
                            }}
                          >
                            <span 
                              className="text-8xl font-bold text-white block"
                              style={{
                                textShadow: '0 0 60px rgba(255,255,255,0.8), 0 4px 8px rgba(0,0,0,0.3)'
                              }}
                            >
                              {awardedLetter}
                            </span>
                          </div>
                          <div className="flex items-center justify-center gap-2 mt-3">
                            <Sparkles className="h-5 w-5 text-yellow-100 animate-pulse" />
                            <span className="text-white text-base font-medium">حرف جديد!</span>
                            <Sparkles className="h-5 w-5 text-yellow-100 animate-pulse" />
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-7xl opacity-50">❓</div>
                  )}
                  
                  {/* Glow effect when revealed */}
                  {isRevealed && !isBetterLuck && (
                    <div 
                      className="absolute inset-0 animate-pulse"
                      style={{
                        boxShadow: isTicketReward 
                          ? '0 0 60px 20px rgba(6,182,212,0.4) inset'
                          : '0 0 60px 20px rgba(255,215,0,0.4) inset'
                      }}
                    />
                  )}
                </div>
                
                {/* Scratch layer */}
                {!isRevealed && (
                  <canvas
                    ref={canvasRef}
                    width={288}
                    height={208}
                    className="absolute inset-0 w-full h-full cursor-crosshair touch-none z-10"
                    style={{ touchAction: 'none' }}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerCancel}
                    onPointerLeave={handlePointerUp}
                  />
                )}
                
                {/* Scratch progress indicator */}
                {!isRevealed && scratchPercentage > 5 && (
                  <div className="absolute bottom-3 left-4 right-4 z-20">
                    <div className="h-1.5 bg-black/30 rounded-full overflow-hidden backdrop-blur-sm">
                      <div 
                        className={`h-full rounded-full transition-all duration-200 ${
                          isReadyToReveal ? 'bg-green-400' : 'bg-amber-400'
                        }`}
                        style={{ width: `${Math.min(scratchPercentage * (100 / SCRATCH_THRESHOLD), 100)}%` }}
                      />
                    </div>
                    {isReadyToReveal && !isRevealed && (
                      <p className="text-center text-xs text-green-300 mt-1 animate-pulse">ارفع إصبعك لكشف الحرف!</p>
                    )}
                  </div>
                )}
              </div>
              
              {/* Progress */}
              {isRevealed && targetWord && (
                <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 space-y-3 animate-fade-in mt-4">
                  <p className="text-sm opacity-80">تقدمك في الكلمة:</p>
                  <div className="flex justify-center gap-2 flex-wrap flex-row-reverse">
                    {[...new Set(targetWord.split(''))].map((letter, idx) => {
                      const hasLetter = allCollected.includes(letter);
                      const isNew = letter === awardedLetter && !collectedLetters.includes(letter);
                      const count = allCollected.filter((l) => l === letter).length;
                      return (
                        <div
                          key={idx}
                          className={`relative w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold transition-all ${
                            hasLetter
                              ? isNew
                                ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow-lg scale-110 ring-2 ring-yellow-300 animate-bounce'
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

                  <div className="pt-2 border-t border-white/15">
                    <p className="text-sm opacity-80 mb-2">كل الأحرف التي جمعتها:</p>
                    <div className="flex justify-center gap-1.5 flex-wrap">
                      {Object.entries(
                        allCollected.reduce<Record<string, number>>((acc, l) => {
                          acc[l] = (acc[l] ?? 0) + 1;
                          return acc;
                        }, {})
                      )
                        .sort(([a], [b]) => a.localeCompare(b, 'ar'))
                        .map(([letter, count]) => (
                          <Badge
                            key={letter}
                            variant="secondary"
                            className="bg-white/10 text-white border border-white/20"
                          >
                            <span className="font-bold">{letter}</span>
                            <span className="text-xs opacity-80">&nbsp;×{count}</span>
                          </Badge>
                        ))}
                      {allCollected.length === 0 && (
                        <span className="text-sm opacity-70">لا توجد أحرف بعد</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              {isRevealed && !wonPrize && (
                <Button 
                  onClick={onClose}
                  className="bg-white text-gray-900 hover:bg-white/90 font-bold px-8 mt-4"
                >
                  {isBetterLuck ? 'حاول مرة أخرى' : 'حسناً'}
                </Button>
              )}
            </div>
          )}

          {/* Prize screen */}
          {showPrize && wonPrize && (
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
          @keyframes shimmer {
            0% { transform: translateX(-100%) translateY(-100%); }
            100% { transform: translateX(100%) translateY(100%); }
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}
