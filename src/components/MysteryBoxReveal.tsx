import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Gift, Sparkles, X, SkipForward, Package } from "lucide-react";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface BoxPrize {
  id: string;
  name_ar: string;
  probability: number;
  value?: number;
  image_url?: string;
  product_id?: string;
}

interface MysteryBoxRevealProps {
  isOpen: boolean;
  onClose: () => void;
  boxes: BoxPrize[];
  wonPrize: BoxPrize | null;
  allowSkip?: boolean;
}

export default function MysteryBoxReveal({
  isOpen,
  onClose,
  boxes,
  wonPrize,
  allowSkip = true
}: MysteryBoxRevealProps) {
  // Stages: show_prizes -> closing_boxes -> shuffling -> select_box -> revealing -> result
  const [stage, setStage] = useState<'show_prizes' | 'closing_boxes' | 'shuffling' | 'select_box' | 'revealing' | 'result'>('show_prizes');
  const [selectedBoxIndex, setSelectedBoxIndex] = useState<number | null>(null);
  const [boxPositions, setBoxPositions] = useState<number[]>([]);
  const [shuffleCount, setShuffleCount] = useState(0);
  const [skipped, setSkipped] = useState(false);

  const boxColors = [
    'from-indigo-400 to-indigo-600',
    'from-purple-400 to-purple-600',
    'from-pink-400 to-pink-600',
    'from-rose-400 to-rose-600',
    'from-orange-400 to-orange-600',
    'from-amber-400 to-amber-600',
    'from-emerald-400 to-emerald-600',
    'from-cyan-400 to-cyan-600',
  ];

  // Initialize box positions
  useEffect(() => {
    if (isOpen) {
      setBoxPositions(boxes.map((_, i) => i));
      setStage('show_prizes');
      setSelectedBoxIndex(null);
      setShuffleCount(0);
      setSkipped(false);
    }
  }, [isOpen, boxes.length]);

  // Auto-progress through stages
  useEffect(() => {
    if (!isOpen || skipped) return;

    if (stage === 'show_prizes') {
      // Show prizes for 3 seconds then close boxes
      const timer = setTimeout(() => setStage('closing_boxes'), 3000);
      return () => clearTimeout(timer);
    }

    if (stage === 'closing_boxes') {
      // Closing animation for 1 second
      const timer = setTimeout(() => setStage('shuffling'), 1000);
      return () => clearTimeout(timer);
    }

    if (stage === 'shuffling') {
      // Shuffle animation
      if (shuffleCount < 8) {
        const timer = setTimeout(() => {
          // Random shuffle
          setBoxPositions(prev => {
            const newPositions = [...prev];
            for (let i = newPositions.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [newPositions[i], newPositions[j]] = [newPositions[j], newPositions[i]];
            }
            return newPositions;
          });
          setShuffleCount(prev => prev + 1);
        }, 300);
        return () => clearTimeout(timer);
      } else {
        setStage('select_box');
      }
    }
  }, [isOpen, stage, shuffleCount, skipped]);

  const handleBoxSelect = useCallback((index: number) => {
    if (stage !== 'select_box') return;
    setSelectedBoxIndex(index);
    setStage('revealing');
    
    // After revealing animation, show result
    setTimeout(() => {
      setStage('result');
    }, 1500);
  }, [stage]);

  const skipToEnd = useCallback(() => {
    setSkipped(true);
    setSelectedBoxIndex(0);
    setStage('result');
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="max-w-lg p-0 overflow-hidden border-0"
        onPointerDownOutside={(e) => e.preventDefault()}
        style={{
          background: 'radial-gradient(ellipse at top, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)'
        }}
      >
        <VisuallyHidden>
          <DialogTitle>اختر صندوقك</DialogTitle>
        </VisuallyHidden>
        
        {/* Animated background stars */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(40)].map((_, i) => (
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
        
        {/* Top bar */}
        <div className="absolute top-3 right-3 left-3 z-20 flex justify-between items-center">
          {allowSkip && !skipped && stage !== 'result' && (
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

        <div className="relative min-h-[500px] flex flex-col items-center justify-center p-6 text-white text-center">
          
          {/* Stage indicator */}
          <div className="absolute top-16 left-1/2 -translate-x-1/2">
            <Badge className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-0 px-4 py-1">
              {stage === 'show_prizes' && '📦 تعرف على الجوائز...'}
              {stage === 'closing_boxes' && '🔒 يتم إغلاق الصناديق...'}
              {stage === 'shuffling' && '🔀 يتم الخلط...'}
              {stage === 'select_box' && '👆 اختر صندوقك!'}
              {stage === 'revealing' && '✨ يتم الكشف...'}
              {stage === 'result' && '🎉 النتيجة!'}
            </Badge>
          </div>

          {/* Boxes grid */}
          {stage !== 'result' && (
            <div className="grid grid-cols-3 gap-4 mt-8">
              {boxes.map((box, originalIndex) => {
                const displayIndex = boxPositions.indexOf(originalIndex);
                const isSelected = selectedBoxIndex === originalIndex;
                
                return (
                  <div
                    key={box.id}
                    className={`relative transition-all duration-300 ${
                      stage === 'shuffling' ? 'animate-pulse' : ''
                    } ${stage === 'select_box' ? 'cursor-pointer hover:scale-110' : ''} ${
                      isSelected ? 'scale-125 z-10' : ''
                    }`}
                    style={{
                      order: displayIndex,
                      transform: stage === 'shuffling' ? `rotate(${Math.sin(shuffleCount + originalIndex) * 5}deg)` : undefined
                    }}
                    onClick={() => handleBoxSelect(originalIndex)}
                  >
                    {/* Box */}
                    <div
                      className={`w-24 h-28 rounded-xl bg-gradient-to-br ${boxColors[originalIndex % boxColors.length]} shadow-2xl relative overflow-hidden transition-all duration-500`}
                      style={{
                        boxShadow: isSelected 
                          ? '0 0 40px 10px rgba(255, 215, 0, 0.5)' 
                          : '0 10px 30px rgba(0,0,0,0.3)'
                      }}
                    >
                      {/* Box lid */}
                      <div 
                        className={`absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-white/30 to-transparent transition-all duration-500 ${
                          stage === 'show_prizes' ? 'translate-y-[-100%] opacity-0' : ''
                        } ${stage === 'revealing' && isSelected ? 'translate-y-[-150%] opacity-0 rotate-[-20deg]' : ''}`}
                      >
                        {/* Ribbon */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full">
                          <div className="h-2 bg-amber-300/80" />
                        </div>
                      </div>
                      
                      {/* Prize inside (visible in show_prizes and revealing stages) */}
                      {(stage === 'show_prizes' || (stage === 'revealing' && isSelected)) && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-2 animate-scale-in">
                          {box.image_url ? (
                            <img 
                              src={box.image_url} 
                              alt={box.name_ar}
                              className="w-12 h-12 object-cover rounded-lg mb-1"
                            />
                          ) : (
                            <Gift className="w-10 h-10 text-white/90 mb-1" />
                          )}
                          <span className="text-[10px] font-bold text-white text-center leading-tight line-clamp-2">
                            {box.name_ar}
                          </span>
                          {stage === 'show_prizes' && (
                            <Badge className="mt-1 text-[8px] px-1 py-0 bg-white/20">
                              {box.probability}%
                            </Badge>
                          )}
                        </div>
                      )}
                      
                      {/* Question mark when closed */}
                      {stage !== 'show_prizes' && !(stage === 'revealing' && isSelected) && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-4xl font-bold text-white/80">?</span>
                        </div>
                      )}
                      
                      {/* Box number */}
                      <div className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                        <span className="text-[10px] font-bold">{originalIndex + 1}</span>
                      </div>
                      
                      {/* Sparkle effect when selected */}
                      {isSelected && (
                        <div className="absolute inset-0 pointer-events-none">
                          {[...Array(12)].map((_, i) => (
                            <Sparkles
                              key={i}
                              className="absolute h-4 w-4 text-yellow-300"
                              style={{
                                left: `${50 + 60 * Math.cos(i * Math.PI / 6)}%`,
                                top: `${50 + 60 * Math.sin(i * Math.PI / 6)}%`,
                                transform: 'translate(-50%, -50%)',
                                animation: `sparkle-burst 1s ease-out forwards`,
                                animationDelay: `${i * 0.05}s`
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Result display */}
          {stage === 'result' && wonPrize && (
            <div className="flex flex-col items-center gap-6 animate-scale-in">
              {/* Glow effect */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-64 h-64 rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 opacity-30 blur-3xl animate-pulse" />
              </div>
              
              {/* Prize box */}
              <div 
                className={`w-40 h-48 rounded-2xl bg-gradient-to-br ${boxColors[(selectedBoxIndex || 0) % boxColors.length]} shadow-2xl relative overflow-hidden`}
                style={{
                  boxShadow: '0 0 60px 20px rgba(255, 215, 0, 0.4)'
                }}
              >
                {/* Open lid */}
                <div className="absolute -top-8 left-0 right-0 h-10 bg-gradient-to-b from-white/40 to-transparent rotate-[-30deg] origin-bottom-left" />
                
                {/* Prize content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                  {wonPrize.image_url ? (
                    <img 
                      src={wonPrize.image_url} 
                      alt={wonPrize.name_ar}
                      className="w-24 h-24 object-cover rounded-xl mb-2 shadow-lg"
                    />
                  ) : (
                    <Gift className="w-20 h-20 text-white mb-2" />
                  )}
                  <h3 className="text-lg font-bold text-white text-center">
                    {wonPrize.name_ar}
                  </h3>
                  {wonPrize.value && wonPrize.value > 0 && (
                    <Badge className="mt-2 bg-amber-500 text-white border-0">
                      قيمة {wonPrize.value.toLocaleString()}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="space-y-3 text-center">
                <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-500">
                  🎉 مبروك! ربحت!
                </h2>
                <p className="text-white/80 text-sm">
                  لقد فزت بـ "{wonPrize.name_ar}"
                </p>
                
                <Button
                  onClick={onClose}
                  className="mt-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0 px-8"
                >
                  إغلاق
                </Button>
              </div>
            </div>
          )}

          {/* Floating particles */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {[...Array(15)].map((_, i) => (
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
        </div>

        <style>{`
          @keyframes twinkle {
            0%, 100% { opacity: 0.3; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.5); }
          }
          @keyframes float-up {
            0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.6; }
            50% { transform: translateY(-20px) rotate(180deg); opacity: 1; }
          }
          @keyframes sparkle-burst {
            0% { transform: translate(-50%, -50%) scale(0); opacity: 1; }
            100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
          }
          @keyframes scale-in {
            0% { transform: scale(0.5); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
          }
          .animate-scale-in {
            animation: scale-in 0.5s ease-out forwards;
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}
