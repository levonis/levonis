import { useEffect, useState } from 'react';
import { Crown, Sparkles, Star } from 'lucide-react';

interface CelebrationEffectProps {
  isActive: boolean;
  winnerName?: string;
  ticketNumber?: string;
  onComplete?: () => void;
}

const CelebrationEffect = ({ isActive, winnerName, ticketNumber, onComplete }: CelebrationEffectProps) => {
  const [particles, setParticles] = useState<Array<{
    id: number;
    x: number;
    y: number;
    color: string;
    size: number;
    delay: number;
  }>>([]);
  
  useEffect(() => {
    if (isActive) {
      // Play celebration sound
      const audio = new Audio('/sounds/notification.mp3');
      audio.volume = 0.5;
      audio.play().catch(() => {});
      
      // Generate confetti particles
      const newParticles = [];
      const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];
      
      for (let i = 0; i < 60; i++) {
        newParticles.push({
          id: i,
          x: Math.random() * 100,
          y: -10 - Math.random() * 20,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: 8 + Math.random() * 12,
          delay: Math.random() * 0.5
        });
      }
      setParticles(newParticles);
      
      // Clear after animation
      const timer = setTimeout(() => {
        setParticles([]);
        onComplete?.();
      }, 4000);
      
      return () => clearTimeout(timer);
    }
  }, [isActive, onComplete]);
  
  if (!isActive && particles.length === 0) return null;
  
  return (
    <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden">
      {/* Confetti particles */}
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute animate-confetti"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            backgroundColor: particle.color,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            animationDelay: `${particle.delay}s`,
            transform: `rotate(${Math.random() * 360}deg)`
          }}
        />
      ))}
      
      {/* Winner announcement overlay */}
      {isActive && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 pointer-events-auto animate-fade-in">
          <div className="bg-gradient-to-br from-yellow-400 via-yellow-500 to-orange-500 p-1 rounded-3xl animate-scale-in shadow-2xl">
            <div className="bg-background rounded-3xl p-8 text-center space-y-4 min-w-[300px]">
              <div className="relative">
                <Crown className="h-20 w-20 mx-auto text-yellow-500 animate-bounce" />
                <Sparkles className="h-8 w-8 absolute -top-2 -right-2 text-yellow-400 animate-pulse" />
                <Star className="h-6 w-6 absolute -bottom-1 -left-2 text-yellow-400 animate-pulse" style={{ animationDelay: '0.5s' }} />
              </div>
              
              <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-orange-500">
                🎉 مبروك! 🎉
              </h2>
              
              {winnerName && (
                <p className="text-2xl font-bold text-foreground">
                  {winnerName}
                </p>
              )}
              
              {ticketNumber && (
                <div className="bg-primary/10 rounded-xl py-3 px-6">
                  <p className="text-sm text-muted-foreground">رقم التذكرة الفائزة</p>
                  <p className="text-xl font-mono font-bold text-primary">{ticketNumber}</p>
                </div>
              )}
              
              <p className="text-lg text-muted-foreground">
                تهانينا للفائز! 🏆
              </p>
            </div>
          </div>
        </div>
      )}
      
      <style>{`
        @keyframes confetti {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-confetti {
          animation: confetti 3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default CelebrationEffect;
