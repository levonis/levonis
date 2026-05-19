import { Box, Camera, Grid3x3, RotateCw, Square, Maximize2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  wireframe: boolean;
  autoRotate: boolean;
  showBBox: boolean;
  showPlate: boolean;
  onWireframe: (v: boolean) => void;
  onAutoRotate: (v: boolean) => void;
  onBBox: (v: boolean) => void;
  onPlate: (v: boolean) => void;
  onScreenshot: () => void;
  onReset: () => void;
  language?: "ar" | "en" | "ku";
}

export default function ViewerToolbar(p: Props) {
  const t = (ar: string, en: string) => (p.language === "ar" ? ar : en);

  const Btn = ({
    active, onClick, icon: Icon, label,
  }: { active?: boolean; onClick: () => void; icon: any; label: string }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          onClick={onClick}
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
      <div className="glass-floating rounded-full px-2 py-1.5 flex items-center gap-1 shadow-2xl">
        <Btn active={!p.wireframe} onClick={() => p.onWireframe(false)} icon={Square} label={t("صلب", "Solid")} />
        <Btn active={p.wireframe} onClick={() => p.onWireframe(true)} icon={Eye} label={t("شبكي", "Wireframe")} />
        <div className="w-px h-5 bg-foreground/10 mx-0.5" />
        <Btn active={p.autoRotate} onClick={() => p.onAutoRotate(!p.autoRotate)} icon={RotateCw} label={t("دوران تلقائي", "Auto-rotate")} />
        <Btn active={p.showBBox} onClick={() => p.onBBox(!p.showBBox)} icon={Box} label={t("صندوق الإحاطة", "Bounding box")} />
        <Btn active={p.showPlate} onClick={() => p.onPlate(!p.showPlate)} icon={Grid3x3} label={t("منصة الطباعة", "Build plate")} />
        <div className="w-px h-5 bg-foreground/10 mx-0.5" />
        <Btn onClick={p.onReset} icon={Maximize2} label={t("إعادة التوسيط", "Reset view")} />
        <Btn onClick={p.onScreenshot} icon={Camera} label={t("لقطة شاشة", "Screenshot")} />
      </div>
    </TooltipProvider>
  );
}
