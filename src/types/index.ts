export type CardType =
  | "POKEMON"
  | "ONEPIECE"
  | "MTG"
  | "YUGIOH"
  | "DRAGONBALL"
  | "DIGIMON"
  | "WEISS"
  | "VANGUARD"
  | "LORCANA"
  | "SPORT"
  | "OTHER";

export interface CardTypeInfo {
  value: CardType;
  label: string;
  shortLabel: string;
  certPrefix: string;
  color: string; // hex
}

export const CARD_TYPES: Record<CardType, CardTypeInfo> = {
  POKEMON:    { value: "POKEMON",    label: "Pokémon TCG",           shortLabel: "Pokémon",     certPrefix: "PKM", color: "#FBBF24" },
  ONEPIECE:   { value: "ONEPIECE",   label: "One Piece Card Game",   shortLabel: "One Piece",   certPrefix: "OP",  color: "#F87171" },
  MTG:        { value: "MTG",        label: "Magic: The Gathering",  shortLabel: "MTG",         certPrefix: "MTG", color: "#A78BFA" },
  YUGIOH:     { value: "YUGIOH",     label: "Yu-Gi-Oh!",             shortLabel: "Yu-Gi-Oh!",   certPrefix: "YGO", color: "#818CF8" },
  DRAGONBALL: { value: "DRAGONBALL", label: "Dragon Ball Super TCG", shortLabel: "Dragon Ball", certPrefix: "DBS", color: "#FB923C" },
  DIGIMON:    { value: "DIGIMON",    label: "Digimon TCG",           shortLabel: "Digimon",     certPrefix: "DGM", color: "#60A5FA" },
  WEISS:      { value: "WEISS",      label: "Weiss Schwarz",         shortLabel: "Weiss",       certPrefix: "WS",  color: "#F472B6" },
  VANGUARD:   { value: "VANGUARD",   label: "Cardfight!! Vanguard",  shortLabel: "Vanguard",    certPrefix: "CFV", color: "#C084FC" },
  LORCANA:    { value: "LORCANA",    label: "Disney Lorcana",        shortLabel: "Lorcana",     certPrefix: "LRC", color: "#38BDF8" },
  SPORT:      { value: "SPORT",      label: "Sports Card",           shortLabel: "Sports",      certPrefix: "SPT", color: "#4ADE80" },
  OTHER:      { value: "OTHER",      label: "อื่นๆ / Other",         shortLabel: "Other",       certPrefix: "OTH", color: "#94A3B8" },
};

export const CARD_TYPE_SECTIONS: { label: string; types: CardType[] }[] = [
  { label: "Japanese TCG",  types: ["POKEMON", "ONEPIECE", "DRAGONBALL", "DIGIMON", "WEISS", "VANGUARD"] },
  { label: "Western TCG",   types: ["MTG", "YUGIOH", "LORCANA"] },
  { label: "Sports",        types: ["SPORT"] },
  { label: "อื่นๆ",         types: ["OTHER"] },
];

export function getCardTypeInfo(cardType: string): CardTypeInfo {
  return CARD_TYPES[cardType as CardType] ?? CARD_TYPES.OTHER;
}

export type GradeStatus = "PENDING" | "GRADING" | "COMPLETED";

export interface CardData {
  id: string;
  certNumber: string;
  cardName: string;
  cardSet: string;
  cardNumber: string;
  cardType: CardType;
  language: string;
  year?: string | null;
  rarity?: string | null;
  imageFront?: string | null;
  imageBack?: string | null;
  status: GradeStatus;
  grade?: GradeData | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GradeData {
  id: string;
  cardId: string;
  centering: number;
  corners: number;
  edges: number;
  surface: number;
  finalGrade: number;
  gradeName: string;
  aiNotes?: string | null;
  gradedAt: Date;
  gradedBy: string;
}

export const GRADE_SCALE = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];

export function getGradeName(grade: number): string {
  if (grade === 10) return "GEM MT 10";
  if (grade >= 9.5) return "MINT+ 9.5";
  if (grade >= 9) return "MINT 9";
  if (grade >= 8.5) return "NM-MT+ 8.5";
  if (grade >= 8) return "NM-MT 8";
  if (grade >= 7.5) return "NM+ 7.5";
  if (grade >= 7) return "NM 7";
  if (grade >= 6.5) return "EX-NM+ 6.5";
  if (grade >= 6) return "EX-NM 6";
  if (grade >= 5.5) return "EX+ 5.5";
  if (grade >= 5) return "EX 5";
  if (grade >= 4.5) return "VG-EX+ 4.5";
  if (grade >= 4) return "VG-EX 4";
  if (grade >= 3.5) return "VG+ 3.5";
  if (grade >= 3) return "VG 3";
  if (grade >= 2.5) return "GD+ 2.5";
  if (grade >= 2) return "GD 2";
  if (grade >= 1.5) return "FR 1.5";
  return "PR 1";
}

export function getGradeColor(grade: number): string {
  if (grade === 10) return "#FFD700";
  if (grade >= 9) return "#C0C0C0";
  if (grade >= 8) return "#CD7F32";
  if (grade >= 7) return "#4CAF50";
  if (grade >= 5) return "#2196F3";
  return "#9E9E9E";
}

export function calculateFinalGrade(centering: number, corners: number, edges: number, surface: number): number {
  const weighted = (centering * 0.2) + (corners * 0.3) + (edges * 0.2) + (surface * 0.3);
  const rounded = Math.round(weighted * 2) / 2;
  return Math.min(10, Math.max(1, rounded));
}
