import { Package, Eye, EyeOff, Sparkles, Grid, List, Filter } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type ProductFilter = "all" | "active" | "hidden" | "featured";
type ViewMode = "grid" | "list";

interface ProductFilterTabsProps {
  activeFilter: ProductFilter;
  onFilterChange: (filter: ProductFilter) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  counts: {
    all: number;
    active: number;
    hidden: number;
    featured: number;
  };
}

export default function ProductFilterTabs({
  activeFilter,
  onFilterChange,
  viewMode,
  onViewModeChange,
  counts,
}: ProductFilterTabsProps) {
  const filters = [
    { value: "all", label: "الكل", icon: Package, count: counts.all },
    { value: "active", label: "نشط", icon: Eye, count: counts.active },
    { value: "hidden", label: "مخفي", icon: EyeOff, count: counts.hidden },
    { value: "featured", label: "مميز", icon: Sparkles, count: counts.featured },
  ] as const;

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-card to-card/80 border border-border/50">
      {/* Filter Tabs */}
      <div className="flex items-center gap-3 w-full sm:w-auto">
        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Filter className="h-4 w-4 text-primary" />
        </div>
        
        <Tabs value={activeFilter} onValueChange={(v) => onFilterChange(v as ProductFilter)} className="w-full sm:w-auto">
          <TabsList className="bg-background/50 border border-border/50 p-1 h-auto flex-wrap">
            {filters.map((filter) => (
              <TabsTrigger
                key={filter.value}
                value={filter.value}
                className="gap-1.5 px-3 py-2 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
              >
                <filter.icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{filter.label}</span>
                <Badge 
                  variant="secondary" 
                  className="h-5 min-w-[20px] px-1.5 text-[10px] data-[state=active]:bg-primary-foreground/20 data-[state=active]:text-primary-foreground"
                >
                  {filter.count}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* View Mode Toggle */}
      <div className="flex gap-1.5 p-1 rounded-xl bg-background/50 border border-border/50">
        <Button
          size="icon"
          variant={viewMode === "grid" ? "default" : "ghost"}
          className="h-8 w-8"
          onClick={() => onViewModeChange("grid")}
        >
          <Grid className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant={viewMode === "list" ? "default" : "ghost"}
          className="h-8 w-8"
          onClick={() => onViewModeChange("list")}
        >
          <List className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
