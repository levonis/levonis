import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import Model3DViewer from "./Model3DViewer";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  file: File | null;
  language?: "ar" | "en" | "ku";
}

export default function ViewerDialog({ open, onOpenChange, file, language }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!max-w-[100vw] !w-screen !h-[100dvh] !p-0 !rounded-none !border-0 !bg-[#05070d] !overflow-hidden !max-h-none"
      >
        <VisuallyHidden><DialogTitle>3D Viewer</DialogTitle></VisuallyHidden>
        {file ? (
          <Model3DViewer file={file} language={language} />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            No file
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
