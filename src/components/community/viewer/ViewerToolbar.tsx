import { Box, Camera, Grid3x3, RotateCw, Square, Maximize2, Eye, Flame, Layers, Compass, Scissors, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  wireframe: boolean;
  autoRotate: boolean;
  showBBox: boolean;
  showPlate: boolean;
  overhang: boolean;
  explode: number;
  layerCut: number; // 0..100 (% of model height to clip from top)
  decimate: boolean;
  decimating?: boolean;
  onWireframe: (v: boolean) => void;
  onAutoRotate: (v: boolean) => void;
  onBBox: (v: boolean) => void;
  onPlate: (v: boolean) => void;
  onOverhang: (v: boolean) => void;
  onExplode: (v: number) => void;
  onLayerCut: (v: number) => void;
  onDecimate: (v: boolean) => void;
  onAutoOrient: () => void;
  onScreenshot: () => void;
  onReset: () => void;
  language?: "ar" | "en" | "ku";
}

export default function ViewerToolbar(p: Props) {
  const t = (ar: string, en: string) => (p.language === "ar" ? ar : en);

  const Btn = ({
    active, onClick, icon: Icon, label, disabled,
  }: { active?: boolean; onClick: () => void; icon: any; label: string; disabled?: boolean }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          onClick={onClick}
          disabled={disabled}
          className={`h-9 w-9 p-0 rounded-full transition glass-trigger ${
            active ? "!bg-primary/30 !text-primary-foreground ring-1 ring-primary/50" : ""
          }`}
        >
          <Icon className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="glass-panel">{label}</TooltipContent>
    </Tooltip>
  );

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex flex-col items-center gap-2">
        <div className="glass-floating rounded-full px-2 py-1.5 flex items-center gap-1 shadow-2xl flex-wrap justify-center max-w-[92vw]">
          <Btn active={!p.wireframe} onClick={() => p.onWireframe(false)} icon={Square} label={t("صلب", "Solid")} />
          <Btn active={p.wireframe} onClick={() => p.onWireframe(true)} icon={Eye} label={t("شبكي", "Wireframe")} />
          <div className="w-px h-5 bg-foreground/10 mx-0.5" />
          <Btn active={p.autoRotate} onClick={() => p.onAutoRotate(!p.autoRotate)} icon={RotateCw} label={t("دوران تلقائي", "Auto-rotate")} />
          <Btn active={p.showBBox} onClick={() => p.onBBox(!p.showBBox)} icon={Box} label={t("صندوق الإحاطة", "Bounding box")} />
          <Btn active={p.showPlate} onClick={() => p.onPlate(!p.showPlate)} icon={Grid3x3} label={t("منصة الطباعة", "Build plate")} />
          <div className="w-px h-5 bg-foreground/10 mx-0.5" />
          <Btn active={p.overhang} onClick={() => p.onOverhang(!p.overhang)} icon={Flame} label={t("إبراز التراكيب الناتئة", "Overhang highlight")} />
          <Btn onClick={p.onAutoOrient} icon={Compass} label={t("توجيه تلقائي", "Auto-orient")} />
          <Btn
            active={p.decimate}
            disabled={p.decimating}
            onClick={() => p.onDecimate(!p.decimate)}
            icon={Gauge}
            label={t("تبسيط الشبكة (للملفات الكبيرة)", "Decimate mesh (large files)")}
          />
          <div className="w-px h-5 bg-foreground/10 mx-0.5" />
          <Btn onClick={p.onReset} icon={Maximize2} label={t("إعادة التوسيط", "Reset view")} />
          <Btn onClick={p.onScreenshot} icon={Camera} label={t("لقطة شاشة", "Screenshot")} />
        </div>

        <div className="glass-floating rounded-full px-3 py-1.5 flex items-center gap-2 shadow-lg w-[260px] max-w-[92vw]">
          <Layers className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-[10px] font-medium text-foreground/70 shrink-0">
            {t("تفكيك", "Explode")}
          </span>
          <Slider value={[p.explode]} min={0} max={100} step={1} onValueChange={(v) => p.onExplode(v[0])} className="flex-1" />
          <span className="text-[10px] font-mono text-foreground/60 w-6 text-end">{p.explode}</span>
        </div>

        <div className="glass-floating rounded-full px-3 py-1.5 flex items-center gap-2 shadow-lg w-[260px] max-w-[92vw]">
          <Scissors className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-[10px] font-medium text-foreground/70 shrink-0">
            {t("معاينة الطبقات", "Layer preview")}
          </span>
          <Slider value={[p.layerCut]} min={0} max={100} step={1} onValueChange={(v) => p.onLayerCut(v[0])} className="flex-1" />
          <span className="text-[10px] font-mono text-foreground/60 w-8 text-end">{p.layerCut}%</span>
        </div>
      </div>
    </TooltipProvider>
  );
}
