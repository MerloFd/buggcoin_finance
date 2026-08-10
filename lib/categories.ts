// Category is a free string (user-typed or bank-provided), so there is no
// closed enum. Known labels map to an icon + color; unknown labels get a
// deterministic color from a fixed palette (same label -> same color, nothing
// persisted).

import {
  Car,
  Gamepad2,
  HeartPulse,
  House,
  ShoppingBag,
  Tag,
  Utensils,
  type LucideIcon,
} from "lucide-react";

interface CategoryStyle {
  icon: LucideIcon;
  color: string;
}

const KNOWN: Record<string, CategoryStyle> = {
  Alimentação: { icon: Utensils, color: "#C08A2E" },
  Transporte: { icon: Car, color: "#5B7DB1" },
  Compras: { icon: ShoppingBag, color: "#8A6BB1" },
  Moradia: { icon: House, color: "#4F7D63" },
  Saúde: { icon: HeartPulse, color: "#A84A2C" },
  Lazer: { icon: Gamepad2, color: "#3F9AA8" },
  Outros: { icon: Tag, color: "#6E7A72" },
};

// Fallback palette for unknown labels.
const PALETTE = [
  "#4F7D63",
  "#C08A2E",
  "#5B7DB1",
  "#8A6BB1",
  "#B15B8A",
  "#3F9AA8",
  "#A8763F",
  "#6E7A72",
];

export const KNOWN_CATEGORIES = Object.keys(KNOWN);

export const FALLBACK_CATEGORY = "Outros";

function hash(label: string): number {
  let h = 0;
  for (let i = 0; i < label.length; i++) {
    h = (h * 31 + label.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function getCategoryStyle(label: string | null): CategoryStyle {
  const key = label ?? FALLBACK_CATEGORY;
  if (KNOWN[key]) return KNOWN[key];
  return { icon: Tag, color: PALETTE[hash(key) % PALETTE.length] };
}
