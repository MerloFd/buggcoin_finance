"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/components/nav-items";
import { cn } from "@/lib/utils";

// Mobile navigation. Hidden on desktop, where the Sidebar takes over.
// The primary action (Adicionar) lives in the floating Fab, not the bar.
export function BottomNav() {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((i) => !i.primary);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card lg:hidden">
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[56px] flex-col items-center justify-center gap-1 py-2 text-xs",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <span className="flex size-9 items-center justify-center rounded-md">
                  <Icon className="size-5" aria-hidden />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
