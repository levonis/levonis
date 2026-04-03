import gameRpsImage from "@/assets/game-rps.png";

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║                    GAMES RESOURCE FILE                       ║
 * ║          Structured like Godot Engine .tres / .gd            ║
 * ║                                                              ║
 * ║  Each game is a "Resource" node with typed properties.       ║
 * ║  Add new games by appending to GAME_NODES array.             ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

// ── Enums (like Godot @export_enum) ──────────────────────────

export enum GameStatus {
  LIVE = "live",
  COMING_SOON = "coming_soon",
}

export enum GameCategory {
  ALL = "all",
  POPULAR = "popular",
  NEW = "new",
  STRATEGY = "strategy",
  LUCK = "luck",
}

export enum Difficulty {
  EASY = "easy",
  MEDIUM = "medium",
  HARD = "hard",
}

export interface GameResource {
  node_name: string;
  title: string;
  description: string;
  icon: string;
  image?: string;
  status: GameStatus;
  category: GameCategory;
  reward: string;
  players: string;
  difficulty: Difficulty;
  popular: boolean;
  is_new: boolean;
  /** Settings table key to check if game is enabled (e.g. "stack_game_settings") */
  settings_table?: string;
}

// ── Scene Tree: Game Nodes ───────────────────────────────────
// Each entry = one game "scene" in the arcade

export const GAME_NODES: GameResource[] = [
  {
    node_name: "mystery_case",
    title: "صندوق الغموض",
    description: "ألف الشريط واربح جوائز عشوائية ومكافآت مذهلة!",
    icon: "🎰",
    status: GameStatus.LIVE,
    category: GameCategory.LUCK,
    reward: "جوائز متنوعة",
    players: "1 لاعب",
    difficulty: Difficulty.EASY,
    popular: true,
    is_new: true,
  },
  {
    node_name: "space_blaster",
    title: "حرب الفضاء",
    description: "قُد سفينتك الفضائية ودمّر موجات الأعداء في 10 مراحل مثيرة!",
    icon: "🚀",
    status: GameStatus.LIVE,
    category: GameCategory.STRATEGY,
    reward: "+5 ~ +50",
    players: "1 لاعب",
    difficulty: Difficulty.MEDIUM,
    popular: true,
    is_new: true,
  },
  {
    node_name: "stack_tower",
    title: "البرج",
    description: "كدّس الطوابق فوق بعضها بدقة وابنِ أعلى برج!",
    icon: "🏙️",
    status: GameStatus.LIVE,
    category: GameCategory.STRATEGY,
    reward: "+1 ~ +100",
    players: "1 لاعب",
    difficulty: Difficulty.MEDIUM,
    popular: true,
    is_new: true,
    settings_table: "stack_game_settings",
  },
  {
    node_name: "knife_rain",
    title: "أمطار السكاكين",
    description: "ارمِ السكاكين على الهدف الدوّار! لا تصطدم بسكين أخرى وأكمل المراحل.",
    icon: "🔪",
    status: GameStatus.LIVE,
    category: GameCategory.STRATEGY,
    reward: "+1 ~ +50",
    players: "1 لاعب",
    difficulty: Difficulty.MEDIUM,
    popular: true,
    is_new: true,
    settings_table: "knife_rain_settings",
  },
  {
    node_name: "rps",
    title: "حجرة ورقة مقص",
    description: "تحدى الكمبيوتر في 3 جولات واربح حتى 30 نقطة!",
    icon: "✊",
    image: gameRpsImage,
    status: GameStatus.COMING_SOON,
    category: GameCategory.LUCK,
    reward: "+10 / -5",
    players: "1 لاعب",
    difficulty: Difficulty.EASY,
    popular: true,
    is_new: true,
  },
  {
    node_name: "quiz",
    title: "تحدي المعرفة",
    description: "أجب على أسئلة متنوعة واختبر معلوماتك العامة.",
    icon: "🧠",
    status: GameStatus.COMING_SOON,
    category: GameCategory.STRATEGY,
    reward: "+15 / -3",
    players: "1 لاعب",
    difficulty: Difficulty.MEDIUM,
    popular: false,
    is_new: false,
  },
  {
    node_name: "spin",
    title: "عجلة الحظ",
    description: "أدر العجلة واحصل على جوائز عشوائية ومفاجآت!",
    icon: "🎡",
    status: GameStatus.COMING_SOON,
    category: GameCategory.LUCK,
    reward: "0 ~ +50",
    players: "1 لاعب",
    difficulty: Difficulty.EASY,
    popular: false,
    is_new: false,
  },
  {
    node_name: "memory",
    title: "لعبة الذاكرة",
    description: "اكتشف الأزواج المتطابقة قبل نفاد الوقت.",
    icon: "🃏",
    status: GameStatus.COMING_SOON,
    category: GameCategory.STRATEGY,
    reward: "+20",
    players: "1 لاعب",
    difficulty: Difficulty.MEDIUM,
    popular: false,
    is_new: false,
  },
  {
    node_name: "bank",
    title: "بنك الاستثمار",
    description: "استثمر نقاطك واختر المدة... لكن احذر اللصوص!",
    icon: "🏦",
    status: GameStatus.COMING_SOON,
    category: GameCategory.LUCK,
    reward: "+1% ~ +500%",
    players: "1 لاعب",
    difficulty: Difficulty.MEDIUM,
    popular: true,
    is_new: true,
  },
  {
    node_name: "puzzle",
    title: "ألغاز يومية",
    description: "حل لغز جديد كل يوم واحصل على مكافآت حصرية.",
    icon: "🧩",
    status: GameStatus.COMING_SOON,
    category: GameCategory.STRATEGY,
    reward: "+30",
    players: "1 لاعب",
    difficulty: Difficulty.HARD,
    popular: false,
    is_new: false,
  },
];

// ── Filter Nodes (like Godot UI buttons config) ──────────────

export interface FilterNode {
  id: GameCategory;
  label: string;
  icon_name: "Filter" | "Flame" | "Clock" | "Star" | "Zap";
}

export const FILTER_NODES: FilterNode[] = [
  { id: GameCategory.ALL, label: "الكل", icon_name: "Filter" },
  { id: GameCategory.POPULAR, label: "الأكثر لعباً", icon_name: "Flame" },
  { id: GameCategory.NEW, label: "جديد", icon_name: "Clock" },
  { id: GameCategory.STRATEGY, label: "استراتيجية", icon_name: "Star" },
  { id: GameCategory.LUCK, label: "حظ", icon_name: "Zap" },
];

// ── Helper: filter games by category ─────────────────────────

export function filterGameNodes(
  nodes: GameResource[],
  category: GameCategory
): GameResource[] {
  if (category === GameCategory.ALL) return nodes;
  if (category === GameCategory.POPULAR) return nodes.filter((g) => g.popular);
  if (category === GameCategory.NEW) return nodes.filter((g) => g.is_new);
  return nodes.filter((g) => g.category === category);
}
