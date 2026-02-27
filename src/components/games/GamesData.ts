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

// ── Resource Interface (like Godot Resource class) ───────────

export interface GameResource {
  /** @export unique node name */
  node_name: string;

  /** @export display title (Arabic) */
  title: string;

  /** @export description text */
  description: string;

  /** @export emoji icon for the game */
  icon: string;

  /** @export AI-generated image path (optional) */
  image?: string;

  /** @export current status */
  status: GameStatus;

  /** @export game category for filtering */
  category: GameCategory;

  /** @export reward range string */
  reward: string;

  /** @export players count label */
  players: string;

  /** @export difficulty level */
  difficulty: Difficulty;

  /** @export_flags is this game popular? */
  popular: boolean;

  /** @export_flags is this game new? */
  is_new: boolean;
}

// ── Scene Tree: Game Nodes ───────────────────────────────────
// Each entry = one game "scene" in the arcade

export const GAME_NODES: GameResource[] = [
  {
    node_name: "rps",
    title: "حجرة ورقة مقص",
    description: "تحدى الكمبيوتر في 3 جولات واربح حتى 30 نقطة!",
    icon: "✊",
    image: gameRpsImage,
    status: GameStatus.LIVE,
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
    icon: "🎰",
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
    status: GameStatus.LIVE,
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
