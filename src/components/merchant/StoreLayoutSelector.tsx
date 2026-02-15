import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, LayoutGrid, Rows3, Columns2, AlignRight } from "lucide-react";

type LayoutType = "standard" | "grid_images" | "strip" | "taobao";

interface Props {
  value: LayoutType;
  onChange: (layout: LayoutType) => void;
}

const LAYOUTS: { value: LayoutType; label: string; desc: string; icon: typeof LayoutGrid; preview: React.ReactNode }[] = [
  {
    value: "standard",
    label: "كلاسيكي",
    desc: "أسماء الأقسام مع أقسام فرعية",
    icon: AlignRight,
    preview: (
      <div className="space-y-1 p-2">
        <div className="h-2 w-12 bg-foreground/20 rounded" />
        <div className="flex gap-1">
          <div className="h-1.5 w-6 bg-primary/30 rounded-full" />
          <div className="h-1.5 w-8 bg-primary/30 rounded-full" />
        </div>
        <div className="h-2 w-10 bg-foreground/20 rounded mt-1" />
        <div className="flex gap-1">
          <div className="h-1.5 w-7 bg-primary/30 rounded-full" />
          <div className="h-1.5 w-5 bg-primary/30 rounded-full" />
        </div>
      </div>
    ),
  },
  {
    value: "grid_images",
    label: "شبكة صور",
    desc: "صور الأقسام مع الأسماء",
    icon: LayoutGrid,
    preview: (
      <div className="grid grid-cols-2 gap-1 p-2">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="aspect-square bg-primary/15 rounded flex items-center justify-center">
            <div className="h-1.5 w-5 bg-foreground/20 rounded" />
          </div>
        ))}
      </div>
    ),
  },
  {
    value: "strip",
    label: "شريط منتجات",
    desc: "اسم القسم مع شريط منتجات أفقي",
    icon: Rows3,
    preview: (
      <div className="space-y-1.5 p-2">
        <div className="flex justify-between items-center">
          <div className="h-1.5 w-8 bg-foreground/20 rounded" />
          <div className="h-1 w-5 bg-primary/30 rounded" />
        </div>
        <div className="flex gap-1">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-5 w-5 bg-muted rounded shrink-0" />
          ))}
        </div>
        <div className="flex justify-between items-center mt-1">
          <div className="h-1.5 w-6 bg-foreground/20 rounded" />
          <div className="h-1 w-5 bg-primary/30 rounded" />
        </div>
        <div className="flex gap-1">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-5 w-5 bg-muted rounded shrink-0" />
          ))}
        </div>
      </div>
    ),
  },
  {
    value: "taobao",
    label: "تاوباو",
    desc: "أقسام جانبية مع المنتجات",
    icon: Columns2,
    preview: (
      <div className="flex gap-1 p-2">
        <div className="w-[30%] space-y-1 border-l border-border/50 pl-1">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className={`h-2 rounded ${i === 1 ? 'bg-primary/30' : 'bg-muted'}`} />
          ))}
        </div>
        <div className="flex-1 grid grid-cols-2 gap-0.5">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="aspect-square bg-muted rounded" />
          ))}
        </div>
      </div>
    ),
  },
];

export default function StoreLayoutSelector({ value, onChange }: Props) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">طريقة عرض الأقسام</p>
      <div className="grid grid-cols-2 gap-2">
        {LAYOUTS.map(l => (
          <button
            key={l.value}
            type="button"
            onClick={() => onChange(l.value)}
            className={`relative rounded-xl border-2 p-2 text-right transition-all hover:border-primary/50 ${
              value === l.value ? "border-primary bg-primary/5" : "border-border/50"
            }`}
          >
            <div className="h-16 rounded-lg bg-muted/30 border border-border/30 mb-2 overflow-hidden">
              {l.preview}
            </div>
            <p className="text-xs font-bold">{l.label}</p>
            <p className="text-[10px] text-muted-foreground">{l.desc}</p>
            {value === l.value && (
              <div className="absolute top-1.5 left-1.5 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                <Check className="h-2.5 w-2.5 text-primary-foreground" />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
