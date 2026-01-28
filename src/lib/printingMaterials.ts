// Comprehensive printing materials data

export const FILAMENT_MATERIALS = [
  { value: "pla", label: "PLA" },
  { value: "petg", label: "PETG" },
  { value: "abs", label: "ABS" },
  { value: "asa", label: "ASA" },
  { value: "tpu", label: "TPU (مرن)" },
  { value: "nylon", label: "Nylon" },
  { value: "pc", label: "PC (بولي كاربونات)" },
  { value: "cf-pla", label: "PLA-CF (كربون)" },
  { value: "cf-petg", label: "PETG-CF (كربون)" },
  { value: "cf-nylon", label: "Nylon-CF (كربون)" },
  { value: "pla-silk", label: "PLA Silk" },
  { value: "pla-matte", label: "PLA Matte" },
  { value: "pla-wood", label: "PLA Wood" },
  { value: "pla-marble", label: "PLA Marble" },
  { value: "hips", label: "HIPS" },
  { value: "pva", label: "PVA (دعم قابل للذوبان)" },
];

export const RESIN_MATERIALS = [
  { value: "standard", label: "Standard Resin" },
  { value: "abs-like", label: "ABS-Like Resin" },
  { value: "tough", label: "Tough Resin" },
  { value: "flexible", label: "Flexible Resin" },
  { value: "water-washable", label: "Water Washable" },
  { value: "castable", label: "Castable Resin" },
  { value: "dental", label: "Dental Resin" },
  { value: "high-temp", label: "High Temp Resin" },
  { value: "clear", label: "Clear Resin" },
  { value: "grey", label: "Grey Resin" },
  { value: "white", label: "White Resin" },
  { value: "black", label: "Black Resin" },
  { value: "plant-based", label: "Plant-Based Resin" },
];

export const POPULAR_PRINTER_BRANDS = [
  { brand: "Bambu Lab", models: ["A1", "A1 Mini", "P1S", "P1P", "X1 Carbon", "X1E", "H2S"] },
  { brand: "Creality", models: ["Ender 3 V3 KE", "Ender 3 S1", "Ender 3 V2", "K1", "K1 Max", "CR-10 SE", "Halot Mage"] },
  { brand: "Prusa", models: ["MK4", "MK3S+", "Mini+", "XL", "SL1S"] },
  { brand: "Anycubic", models: ["Kobra 3", "Kobra 2 Pro", "Photon Mono M5s", "Photon Mono X6K", "Photon M3 Max"] },
  { brand: "Elegoo", models: ["Neptune 4 Pro", "Neptune 4 Plus", "Mars 5 Ultra", "Saturn 4 Ultra", "Jupiter SE"] },
  { brand: "Voron", models: ["V0.2", "V2.4", "Trident", "Switchwire"] },
  { brand: "Phrozen", models: ["Sonic Mini 8K", "Sonic Mega 8K", "Sonic Mighty 8K"] },
  { brand: "Formlabs", models: ["Form 3+", "Form 3L", "Form 4", "Fuse 1+"] },
  { brand: "FlashForge", models: ["Adventurer 5M", "Adventurer 5M Pro", "Creator 4"] },
  { brand: "Sovol", models: ["SV08", "SV07", "SV06 Plus"] },
];

export type MaterialType = "filament" | "resin";

export function getMaterialsByType(type: MaterialType) {
  return type === "filament" ? FILAMENT_MATERIALS : RESIN_MATERIALS;
}

export function getMaterialLabel(type: MaterialType, value: string): string {
  const materials = getMaterialsByType(type);
  return materials.find(m => m.value === value)?.label || value.toUpperCase();
}
