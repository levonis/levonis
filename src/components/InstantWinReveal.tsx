import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Gift, Sparkles, Trophy, PartyPopper, X, Package } from "lucide-react";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface Prize {
  name_ar: string;
  value?: number;
  image_url?: string;
}

interface InstantWinRevealProps {
  isOpen: boolean;
  onClose: () => void;
  prize: Prize | null;
  competitionType: 'instant_winner' | 'everyone_wins' | 'mystery_box';
  isWinner: boolean;
}

export default function InstantWinReveal({
  isOpen,
  onClose,
  prize,
  competitionType,
  isWinner
}: InstantWinRevealProps) {
  const [stage, setStage] = useState<'opening' | 'revealed'>('opening');
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStage('opening');
      const timer = setTimeout(() => {
        setStage('revealed');
        if (isWinner || competitionType === 'everyone_wins') {
          setShowConfetti(true);
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isWinner, competitionType]);

  const getBackgroundGradient = () => {
    if (competitionType === 'mystery_box') {
      return 'bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600';
    }
    if (competitionType === 'everyone_wins') {
      return 'bg-gradient-to-br from-pink-500 via-rose-500 to-red-500';
    }
    return 'bg-gradient-to-br from-yellow-500 via-amber-500 to-orange-500';
  };

  const getIcon = () => {
    if (competitionType === 'mystery_box') return <Package className="h-16 w-16" />;
    if (competitionType === 'everyone_wins') return <Gift className="h-16 w-16" />;
    return <Trophy className="h-16 w-16" />;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className={`max-w-sm p-0 overflow-hidden border-0 ${getBackgroundGradient()}`}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <VisuallyHidden>
          <DialogTitle>نتيجة المسابقة</DialogTitle>
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
                  <Sparkles 
                    className="h-4 w-4" 
                    style={{ color: ['#FFD700', '#FF69B4', '#00CED1', '#FF6347', '#7B68EE'][Math.floor(Math.random() * 5)] }} 
                  />
                </div>
              ))}
            </div>
          )}

          {stage === 'opening' ? (
            <div className="space-y-6">
              <div className="relative">
                <div className="animate-pulse">
                  {competitionType === 'mystery_box' ? (
                    <div className="w-32 h-32 mx-auto relative">
                      <div className="absolute inset-0 bg-white/20 rounded-xl animate-ping" />
                      <div className="relative bg-gradient-to-br from-amber-400 to-yellow-600 rounded-xl p-4 shadow-2xl transform hover:scale-105 transition-transform">
                        <Package className="h-24 w-24 text-white" />
                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-full h-4 bg-red-500 rounded-t-sm" />
                        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-1 h-8 bg-red-500" />
                      </div>
                    </div>
                  ) : (
                    <div className="w-24 h-24 mx-auto bg-white/20 rounded-full flex items-center justify-center">
                      {getIcon()}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">
                  {competitionType === 'mystery_box' ? 'جاري فتح الصندوق...' : 'جاري الكشف...'}
                </h2>
                <div className="flex justify-center gap-1">
                  <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                  <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-scale-in">
              {(isWinner || competitionType === 'everyone_wins') ? (
                <>
                  <div className="relative">
                    <div className="absolute inset-0 bg-white/30 blur-3xl rounded-full" />
                    <div className="relative">
                      <PartyPopper className="h-20 w-20 mx-auto mb-4" />
                      <h2 className="text-3xl font-bold mb-2">🎉 مبروك! 🎉</h2>
                    </div>
                  </div>
                  
                  {prize && (
                    <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6 space-y-3">
                      {prize.image_url && (
                        <img 
                          src={prize.image_url} 
                          alt={prize.name_ar} 
                          className="w-24 h-24 mx-auto object-cover rounded-xl shadow-lg"
                        />
                      )}
                      <h3 className="text-xl font-bold">{prize.name_ar}</h3>
                      {prize.value && (
                        <p className="text-lg opacity-90">
                          قيمة الجائزة: {prize.value.toLocaleString()} دينار
                        </p>
                      )}
                    </div>
                  )}
                  
                  <p className="text-sm opacity-80">
                    تم إضافة الجائزة لحسابك
                  </p>
                </>
              ) : (
                <>
                  <div className="opacity-50">
                    <Gift className="h-16 w-16 mx-auto mb-4" />
                  </div>
                  <h2 className="text-2xl font-bold">لم يحالفك الحظ هذه المرة</h2>
                  <p className="text-lg opacity-80">جرب حظك مرة أخرى!</p>
                </>
              )}
              
              <Button 
                onClick={onClose}
                className="bg-white text-gray-900 hover:bg-white/90 font-bold px-8"
              >
                حسناً
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}