import {
  CalendarRange,
  Home,
  Plus,
  Repeat,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  primary?: boolean; // the highlighted primary action
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/recorrentes", label: "Recorrentes", icon: Repeat },
  { href: "/historico", label: "Histórico", icon: CalendarRange },
  { href: "/adicionar", label: "Adicionar", icon: Plus, primary: true },
];
