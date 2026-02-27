import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Gamepad2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import PixelBackground from "@/components/games/PixelBackground";
import PixelLoadingScreen from "@/components/games/PixelLoadingScreen";
import { useGameSounds } from "@/components/games/useGameSounds";
import PixelSprite from "@/components/games/PixelSprite";
import { SPRITE_ICONS } from "@/components/games/SpriteMap";


export default function MiniGames() {
  const navigate = useNavigate();
  const { playClick } = useGameSounds();

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.inset = '0';
    document.body.style.width = '100%';
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.inset = '';
      document.body.style.width = '';
    };
  }, []);

  const [loading, setLoading] = useState(true);
  const handleLoadComplete = useCallback(() => setLoading(false), []);

  return (
    <div className="fixed inset-0 z-30 bg-background text-foreground overflow-y-auto" dir="rtl">
      {loading && <PixelLoadingScreen onComplete={handleLoadComplete} />}
      <PixelBackground />

      {/* Header */}
      <div className="sticky top-0 z-20 pixel-header-bar">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { playClick(); navigate('/rewards?tab=points&sub=games'); }}
            className="gap-1 text-muted-foreground hover:text-foreground font-mono text-xs pixel-btn-ghost"
          >
            <ArrowRight className="h-4 w-4" />
            BACK
          </Button>
        </div>
      </div>

      {/* Coming Soon */}
      <div className="max-w-2xl mx-auto px-4 relative z-10 flex flex-col items-center justify-center" style={{ minHeight: 'calc(100vh - 80px)' }}>
        <div className="text-center space-y-6">
          <div className="inline-flex items-center gap-2 pixel-frame px-5 py-2 mb-2">
            <Gamepad2 className="h-5 w-5 text-primary" />
            <span className="text-primary font-bold text-sm font-mono tracking-wider">PIXEL GAMES</span>
          </div>

          <div className="relative">
            <div className="text-7xl mb-4 animate-pulse">🎮</div>
            <div className="flex justify-center gap-3 opacity-50">
              <PixelSprite sprite={SPRITE_ICONS.STAR_FULL} scale={1.5} className="pixel-twinkle" />
              <PixelSprite sprite={SPRITE_ICONS.GEM_BLUE} scale={1.5} className="pixel-twinkle" style={{ animationDelay: "0.3s" }} />
              <PixelSprite sprite={SPRITE_ICONS.GEM_GREEN} scale={1.5} className="pixel-twinkle" style={{ animationDelay: "0.6s" }} />
            </div>
          </div>

          <h1 className="text-3xl font-black text-foreground font-mono"
            style={{ textShadow: "3px 3px 0 hsl(var(--accent) / 0.4)" }}>
            قريباً...
          </h1>
          <p className="text-muted-foreground text-sm max-w-xs mx-auto leading-relaxed">
            نعمل على تجهيز ألعاب مميزة لكم! ترقبوا التحديثات القادمة 🚀
          </p>

          <Button
            onClick={() => { playClick(); navigate('/rewards'); }}
            className="pixel-btn-active font-mono text-xs mt-4"
          >
            العودة للمكافآت
          </Button>
        </div>
      </div>
    </div>
  );
}
