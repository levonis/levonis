import { useTheme, ThemeMode } from "@/hooks/useTheme";

const themes: { key: ThemeMode; label: string; colors: string[] }[] = [
  { key: "default", label: "الأساسي", colors: ["hsl(160,46%,15%)", "hsl(44,39%,60%)"] },
  { key: "light", label: "فاتح", colors: ["hsl(45,30%,92%)", "hsl(44,50%,55%)"] },
  { key: "dark", label: "ليلي", colors: ["hsl(220,20%,8%)", "hsl(44,50%,55%)"] },
];

export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground font-bold">المظهر</span>
      <div className="flex gap-1.5">
        {themes.map((t) => (
          <button
            key={t.key}
            onClick={() => setTheme(t.key)}
            className={`relative w-7 h-7 rounded-full border-2 transition-all overflow-hidden ${
              theme === t.key
                ? "border-primary ring-2 ring-primary/30 scale-110"
                : "border-border/50 hover:border-primary/40"
            }`}
            title={t.label}
          >
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: `linear-gradient(135deg, ${t.colors[0]} 50%, ${t.colors[1]} 50%)`,
              }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
