import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { AdminLoading } from "@/components/admin/AdminLayout";
import {
  Plus, Trash2, Save, Settings, Eye, Upload, Search, Copy,
  X, ImageIcon, Ticket, Package, Sparkles, Loader2, ChevronDown, ChevronUp,
  ToggleLeft, Pencil, AlertTriangle, CheckCircle2, Timer, Volume2, Gamepad2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ── Rarity System ──────────────────────────────────────────────
const RARITIES = [
  { value: "common", label: "عادي", color: "#9ca3af", glow: "0 0 8px #9ca3af44" },
  { value: "rare", label: "نادر", color: "#3b82f6", glow: "0 0 12px #3b82f688" },
  { value: "epic", label: "أسطوري", color: "#a855f7", glow: "0 0 16px #a855f788" },
  { value: "legendary", label: "خرافي", color: "#f59e0b", glow: "0 0 20px #f59e0b88" },
  { value: "mythic", label: "أسطورة", color: "#ef4444", glow: "0 0 24px #ef444488, 0 0 48px #ef444444" },
];

const REWARD_TYPES = [
  { value: "product", label: "منتج من المتجر", icon: Package, desc: "اختر منتج من الكتالوج" },
  { value: "tickets", label: "تذاكر إضافية", icon: Ticket, desc: "المستخدم يحصل على تذاكر" },
  { value: "custom", label: "جائزة مخصصة", icon: Sparkles, desc: "جائزة افتراضية مخصصة" },
  { value: "display", label: "عرض فقط", icon: Eye, desc: "تظهر بالشريط فقط - لا يمكن الفوز بها" },
];

const getRarity = (v: string) => RARITIES.find((r) => r.value === v) || RARITIES[0];
const getRewardType = (v: string) => REWARD_TYPES.find((r) => r.value === v) || REWARD_TYPES[2];

// ── Image Upload Component ─────────────────────────────────────
function ImageUploader({ imageUrl, onImageChange }: { imageUrl: string; onImageChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File) => {
    if (!file.type.match(/^image\/(png|jpe?g|webp)$/)) {
      toast.error("يُسمح فقط بصور PNG, JPG, WEBP");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("الحد الأقصى 5MB");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("game-rewards").upload(fileName, file);
    if (error) {
      toast.error("فشل الرفع");
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from("game-rewards").getPublicUrl(fileName);
    onImageChange(data.publicUrl);
    setUploading(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  };

  if (imageUrl) {
    return (
      <div className="relative group w-full">
        <div className="relative w-full h-28 rounded-lg border border-border/50 overflow-hidden bg-muted/10">
          <img src={imageUrl} alt="" className="w-full h-full object-contain" />
          <button
            onClick={() => onImageChange("")}
            className="absolute top-1 right-1 p-1 rounded-full bg-destructive/80 text-white opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <label
      className={`flex flex-col items-center gap-1.5 p-4 rounded-lg border-2 border-dashed cursor-pointer transition-all ${
        dragOver ? "border-primary bg-primary/5" : "border-border/50 hover:border-primary/40 bg-muted/5"
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {uploading ? (
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      ) : (
        <Upload className="h-6 w-6 text-muted-foreground" />
      )}
      <span className="text-xs text-muted-foreground text-center">
        {uploading ? "جاري الرفع..." : "اسحب صورة أو اضغط للرفع"}
      </span>
      <span className="text-[10px] text-muted-foreground">PNG, JPG, WEBP • الحد 5MB</span>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); }}
        disabled={uploading}
      />
    </label>
  );
}

// ── Product Option/Color Selector ──────────────────────────────
function ProductVariantSelector({
  productId,
  selectedColor,
  selectedOptionId,
  onColorChange,
  onOptionChange,
}: {
  productId: string;
  selectedColor: string;
  selectedOptionId: string;
  onColorChange: (color: string) => void;
  onOptionChange: (optionId: string, optionName: string, optionImage: string) => void;
}) {
  const { data: product } = useQuery({
    queryKey: ["admin-product-variants", productId],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("colors")
        .eq("id", productId)
        .single();
      return data;
    },
    enabled: !!productId,
  });

  const { data: options = [] } = useQuery({
    queryKey: ["admin-product-options", productId],
    queryFn: async () => {
      const { data } = await supabase
        .from("product_options")
        .select("id, name, name_ar, image_url, price_adjustment")
        .eq("product_id", productId)
        .order("name_ar");
      return (data || []) as any[];
    },
    enabled: !!productId,
  });

  const colors = (product?.colors as any[] | null) || [];

  if (colors.length === 0 && options.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Colors */}
      {colors.length > 0 && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium">اللون</label>
          <div className="flex flex-wrap gap-2">
            {colors.map((c: any, i: number) => {
              const colorName = typeof c === "string" ? c : c.name || c.name_ar || "";
              const colorHex = typeof c === "string" ? "" : c.hex || c.color || "";
              const colorImage = typeof c === "string" ? "" : c.image_url || c.image || "";
              const isSelected = selectedColor === colorName;
              return (
                <button
                  key={i}
                  onClick={() => onColorChange(isSelected ? "" : colorName)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 text-xs transition-all ${
                    isSelected ? "border-primary bg-primary/10 font-bold" : "border-border/40 hover:border-border"
                  }`}
                >
                  {colorHex && (
                    <span
                      className="w-4 h-4 rounded-full border border-border/50 shrink-0"
                      style={{ backgroundColor: colorHex }}
                    />
                  )}
                  {colorImage && !colorHex && (
                    <img src={colorImage} alt="" className="w-4 h-4 rounded-full object-cover shrink-0" />
                  )}
                  <span>{colorName}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Options */}
      {options.length > 0 && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium">الخيار</label>
          <div className="flex flex-wrap gap-2">
            {options.map((opt: any) => {
              const isSelected = selectedOptionId === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => onOptionChange(
                    isSelected ? "" : opt.id,
                    isSelected ? "" : (opt.name_ar || opt.name),
                    isSelected ? "" : (opt.image_url || "")
                  )}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 text-xs transition-all ${
                    isSelected ? "border-primary bg-primary/10 font-bold" : "border-border/40 hover:border-border"
                  }`}
                >
                  {opt.image_url && (
                    <img src={opt.image_url} alt="" className="w-5 h-5 rounded object-contain shrink-0" />
                  )}
                  <span>{opt.name_ar || opt.name}</span>
                  {opt.price_adjustment ? (
                    <span className="text-muted-foreground">({opt.price_adjustment > 0 ? "+" : ""}{opt.price_adjustment?.toLocaleString()})</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Product Search Component ───────────────────────────────────
function ProductSearch({ selectedId, onSelect }: { selectedId: string; onSelect: (p: any) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const { data: products = [] } = useQuery({
    queryKey: ["admin-products-search", query],
    queryFn: async () => {
      let q = supabase.from("products").select("id, name, name_ar, image_url, price").order("name_ar").limit(20);
      if (query.trim()) {
        q = q.or(`name_ar.ilike.%${query}%,name.ilike.%${query}%`);
      }
      const { data } = await q;
      return (data || []) as any[];
    },
  });

  const selected = products.find((p: any) => p.id === selectedId);

  if (selectedId && selected) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
        {selected.image_url ? (
          <img src={selected.image_url} alt="" className="w-10 h-10 rounded object-contain bg-white" />
        ) : (
          <div className="w-10 h-10 rounded bg-muted/20 flex items-center justify-center"><Package className="h-4 w-4" /></div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{selected.name_ar || selected.name}</p>
          <p className="text-xs text-muted-foreground">{selected.price?.toLocaleString()} د.ع</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => onSelect(null)} className="text-xs h-7">
          <X className="h-3 w-3 ml-1" /> تغيير
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="ابحث عن منتج..."
          className="pr-9"
        />
      </div>
      {open && products.length > 0 && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full mt-1 left-0 right-0 z-20 max-h-60 overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
            {products.map((p: any) => (
              <button
                key={p.id}
                onClick={() => { onSelect(p); setOpen(false); setQuery(""); }}
                className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-right"
              >
                {p.image_url ? (
                  <img src={p.image_url} alt="" className="w-8 h-8 rounded object-contain bg-white shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded bg-muted/20 flex items-center justify-center shrink-0"><Package className="h-3 w-3" /></div>
                )}
                <div className="flex-1 min-w-0 text-right">
                  <p className="text-sm truncate">{p.name_ar || p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.price?.toLocaleString()} د.ع</p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Rarity Selector ────────────────────────────────────────────
function RaritySelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {RARITIES.map((r) => (
        <button
          key={r.value}
          onClick={() => onChange(r.value)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${
            value === r.value ? "scale-105" : "opacity-60 hover:opacity-80"
          }`}
          style={{
            borderColor: value === r.value ? r.color : "transparent",
            background: `${r.color}${value === r.value ? "22" : "11"}`,
            color: r.color,
            boxShadow: value === r.value ? r.glow : "none",
          }}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

// ── Probability Indicator ──────────────────────────────────────
function ProbabilityIndicator({ total }: { total: number }) {
  const color = total > 100 ? "text-destructive" : total >= 90 ? "text-amber-500" : "text-emerald-500";
  const bg = total > 100 ? "bg-destructive/10" : total >= 90 ? "bg-amber-500/10" : "bg-emerald-500/10";
  const icon = total > 100 ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />;

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${bg} ${color}`}>
      {icon}
      <span className="text-sm font-bold">{total.toFixed(1)}%</span>
      <span className="text-xs opacity-70">إجمالي الاحتمالات</span>
      {total > 100 && <span className="text-[10px] font-medium mr-auto">⚠️ يتجاوز 100%</span>}
    </div>
  );
}

// ── Mini Reel Preview ──────────────────────────────────────────
function ReelPreview({ rewards }: { rewards: any[] }) {
  if (rewards.length === 0) return null;

  // Build a sample strip
  const strip: any[] = [];
  for (let i = 0; i < 12; i++) {
    strip.push(rewards[i % rewards.length]);
  }

  return (
    <div className="relative overflow-hidden rounded-lg border border-border/50 bg-background/50 p-2">
      <p className="text-[10px] text-muted-foreground mb-2 font-mono">معاينة الشريط</p>
      {/* Center pointer */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 z-10 w-0.5 h-[calc(100%-2rem)] bg-primary/50" />
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {strip.map((r, i) => {
          const rarity = getRarity(r.rarity);
          return (
            <div
              key={`${r.id}-${i}`}
              className="shrink-0 flex flex-col items-center justify-center rounded border p-1.5"
              style={{
                width: 64,
                height: 72,
                borderColor: rarity.color,
                background: `${rarity.color}11`,
              }}
            >
              {r.image_url ? (
                <img src={r.image_url} alt="" className="w-8 h-8 object-contain mb-0.5" />
              ) : (
                <div className="w-8 h-8 rounded bg-muted/20 flex items-center justify-center text-sm mb-0.5">🎁</div>
              )}
              <span className="text-[8px] text-center leading-tight line-clamp-1" style={{ color: rarity.color }}>
                {r.name_ar}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ██ MAIN COMPONENT
// ══════════════════════════════════════════════════════════════

export default function MysteryCaseTab() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(true);

  // ── Settings ─────────────────────────────────────────────────
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["admin-mystery-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("mystery_case_settings").select("*").limit(1).single();
      return data;
    },
  });

  const [sf, setSf] = useState({
    tickets_per_spin: 4, game_enabled: true, spin_cooldown_seconds: 0,
    spin_sound_enabled: true, animation_duration_ms: 5000, daily_free_spin: false,
  });

  useEffect(() => {
    if (settings) {
      setSf({
        tickets_per_spin: settings.tickets_per_spin, game_enabled: settings.game_enabled,
        spin_cooldown_seconds: settings.spin_cooldown_seconds, spin_sound_enabled: settings.spin_sound_enabled,
        animation_duration_ms: settings.animation_duration_ms, daily_free_spin: settings.daily_free_spin,
      });
    }
  }, [settings]);

  const saveSettings = useMutation({
    mutationFn: async () => {
      if (!settings?.id) return;
      const { error } = await supabase.from("mystery_case_settings").update({ ...sf, updated_at: new Date().toISOString() }).eq("id", settings.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم حفظ الإعدادات"); queryClient.invalidateQueries({ queryKey: ["admin-mystery-settings"] }); },
    onError: () => toast.error("فشل حفظ الإعدادات"),
  });

  // ── Rewards ──────────────────────────────────────────────────
  const { data: rewards = [] } = useQuery({
    queryKey: ["admin-mystery-rewards"],
    queryFn: async () => {
      const { data } = await supabase.from("mystery_case_rewards").select("*").order("display_order");
      return (data || []) as any[];
    },
  });

  const [editReward, setEditReward] = useState<any>(null);
  const [rf, setRf] = useState({
    name_ar: "", reward_type: "custom", rarity: "common", drop_chance: 10,
    image_url: "", product_id: "", ticket_reward_amount: 0, display_only: false, is_active: true,
    selected_color: "", product_option_id: "",
  });

  const resetForm = () => {
    setEditReward(null);
    setRf({ name_ar: "", reward_type: "custom", rarity: "common", drop_chance: 10, image_url: "", product_id: "", ticket_reward_amount: 0, display_only: false, is_active: true, selected_color: "", product_option_id: "" });
    setShowForm(false);
  };

  const openEdit = (r: any) => {
    setEditReward(r);
    const type = r.display_only ? "display" : r.reward_type;
    setRf({
      name_ar: r.name_ar, reward_type: type, rarity: r.rarity, drop_chance: Number(r.drop_chance),
      image_url: r.image_url || "", product_id: r.product_id || "", ticket_reward_amount: r.ticket_reward_amount || 0,
      display_only: r.display_only, is_active: r.is_active,
      selected_color: r.selected_color || "", product_option_id: r.product_option_id || "",
    });
    setShowForm(true);
  };

  const handleTypeChange = (type: string) => {
    if (type === "display") {
      setRf({ ...rf, reward_type: "custom", display_only: true, drop_chance: 0 });
    } else {
      setRf({ ...rf, reward_type: type, display_only: false });
    }
  };

  const handleProductSelect = (p: any) => {
    if (!p) {
      setRf({ ...rf, product_id: "", name_ar: rf.name_ar, image_url: rf.image_url, selected_color: "", product_option_id: "" });
      return;
    }
    setRf({ ...rf, product_id: p.id, name_ar: p.name_ar || p.name, image_url: p.image_url || rf.image_url, selected_color: "", product_option_id: "" });
  };

  const effectiveType = rf.display_only ? "display" : rf.reward_type;
  const totalChance = rewards.reduce((s: number, r: any) => s + Number(r.drop_chance), 0);
  const newTotal = editReward
    ? totalChance - Number(editReward.drop_chance) + rf.drop_chance
    : totalChance + rf.drop_chance;

  const saveReward = useMutation({
    mutationFn: async () => {
      // Validate probability
      if (newTotal > 100 && !rf.display_only) {
        throw new Error("إجمالي الاحتمالات يتجاوز 100%");
      }
      const payload: any = {
        name_ar: rf.name_ar,
        reward_type: rf.display_only ? "custom" : rf.reward_type,
        rarity: rf.rarity,
        drop_chance: rf.display_only ? 0 : rf.drop_chance,
        image_url: rf.image_url || null,
        product_id: rf.reward_type === "product" ? (rf.product_id || null) : null,
        ticket_reward_amount: rf.reward_type === "tickets" ? rf.ticket_reward_amount : 0,
        display_only: rf.display_only,
        is_active: rf.is_active,
        selected_color: rf.reward_type === "product" ? (rf.selected_color || null) : null,
        product_option_id: rf.reward_type === "product" ? (rf.product_option_id || null) : null,
        updated_at: new Date().toISOString(),
      };
      if (editReward) {
        const { error } = await supabase.from("mystery_case_rewards").update(payload).eq("id", editReward.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("mystery_case_rewards").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editReward ? "تم تعديل الجائزة" : "تم إضافة الجائزة");
      queryClient.invalidateQueries({ queryKey: ["admin-mystery-rewards"] });
      resetForm();
    },
    onError: (err: any) => toast.error(err?.message || "فشل حفظ الجائزة"),
  });

  const deleteReward = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("mystery_case_rewards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم حذف الجائزة"); queryClient.invalidateQueries({ queryKey: ["admin-mystery-rewards"] }); },
  });

  const duplicateReward = useMutation({
    mutationFn: async (r: any) => {
      const { id, created_at, updated_at, ...rest } = r;
      const { error } = await supabase.from("mystery_case_rewards").insert({ ...rest, name_ar: `${rest.name_ar} (نسخة)` });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم نسخ الجائزة"); queryClient.invalidateQueries({ queryKey: ["admin-mystery-rewards"] }); },
  });

  const toggleReward = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("mystery_case_rewards").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-mystery-rewards"] }),
  });

  if (settingsLoading) return <AdminLoading />;

  return (
    <div className="space-y-6">
      {/* ═══ GAME SETTINGS ═══ */}
      <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
        <button
          onClick={() => setSettingsOpen(!settingsOpen)}
          className="w-full flex items-center justify-between p-4 hover:bg-muted/5 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold">إعدادات اللعبة</h3>
            {sf.game_enabled ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-medium">مفعّلة</span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">معطّلة</span>
            )}
          </div>
          {settingsOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>

        <AnimatePresence>
          {settingsOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-4 border-t border-border/30 pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium flex items-center gap-1.5">
                      <Ticket className="h-3 w-3 text-primary" /> تذاكر لكل لفة
                    </label>
                    <Input type="number" min={1} value={sf.tickets_per_spin} onChange={(e) => setSf({ ...sf, tickets_per_spin: parseInt(e.target.value) || 1 })} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium flex items-center gap-1.5">
                      <Timer className="h-3 w-3 text-primary" /> فترة الانتظار (ثانية)
                    </label>
                    <Input type="number" min={0} value={sf.spin_cooldown_seconds} onChange={(e) => setSf({ ...sf, spin_cooldown_seconds: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium flex items-center gap-1.5">
                      <Gamepad2 className="h-3 w-3 text-primary" /> مدة الحركة (ms)
                    </label>
                    <Input type="number" min={2000} value={sf.animation_duration_ms} onChange={(e) => setSf({ ...sf, animation_duration_ms: parseInt(e.target.value) || 5000 })} />
                  </div>
                </div>

                <div className="flex flex-wrap gap-x-6 gap-y-3">
                  <div className="flex items-center gap-2">
                    <Switch checked={sf.game_enabled} onCheckedChange={(v) => setSf({ ...sf, game_enabled: v })} id="game-enabled" />
                    <label htmlFor="game-enabled" className="text-sm cursor-pointer">تفعيل اللعبة</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={sf.spin_sound_enabled} onCheckedChange={(v) => setSf({ ...sf, spin_sound_enabled: v })} id="sounds" />
                    <label htmlFor="sounds" className="text-sm cursor-pointer flex items-center gap-1"><Volume2 className="h-3 w-3" /> الأصوات</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={sf.daily_free_spin} onCheckedChange={(v) => setSf({ ...sf, daily_free_spin: v })} id="free-spin" />
                    <label htmlFor="free-spin" className="text-sm cursor-pointer">لفة مجانية يومية</label>
                  </div>
                </div>

                <Button onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending} size="sm" className="gap-1.5">
                  {saveSettings.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  حفظ الإعدادات
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══ PROBABILITY INDICATOR ═══ */}
      <ProbabilityIndicator total={totalChance} />

      {/* ═══ REWARDS MANAGEMENT ═══ */}
      <div className="rounded-xl border border-border/50 bg-card">
        <div className="flex items-center justify-between p-4 border-b border-border/30">
          <h3 className="text-sm font-bold flex items-center gap-2">🎁 الجوائز ({rewards.length})</h3>
          <Button
            onClick={() => { resetForm(); setShowForm(true); }}
            size="sm"
            className="gap-1.5"
          >
            <Plus className="h-3 w-3" /> إضافة جائزة
          </Button>
        </div>

        {/* ── Reward Form ── */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 border-b border-border/30 bg-muted/5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold">{editReward ? "✏️ تعديل جائزة" : "➕ جائزة جديدة"}</h4>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={resetForm}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>

                {/* Type Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-medium">نوع الجائزة</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {REWARD_TYPES.map((t) => {
                      const Icon = t.icon;
                      const isActive = effectiveType === t.value;
                      return (
                        <button
                          key={t.value}
                          onClick={() => handleTypeChange(t.value)}
                          className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all text-center ${
                            isActive ? "border-primary bg-primary/5" : "border-border/30 hover:border-border"
                          }`}
                        >
                          <Icon className={`h-5 w-5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                          <span className={`text-xs font-medium ${isActive ? "text-primary" : ""}`}>{t.label}</span>
                          <span className="text-[9px] text-muted-foreground leading-tight">{t.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Dynamic Fields */}
                <div className="space-y-3">
                  {/* Product Search (for product type) */}
                  {effectiveType === "product" && (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium">المنتج</label>
                        <ProductSearch selectedId={rf.product_id} onSelect={handleProductSelect} />
                      </div>
                      {rf.product_id && (
                        <ProductVariantSelector
                          productId={rf.product_id}
                          selectedColor={rf.selected_color}
                          selectedOptionId={rf.product_option_id}
                          onColorChange={(color) => setRf({ ...rf, selected_color: color })}
                          onOptionChange={(optionId, optionName, optionImage) => {
                            setRf({
                              ...rf,
                              product_option_id: optionId,
                              image_url: optionImage || rf.image_url,
                            });
                          }}
                        />
                      )}
                    </div>
                  )}

                  {/* Name (for non-product types) */}
                  {effectiveType !== "product" && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium">
                        {effectiveType === "tickets" ? "وصف المكافأة" : effectiveType === "display" ? "اسم العنصر" : "اسم الجائزة"}
                      </label>
                      <Input
                        value={rf.name_ar}
                        onChange={(e) => setRf({ ...rf, name_ar: e.target.value })}
                        placeholder={effectiveType === "tickets" ? "مثال: 10 تذاكر إضافية" : "اسم الجائزة"}
                      />
                    </div>
                  )}

                  {/* Ticket Amount */}
                  {effectiveType === "tickets" && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium">عدد التذاكر</label>
                      <Input
                        type="number"
                        min={1}
                        value={rf.ticket_reward_amount}
                        onChange={(e) => setRf({ ...rf, ticket_reward_amount: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  )}

                  {/* Image Upload (for custom and display types) */}
                  {(effectiveType === "custom" || effectiveType === "display") && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium">صورة الجائزة</label>
                      <ImageUploader imageUrl={rf.image_url} onImageChange={(url) => setRf({ ...rf, image_url: url })} />
                    </div>
                  )}

                  {/* Rarity */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">الندرة</label>
                    <RaritySelector value={rf.rarity} onChange={(v) => setRf({ ...rf, rarity: v })} />
                  </div>

                  {/* Drop Chance (not for display) */}
                  {effectiveType !== "display" && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium">نسبة السقوط %</label>
                      <div className="flex items-center gap-3">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={0.01}
                          value={rf.drop_chance}
                          onChange={(e) => setRf({ ...rf, drop_chance: parseFloat(e.target.value) || 0 })}
                          className="w-28"
                        />
                        {newTotal > 100 && !rf.display_only && (
                          <span className="text-xs text-destructive flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> يتجاوز 100%
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Active Toggle */}
                  {effectiveType !== "display" && (
                    <div className="flex items-center gap-2">
                      <Switch checked={rf.is_active} onCheckedChange={(v) => setRf({ ...rf, is_active: v })} />
                      <span className="text-sm">مفعّلة</span>
                    </div>
                  )}
                </div>

                {/* Save */}
                <div className="flex gap-2 pt-1">
                  <Button
                    onClick={() => saveReward.mutate()}
                    disabled={!rf.name_ar || saveReward.isPending || (newTotal > 100 && !rf.display_only)}
                    size="sm"
                    className="gap-1.5"
                  >
                    {saveReward.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                    {editReward ? "تحديث" : "إضافة"}
                  </Button>
                  <Button onClick={resetForm} variant="ghost" size="sm">إلغاء</Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Rewards Table ── */}
        {rewards.length > 0 ? (
          <div className="divide-y divide-border/30">
            {/* Table Header */}
            <div className="hidden sm:grid grid-cols-[3rem_1fr_6rem_5rem_5rem_4rem_5rem] gap-2 px-4 py-2 text-[10px] text-muted-foreground font-medium uppercase tracking-wider bg-muted/5">
              <span>صورة</span>
              <span>الجائزة</span>
              <span>النوع</span>
              <span>الندرة</span>
              <span>الاحتمال</span>
              <span>الحالة</span>
              <span className="text-left">إجراءات</span>
            </div>
            {rewards.map((r: any) => {
              const rarity = getRarity(r.rarity);
              const type = r.display_only ? getRewardType("display") : getRewardType(r.reward_type);
              const TypeIcon = type.icon;
              return (
                <div
                  key={r.id}
                  className={`flex sm:grid sm:grid-cols-[3rem_1fr_6rem_5rem_5rem_4rem_5rem] gap-2 items-center px-4 py-3 hover:bg-muted/5 transition-colors ${
                    !r.is_active ? "opacity-50" : ""
                  }`}
                >
                  {/* Image */}
                  <div className="shrink-0">
                    {r.image_url ? (
                      <img
                        src={r.image_url}
                        alt=""
                        className="w-10 h-10 rounded-lg object-contain border"
                        style={{ borderColor: `${rarity.color}44` }}
                      />
                    ) : (
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-sm border"
                        style={{ borderColor: `${rarity.color}44`, background: `${rarity.color}11` }}
                      >
                        🎁
                      </div>
                    )}
                  </div>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.name_ar}</p>
                    {r.reward_type === "tickets" && r.ticket_reward_amount > 0 && (
                      <p className="text-[10px] text-muted-foreground">+{r.ticket_reward_amount} تذكرة</p>
                    )}
                  </div>

                  {/* Type */}
                  <div className="hidden sm:flex items-center gap-1">
                    <TypeIcon className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{type.label}</span>
                  </div>

                  {/* Rarity */}
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                    style={{ background: `${rarity.color}18`, color: rarity.color }}
                  >
                    {rarity.label}
                  </span>

                  {/* Drop Chance */}
                  <span className="text-xs font-mono tabular-nums">{Number(r.drop_chance)}%</span>

                  {/* Status */}
                  <div className="hidden sm:block">
                    {r.display_only ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500">عرض</span>
                    ) : r.is_active ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500">مفعّلة</span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">معطّلة</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-0.5 mr-auto sm:mr-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)} title="تعديل">
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => duplicateReward.mutate(r)} title="نسخ">
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => toggleReward.mutate({ id: r.id, is_active: !r.is_active })}
                      title={r.is_active ? "تعطيل" : "تفعيل"}
                    >
                      <ToggleLeft className={`h-3 w-3 ${r.is_active ? "text-emerald-500" : "text-muted-foreground"}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => { if (confirm("حذف الجائزة؟")) deleteReward.mutate(r.id); }}
                      title="حذف"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center">
            <Sparkles className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">لم تتم إضافة جوائز بعد</p>
            <Button
              onClick={() => { resetForm(); setShowForm(true); }}
              variant="outline"
              size="sm"
              className="mt-3 gap-1.5"
            >
              <Plus className="h-3 w-3" /> إضافة أول جائزة
            </Button>
          </div>
        )}
      </div>

      {/* ═══ REEL PREVIEW ═══ */}
      <ReelPreview rewards={rewards} />
    </div>
  );
}
