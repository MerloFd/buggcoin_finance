"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";

// Floating "add" action (mobile only). Sits above the bottom nav, hidden on the
// Adicionar screen itself. Desktop uses the sidebar item instead.
export function Fab() {
  const pathname = usePathname();
  if (pathname === "/adicionar") return null;

  return (
    <Link
      href="/adicionar"
      aria-label="Adicionar"
      className="fixed bottom-20 right-4 z-30 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg lg:hidden"
    >
      <Plus className="size-7" aria-hidden />
    </Link>
  );
}
